import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Modal, StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useAuth } from '../auth';
import { ApiBooking, ApiRide, bookings, isCoolingDown, rides } from '../lib/api';
import { LAST_PING, reportDriverLocation } from '../lib/driverLocation';
import { isoDate, t12, today } from '../lib/format';
import { isPast } from '../lib/trips';
import { RIDE_START_CATEGORY, setupRideCategory, syncLocalReminders } from '../lib/push';
import { tripDate, tripWindow } from '../lib/rideMap';
import { getItem, setItem } from '../lib/storage';
import { useNow } from '../lib/useNow';
import { useStore } from '../store';
import { C } from '../theme';
import { Icon } from './Icon';
import { Btn, T } from './ui';

const PREFIX = 'gorides-ride-';
const DISMISSED = 'gorides.ridePrompt.dismissed';
const SOON_MIN = 30; // the "starts in 30 minutes" reminder
const PING_EVERY_MS = 30 * 60000;
const LIVE_PING_MS = 60000; // a passenger whose ride is under way reports every minute, so the driver's ETA and pickup stay accurate // the driver's location is refreshed every 30 minutes while they have upcoming trips
const MAX_TRIPS = 25; // phones allow about 64 scheduled notifications in total; two per trip

type Trip = { instanceId: number; ride: ApiRide; at: Date; day: string; time: string };

/**
 * For a driver's own upcoming trips:
 *  - 30 minutes before: a notification "Your ride starts in 30 minutes";
 *  - at the ride time: a notification "Time to start your ride" (with Start ride / Start route buttons), and, if the app is open,
 *    a pop-up with Start ride and Cancel.
 * Nothing ever starts by itself: a trip only starts when the driver taps Start ride.
 */
export function RideReminders() {
  const { user } = useAuth();
  const { dataVersion, toast, bumpData, hintLive } = useStore();
  const pathname = usePathname();
  const now = useNow(15000);
  const [mine, setMine] = useState<ApiRide[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  // the passenger's side: confirmed bookings that are upcoming or already under way
  const [asPassenger, setAsPassenger] = useState<ApiBooking[]>([]);

  const load = useCallback(() => {
    if (!user || isCoolingDown()) return;
    rides
      .mine()
      .then(setMine)
      .catch(() => {});
    bookings
      .mine('passenger', 'confirmed')
      .then(setAsPassenger)
      .catch(() => {});
  }, [user]);
  useEffect(() => {
    load();
    const t = setInterval(() => AppState.currentState === 'active' && load(), 5 * 60000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [load, dataVersion]);
  useEffect(() => {
    getItem(DISMISSED).then((v) => v && setDismissed(JSON.parse(v))).catch(() => {});
    setupRideCategory();
  }, []);

  // upcoming trips that have not been started, soonest first
  const trips = useMemo<Trip[]>(() => {
    const out: Trip[] = [];
    for (const r of mine) {
      for (const i of r.instances ?? []) {
        if (i.status && i.status !== 'scheduled') continue;
        const w = tripWindow(i.departure_date, i.departure_time);
        if (w) out.push({ instanceId: i.id, ride: r, at: w.start, day: tripDate(i.departure_date), time: (i.departure_time ?? '').slice(0, 5) });
      }
    }
    return out.sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [mine]);

  // schedule the two notifications for each upcoming trip (and drop the ones that no longer apply)
  useEffect(() => {
    if (!user) return;
    const t0 = Date.now();
    const wanted = trips
      .filter((t) => t.at.getTime() > t0)
      .slice(0, MAX_TRIPS)
      .flatMap((t) => {
        const route = t.ride.title ?? `${t.ride.start_location_name ?? ''} to ${t.ride.end_location_name ?? ''}`;
        const data = { ride_id: t.ride.id, ride_instance_id: t.instanceId, day: t.day };
        const soon = new Date(t.at.getTime() - SOON_MIN * 60000);
        return [
          ...(soon.getTime() > t0 ? [{ id: `${PREFIX}${t.instanceId}-soon-${soon.getTime()}`, at: soon, title: 'Your ride starts in 30 minutes', body: `${route} · ${t12(t.time)}. Get ready to go.`, data: { ...data, type: 'ride_reminder' } }] : []),
          { id: `${PREFIX}${t.instanceId}-now-${t.at.getTime()}`, at: t.at, title: 'Time to start your ride', body: `${route}. Start the ride so your passengers get your ETA and can follow you.`, data: { ...data, type: 'ride_start_due' }, category: RIDE_START_CATEGORY },
        ];
      });
    syncLocalReminders(PREFIX, wanted);
  }, [user, trips]);

  // While a driver has upcoming trips that have not started, their phone reports where it is every 30 minutes (once the trip is
  // started, live tracking takes over). The first report after signing in is sent straight away (asking for the location
  // permission if needed); after that every 30 minutes, and again whenever the app comes back to the front.
  const passengerLive = asPassenger.some((b) => b.instance_status === 'in_progress');
  const passengerUpcoming = asPassenger.some((b) => !isPast(b, isoDate(today())));
  const hasUpcoming = trips.length > 0 || passengerUpcoming;
  const every = passengerLive ? LIVE_PING_MS : PING_EVERY_MS;
  const userId = user?.id;
  useEffect(() => {
    if (!userId || !hasUpcoming) return;
    let on = true;
    const ping = async (first: boolean) => {
      const last = Number((await getItem(LAST_PING)) ?? 0);
      if (!first && Date.now() - last < every - 5000) return;
      if (on) await reportDriverLocation(first, passengerLive);
    };
    ping(true);
    const t = setInterval(() => ping(false), every);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && ping(false));
    return () => {
      on = false;
      clearInterval(t);
      sub.remove();
    };
  }, [userId, hasUpcoming, every, passengerLive]);

  // the pop-up: a trip whose time has come and which has not been started or dismissed
  const running = mine.some((r) => (r.instances ?? []).some((i) => i.status === 'in_progress')); // one ride at a time
  const due = running ? undefined : trips.find((t) => now >= t.at.getTime() && now <= t.at.getTime() + 3 * 3600e3 && !dismissed.includes(t.instanceId));
  const hide = !user || !due || pathname.startsWith('/driver-trip') || pathname.startsWith('/signin');

  const dismiss = (id: number) => {
    const next = [...dismissed, id].slice(-100);
    setDismissed(next);
    setItem(DISMISSED, JSON.stringify(next));
  };
  const start = async () => {
    if (!due) return;
    setBusy(true);
    try {
      // the location permission is asked for here if it never was, and the position is shared at once
      reportDriverLocation(true);
      await rides.startInstance(due.instanceId);
      hintLive(due.instanceId);
      toast('Trip started. Your passengers have been notified with your ETA.');
      bumpData();
      load();
      router.push({ pathname: '/driver-trip', params: { rideId: String(due.ride.id), instanceId: String(due.instanceId), day: due.day } });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not start the trip');
    } finally {
      setBusy(false);
    }
  };

  if (hide || !due) return null;
  const route = due.ride.title ?? `${due.ride.start_location_name ?? ''} to ${due.ride.end_location_name ?? ''}`;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => dismiss(due.instanceId)}>
      <View style={styles.scrim}>
        <View style={styles.box}>
          <View style={styles.ic}>
            <Icon name="car" size={24} color={C.oDeep} />
          </View>
          <T w="display" size={22} style={{ textAlign: 'center' }}>
            Time to start your ride
          </T>
          <T color={C.muted} style={{ textAlign: 'center' }}>
            {route}
          </T>
          <T size={13} color={C.muted} style={{ textAlign: 'center' }}>
            Scheduled for {t12(due.time)}. Passengers are notified with their ETA when you start, and can follow your car.
          </T>
          <Btn label={busy ? 'Starting…' : 'Start ride'} icon="play" disabled={busy} onPress={start} />
          <Btn label="Cancel" kind="out" disabled={busy} onPress={() => dismiss(due.instanceId)} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(20,15,20,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: { width: '100%', maxWidth: 380, backgroundColor: C.card, borderRadius: 24, padding: 20, gap: 10, alignItems: 'stretch' },
  ic: { width: 52, height: 52, borderRadius: 16, backgroundColor: C.oSoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
});
