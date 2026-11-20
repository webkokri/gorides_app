import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../auth';
import { ApiBooking, bookings } from '../lib/api';
import { drivingSeconds } from '../lib/geo';
import { counterpart } from '../lib/booking';
import { usePolling } from '../lib/poll';
import { useStore } from '../store';
import { C, glow } from '../theme';
import { Icon } from './Icon';
import { ReturnToTripBtn } from './ReturnToTripBtn';
import { Row, T } from './ui';

/**
 * Appears for a passenger the moment their driver starts the ride: a pulsing green card with a Track live button straight
 * to the car on the map. Shown on Home and at the top of My rides; checks again every 20 seconds while either is open.
 */
export function PassengerTripCard() {
  const { user } = useAuth();
  const { dataVersion } = useStore();
  const [live, setLive] = useState<ApiBooking[]>([]);
  // for each booking: minutes until the car reaches the pickup point and the clock time it reaches the drop-off, from its latest position
  const [eta, setEta] = useState<Record<number, { pickup: number | null; arrive: number | null } | 'waiting'>>({});


  const load = useCallback(() => {
    if (!user) return;
    bookings
      .mine('passenger', 'confirmed')
      .then((b) => setLive(b.filter((x) => x.instance_status === 'in_progress')))
      .catch(() => {});
  }, [user]);
  usePolling(load, 20000);
  // every time the screen is opened or returned to, so an active ride is always shown straight away
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  // also reload when bookings change anywhere in the app
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load, dataVersion]);

  // refresh the ETAs from the car's latest position every 30 seconds
  useEffect(() => {
    if (!live.length) return;
    let on = true;
    const run = async () => {
      for (const b of live) {
        try {
          const p = await bookings.tracking(b.id);
          if (!p || !on) {
            if (on) setEta((e) => ({ ...e, [b.id]: 'waiting' }));
            continue;
          }
          const car = { latitude: Number(p.latitude), longitude: Number(p.longitude) };
          const pick = Number(b.pickup_latitude) && Number(b.pickup_longitude) ? { latitude: Number(b.pickup_latitude), longitude: Number(b.pickup_longitude) } : null;
          const drop = Number(b.dropoff_latitude) && Number(b.dropoff_longitude) ? { latitude: Number(b.dropoff_latitude), longitude: Number(b.dropoff_longitude) } : null;
          const [toPick, toDrop] = await Promise.all([pick ? drivingSeconds(car, pick) : null, drop ? drivingSeconds(car, drop) : null]);
          // within ~2 minutes of the pickup point counts as arrived
          if (on) setEta((e) => ({ ...e, [b.id]: { pickup: toPick !== null && toPick > 120 ? Math.round(toPick / 60) : null, arrive: toDrop !== null ? Date.now() + toDrop * 1000 : null } }));
        } catch {
          if (on) setEta((e) => ({ ...e, [b.id]: 'waiting' }));
        }
      }
    };
    run();
    const t = setInterval(run, 30000);
    return () => {
      on = false;
      clearInterval(t);
    };
  }, [live]);

  if (!user || !live.length) return null;

  return (
    <View style={{ gap: 12 }}>
      {live.map((b) => {
        const who = counterpart(b, user.id);
        return (
          <View key={b.id} style={styles.wrap}>
            <View style={styles.card}>
              <Row style={{ gap: 10 }}>
                <View style={styles.ic}>
                  <Icon name="car" color="#fff" />
                </View>
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
              {(() => {
                const e = eta[b.id];
                const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                if (!e || e === 'waiting') return <T size={13} color="rgba(255,255,255,0.8)">Waiting for the driver&apos;s location…</T>;
                const parts = [e.pickup !== null ? `Pickup in about ${e.pickup} min` : '', e.arrive !== null ? `arriving around ${clock(e.arrive)}` : ''].filter(Boolean);
                return parts.length ? (
                  <T w="bold" size={14} color="#fff">
                    ETA: {parts.join(' · ')}
                  </T>
                ) : null;
              })()}
              <ReturnToTripBtn label="Return to ride" onPress={() => router.push({ pathname: '/tracking', params: { id: String(b.id) } })} />
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
  go: { height: 42, borderRadius: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ic: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
});
