import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState as RNAppState, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from './auth';
import { Ride } from './data';
import { chat, isCoolingDown, settings } from './lib/api';
import type { Place } from './lib/geo';
import { addDays, today } from './lib/format';
import { C, F } from './theme';
import { Icon } from './components/Icon';

export type Mode = 'local' | 'long';
export type Booking = Ride & { bookingId?: number; date: Date; seatsBooked: number; total: number; local: boolean };
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

type Ctx = { s: AppState; set: (p: Partial<AppState>) => void; toast: (msg: string) => void; contactMode: 'public' | 'private'; unread: number; refreshUnread: () => void };
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<AppState>(initial);
  const set = useCallback((p: Partial<AppState>) => setS((prev) => ({ ...prev, ...p })), []);
  const [msg, setMsg] = useState('');
  const [y] = useState(() => new Animated.Value(-120));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const toast = useCallback(
    (m: string) => {
      // "token required" / signed-out errors are not useful to show; screens prompt to sign in instead
      if (/token|sign in required|unauthori[sz]ed|not authenticated/i.test(m)) return;
      setMsg(m);
      if (timer.current) clearTimeout(timer.current);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
      timer.current = setTimeout(() => Animated.timing(y, { toValue: -120, duration: 250, useNativeDriver: true }).start(), 1900);
    },
    [y],
  );

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

  const value = useMemo(() => ({ s, set, toast, contactMode, unread: user ? unread : 0, refreshUnread }), [s, set, toast, contactMode, unread, user, refreshUnread]);
  return (
    <StoreCtx.Provider value={value}>
      {children}
      <Animated.View pointerEvents="none" style={[styles.toast, { top: insets.top + 10, transform: [{ translateY: y }] }]}>
        <Icon name="check" size={18} color="#7EE2B8" />
        <Text style={styles.toastText}>{msg}</Text>
      </Animated.View>
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('useStore must be inside StoreProvider');
  return c;
}

export const paxLabel = (s: AppState) => (s.mode === 'local' ? `${s.pax} rider${s.pax > 1 ? 's' : ''}` : `${s.pax} passenger${s.pax > 1 ? 's' : ''}`);

const styles = StyleSheet.create({
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: C.ink, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 100, maxWidth: '90%' },
  toastText: { color: '#fff', fontFamily: F.semi, fontSize: 14 },
});

