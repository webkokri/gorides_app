import { router } from 'expo-router';
import { useAuth } from '../auth';
import { Ride } from '../data';
import { useStore } from '../store';

/** Opens a ride from a list: your own rides and full rides only show a message. */
export function useOpenRide() {
  const { s, set, toast } = useStore();
  const { user } = useAuth();
  const isOwn = (r: Ride) => r.driverId !== undefined && r.driverId === user?.id;
  const open = (r: Ride) => {
    if (isOwn(r)) return toast("This is your own ride. You can't book it from a passenger account. Manage it under My rides.");
    if (!r.seats) return toast('This ride is full');
    set({ ride: r, mode: r.local ? 'local' : 'long', seats: Math.min(s.pax, r.seats) });
    router.push('/ride');
  };
  return { open, isOwn };
}
