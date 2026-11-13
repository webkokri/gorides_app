import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import { rides as ridesApi } from '../lib/api';
import { getItem, setItem } from '../lib/storage';
import { city, fmtDay, isoDate, today } from '../lib/format';
import { Ride } from '../data';
import { RideCard } from '../components/RideCard';
import { upcomingRides } from '../lib/rideMap';
import { useOpenRide } from '../lib/useOpenRide';
import { useAuth } from '../auth';
import { DriverTripCard } from '../components/DriverTripCard';
import { PassengerTripCard } from '../components/PassengerTripCard';
import { InfoCarousel } from '../components/InfoCarousel';
import { MadeInCanada } from '../components/MadeInCanada';
import { useRequireAuth } from '../lib/useRequireAuth';
import { paxLabel, useStore } from '../store';
import { C, shadow } from '../theme';

type Picker = null | 'from' | 'to' | 'date' | 'pax';

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

  // Rides whose trips start soonest
  const [limit, setLimit] = useState(5);
  const [near, setNear] = useState<Ride[]>([]);
  const [nearLoading, setNearLoading] = useState(true);
  const [kind, setKind] = useState<'daily' | 'monthly'>('daily');
  const [recent, setRecent] = useState<{ from: string; to: string; pax: number }[]>([]);
  useEffect(() => {
    getItem('gorides.recent').then((v) => v && setRecent(JSON.parse(v))).catch(() => {});
  }, []);
  useFocusEffect(
    React.useCallback(() => {
      let live = true;
      (async () => {
        const q = { date_from: isoDate(today()) };
        const [loc, lng] = await Promise.all([ridesApi.search({ ...q, ride_type: 'local' }), ridesApi.search({ ...q, ride_type: 'intercity' })]);
        const starts = (r: Ride) => new Date(`${r.day}T${r.dep || '00:00'}:00`).getTime();
        const rs = [...upcomingRides(loc, true), ...upcomingRides(lng, false)].sort((a, b) => starts(a) - starts(b));
        if (live) setNear(rs);
      })()
        .catch(() => {})
        .finally(() => live && setNearLoading(false));
      return () => {
        live = false;
      };
    }, []),
  );
  const { open, isOwn } = useOpenRide();
  // rides you published yourself are not offered to you to book
  const shown = useMemo(() => near.filter((r) => !isOwn(r) && !!r.monthly === (kind === 'monthly')), [near, kind, isOwn]);
  const monthlyCount = useMemo(() => near.filter((r) => !isOwn(r) && r.monthly).length, [near, isOwn]);
  const visible = shown.slice(0, limit);
  const remember = (from: string, to: string) => {
    const next = [{ from, to, pax: s.pax }, ...recent.filter((r) => !(r.from === from && r.to === to))].slice(0, 5);
    setRecent(next);
    setItem('gorides.recent', JSON.stringify(next));
  };
  const h = new Date().getHours();
  const greet = `${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}, ${user?.first_name ?? 'there'}`;

  const search = () => {
    if (!s.from && !s.to) {
      toast('Enter where you are leaving from or going to');
      setPicker('from');
      return;
    }
    remember(s.from, s.to);
    router.push('/results');
  };
  const quick = (from: string, to: string) => {
    remember(from, to);
    set({ from, to, fromPlace: null, toPlace: null });
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
          {near.length ? (
            <View style={styles.live}>
              <View style={styles.liveDot} />
              <T w="bold" size={12} color="#fff">
                {near.length} ride{near.length > 1 ? 's' : ''} available
              </T>
            </View>
          ) : null}
        </LinearGradient>

        <Card style={styles.search}>
          <View style={styles.sf}>
            <FieldRow dot k="Leaving from" v={s.from || 'City, address or current location'} placeholder={!s.from} right="target" onPress={() => setPicker('from')} />
            <FieldRow dot filled k="Going to" v={s.to || 'City or address'} placeholder={!s.to} onPress={() => setPicker('to')} border />
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
          <Btn label="Search rides" icon="search" onPress={search} style={{ marginTop: 12 }} />
        </Card>

        <DriverTripCard />
        <View style={{ marginHorizontal: 16, marginTop: 14 }}>
          <PassengerTripCard />
        </View>

        <Section title="Upcoming rides" />
        <Seg<'daily' | 'monthly'>
          value={kind}
          onChange={(k) => (setKind(k), setLimit(5))}
          options={[
            { v: 'daily', label: 'Daily Rides', icon: 'clock' },
            { v: 'monthly', label: `Monthly Rides${monthlyCount ? ` (${monthlyCount})` : ''}`, icon: 'calendar' },
          ]}
          style={{ marginHorizontal: 16 }}
        />
        <T size={12} color={C.muted} style={{ marginHorizontal: 20, marginTop: 8 }}>
          {kind === 'monthly' ? 'Rides that run 20 or more days a month. Next trips to start first.' : 'Next trips to start first.'}
        </T>
        <View style={{ paddingHorizontal: 16, gap: 12, marginTop: 10 }}>
          {nearLoading ? (
            <ActivityIndicator color={C.o} style={{ marginVertical: 24 }} />
          ) : visible.length ? (
            <>
              {visible.map((r) => (
                <RideCard key={r.id} ride={r} local={!!r.local} showDate onPress={() => open(r)} />
              ))}
              {shown.length > limit ? <Btn label="See more" kind="out" icon="chev" onPress={() => setLimit((n) => n + 5)} /> : null}
            </>
          ) : (
            <Card style={{ padding: 20, alignItems: 'center', gap: 4 }}>
              <T w="bold">{kind === 'monthly' ? 'No monthly rides yet' : 'No upcoming daily rides yet'}</T>
              <T size={13} color={C.muted} style={{ textAlign: 'center' }}>
                Use the search above to look further away.
              </T>
            </Card>
          )}
        </View>

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

        <Pressable style={styles.how} onPress={() => router.push('/how-it-works')}>
          <View style={styles.recentIc}>
            <Icon name="help" size={18} color={C.oDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <T w="bold" size={14}>
              How GORIDES works
            </T>
            <T size={12} color={C.muted}>
              Search, book, ride and rate in three steps
            </T>
          </View>
          <Icon name="chev" size={18} color={C.muted} />
        </Pressable>

        <InfoCarousel />

        <T size={12} color={C.muted} style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 4 }}>
          GORIDES · Rideshare across Canada
        </T>
        <MadeInCanada />
      </ScrollView>
      <TabBar current="home" />

      <PlaceSheet visible={picker === 'from'} title="Leaving from" withCurrent onClose={() => setPicker(null)} onPick={(v, p) => set({ from: v, fromPlace: p })} />
      <PlaceSheet visible={picker === 'to'} title="Going to" onClose={() => setPicker(null)} onPick={(v, p) => set({ to: v, toPlace: p })} />
      <DateSheet visible={picker === 'date'} title="Choose a date" value={s.date} onClose={() => setPicker(null)} onPick={(d) => set({ date: d })} />
      <PaxSheet visible={picker === 'pax'} label="Passengers" value={s.pax} onClose={() => setPicker(null)} onPick={(pax) => set({ pax })} />
    </View>
  );
}

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
  how: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 22, padding: 12, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  trust: { marginHorizontal: 16, marginTop: 22, padding: 18, borderRadius: 22, backgroundColor: C.night, gap: 14 },
  trustGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  trustCell: { width: '48%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 12, gap: 6 },
  promo: { marginHorizontal: 16, marginTop: 22, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  code: { alignSelf: 'flex-start', borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.o, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6 },
});

