import { Alert, Linking, Platform } from 'react-native';
import { ApiBooking, bookings, rides } from './api';
import { dayOf } from './trips';

export type Stop = { name: string; lat: number; lng: number };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
};
const dist = (a: Stop, b: Stop) => Math.hypot(a.lat - b.lat, a.lng - b.lng);

export type TripPassenger = { bookingId: number; name: string; seats: number; pickupName: string; stop: Stop | null };
export type DriverTrip = { origin: Stop | null; stops: Stop[]; destination: Stop | null; passengers: TripPassenger[] };

/**
 * Everything a driver needs for one trip: where it starts, every pickup point on the way (as stops), where it ends, and the
 * confirmed passengers in the order they are picked up.
 *  - rides with published pickup points (local rides): those points, in their set order;
 *  - other rides: the pickup point each confirmed passenger chose for this day, nearest first.
 */
export async function loadDriverTrip(rideId: number, day: string, instanceId?: number): Promise<DriverTrip> {
  const ride = await rides.get(rideId);
  const origin: Stop | null = num(ride.start_latitude) && num(ride.start_longitude) ? { name: ride.start_location_name ?? 'Start', lat: Number(ride.start_latitude), lng: Number(ride.start_longitude) } : null;
  const destination: Stop | null = num(ride.end_latitude) && num(ride.end_longitude) ? { name: ride.end_location_name ?? 'Destination', lat: Number(ride.end_latitude), lng: Number(ride.end_longitude) } : null;

  const mine: ApiBooking[] = await bookings.mine('driver').catch(() => []);
  const confirmed = mine.filter((b) => b.ride_id === rideId && b.status === 'confirmed' && (instanceId ? b.ride_instance_id === instanceId : !day || dayOf(b) === day));
  const withStop = confirmed.map((b) => ({
    b,
    stop: num(b.pickup_latitude) && num(b.pickup_longitude) ? ({ name: b.pickup_name ?? 'Pickup', lat: Number(b.pickup_latitude), lng: Number(b.pickup_longitude) } as Stop) : null,
  }));
  // pick-up order: nearest to the start first, people without a located pickup last
  const located = withStop.filter((x) => x.stop);
  const rest = withStop.filter((x) => !x.stop);
  const sorted: typeof withStop = [];
  let cur: Stop | null = origin;
  const left = [...located];
  while (left.length) {
    if (cur) left.sort((a, c) => dist(cur as Stop, a.stop as Stop) - dist(cur as Stop, c.stop as Stop));
    const next = left.shift() as (typeof withStop)[number];
    sorted.push(next);
    cur = next.stop;
  }
  const passengers: TripPassenger[] = [...sorted, ...rest].map(({ b, stop }) => ({
    bookingId: b.id,
    name: [b.passenger_first_name, b.passenger_last_name].filter(Boolean).join(' ') || 'Passenger',
    seats: b.seats_booked,
    pickupName: b.pickup_name ?? '',
    stop,
  }));

  const sched = (ride.pickup_schedules ?? []).filter((p) => p.location_type === 'pickup').sort((a, c) => (a.sequence_order ?? 0) - (c.sequence_order ?? 0));
  let stops: Stop[] = sched.filter((p) => num(p.location_latitude) && num(p.location_longitude)).map((p) => ({ name: p.location_name, lat: Number(p.location_latitude), lng: Number(p.location_longitude) }));
  if (!stops.length) {
    const picks = sorted.map((x) => x.stop as Stop);
    stops = picks.filter((p, i) => picks.findIndex((q) => Math.abs(q.lat - p.lat) < 1e-4 && Math.abs(q.lng - p.lng) < 1e-4) === i);
  }
  return { origin, stops: stops.slice(0, 9), destination, passengers };
}

const pt = (s: Stop) => `${s.lat},${s.lng}`;

/** Google Maps: universal link, opens the app when installed. */
export const googleMapsUrl = (origin: Stop | null, stops: Stop[], dest: Stop) =>
  `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${pt(origin)}` : ''}&destination=${pt(dest)}${stops.length ? `&waypoints=${encodeURIComponent(stops.map(pt).join('|'))}` : ''}&travelmode=driving`;

/** Apple Maps: multiple stops are chained with "+to:". */
export const appleMapsUrl = (origin: Stop | null, stops: Stop[], dest: Stop) => `https://maps.apple.com/?${origin ? `saddr=${pt(origin)}&` : ''}daddr=${[...stops, dest].map(pt).join('+to:')}&dirflg=d`;

/** Opens the trip in a maps app: the start, every pickup as a stop, then the destination (asks Apple Maps or Google Maps on iPhone). */
export function openInMaps(trip: DriverTrip, toast: (m: string) => void) {
  const { origin, stops, destination } = trip;
  const dest = destination ?? stops[stops.length - 1];
  if (!dest) return toast('This ride has no pickup points or destination to navigate to yet.');
  const via = destination ? stops : stops.slice(0, -1);
  const open = (url: string) => Linking.openURL(url).catch(() => toast('Could not open the maps app.'));
  if (Platform.OS === 'ios') {
    Alert.alert('Open navigation', `${via.length ? `${via.length} stop${via.length > 1 ? 's' : ''} on the way.` : 'Start to destination.'}`, [
      { text: 'Apple Maps', onPress: () => open(appleMapsUrl(origin, via, dest)) },
      { text: 'Google Maps', onPress: () => open(googleMapsUrl(origin, via, dest)) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  } else {
    open(googleMapsUrl(origin, via, dest));
  }
}
