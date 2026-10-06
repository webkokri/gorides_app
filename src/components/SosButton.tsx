import React, { useState } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { Btn } from './ui';
import { sos } from '../lib/api';
import { useStore } from '../store';
import { C } from '../theme';

/** Emergency button -- available any time, not just during an active ride. Confirms before sending so an
 * accidental tap doesn't page support for nothing. */
export default function SosButton({ bookingId }: { bookingId?: number }) {
  const { toast } = useStore();
  const [sending, setSending] = useState(false);

  const trigger = async () => {
    setSending(true);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        }
      } catch {
        // Location is best-effort -- the alert still goes out without it.
      }
      await sos.trigger({ latitude, longitude, booking_id: bookingId });
      toast('Alert sent. Our team has been notified.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send alert -- please call support directly.');
    } finally {
      setSending(false);
    }
  };

  const confirm = () => {
    Alert.alert('Send SOS alert?', 'This immediately notifies the GORIDES safety team with your current location.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send SOS', style: 'destructive', onPress: trigger },
    ]);
  };

  // Btn is full-width by default, which squeezed the neighbouring text out of the card; this one is a compact, fixed-size pill
  return (
    <Btn
      label={sending ? 'Sending…' : 'SOS'}
      icon="alert"
      kind="dark"
      small
      disabled={sending}
      onPress={confirm}
      style={{ width: undefined, flexShrink: 0, alignSelf: 'center', height: 38, paddingHorizontal: 14, gap: 6, backgroundColor: C.bad }}
    />
  );
}
