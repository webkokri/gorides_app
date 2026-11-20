import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import { bookings, isCoolingDown, rides } from '../lib/api';
import { tripDate } from '../lib/rideMap';
import { useStore } from '../store';
import { C } from '../theme';
import { Icon } from './Icon';
import { T } from './ui';

type Live = { rideId: number; instanceId: number; day: string; route: string; bookingId?: number };

/**
 * While the driver has a trip in progress, a bar stays at the bottom of every other screen: "Trip in progress · Return to trip",
 * so they can always get back to the trip map. It is hidden on the trip screen itself.
 */
export function ActiveTripBar() {
  const { user } = useAuth();
  const { dataVersion, liveHint } = useStore();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [live, setLive] = useState<Live | null>(null);

  const load = useCallback(() => {
    if (!user || isCoolingDown()) return;
    rides
      .mine()
      .then((mine) => {
        for (const r of mine) {
          const i = (r.instances ?? []).find((x) => x.status === 'in_progress');
          if (i) return setLive({ rideId: r.id, instanceId: i.id, day: tripDate(i.departure_date), route: r.title ?? `${r.start_location_name ?? ''} → ${r.end_location_name ?? ''}` });
        }
        // not driving: a passenger whose ride is under way
        return bookings.mine('passenger', 'confirmed').then((bs) => {
          const b = bs.find((x) => x.instance_status === 'in_progress');
          setLive(b ? { rideId: b.ride_id ?? 0, instanceId: b.ride_instance_id ?? 0, day: '', route: `${b.start_name} → ${b.end_name}`, bookingId: b.id } : null);
        });
      })
      .catch(() => {});
  }, [user]);
  useEffect(() => {
    const first = setTimeout(load, 500);
    const t = setInterval(load, 60000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
    return () => {
      clearTimeout(first);
      clearInterval(t);
      sub.remove();
    };
  }, [load, dataVersion, liveHint]);

  // on the four main screens the floating tab bar sits at the bottom, so the bar rides above it
  const onTabs = ['/home', '/inbox', '/my-rides', '/profile'].includes(pathname);
  if (!user || !live || pathname.startsWith('/driver-trip') || pathname.startsWith('/tracking') || pathname.startsWith('/signin') || pathname === '/' || pathname.startsWith('/onboarding')) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + (onTabs ? 100 : 12) }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Return to your trip in progress" style={styles.bar} onPress={() => (live.bookingId ? router.push({ pathname: '/tracking', params: { id: String(live.bookingId) } }) : router.push({ pathname: '/driver-trip', params: { rideId: String(live.rideId), instanceId: String(live.instanceId), day: live.day } }))}>
        <View style={styles.dot} />
        <View style={{ flex: 1 }}>
          <T w="bold" size={14} color="#fff">
            {live.bookingId ? 'Your ride is in progress' : 'Trip in progress'}
          </T>
          <T size={12} color="rgba(255,255,255,0.85)" numberOfLines={1}>
            {live.route}
          </T>
        </View>
        <T w="bold" size={13} color="#fff">
          {live.bookingId ? 'Return to ride' : 'Return to trip'}
        </T>
        <Icon name="chev" size={16} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.oDeep, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, elevation: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#7CFFB5' },
});
