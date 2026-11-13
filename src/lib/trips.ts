import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../auth';
import { useStore } from '../store';
import { ApiBooking, ApiRide, bookings, rides, Subscription, subscriptions } from './api';
import { fmtDay } from './format';
import { tripDate } from './rideMap';

export const dayOf = (b: ApiBooking) => (b.departure_date ? tripDate(b.departure_date) : '');
export const isPast = (b: ApiBooking, todayIso?: string) =>
  b.status === 'completed' ||
  b.status === 'cancelled' ||
  // a trip whose day has passed belongs in History even if nobody marked it completed (an unfinished in-progress trip stays)
  (!!todayIso && !!dayOf(b) && dayOf(b) < todayIso && b.instance_status !== 'in_progress');
export const prettyDay = (d: string) => (d ? fmtDay(new Date(`${d}T00:00:00`)) : '');
const live = (i: { status?: string }) => !i.status || !['cancelled', 'completed'].includes(i.status);

/** Upcoming trips of a published ride (today or later), soonest first. */
export const nextTrips = (r: ApiRide, from: string) => (r.instances ?? []).filter((i) => live(i) && tripDate(i.departure_date) >= from);
export const lastTrip = (r: ApiRide) => [...(r.instances ?? [])].map((i) => tripDate(i.departure_date)).sort().pop() ?? '';
export const byDate = (dir: 1 | -1) => (a: ApiBooking, b: ApiBooking) => dir * (dayOf(a) + (a.departure_time ?? '')).localeCompare(dayOf(b) + (b.departure_time ?? ''));

/** Everything about the signed-in person's trips; reloads when the screen is shown and whenever data changes anywhere. */
export function useTripData() {
  const { user } = useAuth();
  const { toast, dataVersion } = useStore();
  const [asPassenger, setAsPassenger] = useState<ApiBooking[]>([]);
  const [asDriver, setAsDriver] = useState<ApiBooking[]>([]);
  const [published, setPublished] = useState<ApiRide[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [p, d, mine, sub] = await Promise.all([bookings.mine('passenger'), bookings.mine('driver'), rides.mine(), subscriptions.list()]);
      setAsPassenger(p);
      setAsDriver(d);
      setPublished(mine);
      setSubs(sub);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not load your rides');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      if (user) load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, user, dataVersion]),
  );

  return { asPassenger, asDriver, published, subs, loading, load };
}
