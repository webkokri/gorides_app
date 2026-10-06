import React, { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Btn, Card, Row, T } from './ui';
import { bookings } from '../lib/api';
import { connectTrackingSocket } from '../lib/trackingSocket';
import { C } from '../theme';

type Point = { latitude: number; longitude: number; heading: number | null; speed: number | null; recorded_at: string };

/** Shown on the trip screen only while the ride_instance is 'in_progress' -- the server enforces the same
 * window server-side (both the REST fallback and the socket join), this is just the UI gate. No in-app map
 * library yet, so "View on map" opens the device's own maps app with the latest point. */
export default function LiveTracking({ bookingId, rideInstanceId }: { bookingId: number; rideInstanceId: number }) {
  const [point, setPoint] = useState<Point | null>(null);
  const [live, setLive] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const socket = connectTrackingSocket();

      const join = () => {
        setLive(true);
        socket.emit('join_ride_tracking', { ride_instance_id: rideInstanceId }, (res: { success: boolean }) => {
          if (!res?.success) setLive(false);
        });
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
      pollRef.current = setInterval(sync, 10000);

      return () => {
        active = false;
        socket.emit('leave_ride_tracking', { ride_instance_id: rideInstanceId });
        socket.off('connect', join);
        socket.off('disconnect', onDisconnect);
        socket.off('location_update', onUpdate);
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [bookingId, rideInstanceId]),
  );

  return (
    <Card style={{ padding: 16, gap: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T w="bold">Live tracking</T>
        <Row style={{ gap: 6, alignItems: 'center' }}>
          <T size={11} color={live ? C.good : C.muted}>
            {live ? '● Live' : '○ Connecting…'}
          </T>
        </Row>
      </Row>
      {point ? (
        <>
          <T size={13} color={C.ink2}>
            Last update: {new Date(point.recorded_at).toLocaleTimeString()}
            {point.speed != null ? ` · ${Math.round(point.speed)} km/h` : ''}
          </T>
          <Btn
            label="View on map"
            icon="pin"
            kind="sec"
            small
            onPress={() => Linking.openURL(`https://www.google.com/maps?q=${point.latitude},${point.longitude}`)}
          />
        </>
      ) : (
        <T size={13} color={C.muted}>
          Waiting for the driver&apos;s location…
        </T>
      )}
    </Card>
  );
}
