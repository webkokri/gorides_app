import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { useAuth } from '../auth';
import { auth, isCoolingDown, rides } from '../lib/api';
import { connectTrackingSocket } from '../lib/trackingSocket';
import { useStore } from '../store';

type Fix = { latitude: number; longitude: number; heading: number | null; speed: number | null };

/**
 * Shares the driver's GPS with the passengers while one of their rides is in progress, whichever screen is open.
 * It sends a fix straight away, then on every GPS update, and re-sends the last position every few seconds even when the
 * car is parked (a car that has not moved 15 m would otherwise never report, and passengers would wait forever).
 * Each update is acknowledged by the server; the result is published to the store so the driver can see whether it is working.
 * (Foreground only: the phone stops sending if the app is closed. Background location needs a separate native setup.)
 */
export function TripBroadcaster() {
  const { user } = useAuth();
  const { dataVersion, setBroadcast } = useStore();
  const [instanceId, setInstanceId] = useState<number | null>(null);

  const find = useCallback(async () => {
    if (!user || isCoolingDown() || AppState.currentState !== 'active') return;
    try {
      const mine = await rides.mine();
      const live = mine.flatMap((r) => r.instances ?? []).find((i) => i.status === 'in_progress');
      setInstanceId(live?.id ?? null);
    } catch {
      // keep whatever we had
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const first = setTimeout(find, 1000);
    const t = setInterval(find, 60000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [user, find, dataVersion]);

  useEffect(() => {
    if (!user || !instanceId) {
      setBroadcast({ instanceId: null });
      return;
    }
    let cancelled = false;
    let sub: Location.LocationSubscription | null = null;
    let last: Fix | null = null;
    let lastSentAt = 0;
    const socket = connectTrackingSocket();
    setBroadcast({ instanceId, error: '' });

    const send = (fix: Fix) => {
      last = fix;
      lastSentAt = Date.now();
      socket.emit('driver_update_location', { ride_instance_id: instanceId, ...fix }, (ack?: { success?: boolean; error?: string }) => {
        if (cancelled) return;
        if (ack?.success) setBroadcast({ lastAt: Date.now(), error: '' });
        else setBroadcast({ error: ack?.error ?? 'The server did not accept the location update.' });
      });
    };
    const toFix = (p: Location.LocationObject): Fix => ({ latitude: p.coords.latitude, longitude: p.coords.longitude, heading: p.coords.heading, speed: p.coords.speed });

    // the access token lasts an hour: a refused connection means it expired, so renew it and reconnect with the new one
    const onConnectError = (e: Error) => {
      if (cancelled) return;
      setBroadcast({ error: /unauthori/i.test(e.message) ? 'Reconnecting…' : `Can't reach the tracking server (${e.message}).` });
      if (/unauthori/i.test(e.message)) auth.me().catch(() => {}).finally(() => !cancelled && connectTrackingSocket());
    };
    socket.on('connect_error', onConnectError);

    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (perm.status !== 'granted') {
        setBroadcast({ error: 'Location permission is off, so passengers cannot see your car. Allow location for GORIDES in your phone settings.' });
        return;
      }
      try {
        send(toFix(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })));
      } catch {
        setBroadcast({ error: 'Could not get your GPS position. Check that location is switched on.' });
      }
      if (cancelled) return;
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 0 }, (p) => send(toFix(p)));
      if (cancelled) sub.remove();
    })().catch(() => setBroadcast({ error: 'Could not start sharing your location.' }));

    const heartbeat = setInterval(() => {
      if (last && Date.now() - lastSentAt > 5000) send(last);
    }, 5000);
    const reconnect = setInterval(() => connectTrackingSocket(), 30000);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      clearInterval(reconnect);
      socket.off('connect_error', onConnectError);
      sub?.remove();
    };
  }, [user, instanceId, setBroadcast]);

  return null;
}
