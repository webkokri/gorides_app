import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { goBack } from '../lib/nav';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RideMap } from '../components/scenes/Maps';
import { Icon, IconName } from '../components/Icon';
import { Avatar, Btn, Card, IconBtn, Row, T, Tag } from '../components/ui';
import { fmtLong, money, t12 } from '../lib/format';
import { useAuth } from '../auth';
import { ApiRide, rides } from '../lib/api';
import { useRequireAuth } from '../lib/useRequireAuth';
import { seatShare, toRide } from '../lib/rideMap';
import { useStore } from '../store';
import { C } from '../theme';

export default function RideDetails() {
  const { s, set, toast } = useStore();
  const { user } = useAuth();
  const needLogin = useRequireAuth();
  const insets = useSafeAreaInsets();
  const base = s.ride;
  const [rated, setRated] = useState<{ rating: number; rev: number } | null>(null);
  const [detail, setDetail] = useState<ApiRide | null>(null);
  const rideId = base?.rideId;
  useEffect(() => {
    // the search list has no driver rating; the single-ride endpoint does
    if (rideId)
      rides
        .get(rideId)
        .then((d) => {
          setRated({ rating: d.driver_rating ?? 0, rev: d.driver_rating_count ?? 0 });
          setDetail(d);
        })
        .catch(() => {});
  }, [rideId]);
  const r = base && rated ? { ...base, ...rated } : base;
  if (!r) return <Redirect href="/home" />;
  const isMine = r.driverId !== undefined && r.driverId === user?.id;
  const local = s.mode === 'local';
  const stops: { time: string; place: string; sub: string; stop?: boolean }[] = [
    { time: t12(r.dep), place: r.from, sub: r.fromS },
    ...(r.stop ? [{ time: '', place: r.stop, sub: 'Stopover', stop: true }] : []),
    { time: t12(r.arr), place: r.to, sub: r.toS },
  ];
  // Return trip. City to city: the linked return ride's own dates, each bookable on its own or with this trip.
  // Local commute: the time the driver heads back each day (stored on the drop stop; 00:00 means none).
  const returnInstances = (detail?.return_ride?.instances ?? []).filter((i) => !i.status || i.status === 'scheduled');
  const localReturn = (detail?.pickup_schedules ?? []).find((p) => p.location_type === 'drop' && p.pickup_time && p.pickup_time.slice(0, 5) !== '00:00');
  const bookReturnOnly = async (instId: number) => {
    if (!detail?.return_ride) return;
    try {
      const full = await rides.get(detail.return_ride.id);
      const inst = full.instances?.find((i) => i.id === instId) ?? detail.return_ride.instances.find((i) => i.id === instId);
      if (!inst) return;
      set({ ride: toRide(full, inst) });
      router.push(user ? '/book' : { pathname: '/signin', params: { mode: 'in' } });
    } catch {
      toast('Could not open the return trip');
    }
  };
  const returnCard =
    !local && returnInstances.length ? (
      <Card style={styles.blk}>
        <T w="bold" style={styles.h4}>
          Return trip
        </T>
        <T size={13} color={C.muted}>
          This driver also drives back. Book one way, the return only, or both from the next screen.
        </T>
        {returnInstances.slice(0, 6).map((i) => (
          <Row key={i.id} style={{ justifyContent: 'space-between', paddingVertical: 8 }}>
            <View style={{ flex: 1 }}>
              <T w="bold" size={14}>
                {fmtLong(new Date(`${String(i.departure_date).slice(0, 10)}T00:00:00`))}
              </T>
              <T size={12} color={C.muted}>
                {t12(String(i.departure_time ?? '').slice(0, 5))} · {i.available_seats ?? 0} seats left
              </T>
            </View>
            {isMine ? null : <Btn label="Book return only" kind="out" small disabled={!i.available_seats} onPress={() => bookReturnOnly(i.id)} style={{ width: undefined, paddingHorizontal: 14 }} />}
          </Row>
        ))}
        <T size={12} color={C.muted}>
          A return seat is charged when you book it and is not refundable.
        </T>
      </Card>
    ) : local && localReturn ? (
      <Card style={styles.blk}>
        <T w="bold" style={styles.h4}>
          Return trip
        </T>
        <Row style={{ gap: 10 }}>
          <Icon name="clock" color={C.oDeep} />
          <T size={14} style={{ flex: 1 }}>
            The driver heads back at {t12(String(localReturn.pickup_time).slice(0, 5))} on the same days. The return is included in the commute price.
          </T>
        </Row>
      </Card>
    ) : null;
  const prefs: [IconName, string][] = [
    [r.pets ? 'paw' : 'x', r.pets ? 'Pets welcome' : 'No pets'],
    ...(r.tags.map((t) => ['check', t]) as [IconName, string][]),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View>
          <RideMap local={local} height={230 + insets.top} />
          <View style={[styles.mapBtns, { top: insets.top + 8 }]}>
            <IconBtn name="back" onPress={goBack} label="Back" />
            <IconBtn name="share" onPress={() => toast('Trip link copied')} label="Share" />
          </View>
        </View>
        <Card style={styles.main}>
          <T w="bold" size={13} color={C.oDeep} style={{ letterSpacing: 1 }}>
            {(r.day ? fmtLong(new Date(`${r.day}T00:00:00`)) : '').toUpperCase()}
          </T>
          <View style={{ marginTop: 14 }}>
            {stops.map((st, i) => (
              <View key={i} style={styles.st}>
                <View style={{ width: 70 }}>
                  <T w="xbold">{st.time}</T>
                  {i === 0 ? (
                    <T w="semi" size={11} color={C.muted}>
                      {r.dur}
                    </T>
                  ) : null}
                </View>
                <View style={styles.rail}>
                  <View style={[styles.node, st.stop && styles.nodeSm, i === stops.length - 1 && { backgroundColor: C.ink }]} />
                  {i < stops.length - 1 ? <View style={styles.bar} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: 18 }}>
                  <T w={st.stop ? 'semi' : 'bold'} size={st.stop ? 14 : 15} color={st.stop ? C.ink2 : C.ink}>
                    {st.place}
                  </T>
                  <T size={12} color={C.muted}>
                    {st.sub}
                  </T>
                </View>
              </View>
            ))}
          </View>
          <Row style={styles.price}>
            <View style={{ flex: 1, gap: 6 }}>
              <T size={13} color={C.muted}>
                Price per seat
              </T>
              <Tag label={`${r.seats} of ${r.of} seats left`} icon="users" tone="g" />
            </View>
            <T w="xbold" size={24}>
              {money(seatShare(r, 1).now)}
            </T>
          </Row>
        </Card>

        {returnCard}

        <Card style={styles.blk} onPress={r.driverId ? () => router.push({ pathname: '/user', params: { id: String(r.driverId), name: r.driver, rideId: String(r.rideId ?? '') } }) : undefined}>
          <Row>
            <Avatar name={r.driver} size={56} uri={r.avatar} verified={!!r.verified} />
            <View style={{ flex: 1 }}>
              <T w="bold" size={16}>
                {r.driver}
              </T>
              <Row style={{ gap: 4 }}>
                <Icon name="star" size={14} color={C.star} fill />
                <T size={13} color={C.muted}>
                  {r.rev ? `${r.rating.toFixed(1)} · ${r.rev} review${r.rev > 1 ? 's' : ''}` : 'New driver'}
                </T>
              </Row>
              <T w="bold" size={12} color={C.oDeep}>
                View profile and reviews
              </T>
            </View>
          </Row>
          <View style={{ gap: 10, marginTop: 14 }}>
            {(
              [
                ['bolt', r.instant ? 'Instant booking: your seat is confirmed right away' : 'Driver approves each request, usually within 2 hours'],
              ] as [IconName, string][]
            ).map(([ic, t]) => (
              <Row key={t} style={{ gap: 10 }}>
                <Icon name={ic} color={C.good} />
                <T size={14} style={{ flex: 1 }}>
                  {t}
                </T>
              </Row>
            ))}
          </View>
        </Card>

        <Card style={styles.blk}>
          <T w="bold" style={styles.h4}>
            Car
          </T>
          <Row>
            <View style={styles.carIc}>
              <Icon name="car" color={C.oDeep} />
            </View>
            <View>
              <T w="bold">{r.car}</T>
              <T size={12} color={C.muted}>
                Licence plate shown after booking
              </T>
            </View>
          </Row>
        </Card>

        <Card style={styles.blk}>
          <T w="bold" style={styles.h4}>
            Ride preferences
          </T>
          <View style={styles.prefs}>
            {prefs.map(([ic, t]) => (
              <Row key={t} style={{ width: '48%', gap: 8 }}>
                <Icon name={ic} size={18} color={C.oDeep} />
                <T w="semi" size={13} color={C.ink2}>
                  {t}
                </T>
              </Row>
            ))}
          </View>
        </Card>

        <View style={{ padding: 16 }}>
          {local && r.rideId ? <Btn label="Subscribe to this commute" kind="sec" small style={{ marginBottom: 10 }} onPress={() => router.push({ pathname: '/subscriptions', params: { rideId: String(r.rideId) } })} /> : null}
          <Btn label="Report this ride" kind="out" small onPress={needLogin(() => router.push('/chat'))} />
        </View>
      </ScrollView>
      {isMine ? (
        <View style={[styles.sticky, { paddingBottom: insets.bottom + 14 }]}>
          <View style={{ flex: 1 }}>
            <T w="bold" size={14}>
              This is your own ride
            </T>
            <T size={12} color={C.muted}>
              You can&apos;t book a ride you published. Manage it under My rides.
            </T>
          </View>
          <Btn label="My rides" kind="sec" small onPress={() => router.replace('/my-rides')} style={{ width: undefined, paddingHorizontal: 16 }} />
        </View>
      ) : (
        <View style={[styles.sticky, { paddingBottom: insets.bottom + 14 }]}>
          <View>
            <T size={12} color={C.muted}>
              {s.seats > 1 ? `${s.seats} seats` : 'Your seat'} · before fees
            </T>
            <T w="xbold" size={22}>
              {money(seatShare(r, s.seats).now)}
            </T>
          </View>
          <Btn label={r.instant ? 'Book now' : 'Request to book'} onPress={() => (user ? router.push('/book') : router.push({ pathname: '/signin', params: { mode: 'in' } }))} style={{ flex: 1, width: undefined }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapBtns: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  main: { marginTop: -26, marginHorizontal: 16, padding: 18 },
  st: { flexDirection: 'row', gap: 10 },
  rail: { width: 18, alignItems: 'center' },
  node: { width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: C.ink, backgroundColor: C.card, marginTop: 3, zIndex: 1 },
  nodeSm: { width: 10, height: 10, borderWidth: 2, marginTop: 5 },
  bar: { position: 'absolute', top: 14, bottom: -4, width: 3, backgroundColor: C.ink, borderRadius: 2 },
  price: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14, marginTop: 4 },
  blk: { marginHorizontal: 16, marginTop: 14, padding: 16 },
  h4: { marginBottom: 12 },
  carIc: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.oSoft, alignItems: 'center', justifyContent: 'center' },
  prefs: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, justifyContent: 'space-between' },
  sticky: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line },
});
