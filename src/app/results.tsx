import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { goBack } from '../lib/nav';
import { useAuth } from '../auth';
import { StatusBar } from 'expo-status-bar';
import { RideCard } from '../components/RideCard';
import { Icon } from '../components/Icon';
import { Btn, Card, Chip, IconBtn, Row, Screen, Sheet, T, Toggle } from '../components/ui';
import { Ride } from '../data';
import { rides as ridesApi } from '../lib/api';
import { geocode } from '../lib/geo';
import { toRides } from '../lib/rideMap';
import { addDays, city, dayShort, fmtDay, isoDate, sameDay, today } from '../lib/format';
import { paxLabel, useStore } from '../store';
import { C } from '../theme';

type Filter = 'instant' | 'rated' | 'pets';

export default function Results() {
  const { s, set, toast } = useStore();
  const { user } = useAuth();
  const local = s.mode === 'local';
  const [sort, setSort] = useState<'early' | 'cheap'>('early');
  const [filters, setFilters] = useState<Set<Filter>>(new Set());
  const [sheet, setSheet] = useState(false);

  const [nonce, setNonce] = useState(0);
  const [res, setRes] = useState<{ key: string; rides: Ride[]; error: string }>({ key: '', rides: [], error: '' });
  const d = isoDate(local ? s.localDate : s.date);
  const key = `${local}|${d}|${nonce}`;
  const loading = res.key !== key;
  const all = res.rides;
  const error = loading ? '' : res.error;

  // The API searches by coordinates, so typed labels are geocoded first (cached).
  const fromLabel = local ? s.localFrom : s.from;
  const toLabel = local ? s.localTo : s.to;
  const fromPlace = local ? s.localFromPlace : s.fromPlace;
  const toPlace = local ? s.localToPlace : s.toPlace;
  useEffect(() => {
    let live = true;
    (async () => {
      const a = fromPlace ?? (await geocode(fromLabel.replace('', '')));
      const b = toPlace ?? (toLabel ? await geocode(toLabel) : null);
      const rs = await ridesApi.search({
        ride_type: local ? 'local' : 'intercity',
        date_from: d,
        date_to: local ? undefined : d, // local commutes run for a month from their start date
        start_lat: a?.latitude,
        start_lng: a?.longitude,
        end_lat: b?.latitude,
        end_lng: b?.longitude,
        min_seats_available: s.pax,
        radius_km: 20,
      });
      if (live) setRes({ key, rides: toRides(rs, local), error: '' });
    })().catch((e) => live && setRes({ key, rides: [], error: e instanceof Error ? e.message : 'Could not load rides' }));
    return () => {
      live = false;
    };
  }, [key, local, d, fromLabel, toLabel, fromPlace, toPlace, s.pax]);

  const rides = useMemo(() => {
    let rs = all;
    if (filters.has('instant')) rs = rs.filter((r) => r.instant);
    if (filters.has('rated')) rs = rs.filter((r) => r.rating >= 4.8);
    if (filters.has('pets')) rs = rs.filter((r) => r.pets);
    if (sort === 'cheap') rs = [...rs].sort((a, b) => a.price - b.price);
    return rs;
  }, [all, filters, sort]);

  const toggle = (f: Filter) =>
    setFilters((prev) => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });

  const route = local ? `${s.localFrom.replace('', '') || 'Pickup'} → ${s.localTo ?? 'Drop point'}` : `${city(s.from)} → ${city(s.to)}`;
  const meta = local ? `${fmtDay(s.localDate)} · ${s.localTrips} round trips / month · ${paxLabel(s)}` : `${fmtDay(s.date)} · ${paxLabel(s)}`;

  return (
    <Screen bg={C.bg}>
      <StatusBar style="dark" />
      <View style={styles.head}>
        <Row style={{ gap: 10 }}>
          <IconBtn name="back" onPress={goBack} label="Back" />
          <Pressable style={styles.box} onPress={goBack}>
            <T w="bold" numberOfLines={1}>
              {route}
            </T>
            <T size={12} color={C.muted}>
              {meta}
            </T>
          </Pressable>
          <IconBtn name="filter" onPress={() => setSheet(true)} label="Filters" />
        </Row>
        {!local ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 12 }}>
            {Array.from({ length: 10 }, (_, i) => addDays(today(), i)).map((d, i) => {
              const on = sameDay(d, s.date);
              return (
                <Pressable key={i} onPress={() => set({ date: d })} style={[styles.day, on && { backgroundColor: C.ink, borderColor: C.ink }]}>
                  <T w="semi" size={11} color={on ? '#CFCBD3' : C.muted}>
                    {i === 0 ? 'Today' : dayShort(d)}
                  </T>
                  <T w="xbold" color={on ? '#fff' : C.ink}>
                    {d.getDate()}
                  </T>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 16, paddingBottom: 4 }}>
          <Chip label="Earliest" icon="clock" on={sort === 'early'} onPress={() => setSort('early')} />
          <Chip label="Lowest price" on={sort === 'cheap'} onPress={() => setSort('cheap')} />
          <Chip label="Instant booking" icon="bolt" on={filters.has('instant')} onPress={() => toggle('instant')} />
          <Chip label="4.8+" icon="star" on={filters.has('rated')} onPress={() => toggle('rated')} />
          <Chip label="Pets OK" icon="paw" on={filters.has('pets')} onPress={() => toggle('pets')} />
        </ScrollView>
        <T w="semi" size={13} color={C.muted} style={{ marginHorizontal: 20, marginTop: 12, marginBottom: 8 }}>
          {rides.length ? `${rides.filter((r) => r.seats > 0).length} rides available` : ''}
        </T>
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {loading ? (
            <ActivityIndicator color={C.o} style={{ marginTop: 32 }} />
          ) : error ? (
            <Card style={{ padding: 24, alignItems: 'center', gap: 8 }}>
              <T w="bold">Could not load rides</T>
              <T size={14} color={C.muted}>
                {error}
              </T>
              <Btn label="Retry" kind="sec" small onPress={() => setNonce((n) => n + 1)} />
            </Card>
          ) : rides.length ? (
            rides.map((r) => (
              <RideCard
                key={r.id}
                ride={r}
                local={local}
                isOwn={r.driverId !== undefined && r.driverId === user?.id}
                onPress={() => {
                  if (r.driverId !== undefined && r.driverId === user?.id) return toast("This is your own ride. You can't book it from a passenger account. Manage it under My rides.");
                  if (!r.seats) return toast('This ride is full');
                  set({ ride: r, seats: Math.min(s.pax, r.seats) });
                  router.push('/ride');
                }}
              />
            ))
          ) : (
            <Card style={{ padding: 24, alignItems: 'center', gap: 8 }}>
              <T w="bold">No rides match these filters</T>
              <T size={14} color={C.muted}>
                Try removing a filter or picking another day.
              </T>
              <Btn label="Clear filters" kind="sec" small onPress={() => setFilters(new Set())} />
            </Card>
          )}
        </View>
      </ScrollView>

      <Sheet visible={sheet} title="Filters" onClose={() => setSheet(false)}>
        <Card style={{ paddingHorizontal: 14 }}>
          {(
            [
              ['instant', 'bolt', 'Instant booking', 'Seat confirmed right away'],
              ['rated', 'star', 'Top rated drivers', '4.8 stars and up'],
              ['pets', 'paw', 'Pets allowed', 'Small pets in a carrier'],
            ] as [Filter, string, string, string][]
          ).map(([k, ic, t, sub], i) => (
            <Row key={k} style={[{ paddingVertical: 14 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
              <Icon name={ic} color={C.oDeep} />
              <View style={{ flex: 1 }}>
                <T w="bold" size={14}>
                  {t}
                </T>
                <T size={12} color={C.muted}>
                  {sub}
                </T>
              </View>
              <Toggle value={filters.has(k)} onChange={() => toggle(k)} />
            </Row>
          ))}
        </Card>
        <Btn label="Show rides" onPress={() => setSheet(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.line },
  box: { flex: 1, backgroundColor: C.chip, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  day: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: C.line, alignItems: 'center', minWidth: 62 },
});
