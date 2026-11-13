import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { AppState as RNAppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from './auth';
import { Ride } from './data';
import { chat, isCoolingDown, setSignedOutActionHandler, settings } from './lib/api';
import type { Place } from './lib/geo';
import { addDays, today } from './lib/format';
import { Toaster, ToastItem } from './components/Toaster';

export type Mode = 'local' | 'long';
export type Booking = Ride & { bookingId?: number; date: Date; seatsBooked: number; total: number; local: boolean; paidUpFront?: boolean };
export type Published = { from: string; to: string; date: Date; time: string; seats: number; price: number };

export type AppState = {
  mode: Mode;
  pax: number;
  from: string;
  to: string;
  date: Date;
  localFrom: string;
  localTo: string | null;
  localDate: Date;
  localTrips: number; // round trips per month, 1 to 30
  ride: Ride | null;
  seats: number;
  booked: Booking | null;
  published: Published | null;
  chatWith: string;
  // coordinates for the labels above; when absent the label is geocoded at search time
  fromPlace: Place | null;
  toPlace: Place | null;
  localFromPlace: Place | null;
  localToPlace: Place | null;
};

const initial: AppState = {
  mode: 'local',
  pax: 1,
  from: 'Toronto, ON',
  to: 'Ottawa, ON',
  date: addDays(today(), 1),
  localFrom: '',
  localTo: null,
  localDate: addDays(today(), 1),
  localTrips: 20,
  ride: null,
  seats: 1,
  booked: null,
  published: null,
  chatWith: 'driver',
  fromPlace: null,
  toPlace: null,
  localFromPlace: null,
  localToPlace: null,
};

export type Broadcast = { instanceId: number | null; lastAt: number; error: string };

type Ctx = { broadcast: Broadcast; setBroadcast: (b: Partial<Broadcast>) => void; s: AppState; set: (p: Partial<AppState>) => void; toast: (msg: string) => void; contactMode: 'public' | 'private'; unread: number; refreshUnread: () => void; dataVersion: number; bumpData: () => void };
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<AppState>(initial);
  const set = useCallback((p: Partial<AppState>) => setS((prev) => ({ ...prev, ...p })), []);
  const [toastItem, setToastItem] = useState<ToastItem | null>(null);
  // is this phone currently sharing the driver's location, and did the last update reach the server?
  const [broadcast, setBroadcastState] = useState<Broadcast>({ instanceId: null, lastAt: 0, error: '' });
  const setBroadcast = useCallback((b: Partial<Broadcast>) => setBroadcastState((prev) => ({ ...prev, ...b })), []);
  const insets = useSafeAreaInsets();

  const toast = useCallback(
    (m: string) => {
      // "token required" / signed-out errors are not useful to show; screens prompt to sign in instead
      if (/token|sign in required|unauthori[sz]ed|not authenticated/i.test(m)) return;
      setToastItem({ id: Date.now() + Math.random(), text: m });
    },
    [],
  );

  // an account action (book, publish, message...) attempted while signed out: say so and open the login page
  useEffect(() => {
    setSignedOutActionHandler(() => {
      toast('Please log in or create an account first.');
      router.push({ pathname: '/signin', params: { mode: 'in' } });
    });
    return () => setSignedOutActionHandler(null);
  }, [toast]);

  // Platform-wide contact visibility: fetched once at launch. Private is the safe default if it can't be read.
  const [contactMode, setContactMode] = useState<'public' | 'private'>('private');
  useEffect(() => {
    settings.app().then((a) => a.contact_visibility_mode && setContactMode(a.contact_visibility_mode)).catch(() => {});
  }, []);

  // Unread chat badge: poll every 20s while signed in
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const refreshUnread = useCallback(() => {
    if (RNAppState.currentState !== 'active' || isCoolingDown()) return;
    chat.unreadCount().then((r) => setUnread(r.unread_count)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!user) return;
    const first = setTimeout(refreshUnread, 0);
    const t = setInterval(refreshUnread, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [user, refreshUnread]);

  // bumped whenever bookings/subscriptions change, so My rides and Profile reload straight away
  const [dataVersion, setDataVersion] = useState(0);
  const bumpData = useCallback(() => setDataVersion((v) => v + 1), []);

  const value = useMemo(() => ({ broadcast, setBroadcast, s, set, toast, contactMode, unread: user ? unread : 0, refreshUnread, dataVersion, bumpData }), [broadcast, setBroadcast, s, set, toast, contactMode, unread, user, refreshUnread, dataVersion, bumpData]);
  return (
    <StoreCtx.Provider value={value}>
      {children}
      <Toaster toast={toastItem} top={insets.top} />
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('useStore must be inside StoreProvider');
  return c;
}

export const paxLabel = (s: AppState) => (s.mode === 'local' ? `${s.pax} rider${s.pax > 1 ? 's' : ''}` : `${s.pax} passenger${s.pax > 1 ? 's' : ''}`);
