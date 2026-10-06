import { ApiBooking } from './api';

const join = (...p: (string | undefined)[]) => p.filter(Boolean).join(' ');

/** Who the other person on a booking is, from the signed-in user's point of view. */
export function counterpart(b: ApiBooking, uid?: number) {
  const iAmDriver = b.driver_id === uid;
  return {
    iAmDriver,
    role: iAmDriver ? ('Passenger' as const) : ('Driver' as const),
    id: iAmDriver ? b.passenger_id : b.driver_id,
    name: (iAmDriver ? join(b.passenger_first_name, b.passenger_last_name) : join(b.driver_first_name, b.driver_last_name)) || (iAmDriver ? 'Passenger' : 'Driver'),
  };
}
