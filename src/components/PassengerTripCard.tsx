import React, { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../auth';
import { ApiBooking, bookings } from '../lib/api';
import { counterpart } from '../lib/booking';
import { usePolling } from '../lib/poll';
import { useStore } from '../store';
import { C, glow } from '../theme';
import { Icon } from './Icon';
import { Btn, Row, T } from './ui';

/**
 * Appears for a passenger the moment their driver starts the ride: a pulsing green card with a Track live button straight
 * to the car on the map. Shown on Home and at the top of My rides; checks again every 20 seconds while either is open.
 */
export function PassengerTripCard() {
  const { user } = useAuth();
  const { dataVersion } = useStore();
  const [live, setLive] = useState<ApiBooking[]>([]);
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const load = useCallback(() => {
    if (!user) return;
    bookings
      .mine('passenger', 'confirmed')
      .then((b) => setLive(b.filter((x) => x.instance_status === 'in_progress')))
      .catch(() => {});
  }, [user]);
  usePolling(load, 20000);
  // also reload when bookings change anywhere in the app
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load, dataVersion]);

  if (!user || !live.length) return null;

  return (
    <View style={{ gap: 12 }}>
      {live.map((b) => {
        const who = counterpart(b, user.id);
        return (
          <View key={b.id} style={styles.wrap}>
            <Animated.View pointerEvents="none" style={[styles.halo, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.7] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) }] }]} />
            <View style={styles.card}>
              <Row style={{ gap: 10 }}>
                <Animated.View style={[styles.ic, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }] }]}>
                  <Icon name="car" color="#fff" />
                </Animated.View>
                <View style={{ flex: 1 }}>
                  <T w="xbold" size={16} color="#fff">
                    Your ride has started
                  </T>
                  <T size={13} color="rgba(255,255,255,0.9)">
                    {b.start_name} → {b.end_name}
                  </T>
                </View>
              </Row>
              <T size={13} color="rgba(255,255,255,0.9)">
                {who.name} is on the way. Follow the car live on the map.
              </T>
              <Btn label="Track live" icon="pin" kind="dark" small style={{ backgroundColor: '#fff' }} onPress={() => router.push({ pathname: '/tracking', params: { id: String(b.id) } })} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  halo: { position: 'absolute', left: -4, right: -4, top: -4, bottom: -4, borderRadius: 26, backgroundColor: C.good },
  card: { backgroundColor: '#157A55', borderRadius: 22, padding: 16, gap: 10, ...glow, shadowColor: C.good },
  ic: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
});
