import { Alert, Linking, Platform } from 'react-native';
import { ApiBooking, bookings, rides } from './api';
import { dayOf } from './trips';

export type Stop = { name: string; lat: number; lng: number };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
};
const dist = (a: Stop, b: Stop) => Math.hypot(a.lat - b.lat, a.lng - b.lng);

/** Greedy nearest-next ordering, starting from `from`. Good enough for a handful of pickups on one route. */
function order(from: Stop, stops: Stop[]): Stop[] {
  const left = [...stops];
  const out: Stop[] = [];
  let cur = from;
  while (left.length) {
    left.sort((a, b) => dist(cur, a) - dist(cur, b));
    cur = left.shift() as Stop;
    out.push(cur);
  }
  return out;
}

/**
 * The route a driver drives for one trip. A (the driver's own location) is left out on purpose: the maps app starts from
 * where the phone is. The stops are the pickup points in order (B, C, D...), and the destination is the end of the ride.
 *  - rides with published pickup points (local rides): those points, in their set order;
 *  - other rides: the pickup point each confirmed passenger chose for this day, nearest first.
 */
export async function buildDriverRoute(rideId: number, day: string): Promise<{ stops: Stop[]; destination: Stop | null }> {
  const ride = await rides.get(rideId);
  const start: Stop | null = num(ride.start_latitude) && num(ride.start_longitude) ? { name: ride.start_location_name ?? 'Start', lat: Number(ride.start_latitude), lng: Number(ride.start_longitude) } : null;
  const end: Stop | null = num(ride.end_latitude) && num(ride.end_longitude) ? { name: ride.end_location_name ?? 'Destination', lat: Number(ride.end_latitude), lng: Number(ride.end_longitude) } : null;

  const sched = (ride.pickup_schedules ?? []).filter((p) => p.location_type === 'pickup').sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0));
  let stops: Stop[] = sched
    .filter((p) => num(p.location_latitude) && num(p.location_longitude))
    .map((p) => ({ name: p.location_name, lat: Number(p.location_latitude), lng: Number(p.location_longitude) }));

  if (!stops.length) {
    const mine: ApiBooking[] = await bookings.mine('driver').catch(() => []);
    const picks = mine
      .filter((b) => b.ride_id === rideId && b.status === 'confirmed' && (!day || dayOf(b) === day) && num(b.pickup_latitude) && num(b.pickup_longitude))
      .map((b) => ({ name: b.pickup_name ?? 'Pickup', lat: Number(b.pickup_latitude), lng: Number(b.pickup_longitude) }));
    const unique = picks.filter((p, i) => picks.findIndex((q) => Math.abs(q.lat - p.lat) < 1e-4 && Math.abs(q.lng - p.lng) < 1e-4) === i);
    stops = start ? order(start, unique) : unique;
  }
  return { stops: stops.slice(0, 9), destination: end };
}

const pt = (s: Stop) => `${s.lat},${s.lng}`;

/** Google Maps: universal link, opens the app when installed. No origin = the phone's current location. */
export const googleMapsUrl = (stops: Stop[], dest: Stop) =>
  `https://www.google.com/maps/dir/?api=1&destination=${pt(dest)}${stops.length ? `&waypoints=${encodeURIComponent(stops.map(pt).join('|'))}` : ''}&travelmode=driving`;

/** Apple Maps: multiple stops are chained with "+to:"; no saddr = the phone's current location. */
export const appleMapsUrl = (stops: Stop[], dest: Stop) => `https://maps.apple.com/?daddr=${[...stops, dest].map(pt).join('+to:')}&dirflg=d`;

/** Build the route for this trip and open it in the driver's maps app (asks Apple Maps or Google Maps on iPhone). */
export async function startRoute(rideId: number, day: string, toast: (m: string) => void) {
  let route: Awaited<ReturnType<typeof buildDriverRoute>>;
  try {
    route = await buildDriverRoute(rideId, day);
  } catch {
    return toast('Could not load the route. Check your connection and try again.');
  }
  const { stops, destination } = route;
  const dest = destination ?? stops[stops.length - 1];
  if (!dest) return toast('This ride has no pickup points or destination to navigate to yet.');
  const via = destination ? stops : stops.slice(0, -1);
  const open = (url: string) => Linking.openURL(url).catch(() => toast('Could not open the maps app.'));
  if (Platform.OS === 'ios') {
    Alert.alert('Start route', `${via.length + 1} stop${via.length ? 's' : ''}, starting from where you are.`, [
      { text: 'Apple Maps', onPress: () => open(appleMapsUrl(via, dest)) },
      { text: 'Google Maps', onPress: () => open(googleMapsUrl(via, dest)) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  } else {
    open(googleMapsUrl(via, dest));
  }
}
