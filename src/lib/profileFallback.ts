import { ApiUser, bookings, PublicProfile, ratings, rides } from './api';

export type ProfileView = PublicProfile & {
  /** true when built from other endpoints because /users/{id}/public-profile isn't on the server yet */
  partial?: boolean;
  /** whether written reviews and the full history are known for this person */
  full?: boolean;
};

const zero = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

/**
 * /users/{id}/public-profile is a new server route. Until it is deployed, show what the live endpoints already give:
 *  - yourself: your own received reviews, rating and counts;
 *  - a driver reached from a ride or booking: the rating, completed trips, member-since date and car on that ride.
 * Returns null when nothing is known about the person (e.g. a passenger on a booking).
 */
export async function fallbackProfile(id: number, me: ApiUser | null, rideId?: number): Promise<ProfileView | null> {
  if (me && id === me.id) {
    const [rec, mine, asPassenger] = await Promise.all([ratings.mine('received'), rides.mine().catch(() => []), bookings.mine('passenger').catch(() => [])]);
    const list = rec.ratings ?? [];
    const dist = { ...zero };
    list.forEach((r) => (dist[String(r.rating) as '1'] += 1));
    const completed = mine.flatMap((r) => r.instances ?? []).filter((i) => i.status === 'completed').length;
    return {
      partial: true,
      full: true,
      user: { id: me.id, first_name: me.first_name, last_name: me.last_name, avatar_url: me.avatar_url, role: me.role === 'driver' || mine.length ? 'driver' : 'passenger', member_since: '', identity_verified: false },
      stats: {
        rides_published: mine.length,
        trips_driven: completed,
        trips_cancelled_as_driver: 0,
        bookings_total: asPassenger.length,
        bookings_completed: asPassenger.filter((b) => b.status === 'completed').length,
        bookings_cancelled: asPassenger.filter((b) => b.status === 'cancelled').length,
      },
      ratings: { average: rec.averageRating ?? 0, total: rec.total ?? list.length, distribution: dist },
      reviews: list.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, rater_role: r.rater_role, created_at: r.created_at, rater_first_name: r.rater_first_name, rater_last_initial: (r.rater_last_name ?? '').slice(0, 1) })),
      vehicle: null,
    };
  }
  if (rideId) {
    const r = await rides.get(rideId);
    if (r.driver_id !== id) return null;
    return {
      partial: true,
      full: false,
      user: { id, first_name: r.first_name ?? '', last_name: r.last_name ?? '', avatar_url: r.driver_avatar ?? null, role: 'driver', member_since: r.driver_member_since ?? '', identity_verified: !!r.driver_verified },
      stats: { rides_published: 0, trips_driven: r.driver_completed_rides ?? 0, trips_cancelled_as_driver: 0, bookings_total: 0, bookings_completed: 0, bookings_cancelled: 0 },
      ratings: { average: r.driver_rating ?? 0, total: r.driver_rating_count ?? 0, distribution: { ...zero } },
      reviews: [],
      vehicle: {
        make: r.vehicle_make ?? null,
        model: r.vehicle_model ?? null,
        year: r.vehicle_year ?? null,
        color: r.vehicle_color ?? null,
        license_plate: r.driver_vehicle_license_plate ?? r.license_plate ?? null,
        photo_urls: r.driver_vehicle_photos ?? [],
        verification_status: 'pending',
      },
    };
  }
  return null;
}
