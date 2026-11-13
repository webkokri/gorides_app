import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Icon } from '../components/Icon';
import { Avatar, Btn, Card, Row, Screen, T, TopBar } from '../components/ui';
import { ApiRide, bookings, rides, settings } from '../lib/api';
import { DriverTrip, loadDriverTrip, openInMaps, Stop } from '../lib/route';
import { getItem, setItem } from '../lib/storage';
import { startWindow } from '../lib/rideMap';
import { useNow } from '../lib/useNow';
import { t12 } from '../lib/format';
import { useStore } from '../store';
import { C } from '../theme';

/** Encoded driving line between the points (Mapbox Directions); null when it is unavailable or too long to draw. */
async function drivingLine(token: string, pts: Stop[]): Promise<string | null> {
  if (!token || pts.length < 2) return null;
  try {
    const coords = pts.map((p) => `${p.lng},${p.lat}`).join(';');
    const res = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?overview=simplified&geometries=polyline&access_token=${token}`);
    const line: string | undefined = (await res.json())?.routes?.[0]?.geometry;
    return line && encodeURIComponent(line).length < 5500 ? line : null;
  } catch {
    return null;
  }
}

/**
 * The driver's trip screen, opened by "Start trip": the whole route on a map (start, every pickup as a numbered stop,
 * destination), the navigation button that opens it in a maps app, the next passenger to pick up (call when phone numbers
 * are shared, otherwise the in-app chat) and the Start / Complete trip control.
 */
export default function DriverTripScreen() {
  const { rideId, instanceId, day } = useLocalSearchParams<{ rideId: string; instanceId: string; day: string }>();
  const { toast, contactMode, bumpData } = useStore();
  const { width } = useWindowDimensions();
  const [trip, setTrip] = useState<DriverTrip | null>(null);
  const [ride, setRide] = useState<ApiRide | null>(null);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [line, setLine] = useState<string | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [phone, setPhone] = useState<{ id: number; number: string } | null>(null);
  const [busy, setBusy] = useState(false);
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
    settings.map().then((m) => setToken(m.mapboxAccessToken ?? '')).catch(() => {});
    getItem(storeKey).then((v) => v && setDone(JSON.parse(v))).catch(() => {});
  }, [storeKey]);

  const points = useMemo(() => (trip ? [trip.origin, ...trip.stops, trip.destination].filter((p): p is Stop => !!p) : []), [trip]);
  useEffect(() => {
    drivingLine(token, points).then(setLine);
  }, [token, points]);

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
  // a trip can be started from an hour before to an hour after its departure time
  const now = useNow(15000);
  const win = instance ? startWindow(instance.departure_date, instance.departure_time) : null;
  const early = !!win && now < win.opens.getTime();
  const tooLate = !!win && now > win.closes.getTime();
  const canStart = !early && !tooLate;
  const hm = (d: Date) => t12(`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);

  const markPicked = (id: number) => {
    const n = [...done, id];
    setDone(n);
    setItem(storeKey, JSON.stringify(n));
  };
  const run = async (kind: 'start' | 'complete') => {
    setBusy(true);
    try {
      if (kind === 'start') await rides.startInstance(Number(instanceId));
      else await rides.completeInstance(Number(instanceId));
      toast(kind === 'start' ? 'Trip started. Your passengers have been notified.' : 'Trip completed.');
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

  // map: A = start, 1..n = pickup stops, flag = destination
  const mapW = Math.min(640, Math.round(width - 32));
  const pins = trip
    ? [
        trip.origin ? `pin-s-a+2f6fe4(${trip.origin.lng},${trip.origin.lat})` : '',
        ...trip.stops.map((s, i) => `pin-s-${i + 1}+f47a20(${s.lng},${s.lat})`),
        trip.destination ? `pin-s-star+1b1a1f(${trip.destination.lng},${trip.destination.lat})` : '',
      ].filter(Boolean)
    : [];
  const overlays = [line ? `path-5+f47a20-0.85(${encodeURIComponent(line)})` : '', ...pins].filter(Boolean);
  const mapUrl = token && overlays.length ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays.join(',')}/auto/${mapW}x300@2x?padding=48&access_token=${token}` : null;

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Your trip" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
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
              {mapUrl ? <Image source={{ uri: mapUrl }} style={styles.map} transition={250} accessibilityLabel="Map of the whole route with every pickup stop" /> : <View style={[styles.map, styles.mapEmpty]}><T size={13} color={C.muted}>The map is not available right now.</T></View>}
              <Pressable style={styles.nav} onPress={() => openInMaps(trip, toast)} accessibilityLabel="Navigate in maps app">
                <Icon name="nav" size={22} color="#fff" />
              </Pressable>
              <Row style={{ justifyContent: 'space-between' }}>
                <T size={12} color={C.muted}>
                  {trip.stops.length ? `${trip.stops.length} pickup stop${trip.stops.length > 1 ? 's' : ''} on the way` : 'No pickup stops yet'}
                </T>
                <T w="semi" size={12} color={C.oDeep} onPress={() => openInMaps(trip, toast)}>
                  Open in maps
                </T>
              </Row>
            </Card>

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

            <Card style={{ padding: 14, gap: 10 }}>
              <T w="bold">{next ? 'Next passenger' : trip.passengers.length ? 'All passengers picked up' : 'No confirmed passengers yet'}</T>
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

            {status === 'scheduled' || running ? (
              <>
                <Btn label={busy ? 'Please wait…' : running ? 'Complete trip' : 'Start trip'} icon={running ? 'check' : 'play'} disabled={busy || (!running && !canStart)} onPress={() => confirm(running ? 'complete' : 'start')} />
                {!running && win ? (
                  <T size={12} color={canStart ? C.muted : C.warn} style={{ textAlign: 'center' }}>
                    {early ? `Too early. You can start this trip from ${hm(win.opens)}, an hour before its ${hm(win.at)} departure.` : tooLate ? `The start window closed at ${hm(win.closes)}, an hour after its ${hm(win.at)} departure. Edit or delete the ride from My rides.` : `You can start from ${hm(win.opens)} to ${hm(win.closes)}. Passengers are notified when you start.`}
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
  map: { width: '100%', height: 260, borderRadius: 14, backgroundColor: '#E8E4DF' },
  mapEmpty: { alignItems: 'center', justifyContent: 'center' },
  nav: { position: 'absolute', right: 22, top: 22, width: 48, height: 48, borderRadius: 24, backgroundColor: C.o, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rail: { width: 2, flex: 1, minHeight: 14, backgroundColor: C.line, marginTop: 2 },
  round: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
