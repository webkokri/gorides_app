import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeroMap } from '../components/scenes/Maps';
import { DateSheet, PaxSheet, PlaceSheet } from '../components/Pickers';
import { TabBar, TAB_SPACE } from '../components/TabBar';
import { Icon, IconName } from '../components/Icon';
import { Logo } from '../components/Logo';
import { Btn, Card, IconBtn, Section, Seg, T } from '../components/ui';
import { bookings, rides as ridesApi } from '../lib/api';
import { getItem, setItem } from '../lib/storage';
import { city, fmtDay, isoDate } from '../lib/format';
import { useAuth } from '../auth';
import { DriverTripCard } from '../components/DriverTripCard';
import { PassengerTripCard } from '../components/PassengerTripCard';
import { InfoCarousel } from '../components/InfoCarousel';
import { MadeInCanada } from '../components/MadeInCanada';
import { useRequireAuth } from '../lib/useRequireAuth';
import { Mode, paxLabel, useStore } from '../store';
import { C, shadow } from '../theme';

type Picker = null | 'localFrom' | 'localTo' | 'localDate' | 'trips' | 'from' | 'to' | 'date' | 'pax';

export default function Home() {
  const insets = useSafeAreaInsets();
  const { s, set, toast } = useStore();
  const [picker, setPicker] = useState<Picker>(null);
  const [focused, setFocused] = useState(true);
  const [spun, setSpun] = useState(false);
  useFocusEffect(
    React.useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const { user } = useAuth();
  const needLogin = useRequireAuth();

  // Popular routes come from the rides currently published (grouped by route, cheapest price, number of rides)
  const [live, setLive] = useState<Awaited<ReturnType<typeof ridesApi.search>>>([]);
  const [upcoming, setUpcoming] = useState<number | null>(null);
  const [recent, setRecent] = useState<{ from: string; to: string; pax: number }[]>([]);
  useEffect(() => {
    ridesApi.search({ ride_type: 'intercity' }).then(setLive).catch(() => {});
    getItem('gorides.recent').then((v) => v && setRecent(JSON.parse(v))).catch(() => {});
  }, []);
  useFocusEffect(
    React.useCallback(() => {
      if (!user) return;
      bookings
        .mine('passenger')
        .then((b) => setUpcoming(b.filter((x) => x.status === 'pending' || x.status === 'confirmed').length))
        .catch(() => {});
    }, [user]),
  );
  const popular = useMemo(() => {
    const m = new Map<string, { from: string; to: string; price: number; count: number }>();
    for (const r of live) {
      // titles read "Toronto to Ottawa Carpool"; the location names can be street addresses, so prefer the cities
      const t = /^(.+?) to (.+?)(?: Carpool)?$/i.exec(r.title ?? '');
      const from = t?.[1] ?? r.start_location_name;
      const to = t?.[2] ?? r.end_location_name;
      if (!from || !to) continue;
      const k = `${from}|${to}`;
      const e = m.get(k) ?? { from, to, price: Infinity, count: 0 };
      e.price = Math.min(e.price, Number(r.price_per_seat));
      e.count += r.instances?.length ?? 1;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [live]);
  const remember = (from: string, to: string) => {
    const next = [{ from, to, pax: s.pax }, ...recent.filter((r) => !(r.from === from && r.to === to))].slice(0, 5);
    setRecent(next);
    setItem('gorides.recent', JSON.stringify(next));
  };
  const h = new Date().getHours();
  const greet = `${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}, ${user?.first_name ?? 'there'}`;

  const searchLocal = () => {
    if (!s.localFrom) {
      toast('Choose a pickup point first');
      setPicker('localFrom');
      return;
    }
    if (!s.localTo) {
      toast('Choose a drop point first');
      setPicker('localTo');
      return;
    }
    set({ mode: 'local' });
    router.push('/results');
  };
  const quick = (from: string, to: string) => {
    remember(from, to);
    set({ mode: 'long', from, to, fromPlace: null, toPlace: null });
    router.push('/results');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_SPACE }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#0C0F20', '#14162C', '#2A1726']} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <View style={styles.glowO} />
          <View style={styles.glowP} />
          <HeroMap active={focused} />
          <View style={styles.hd}>
            <Logo size={38} />
            <T w="display" size={22} color="#fff" style={{ flex: 1, letterSpacing: 1 }}>
              GORIDES
            </T>
            <IconBtn name="bell" tone="glass" dot onPress={needLogin(() => router.push('/notifications'))} label="Notifications" />
            <IconBtn name="help" tone="glass" onPress={() => router.push('/help')} label="Help" />
          </View>
          <T w="semi" size={14} color="rgba(255,255,255,0.9)" style={{ marginTop: 22 }}>
            {greet}
          </T>
          <T w="display" size={36} color="#fff" style={{ maxWidth: 230, lineHeight: 46, marginTop: 4 }}>
            Go anywhere, <T w="display" size={36} color="#FF9A4A">together.</T>
          </T>
          {live.length ? (
            <View style={styles.live}>
              <View style={styles.liveDot} />
              <T w="bold" size={12} color="#fff">
                {live.length} ride{live.length > 1 ? 's' : ''} published
              </T>
            </View>
          ) : null}
        </LinearGradient>

        <Card style={styles.search}>
          <Seg<Mode>
            value={s.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { v: 'local', label: 'Local ride', icon: 'pin' },
              { v: 'long', label: 'Long route', icon: 'route' },
            ]}
            style={{ marginBottom: 12 }}
          />
          {s.mode === 'local' ? (
            <>
              <View style={styles.sf}>
                <FieldRow dot k="Pickup point" v={s.localFrom || 'Pickup point in your city'} placeholder={!s.localFrom} right="target" onPress={() => setPicker('localFrom')} />
                <FieldRow dot filled k="Drop point" v={s.localTo ?? 'Drop point in your city'} placeholder={!s.localTo} onPress={() => setPicker('localTo')} border />
                <FieldRow icon="calendar" k="Start date" v={fmtIso(s.localDate)} onPress={() => setPicker('localDate')} border />
                <View style={[styles.fr, styles.bt]}>
                  <FieldRow icon="route" k="Round trips / month" v={String(s.localTrips)} onPress={() => setPicker('trips')} flex />
                  <View style={{ width: 1, backgroundColor: C.line }} />
                  <FieldRow icon="users" k="Riders" v={paxLabel(s)} onPress={() => setPicker('pax')} flex />
                </View>
              </View>
              <T size={12} color={C.muted} style={{ marginTop: 8 }}>
                Regular commutes, round trip: 1 to 30 times a month. For example 20 days a month for the office, or 26.
              </T>
              <Btn label="Find local rides" icon="search" onPress={searchLocal} style={{ marginTop: 12 }} />
            </>
          ) : (
            <>
              <View style={styles.sf}>
                <FieldRow dot k="Leaving from" v={s.from} onPress={() => setPicker('from')} />
                <FieldRow dot filled k="Going to" v={s.to} onPress={() => setPicker('to')} border />
                <Pressable
                  style={[styles.swap, { transform: [{ rotate: spun ? '180deg' : '0deg' }] }]}
                  onPress={() => {
                    setSpun(!spun);
                    set({ from: s.to, to: s.from, fromPlace: s.toPlace, toPlace: s.fromPlace });
                  }}
                  accessibilityLabel="Swap"
                >
                  <Icon name="swap" color={C.oDeep} />
                </Pressable>
                <View style={[styles.fr, styles.bt]}>
                  <FieldRow icon="calendar" k="Date" v={fmtDay(s.date)} onPress={() => setPicker('date')} flex />
                  <View style={{ width: 1, backgroundColor: C.line }} />
                  <FieldRow icon="users" k="Passengers" v={paxLabel(s)} onPress={() => setPicker('pax')} flex />
                </View>
              </View>
              <Btn label="Search rides" icon="search" onPress={() => (remember(s.from, s.to), router.push('/results'))} style={{ marginTop: 12 }} />
            </>
          )}
        </Card>

        <DriverTripCard />
        <View style={{ marginHorizontal: 16, marginTop: 14 }}>
          <PassengerTripCard />
        </View>

        <View style={styles.qa}>
          <Pressable style={[styles.qaCard, { backgroundColor: C.night }]} onPress={needLogin(() => router.push('/publish'))}>
            <View style={[styles.qaIc, { backgroundColor: C.o }]}>
              <Icon name="plus" color="#fff" />
            </View>
            <T w="bold" size={15} color="#fff">
              Publish a ride
            </T>
            <T size={12} color="rgba(255,255,255,0.75)">
              Driving somewhere? Fill your empty seats.
            </T>
          </Pressable>
          <Pressable style={[styles.qaCard, { backgroundColor: C.card, borderWidth: 1, borderColor: C.line }]} onPress={needLogin(() => router.replace('/my-rides'))}>
            <View style={[styles.qaIc, { backgroundColor: C.oSoft }]}>
              <Icon name="ticket" color={C.oDeep} />
            </View>
            <T w="bold" size={15}>
              My bookings
            </T>
            <T size={12} color={C.muted}>
              {user ? (upcoming === null ? ' ' : upcoming ? `${upcoming} upcoming trip${upcoming > 1 ? 's' : ''}` : 'No upcoming trips') : 'Sign in to see your trips'}
            </T>
          </Pressable>
        </View>

        <InfoCarousel />

        {popular.length ? (
          <>
            <Section title="Popular long routes" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }} snapToInterval={202} decelerationRate="fast">
              {popular.map((r) => (
                <Card key={r.from + r.to} style={styles.route} onPress={() => quick(r.from, r.to)}>
                  <View style={styles.rl}>
                    <View style={styles.rlLine} />
                    <View style={styles.rlRow}>
                      <View style={styles.rlDot} />
                      <T w="bold">{city(r.from)}</T>
                    </View>
                    <View style={styles.rlRow}>
                      <View style={[styles.rlDot, { backgroundColor: C.o }]} />
                      <T w="bold">{city(r.to)}</T>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <T size={12} color={C.muted}>
                      {r.count} ride{r.count > 1 ? 's' : ''}
                    </T>
                    <View style={{ alignItems: 'flex-end' }}>
                      <T size={12} color={C.muted}>
                        from
                      </T>
                      <T w="xbold" size={18}>
                        ${r.price}
                      </T>
                    </View>
                  </View>
                </Card>
              ))}
            </ScrollView>
          </>
        ) : null}

        {recent.length ? (
          <>
            <Section title="Recent searches" />
            <Card style={{ marginHorizontal: 16, paddingHorizontal: 12 }}>
              {recent.map((r, i) => (
                <Pressable key={r.from + r.to} onPress={() => quick(r.from, r.to)} style={[styles.recent, i > 0 && styles.bt]}>
                  <View style={styles.recentIc}>
                    <Icon name="clock" size={18} color={C.ink2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T w="bold" size={14}>
                      {city(r.from)} → {city(r.to)}
                    </T>
                    <T size={12} color={C.muted}>
                      {r.pax} passenger{r.pax > 1 ? 's' : ''}
                    </T>
                  </View>
                  <Icon name="chev" size={18} color={C.muted} />
                </Pressable>
              ))}
            </Card>
          </>
        ) : null}

        <Section title="How GORIDES works" />
        <View style={{ marginHorizontal: 16, gap: 10 }}>
          {[
            ['Search your route', 'Local hops across the GTA or long trips between cities. Pick a date and seats.'],
            ['Book a seat', 'Compare drivers by rating, price and pickup point. Pay in the app.'],
            ['Ride and rate', 'Meet at the pickup point, travel together, then rate each other.'],
          ].map(([t, d], i) => (
            <Card key={t} style={styles.step}>
              <View style={styles.stepN}>
                <T w="display" size={18} color="#fff">
                  {i + 1}
                </T>
              </View>
              <View style={{ flex: 1 }}>
                <T w="bold">{t}</T>
                <T size={13} color={C.muted} style={{ lineHeight: 19 }}>
                  {d}
                </T>
              </View>
            </Card>
          ))}
        </View>

        <View style={styles.trust}>
          <T w="display" size={24} color="#fff" style={{ lineHeight: 32 }}>
            Travel with people you can trust
          </T>
          <View style={styles.trustGrid}>
            {(
              [
                ['star', 'Ratings after every ride'],
                ['card', 'Secure in-app payments'],
              ] as [IconName, string][]
            ).map(([ic, label]) => (
              <View key={label} style={styles.trustCell}>
                <Icon name={ic} color={C.o} />
                <T size={13} color="#fff">
                  {label}
                </T>
              </View>
            ))}
          </View>
        </View>

        <T size={12} color={C.muted} style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 4 }}>
          GORIDES · Rideshare across Canada
        </T>
        <MadeInCanada />
      </ScrollView>
      <TabBar current="home" />

      <PlaceSheet visible={picker === 'localFrom'} title="Pickup" withCurrent onClose={() => setPicker(null)} onPick={(v, p) => set({ localFrom: v, localFromPlace: p })} />
      <PlaceSheet visible={picker === 'localTo'} title="Drop-off" onClose={() => setPicker(null)} onPick={(v, p) => set({ localTo: v, localToPlace: p })} />
      <PlaceSheet visible={picker === 'from'} title="Leaving from" onClose={() => setPicker(null)} onPick={(v, p) => set({ from: v, fromPlace: p })} />
      <PlaceSheet visible={picker === 'to'} title="Going to" onClose={() => setPicker(null)} onPick={(v, p) => set({ to: v, toPlace: p })} />
      <DateSheet visible={picker === 'date'} title="Choose a date" value={s.date} onClose={() => setPicker(null)} onPick={(d) => set({ date: d })} />
      <DateSheet visible={picker === 'localDate'} title="Start date" value={s.localDate} onClose={() => setPicker(null)} onPick={(d) => set({ localDate: d })} />
      <PaxSheet visible={picker === 'trips'} label="Round trips / month" value={s.localTrips} min={1} max={30} hint="1 to 30 round trips a month" onClose={() => setPicker(null)} onPick={(localTrips) => set({ localTrips })} />
      <PaxSheet visible={picker === 'pax'} label={s.mode === 'local' ? 'Riders' : 'Passengers'} value={s.pax} onClose={() => setPicker(null)} onPick={(pax) => set({ pax })} />
    </View>
  );
}

const fmtIso = (d: Date) => isoDate(d);

function FieldRow({ k, v, onPress, dot, filled, icon, right, placeholder, border, flex }: { k: string; v: string; onPress: () => void; dot?: boolean; filled?: boolean; icon?: IconName; right?: IconName; placeholder?: boolean; border?: boolean; flex?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.fl, border && styles.bt, flex && { flex: 1 }]}>
      {dot ? <View style={[styles.fdot, filled && { backgroundColor: C.o }]} /> : icon ? <Icon name={icon} color={C.o} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w="bold" size={11} color={C.muted} style={{ letterSpacing: 0.9 }}>
          {k.toUpperCase()}
        </T>
        <T w={placeholder ? 'semi' : 'bold'} size={15} color={placeholder ? '#A9A4AD' : C.ink} numberOfLines={1}>
          {v}
        </T>
      </View>
      {right ? <Icon name={right} color={C.o} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 110, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: 'hidden' },
  glowO: { position: 'absolute', right: -120, bottom: -140, width: 360, height: 300, borderRadius: 200, backgroundColor: C.o, opacity: 0.35 },
  glowP: { position: 'absolute', left: -120, top: -120, width: 280, height: 240, borderRadius: 160, backgroundColor: '#5A46C8', opacity: 0.25 },
  hd: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3DDC97' },
  search: { marginTop: -78, marginHorizontal: 16, padding: 14, ...shadow },
  sf: { borderWidth: 1, borderColor: C.line, borderRadius: 16, overflow: 'hidden' },
  fl: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, minHeight: 58, backgroundColor: C.card },
  fdot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: C.o, marginHorizontal: 4 },
  fr: { flexDirection: 'row' },
  bt: { borderTopWidth: 1, borderTopColor: C.line },
  swap: { position: 'absolute', right: 14, top: 38, width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  opts: { flexDirection: 'row', gap: 8, marginTop: 12 },
  opt: { flex: 1, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, padding: 10, backgroundColor: C.card },
  optOn: { borderColor: C.o, backgroundColor: C.oSoft },
  qa: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 18 },
  qaCard: { flex: 1, padding: 14, borderRadius: 20, gap: 8, minHeight: 124 },
  qaIc: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  route: { width: 190, padding: 14, gap: 12 },
  rl: { paddingLeft: 18, gap: 4 },
  rlLine: { position: 'absolute', left: 4, top: 10, bottom: 10, width: 2, borderLeftWidth: 2, borderColor: C.o, borderStyle: 'dashed' },
  rlRow: { flexDirection: 'row', alignItems: 'center' },
  rlDot: { position: 'absolute', left: -18, width: 10, height: 10, borderRadius: 5, borderWidth: 2.5, borderColor: C.o, backgroundColor: C.card },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  recentIc: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F2EEEB', alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', gap: 14, padding: 14, alignItems: 'flex-start' },
  stepN: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.o, alignItems: 'center', justifyContent: 'center' },
  trust: { marginHorizontal: 16, marginTop: 22, padding: 18, borderRadius: 22, backgroundColor: C.night, gap: 14 },
  trustGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  trustCell: { width: '48%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 12, gap: 6 },
  promo: { marginHorizontal: 16, marginTop: 22, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  code: { alignSelf: 'flex-start', borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.o, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6 },
});

