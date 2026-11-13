import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../auth';
import { ApiBooking, BookingDetail, bookings, isCoolingDown } from '../lib/api';
import { fmtDay, money, t12 } from '../lib/format';
import { tripDate } from '../lib/rideMap';
import { addPushListener, listenForPushTaps } from '../lib/push';
import { getItem, setItem } from '../lib/storage';
import { useStore } from '../store';
import { C, shadow } from '../theme';
import { Btn, Row, T } from './ui';

type Ev = { kind: 'request' | 'accepted' | 'declined' | 'started'; booking: ApiBooking };

const SEEN_KEY = 'gorides.events.seen';
const STATUS_KEY = 'gorides.events.status';
const name = (f?: string, l?: string) => [f, l].filter(Boolean).join(' ');

/**
 * Pop-ups for booking requests, shown anywhere in the app:
 *  - the DRIVER sees each new pending request (passenger, seats, trip, message) and can accept or decline;
 *  - the PASSENGER is told the moment a driver accepts (and can pay right there) or declines.
 * A push notification (booking_request / booking_accepted / booking_declined)
 * triggers an immediate check; the poll below is just the safety net for a
 * missed/delayed push, so its interval is wide.
 */
export function BookingEvents() {
  const { user } = useAuth();
  const { toast, bumpData } = useStore();
  const [queue, setQueue] = useState<Ev[]>([]);
  const [detailFor, setDetailFor] = useState<BookingDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const snoozed = useRef<Set<string>>(new Set());
  const loaded = useRef(false);

  const remember = useCallback((key: string) => {
    seen.current.add(key);
    setItem(SEEN_KEY, JSON.stringify([...seen.current].slice(-300)));
  }, []);

  const poll = useCallback(async () => {
    if (!user || isCoolingDown() || AppState.currentState !== 'active') return;
    if (!loaded.current) {
      loaded.current = true;
      try {
        seen.current = new Set(JSON.parse((await getItem(SEEN_KEY)) ?? '[]'));
      } catch {}
    }
    try {
      const [mine, asDriver] = await Promise.all([bookings.mine('passenger'), bookings.mine('driver', 'pending')]);
      const events: Ev[] = [];

      for (const b of asDriver) {
        const key = `req:${b.id}`;
        if (!seen.current.has(key) && !snoozed.current.has(key)) events.push({ kind: 'request', booking: b });
      }

      // passenger: compare with the last statuses we saw
      let prev: Record<string, string> = {};
      try {
        prev = JSON.parse((await getItem(STATUS_KEY)) ?? '{}');
      } catch {}
      const next: Record<string, string> = {};
      for (const b of mine) {
        next[b.id] = `${b.status}|${b.instance_status ?? ''}`;
        const was = (prev[b.id] ?? '').split('|')[0];
        const unpaid = b.status === 'confirmed' && b.payment_status !== 'paid';
        if ((was === 'pending' && b.status === 'confirmed') || (unpaid && b.booking_mode === 'request')) {
          const key = `acc:${b.id}`;
          if (!seen.current.has(key) && !snoozed.current.has(key)) events.push({ kind: 'accepted', booking: b });
        }
        // the driver started the ride: tell the passenger right away, with a way straight to live tracking
        if (b.status === 'confirmed' && b.instance_status === 'in_progress') {
          const key = `start:${b.id}`;
          if (!seen.current.has(key) && !snoozed.current.has(key)) events.push({ kind: 'started', booking: b });
        }
        if (was === 'pending' && b.status === 'cancelled') {
          const key = `dec:${b.id}`;
          if (!seen.current.has(key) && !snoozed.current.has(key)) events.push({ kind: 'declined', booking: b });
        }
      }
      setItem(STATUS_KEY, JSON.stringify(next));

      if (events.length) {
        bumpData();
        setQueue((q) => [...q, ...events.filter((e) => !q.some((x) => x.kind === e.kind && x.booking.id === e.booking.id))]);
      }
    } catch {
      // background check: stay quiet
    }
  }, [user, bumpData]);

  useEffect(() => {
    if (!user) {
      loaded.current = false;
      return;
    }
    const first = setTimeout(poll, 1500);
    const t = setInterval(poll, 60000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && poll());
    const unsubPush = addPushListener((data) => {
      if (data?.type === 'booking_request' || data?.type === 'booking_accepted' || data?.type === 'booking_declined' || data?.type === 'ride_started') poll();
    });
    return () => {
      clearTimeout(first);
      clearInterval(t);
      sub.remove();
      unsubPush();
    };
  }, [user, poll]);

  // tapping a push notification: ride started -> straight to live tracking; anything else -> My rides
  useEffect(() => {
    if (!user) return;
    return listenForPushTaps(async (data) => {
      if (data.type === 'ride_started') {
        try {
          const mine = await bookings.mine('passenger', 'confirmed');
          const live = mine.find((x) => x.instance_status === 'in_progress');
          if (live) return router.push({ pathname: '/tracking', params: { id: String(live.id) } });
        } catch {}
      }
      router.push('/my-rides');
    });
  }, [user]);

  const ev = queue[0];
  const evId = ev?.booking.id;
  const evKind = ev?.kind;
  useEffect(() => {
    if (evId && evKind === 'request') bookings.get(evId).then(setDetailFor).catch(() => {});
  }, [evId, evKind]);
  const detail = detailFor && detailFor.id === evId ? detailFor : null;

  if (!user || !ev) return null;
  const b = ev.booking;
  const key = `${ev.kind === 'request' ? 'req' : ev.kind === 'accepted' ? 'acc' : ev.kind === 'started' ? 'start' : 'dec'}:${b.id}`;
  const next = () => setQueue((q) => q.slice(1));
  const later = () => {
    snoozed.current.add(key);
    next();
  };
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      remember(key);
      toast(ok);
      bumpData();
      next();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const when = b.departure_date ? `${fmtDay(new Date(`${tripDate(b.departure_date)}T00:00:00`))}${b.departure_time ? ` · ${t12(b.departure_time.slice(0, 5))}` : ''}` : '';
  const amount = b.total_price !== undefined ? money(Number(b.total_price)) : '';
  const passenger = name(b.passenger_first_name, b.passenger_last_name) || 'A passenger';
  const driver = name(b.driver_first_name, b.driver_last_name) || 'The driver';
  const unpaid = ev.kind === 'accepted' && b.payment_status !== 'paid';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={later}>
      <View style={styles.scrim}>
        <View style={styles.card}>
          <T w="display" size={24}>
            {ev.kind === 'request' ? 'New booking request' : ev.kind === 'accepted' ? 'Request accepted' : ev.kind === 'started' ? 'Your ride has started' : 'Request declined'}
          </T>

          {ev.kind === 'request' ? (
            <T size={14} color={C.ink2}>
              {passenger} wants to book {b.seats_booked} seat{b.seats_booked > 1 ? 's' : ''} on your ride.
            </T>
          ) : ev.kind === 'started' ? (
            <T size={14} color={C.ink2}>
              {driver} started the trip. Live tracking is now on, so you can follow the car.
            </T>
          ) : ev.kind === 'accepted' ? (
            <T size={14} color={C.ink2}>
              {driver} accepted your request. {unpaid ? `Pay ${amount} now to confirm your seat.` : 'Your seat is confirmed.'}
            </T>
          ) : (
            <T size={14} color={C.ink2}>
              {driver} could not take this trip. If you paid, the amount is refunded.
            </T>
          )}

          <View style={styles.box}>
            <T w="bold">
              {b.start_name} → {b.end_name}
            </T>
            <T size={13} color={C.muted}>
              {when}
            </T>
            {ev.kind === 'request' ? (
              <>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T size={13} color={C.muted}>
                    Passenger
                  </T>
                  <T w="bold" size={13}>
                    {passenger}
                  </T>
                </Row>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T size={13} color={C.muted}>
                    Seats
                  </T>
                  <T w="bold" size={13}>
                    {b.seats_booked}
                  </T>
                </Row>
                {b.pickup_name ? (
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T size={13} color={C.muted}>
                      Pickup
                    </T>
                    <T w="bold" size={13} style={{ textAlign: 'right' }}>
                      {b.pickup_name}
                    </T>
                  </Row>
                ) : null}
                {detail?.special_requests ? (
                  <T size={13} color={C.ink2}>
                    Message: “{detail.special_requests}”
                  </T>
                ) : null}
                {detail?.passenger_mobile ? (
                  <T size={13} color={C.ink2}>
                    Phone: {detail.passenger_mobile}
                  </T>
                ) : null}
              </>
            ) : amount ? (
              <T w="bold">{amount}</T>
            ) : null}
          </View>

          {ev.kind === 'request' ? (
            <Row style={{ gap: 8 }}>
              <Btn label="Decline" kind="out" small style={{ flex: 1, width: undefined }} disabled={busy} onPress={() => run(() => bookings.decline(b.id), 'Request declined')} />
              <Btn label={busy ? 'Please wait…' : 'Accept'} small style={{ flex: 1, width: undefined }} disabled={busy} onPress={() => run(() => bookings.accept(b.id), 'Request accepted. The passenger has been notified.')} />
            </Row>
          ) : ev.kind === 'started' ? (
            <Btn
              label="Track live"
              icon="pin"
              onPress={() => {
                remember(key);
                next();
                router.push({ pathname: '/tracking', params: { id: String(b.id) } });
              }}
            />
          ) : unpaid ? (
            <>
              <Btn
                label={`Pay ${amount}`}
                onPress={() => {
                  remember(key);
                  next();
                  router.push({ pathname: '/booking', params: { id: String(b.id), pay: '1' } });
                }}
              />
              <Btn
                label="View booking"
                kind="out"
                small
                onPress={() => {
                  later();
                  router.push({ pathname: '/booking', params: { id: String(b.id) } });
                }}
              />
            </>
          ) : (
            <Btn
              label="OK"
              small
              onPress={() => {
                remember(key);
                next();
              }}
            />
          )}
          {ev.kind !== 'declined' && (ev.kind === 'request' ? b.passenger_id : b.driver_id) ? (
            <T
              w="bold"
              size={13}
              color={C.oDeep}
              style={{ textAlign: 'center' }}
              onPress={() => {
                later();
                router.push({ pathname: '/user', params: { id: String(ev.kind === 'request' ? b.passenger_id : b.driver_id), name: ev.kind === 'request' ? passenger : driver, rideId: String(b.ride_id ?? '') } });
              }}
            >
              {ev.kind === 'request' ? "View passenger's profile and reviews" : "View driver's profile and reviews"}
            </T>
          ) : null}
          <T w="bold" size={13} color={C.muted} style={{ textAlign: 'center' }} onPress={later}>
            {ev.kind === 'request' ? 'Decide later' : 'Close'}
          </T>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(12,8,16,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: C.card, borderRadius: 24, padding: 20, gap: 12, ...shadow },
  box: { backgroundColor: C.chip, borderRadius: 14, padding: 12, gap: 6 },
});
