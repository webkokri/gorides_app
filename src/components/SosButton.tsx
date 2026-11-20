import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { Icon } from './Icon';
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

  // icon only: a compact red round button with the alert icon and no text
  return (
    <Pressable onPress={confirm} disabled={sending} accessibilityRole="button" accessibilityLabel="Send SOS alert" hitSlop={6} style={[styles.btn, sending && { opacity: 0.5 }]}>
      <Icon name="alert" size={20} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bad, alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'center' },
});
