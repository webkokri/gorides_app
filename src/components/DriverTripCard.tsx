import React, { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../auth';
import { ApiBooking, ApiRide, bookings, isCoolingDown, rides } from '../lib/api';
import { t12 } from '../lib/format';
import { START_GRACE_MS, tripDate, tripWindow } from '../lib/rideMap';
import { dayOf } from '../lib/trips';
import { useNow } from '../lib/useNow';
import { useStore } from '../store';
import { C, glow } from '../theme';
import { Icon } from './Icon';
import { Btn, Row, T } from './ui';

type Trip = { instanceId: number; ride: ApiRide; status: string; start: Date; end: Date; day: string; time: string };

/**
 * Home reminder for drivers: a pulsing card for a trip of theirs that is due today (from an hour before departure to its
 * end), so the trip gets STARTED, which is what turns on live tracking and notifies the passengers.
 */
export function DriverTripCard() {
  const { user } = useAuth();
  const { dataVersion, broadcast } = useStore();
  const now = useNow(30000);
  const [mine, setMine] = useState<ApiRide[]>([]);
  const [asDriver, setAsDriver] = useState<ApiBooking[]>([]);
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useFocusEffect(
    useCallback(() => {
      if (!user || isCoolingDown()) return;
      Promise.all([rides.mine(), bookings.mine('driver')])
        .then(([r, d]) => {
          setMine(r);
          setAsDriver(d);
        })
        .catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, dataVersion]),
  );

  // today's trips that are scheduled or already under way, inside the "due" window
  const trips: Trip[] = mine.flatMap((r) =>
    (r.instances ?? [])
      .filter((i) => i.status === 'scheduled' || i.status === 'in_progress')
      .map((i): Trip | null => {
        const w = tripWindow(i.departure_date, i.departure_time, i.estimated_arrival_time);
        if (!w) return null;
        return { instanceId: i.id, ride: r, status: i.status ?? 'scheduled', start: w.start, end: w.end, day: tripDate(i.departure_date), time: (i.departure_time ?? '').slice(0, 5) };
      })
      .filter((t): t is Trip => !!t),
  );
  const due = trips
    .filter((t) => t.status === 'in_progress' || (now >= t.start.getTime() - START_GRACE_MS && now <= t.start.getTime() + START_GRACE_MS))
    .sort((a, b) => (a.status === 'in_progress' ? -1 : 1) - (b.status === 'in_progress' ? -1 : 1) || a.start.getTime() - b.start.getTime())[0];

  if (!user || !due) return null;

  const passengers = asDriver.filter((b) => b.ride_id === due.ride.id && dayOf(b) === due.day && b.status === 'confirmed');
  const seats = passengers.reduce((n, b) => n + b.seats_booked, 0);
  const running = due.status === 'in_progress';
  // nobody has booked (not even a request): the whole ride can still be edited, e.g. when the time was missed
  const anyBooked = asDriver.some((b) => b.ride_id === due.ride.id && (b.status === 'pending' || b.status === 'confirmed'));
  const late = !running && now >= due.start.getTime();
  const route = due.ride.title ?? `${due.ride.start_location_name ?? ''} → ${due.ride.end_location_name ?? ''}`;

  return (
    <View style={styles.wrap}>
      <Animated.View pointerEvents="none" style={[styles.halo, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.8] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) }] }]} />
      <View style={styles.card}>
        <Row style={{ gap: 10 }}>
          <Animated.View style={[styles.ic, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }] }]}>
            <Icon name={running ? 'pin' : 'bolt'} color="#fff" />
          </Animated.View>
          <View style={{ flex: 1 }}>
            <T w="xbold" size={16} color="#fff">
              {running ? 'Your trip is in progress' : late ? 'Time to start your trip!' : 'Your trip is coming up'}
            </T>
            <T size={13} color="rgba(255,255,255,0.85)">
              {route}
            </T>
          </View>
        </Row>
        <T size={13} color="rgba(255,255,255,0.85)">
          {running ? 'Passengers are following you live.' : `Departs ${t12(due.time)}`} · {passengers.length ? `${seats} seat${seats > 1 ? 's' : ''} booked by ${passengers.length} passenger${passengers.length > 1 ? 's' : ''}` : 'no confirmed passengers yet'}
        </T>
        {running ? (
          <T size={12} color={broadcast.instanceId === due.instanceId && !broadcast.error ? '#BFF5DD' : '#FFE1A8'}>
            {broadcast.instanceId !== due.instanceId
              ? '● Starting to share your location…'
              : broadcast.error
                ? `● Not sharing: ${broadcast.error}`
                : broadcast.lastAt
                  ? `● Sharing your location · updated ${Math.max(0, Math.round((now - broadcast.lastAt) / 1000))} s ago`
                  : '● Starting to share your location…'}
          </T>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/driver-trip', params: { rideId: String(due.ride.id), instanceId: String(due.instanceId), day: due.day } })} style={styles.go}>
          <Icon name={running ? 'route' : 'play'} size={18} color={C.oDeep} />
          <T w="bold" size={14} color={C.oDeep}>
            {running ? 'Open trip' : 'Start trip'}
          </T>
        </Pressable>
        {!running && !anyBooked ? (
          <Btn label="Edit ride" icon="edit" kind="dark" small style={{ backgroundColor: 'rgba(255,255,255,0.22)' }} onPress={() => router.push({ pathname: '/publish', params: { edit: String(/\(Return\)$/.test(due.ride.title ?? '') && due.ride.return_ride_id ? due.ride.return_ride_id : due.ride.id) } })} />
        ) : null}
        {passengers[0] ? (
          <Btn label="Live tracking" icon="pin" kind="dark" small style={{ backgroundColor: 'rgba(255,255,255,0.22)' }} onPress={() => router.push({ pathname: '/tracking', params: { id: String(passengers[0].id) } })} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 14 },
  halo: { position: 'absolute', left: -4, right: -4, top: -4, bottom: -4, borderRadius: 26, backgroundColor: C.o },
  card: { backgroundColor: C.oDeep, borderRadius: 22, padding: 16, gap: 10, ...glow },
  go: { height: 42, borderRadius: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ic: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
});
