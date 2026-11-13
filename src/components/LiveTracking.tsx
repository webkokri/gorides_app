import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { Btn, Card, Row, T } from './ui';
import { bookings, settings } from '../lib/api';
import { connectTrackingSocket } from '../lib/trackingSocket';
import { useNow } from '../lib/useNow';
import { C } from '../theme';

type Point = { latitude: number; longitude: number; heading: number | null; speed: number | null; recorded_at: string };
export type LatLng = { lat: number; lng: number };

/**
 * The passenger's live view of the car. Once the driver has started the ride (the trip status becomes in_progress) it joins
 * the live channel and also asks the server every 5 seconds, so the car shows even if the live channel is blocked. A map
 * picture marks the car, your pickup point and the destination, and refreshes with every new position.
 * Before the ride starts, or after it ends, the card is greyed out and says why.
 */
export default function LiveTracking({
  bookingId,
  rideInstanceId,
  status = 'in_progress',
  window: win,
  pickup,
  destination,
}: {
  bookingId: number;
  rideInstanceId: number;
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  window?: { start: Date; end: Date } | null;
  pickup?: LatLng | null;
  destination?: LatLng | null;
}) {
  const now = useNow(2000);
  const running = status === 'in_progress'; // the driver started the ride: tracking is on, whatever the clock says
  const phase: 'before' | 'during' | 'after' = running ? 'during' : !win ? 'during' : now < win.start.getTime() ? 'before' : now > win.end.getTime() ? 'after' : 'during';
  const [point, setPoint] = useState<Point | null>(null);
  const [live, setLive] = useState(false);
  const [mapToken, setMapToken] = useState('');
  const { width } = useWindowDimensions();
  useEffect(() => {
    settings.map().then((m) => setMapToken(m.mapboxAccessToken ?? '')).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!running) return;
      let active = true;
      const socket = connectTrackingSocket();
      const join = () => {
        socket.emit('join_ride_tracking', { ride_instance_id: rideInstanceId }, (res: { success: boolean }) => active && setLive(!!res?.success));
      };
      const onDisconnect = () => setLive(false);
      const onUpdate = (p: Point & { ride_instance_id: number }) => {
        if (active && p.ride_instance_id === rideInstanceId) setPoint(p);
      };
      socket.on('connect', join);
      socket.on('disconnect', onDisconnect);
      socket.on('location_update', onUpdate);
      if (socket.connected) join();

      const sync = () => {
        bookings
          .tracking(bookingId)
          .then((p) => active && p && setPoint(p))
          .catch(() => {});
      };
      sync();
      const poll = setInterval(sync, 5000);
      const reconnect = setInterval(() => connectTrackingSocket(), 30000);

      return () => {
        active = false;
        clearInterval(poll);
        clearInterval(reconnect);
        socket.emit('leave_ride_tracking', { ride_instance_id: rideInstanceId });
        socket.off('connect', join);
        socket.off('disconnect', onDisconnect);
        socket.off('location_update', onUpdate);
      };
    }, [bookingId, rideInstanceId, running]),
  );

  const mapW = Math.min(640, Math.round(width - 64));
  const overlays = point
    ? [
        `pin-l-car+f47a20(${point.longitude},${point.latitude})`,
        pickup ? `pin-s-circle+2f6fe4(${pickup.lng},${pickup.lat})` : '',
        destination ? `pin-s-star+1b1a1f(${destination.lng},${destination.lat})` : '',
      ].filter(Boolean)
    : [];
  // "auto" fits the car, the pickup and the destination in one view
  const mapUrl = point && mapToken ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays.join(',')}/auto/${mapW}x240@2x?padding=48&access_token=${mapToken}` : null;
  const fmt = (d: Date) => d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const ageSec = point ? Math.max(0, Math.round((now - new Date(point.recorded_at).getTime()) / 1000)) : 0;
  const stale = ageSec > 45;

  return (
    <Card style={[{ padding: 16, gap: 10 }, !running && { opacity: 0.55 }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T w="bold">Live tracking</T>
        <T size={11} color={running ? (live || (point && !stale) ? C.good : C.muted) : C.muted}>
          {phase === 'before' ? 'Disabled' : !running && (phase === 'after' || status === 'completed') ? 'Ended' : running ? (point && !stale ? '● Live' : live ? '● Connected' : '○ Connecting…') : 'Not started'}
        </T>
      </Row>
      {!running ? (
        <T size={13} color={C.muted}>
          {phase === 'before' && win
            ? `Live tracking is off until the ride starts at ${fmt(win.start)}.`
            : phase === 'after' || status === 'completed'
              ? 'This ride has ended, so live tracking is off.'
              : status === 'cancelled'
                ? 'This trip was cancelled.'
                : "It's ride time. Tracking goes live the moment your driver starts the ride. This page updates by itself."}
        </T>
      ) : point ? (
        <>
          {mapUrl ? <Image source={{ uri: mapUrl }} style={styles.map} transition={250} accessibilityLabel="Map with the car, your pickup point and the destination" /> : null}
          <T size={13} color={stale ? C.warn : C.ink2}>
            {stale ? `Last location ${ageSec >= 120 ? `${Math.round(ageSec / 60)} min` : `${ageSec} s`} ago. The driver's phone may be offline or out of signal.` : `Updated ${ageSec} s ago`}
            {point.speed != null && point.speed > 0.5 ? ` · ${Math.round(point.speed * 3.6)} km/h` : ''}
          </T>
          <Btn label="Open in Maps" icon="pin" kind="sec" small onPress={() => Linking.openURL(`https://www.google.com/maps?q=${point.latitude},${point.longitude}`)} />
        </>
      ) : (
        <T size={13} color={C.muted}>
          The ride has started. Waiting for the first location from your driver&apos;s phone…
        </T>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', height: 200, borderRadius: 14, backgroundColor: '#E8E4DF' },
});
