import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { goBack } from '../lib/nav';
import { StatusBar } from 'expo-status-bar';
import { RideCard } from '../components/RideCard';
import { Icon } from '../components/Icon';
import { Btn, Card, Chip, IconBtn, Row, Screen, Seg, Sheet, T, Toggle } from '../components/ui';
import { Ride } from '../data';
import { rides as ridesApi } from '../lib/api';
import { geocode } from '../lib/geo';
import { awayLabel, getHere, Here, kmBetween } from '../lib/here';
import { useOpenRide } from '../lib/useOpenRide';
import { toRides } from '../lib/rideMap';
import { addDays, city, dayShort, fmtDay, isoDate, sameDay, today } from '../lib/format';
import { paxLabel, useStore } from '../store';
import { C } from '../theme';

type Filter = 'instant' | 'rated' | 'pets';

type Tab = 'local' | 'long';
type Found = { key: string; local: Ride[]; long: Ride[]; error: string };

export default function Results() {
  const { s, set } = useStore();
  const { open, isOwn } = useOpenRide();
  const [tab, setTab] = useState<Tab>('local');
  const [sort, setSort] = useState<'near' | 'early' | 'cheap'>('near');
  const [filters, setFilters] = useState<Set<Filter>>(new Set());
  const [sheet, setSheet] = useState(false);

  const [nonce, setNonce] = useState(0);
  const [res, setRes] = useState<Found>({ key: '', local: [], long: [], error: '' });
  const d = isoDate(s.date);
  const key = `${d}|${nonce}`;
  const loading = res.key !== key;
  const error = loading ? '' : res.error;

  // The API searches by coordinates, so typed labels are geocoded first (cached). Both kinds of ride are searched at once.
  useEffect(() => {
    let live = true;
    (async () => {
      const a = s.fromPlace ?? (s.from ? await geocode(s.from) : null);
      const b = s.toPlace ?? (s.to ? await geocode(s.to) : null);
      const origin: Here | null = a ?? (await getHere());
      const base = { start_lat: origin?.latitude, start_lng: origin?.longitude, end_lat: b?.latitude, end_lng: b?.longitude, min_seats_available: s.pax };
      const [loc, lng] = await Promise.all([
        // local commutes run for a month from their start date, so they only need a start
        ridesApi.search({ ...base, radius_km: 20, ride_type: 'local', date_from: d }),
        // long routes: every trip from the chosen day onwards, so rides on other days can be offered when the chosen day has none
        ridesApi.search({ ...base, radius_km: 30, ride_type: 'intercity', date_from: d }),
      ]);
      // the chosen day's trips, then each ride's next trip on a later day
      const longAll = toRides(lng, false);
      const seenRide = new Set<number | undefined>();
      const longCards = [...longAll.filter((r) => r.day === d), ...longAll.filter((r) => r.day !== d && !seenRide.has(r.rideId) && (seenRide.add(r.rideId), true))];
      const near = (rs: Ride[]) =>
        rs.map((r) => {
          if (!origin || r.lat === undefined || r.lng === undefined) return r;
          const km = kmBetween(origin, { latitude: r.lat, longitude: r.lng });
          return { ...r, away: awayLabel(km), awayKm: km };
        });
      if (live) setRes({ key, local: near(toRides(loc, true)), long: near(longCards), error: '' });
    })().catch((e) => live && setRes({ key, local: [], long: [], error: e instanceof Error ? e.message : 'Could not load rides' }));
    return () => {
      live = false;
    };
  }, [key, d, s.from, s.to, s.fromPlace, s.toPlace, s.pax]);

  const all = tab === 'local' ? res.local : res.long;
  const rides = useMemo(() => {
    let rs = all;
    if (filters.has('instant')) rs = rs.filter((r) => r.instant);
    if (filters.has('rated')) rs = rs.filter((r) => r.rating >= 4.8);
    if (filters.has('pets')) rs = rs.filter((r) => r.pets);
    const km = (r: Ride) => r.awayKm ?? Infinity;
    // trips on the chosen day come first, then trips on later days, soonest day first
    const dayRank = (r: Ride) => (r.day === d ? '' : r.day ?? '9');
    const inDay = sort === 'cheap' ? (a: Ride, b: Ride) => a.price - b.price : sort === 'near' ? (a: Ride, b: Ride) => km(a) - km(b) || a.dep.localeCompare(b.dep) : (a: Ride, b: Ride) => a.dep.localeCompare(b.dep);
    return [...rs].sort((a, b) => dayRank(a).localeCompare(dayRank(b)) || inDay(a, b));
  }, [all, filters, sort, d]);

  const toggle = (f: Filter) =>
    setFilters((prev) => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });

  const route = `${s.from ? city(s.from) : 'Near you'} → ${s.to ? city(s.to) : 'Anywhere'}`;
  const meta = `${fmtDay(s.date)} · ${paxLabel(s)}`;

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
        {(
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
        )}
        <Seg<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { v: 'local', label: `Local Rides${loading ? '' : ` (${res.local.length})`}`, icon: 'pin' },
            { v: 'long', label: `Long Routes${loading ? '' : ` (${res.long.length})`}`, icon: 'route' },
          ]}
          style={{ marginTop: 12 }}
        />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 16, paddingBottom: 4 }}>
          <Chip label="Nearest" icon="pin" on={sort === 'near'} onPress={() => setSort('near')} />
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
            rides.map((r, i) => (
              <React.Fragment key={r.id}>
                {r.day !== d && (i === 0 || rides[i - 1].day === d) ? (
                  <T w="bold" size={13} color={C.muted} style={{ marginTop: i === 0 ? 0 : 8, letterSpacing: 0.6 }}>
                    {i === 0 ? `NOTHING ON ${fmtDay(s.date).toUpperCase()}. OTHER DAYS` : 'OTHER DAYS'}
                  </T>
                ) : null}
                <RideCard ride={r} local={tab === 'local'} isOwn={isOwn(r)} showDate={r.day !== d} onPress={() => open(r)} />
              </React.Fragment>
            ))
          ) : (
            <Card style={{ padding: 24, alignItems: 'center', gap: 8 }}>
              <T w="bold">{all.length ? 'No rides match these filters' : tab === 'local' ? 'No local rides found' : 'No long routes found'}</T>
              <T size={14} color={C.muted}>
                {all.length ? 'Try removing a filter or picking another day.' : (tab === 'local' ? res.long.length : res.local.length) ? `Try the ${tab === 'local' ? 'Long Routes' : 'Local Rides'} tab, or pick another day.` : 'Try another day or a wider area.'}
              </T>
              {all.length ? <Btn label="Clear filters" kind="sec" small onPress={() => setFilters(new Set())} /> : null}
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
