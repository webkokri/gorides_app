import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DriverMap } from '../components/DriverMap';
import { Icon } from '../components/Icon';
import { Avatar, Btn, Card, IconBtn, Row, Screen, T, TopBar } from '../components/ui';
import { ApiRide, bookings, rides } from '../lib/api';
import { DriverTrip, loadDriverTrip, openInMaps } from '../lib/route';
import { reportDriverLocation } from '../lib/driverLocation';
import { getItem, setItem } from '../lib/storage';
import { t12 } from '../lib/format';
import { tripWindow } from '../lib/rideMap';
import { useNow } from '../lib/useNow';
import { useStore } from '../store';
import { C } from '../theme';

/**
 * The driver's trip screen, opened by "Start trip": the whole route on a map (start, every pickup as a numbered stop,
 * destination), the navigation button that opens it in a maps app, the next passenger to pick up (call when phone numbers
 * are shared, otherwise the in-app chat) and the Start / Complete trip control.
 */
export default function DriverTripScreen() {
  const { rideId, instanceId, day, start: autoStart, nav: autoNav } = useLocalSearchParams<{ rideId: string; instanceId: string; day: string; start?: string; nav?: string }>();
  const { toast, contactMode, bumpData, hintLive } = useStore();
  const [trip, setTrip] = useState<DriverTrip | null>(null);
  const [ride, setRide] = useState<ApiRide | null>(null);
  const [error, setError] = useState('');
  const [lock, setLock] = useState(false); // the page does not scroll while a finger is on the map
  const [done, setDone] = useState<number[]>([]);
  const [phone, setPhone] = useState<{ id: number; number: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [panelH, setPanelH] = useState(220);
  const [legs, setLegs] = useState<number[] | null>(null);
  const { height: winH } = useWindowDimensions();
  const now = useNow(30000);
  const insets = useSafeAreaInsets();
  const storeKey = `gorides.pickedup.${instanceId}`;

  const reload = useCallback(() => {
    loadDriverTrip(Number(rideId), day ?? '', Number(instanceId))
      .then((t) => {
        setTrip(t);
        setError('');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the route'));
    rides.get(Number(rideId)).then(setRide).catch(() => {});
  }, [rideId, day, instanceId]);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  useEffect(() => {
    getItem(storeKey).then((v) => v && setDone(JSON.parse(v))).catch(() => {});
  }, [storeKey]);

  const waiting = trip?.passengers.filter((p) => !done.includes(p.bookingId)) ?? [];
  const next = waiting[0];
  // a phone number comes with the booking detail, and only when the app shares contact numbers
  useEffect(() => {
    if (!next || contactMode !== 'public') return;
    bookings
      .get(next.bookingId)
      .then((d) => d.passenger_mobile && setPhone({ id: next.bookingId, number: d.passenger_mobile }))
      .catch(() => {});
  }, [next, contactMode]);

  const instance = ride?.instances?.find((i) => i.id === Number(instanceId));
  const status = instance?.status ?? 'scheduled';
  const running = status === 'in_progress';

  const markPicked = (id: number) => {
    const n = [...done, id];
    setDone(n);
    setItem(storeKey, JSON.stringify(n));
  };
  const run = async (kind: 'start' | 'complete') => {
    setBusy(true);
    try {
      if (kind === 'start') {
        // the location permission is asked for here if it never was, and the position is shared at once
        const share = await reportDriverLocation(true);
        await rides.startInstance(Number(instanceId));
        hintLive(Number(instanceId));
        if (share === 'denied') toast('Trip started, but location is off, so passengers cannot see your car. Allow location in your phone settings.');
      } else {
        await rides.completeInstance(Number(instanceId));
        hintLive(null);
      }
      if (kind === 'complete') toast('Trip completed.');
      else toast('Trip started. Your passengers have been notified with your ETA.');
      bumpData();
      if (kind === 'complete') router.back();
      else reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };
  const confirm = (kind: 'start' | 'complete') =>
    Alert.alert(kind === 'start' ? 'Start this trip?' : 'Complete this trip?', kind === 'start' ? 'Every confirmed passenger is notified and can follow your trip live.' : 'Live tracking and chat close for everyone on this ride.', [
      { text: 'Not yet', style: 'cancel' },
      { text: kind === 'start' ? 'Start trip' : 'Complete trip', onPress: () => run(kind) },
    ]);

  // opened from the "Start ride" / "Start route" notification buttons
  const auto = React.useRef(false);
  useEffect(() => {
    if (auto.current || !trip || !ride) return;
    if (autoStart === '1' && status === 'scheduled') {
      auto.current = true;
      confirm('start');
    } else if (autoNav === '1') {
      auto.current = true;
      openInMaps(trip, toast);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip, ride, status]);

  // estimated driving time A -> every pickup -> destination (about a minute at each stop), and when that puts the driver at the destination
  const driveSec = legs ? legs.reduce((a, b) => a + b, 0) + 60 * (trip?.stops.length ?? 0) : null;
  const dur = (sec: number) => {
    const m = Math.max(1, Math.round(sec / 60));
    return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
  };
  const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sched = instance ? tripWindow(instance.departure_date, instance.departure_time)?.start.getTime() : undefined;
  const leaveAt = running ? now : Math.max(now, sched ?? 0);
  const etaLine = driveSec !== null ? `${dur(driveSec)} · arrive around ${clock(leaveAt + driveSec * 1000)}` : '';

  const nextCard = (
            <Card style={{ padding: 14, gap: 10 }}>
              <T w="bold">{next ? 'Next passenger' : trip?.passengers.length ? 'All passengers picked up' : 'No confirmed passengers yet'}</T>
              {next ? (
                <>
                  <Row style={{ gap: 12 }}>
                    <Avatar name={next.name} size={46} />
                    <View style={{ flex: 1 }}>
                      <T w="bold" size={16}>
                        {next.name}
                      </T>
                      <T size={12} color={C.muted} numberOfLines={2}>
                        {next.pickupName ? `Pickup: ${next.pickupName} · ` : ''}
                        {next.seats} seat{next.seats > 1 ? 's' : ''}
                      </T>
                    </View>
                    {phone?.id === next.bookingId ? (
                      <Pressable style={[styles.round, { backgroundColor: C.good }]} onPress={() => Linking.openURL(`tel:${phone.number}`)} accessibilityLabel={`Call ${next.name}`}>
                        <Icon name="phone" size={20} color="#fff" />
                      </Pressable>
                    ) : (
                      <Pressable style={[styles.round, { backgroundColor: C.o }]} onPress={() => router.push({ pathname: '/booking-chat', params: { id: String(next.bookingId) } })} accessibilityLabel={`Message ${next.name}`}>
                        <Icon name="chat" size={20} color="#fff" />
                      </Pressable>
                    )}
                  </Row>
                  <Btn label="Picked up" icon="check" kind="sec" small onPress={() => markPicked(next.bookingId)} />
                  {waiting.length > 1 ? (
                    <T size={12} color={C.muted}>
                      Then: {waiting.slice(1).map((p) => p.name).join(', ')}
                    </T>
                  ) : null}
                </>
              ) : null}
            </Card>
  );

  // Once the trip is running the map IS the screen: full size, with a compact panel for the next passenger and Complete trip.
  if (running && trip) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar style="dark" />
        <DriverMap full bottomInset={panelH + 12} onLegs={setLegs} trip={trip} running done={done} onNavigate={() => openInMaps(trip, toast)} />
        <View style={[styles.floatTop, { top: insets.top + 8 }]}>
          <IconBtn name="back" label="Back" onPress={() => router.back()} />
          <View style={styles.pill}>
            <T w="bold" size={13} numberOfLines={1}>
              {ride?.title ?? 'Trip in progress'}
            </T>
            {etaLine ? (
              <T size={12} color={C.oDeep} w="semi" numberOfLines={1}>
                {trip.destination ? `To ${trip.destination.name}: ` : ''}
                {etaLine}
              </T>
            ) : null}
          </View>
        </View>
        <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]} onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}>
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
            {nextCard}
          </ScrollView>
          <Btn label={busy ? 'Please wait…' : 'Complete trip'} icon="check" disabled={busy} onPress={() => confirm('complete')} />
        </View>
      </View>
    );
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Your trip" />
      <ScrollView scrollEnabled={!lock} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {error && !trip ? (
          <Card style={{ padding: 20, gap: 10, alignItems: 'center' }}>
            <T color={C.muted} style={{ textAlign: 'center' }}>
              {error}
            </T>
            <Btn label="Try again" small onPress={reload} />
          </Card>
        ) : !trip ? (
          <ActivityIndicator color={C.o} style={{ marginTop: 32 }} />
        ) : (
          <>
            <Card style={{ padding: 12, gap: 10 }}>
              <DriverMap height={Math.max(440, Math.round(winH * 0.58))} onLegs={setLegs} trip={trip} running={running} done={done} onNavigate={() => openInMaps(trip, toast)} onTouch={setLock} />
              <Row style={{ justifyContent: 'space-between' }}>
                <T size={12} color={C.muted}>
                  {trip.stops.length ? `${trip.stops.length} pickup stop${trip.stops.length > 1 ? 's' : ''} on the way` : 'No pickup stops yet'}
                </T>
                <T w="semi" size={12} color={C.oDeep} onPress={() => openInMaps(trip, toast)}>
                  Open in maps
                </T>
              </Row>
            </Card>

            {driveSec !== null ? (
              <Card style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.oSoft }}>
                <View style={styles.etaIc}>
                  <Icon name="clock" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <T size={12} color={C.muted}>
                    {trip.origin ? `${trip.origin.name} ` : 'Start '}→ {trip.destination ? trip.destination.name : 'destination'}
                  </T>
                  <T w="xbold" size={20} color={C.oDeep}>
                    {dur(driveSec)}
                  </T>
                  <T size={12} color={C.ink2}>
                    {running ? 'Arrive around' : sched && sched > now ? `Leave ${clock(sched)}, arrive around` : 'If you leave now, arrive around'} {clock(leaveAt + driveSec * 1000)}
                    {trip.stops.length ? ` · includes ${trip.stops.length} pickup stop${trip.stops.length > 1 ? 's' : ''}` : ''}
                  </T>
                </View>
              </Card>
            ) : null}

            <Card style={{ padding: 14, gap: 0 }}>
              {[
                trip.origin && { k: 'A', name: trip.origin.name, sub: instance?.departure_time ? `Departs ${t12(instance.departure_time.slice(0, 5))}` : 'Start', tone: '#2f6fe4' },
                ...trip.stops.map((s, i) => ({ k: String(i + 1), name: s.name, sub: trip.passengers.filter((p) => p.stop && Math.abs(p.stop.lat - s.lat) < 1e-4 && Math.abs(p.stop.lng - s.lng) < 1e-4).map((p) => p.name).join(', ') || 'Pickup', tone: C.o })),
                trip.destination && { k: '★', name: trip.destination.name, sub: 'Destination', tone: C.ink },
              ]
                .filter((x): x is { k: string; name: string; sub: string; tone: string } => !!x)
                .map((r, i, all) => (
                  <Row key={r.k + i} style={{ gap: 12, paddingVertical: 8, alignItems: 'flex-start' }}>
                    <View style={{ alignItems: 'center' }}>
                      <View style={[styles.dot, { backgroundColor: r.tone }]}>
                        <T w="bold" size={11} color="#fff">
                          {r.k}
                        </T>
                      </View>
                      {i < all.length - 1 ? <View style={styles.rail} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <T w="bold" size={14} numberOfLines={1}>
                        {r.name}
                      </T>
                      <T size={12} color={C.muted} numberOfLines={1}>
                        {r.sub}
                      </T>
                    </View>
                  </Row>
                ))}
            </Card>

            {nextCard}

            {status === 'scheduled' || running ? (
              <>
                <Btn label={busy ? 'Please wait…' : running ? 'Complete trip' : 'Start trip'} icon={running ? 'check' : 'play'} disabled={busy} onPress={() => confirm(running ? 'complete' : 'start')} />
                {!running ? (
                  <T size={12} color={C.muted} style={{ textAlign: 'center' }}>
                    You can start any time. Your passengers are notified with their ETA when you start, and can follow your car live.
                  </T>
                ) : null}
              </>
            ) : (
              <T size={13} color={C.muted} style={{ textAlign: 'center' }}>
                This trip is {status === 'completed' ? 'completed' : status}.
              </T>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  etaIc: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.o, alignItems: 'center', justifyContent: 'center' },
  floatTop: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: { flex: 1, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 1 } },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 14, gap: 10, elevation: 12, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: -2 } },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rail: { width: 2, flex: 1, minHeight: 14, backgroundColor: C.line, marginTop: 2 },
  round: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
