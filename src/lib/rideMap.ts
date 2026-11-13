import { Ride } from '../data';
import { ApiRide, ApiInstance } from './api';

// local rides use the full street address as the location name; show just its first part as the title
const place = (n?: string) => n?.split(',')[0].trim();

const hhmm = (t?: string) => (t ?? '').slice(0, 5);

/**
 * The server stores a trip's calendar day as local midnight in its own timezone (UTC+1/+2), so the ISO string
 * lands on the evening before ("2026-10-04T22:00Z" is 5 October). Adding 3 hours and reading the UTC date fixes both.
 */
export const tripDate = (iso: string) => new Date(Date.parse(iso) + 3 * 3600e3).toISOString().slice(0, 10);

const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const duration = (dep: string, arr: string) => {
  if (!dep || !arr) return '';
  const d = (minutes(arr) - minutes(dep) + 1440) % 1440;
  return d >= 60 ? `${Math.floor(d / 60)}h${d % 60 ? String(d % 60).padStart(2, '0') : ''}` : `${d} min`;
};

/** One API ride + one scheduled instance -> the card shape the UI renders. */
export function toRide(r: ApiRide, inst: ApiInstance): Ride {
  const dep = hhmm(inst.departure_time);
  const arr = hhmm(inst.estimated_arrival_time);
  const tags: string[] = [];
  if (r.amenities?.includes('pets')) tags.push('Pets OK');
  if (r.amenities?.includes('winter_tires')) tags.push('Winter tires');
  if (r.amenities?.includes('bikes')) tags.push('Bikes OK');
  if (r.amenities?.includes('skis_snowboards')) tags.push('Skis and snowboards');
  const bag = ({ S: 'Small luggage', M: 'Medium luggage', L: 'Large luggage' } as Record<string, string>)[r.luggage_size ?? ''];
  if (bag) tags.push(bag);
  if (r.back_seat_max === 2) tags.push('Max 2 in back');
  if (r.is_round_trip) tags.push('Round trip');
  const stops = (r.pickup_schedules ?? []).filter((p) => p.location_type === 'pickup').map((p) => ({ time: hhmm(p.pickup_time), place: p.location_name, sub: p.location_address ?? '' }));
  return {
    id: `${r.id}-${inst.id}`,
    instanceId: inst.id,
    rideId: r.id,
    driverId: r.driver_id,
    day: tripDate(inst.departure_date),
    dep,
    arr,
    dur: duration(dep, arr),
    from: place(r.start_location_name) ?? 'Start',
    fromS: r.start_address ?? '',
    to: place(r.end_location_name) ?? 'Destination',
    toS: r.end_address ?? '',
    price: Number(r.price_per_seat),
    tripTotal: Number(r.total_trip_amount) || undefined,
    fixedPrice: !(Number(r.daily_distance_km) > 0),
    seats: inst.available_seats ?? r.total_seats,
    of: r.total_seats,
    driver: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Driver',
    avatar: r.driver_avatar,
    verified: !!r.driver_verified,
    rating: r.driver_rating ?? 0,
    rev: r.driver_rating_count ?? 0,
    car: [[r.vehicle_make, r.vehicle_model].filter(Boolean).join(' '), r.vehicle_color].filter(Boolean).join(' · '),
    instant: r.booking_mode === 'instant',
    pets: !!r.amenities?.includes('pets'),
    tags,
    stops,
    description: r.description ?? undefined,
  };
}

/**
 * The search already filters by date server-side, so no date filter here. Intercity rides become one card per
 * scheduled trip; local commutes repeat on many days, so each local ride is one card (its next trip).
 */
export function toRides(rs: ApiRide[], local = false): Ride[] {
  return rs.flatMap((r) => {
    const open = (r.instances ?? []).filter((i) => !i.status || !['cancelled', 'completed'].includes(i.status));
    return (local ? open.slice(0, 1) : open).map((i) => toRide(r, i));
  });
}

/**
 * Cost sharing, as the server charges it (POST /rides/{id}/book): the trip amount is split equally between the driver
 * and every passenger seat, so one seat costs total / (1 + seats already taken + seats being booked).
 */
export function seatShare(r: Ride, seats: number) {
  if (r.fixedPrice) return { now: r.price * seats, whenFull: r.price * seats };
  const filled = Math.max(0, r.of - r.seats);
  const total = r.tripTotal ?? r.price * r.of;
  return {
    now: (total / (1 + filled + seats)) * seats,
    whenFull: (total / (1 + r.of)) * seats,
  };
}

/**
 * When a trip is on: from its departure time to its estimated arrival time (device local time; a trip that arrives
 * after midnight ends the next day). Used to keep live tracking switched off outside the ride.
 */
export function tripWindow(dateIso: string, departure?: string, arrival?: string): { start: Date; end: Date } | null {
  if (!dateIso || !departure) return null;
  const day = tripDate(dateIso);
  const at = (t: string) => new Date(`${day}T${t.slice(0, 5)}:00`);
  const start = at(departure);
  let end = arrival ? at(arrival) : new Date(start.getTime() + 2 * 3600e3); // no arrival estimate: assume 2 hours
  if (end <= start) end.setDate(end.getDate() + 1);
  return { start, end };
}
