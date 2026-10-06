import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { Btn, Card, Row, T } from './ui';
import { rides } from '../lib/api';
import { connectTrackingSocket } from '../lib/trackingSocket';
import { useStore } from '../store';
import { C } from '../theme';

type InstanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

/** Driver-only controls on the trip screen: start the ride (opens the live-tracking window for every
 * passenger on this ride_instance) and complete it (closes tracking + chat for all of them). While
 * in_progress, broadcasts this device's GPS over the /tracking socket every few seconds. */
export default function DriverRideControl({ rideInstanceId, instanceStatus, onChanged }: { rideInstanceId: number; instanceStatus?: InstanceStatus; onChanged: () => void }) {
  const { toast } = useStore();
  const [busy, setBusy] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const startBroadcast = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      toast('Location permission is required to share your trip location.');
      return;
    }
    const socket = connectTrackingSocket();
    watchRef.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 15 }, (pos) => {
      socket.emit('driver_update_location', {
        ride_instance_id: rideInstanceId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
      });
    });
  }, [rideInstanceId, toast]);

  useFocusEffect(
    useCallback(() => {
      if (instanceStatus === 'in_progress') startBroadcast();
      return () => {
        watchRef.current?.remove();
        watchRef.current = null;
      };
    }, [instanceStatus, startBroadcast]),
  );

  useEffect(() => () => watchRef.current?.remove(), []);

  const run = async (action: 'start' | 'complete') => {
    setBusy(true);
    try {
      if (action === 'start') await rides.startInstance(rideInstanceId);
      else await rides.completeInstance(rideInstanceId);
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (instanceStatus !== 'scheduled' && instanceStatus !== 'in_progress') return null;

  return (
    <Card style={{ padding: 16, gap: 10 }}>
      <T w="bold">Trip controls</T>
      {instanceStatus === 'scheduled' ? (
        <Btn label={busy ? 'Starting…' : 'Start ride'} icon="play" small disabled={busy} onPress={() => run('start')} />
      ) : (
        <>
          <Row style={{ gap: 6 }}>
            <T size={12} color={C.good}>
              ● Sharing your location live
            </T>
          </Row>
          <Btn label={busy ? 'Completing…' : 'Complete ride'} icon="check" kind="sec" small disabled={busy} onPress={() => run('complete')} />
        </>
      )}
    </Card>
  );
}
