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
import { rides } from '../lib/api';
import { seatShare } from '../lib/rideMap';
import { useStore } from '../store';
import { C } from '../theme';

export default function RideDetails() {
  const { s, toast } = useStore();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const base = s.ride;
  const [rated, setRated] = useState<{ rating: number; rev: number } | null>(null);
  const rideId = base?.rideId;
  useEffect(() => {
    // the search list has no driver rating; the single-ride endpoint does
    if (rideId) rides.get(rideId).then((d) => setRated({ rating: d.driver_rating ?? 0, rev: d.driver_rating_count ?? 0 })).catch(() => {});
  }, [rideId]);
  const r = base && rated ? { ...base, ...rated } : base;
  if (!r) return <Redirect href="/home" />;
  const local = s.mode === 'local';
  const stops: { time: string; place: string; sub: string; stop?: boolean }[] = [
    { time: t12(r.dep), place: r.from, sub: r.fromS },
    ...(r.stop ? [{ time: '', place: r.stop, sub: 'Stopover', stop: true }] : []),
    { time: t12(r.arr), place: r.to, sub: r.toS },
  ];
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
              {money(r.price)}
            </T>
          </Row>
        </Card>

        <Card style={styles.blk}>
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
          <Btn label="Report this ride" kind="out" small onPress={() => router.push('/chat')} />
        </View>
      </ScrollView>
      <View style={[styles.sticky, { paddingBottom: insets.bottom + 14 }]}>
        <View>
          <T size={12} color={C.muted}>
            {s.seats} seat{s.seats > 1 ? 's' : ''}
          </T>
          <T w="xbold" size={22}>
            {money(seatShare(r, s.seats).now)}
          </T>
        </View>
        <Btn label={r.instant ? 'Book now' : 'Request to book'} onPress={() => (user ? router.push('/book') : router.push({ pathname: '/signin', params: { mode: 'in' } }))} style={{ flex: 1, width: undefined }} />
      </View>
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
