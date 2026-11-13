import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Btn, Card, Row, T } from './ui';
import { rides } from '../lib/api';
import { router } from 'expo-router';
import { useNow } from '../lib/useNow';
import { useStore } from '../store';
import { C } from '../theme';

type InstanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

/** Driver-only controls on the trip screen: start the ride (opens live tracking for every passenger on this
 * ride_instance and notifies them) and complete it (closes tracking + chat for all of them). While the ride is in
 * progress the app shares this device's GPS from anywhere in the app (see TripBroadcaster), not just from this screen. */
export default function DriverRideControl({ rideInstanceId, rideId, day = '', instanceStatus, onChanged }: { rideInstanceId: number; rideId?: number; day?: string; instanceStatus?: InstanceStatus; onChanged: () => void }) {
  const { toast, bumpData, broadcast } = useStore();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);

  const run = async (action: 'start' | 'complete') => {
    setBusy(true);
    try {
      if (action === 'start') await rides.startInstance(rideInstanceId);
      else await rides.completeInstance(rideInstanceId);
      toast(action === 'start' ? 'Trip started. Your passengers have been notified.' : 'Trip completed.');
      bumpData();
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const confirm = (action: 'start' | 'complete') =>
    Alert.alert(action === 'start' ? 'Start this trip?' : 'Complete this trip?', action === 'start' ? 'Every confirmed passenger is notified and can follow your trip live.' : 'Live tracking and chat close for everyone on this ride.', [
      { text: 'Not yet', style: 'cancel' },
      { text: action === 'start' ? 'Start trip' : 'Complete trip', onPress: () => run(action) },
    ]);

  const openTrip = () => router.push({ pathname: '/driver-trip', params: { rideId: String(rideId ?? ''), instanceId: String(rideInstanceId), day } });

  if (instanceStatus !== 'scheduled' && instanceStatus !== 'in_progress') return null;

  const sharing = broadcast.instanceId === rideInstanceId;
  const ago = broadcast.lastAt ? Math.max(0, Math.round((now - broadcast.lastAt) / 1000)) : null;

  return (
    <Card style={{ padding: 16, gap: 10 }}>
      <T w="bold">Trip controls</T>
      {instanceStatus === 'scheduled' ? (
        <>
          <T size={13} color={C.muted}>
            Start the trip when you leave. Every confirmed passenger is notified and can follow you live. The next screen shows the whole route on a map.
          </T>
          <Btn label="Start trip" icon="play" small onPress={openTrip} />
        </>
      ) : (
        <>
          <Row style={{ gap: 6 }}>
            <T size={12} color={sharing && !broadcast.error ? C.good : C.warn}>
              {sharing ? (broadcast.error ? `● Not sharing: ${broadcast.error}` : ago !== null ? `● Sharing your location · updated ${ago} s ago` : '● Starting to share your location…') : '● Starting to share your location…'}
            </T>
          </Row>
          <Btn label="Open route" icon="route" kind="sec" small onPress={openTrip} />
          <Btn label={busy ? 'Completing…' : 'Complete trip'} icon="check" kind="out" small disabled={busy} onPress={() => confirm('complete')} />
        </>
      )}
    </Card>
  );
}
