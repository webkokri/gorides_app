import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import SosButton from '../components/SosButton';
import { useStore } from '../store';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../auth';
import DriverRideControl from '../components/DriverRideControl';
import LiveTracking from '../components/LiveTracking';
import { TripMap } from '../components/TripMap';
import { Avatar, Btn, Card, IconBtn, Row, Screen, T, TopBar } from '../components/ui';
import { ApiRide, bookings, BookingDetail, rides } from '../lib/api';
import { counterpart } from '../lib/booking';
import { usePolling } from '../lib/poll';
import { tripDate, tripWindow } from '../lib/rideMap';
import { C } from '../theme';

const coord = (lat?: string | number | null, lng?: string | number | null) => (Number(lat) && Number(lng) ? { lat: Number(lat), lng: Number(lng) } : null);

/**
 * Live tracking for one booking. Passengers see the car (and drivers see what the server has received from their phone);
 * the controls to start the trip and open the route in a maps app are here for the driver. The trip is loaded straight away on
 * opening (never skipped), refreshed in the background, and a failed load shows a message with a Retry button, not a spinner.
 */
export default function Tracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = Number(id);
  const { user } = useAuth();
  const [b, setB] = useState<BookingDetail | null>(null);
  const [ride, setRide] = useState<ApiRide | null>(null);
  const [error, setError] = useState('');
  const [panelH, setPanelH] = useState(150);
  const insets = useSafeAreaInsets();
  const { contactMode } = useStore();

  const reload = useCallback(() => {
    bookings
      .get(bookingId)
      .then((d) => {
        setB(d);
        setError('');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load this trip'));
  }, [bookingId]);

  // load immediately on opening, whatever the background polling is doing
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  usePolling(reload, 10000);

  const rideId = b?.ride_id;
  useEffect(() => {
    if (rideId) rides.get(rideId).then(setRide).catch(() => {});
  }, [rideId]);

  const who = b ? counterpart(b, user?.id) : null;
  const instance = ride?.instances?.find((i) => i.id === b?.ride_instance_id);
  const win = b ? tripWindow(b.departure_date ?? '', b.departure_time, instance?.estimated_arrival_time) : null;
  const day = b?.departure_date ? tripDate(b.departure_date) : '';

  // Once the driver has started, the passenger gets the map as the whole screen, with the driver's details underneath.
  if (b && who && !who.iAmDriver && b.status === 'confirmed' && b.instance_status === 'in_progress' && b.ride_instance_id) {
    const phone = contactMode === 'public' ? b.driver_mobile : undefined;
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <StatusBar style="dark" />
        <TripMap full bottomInset={panelH + 12} bookingId={bookingId} instanceId={b.ride_instance_id} running pickup={coord(b.pickup_latitude, b.pickup_longitude)} destination={coord(b.dropoff_latitude, b.dropoff_longitude) ?? coord(ride?.end_latitude, ride?.end_longitude)} />
        <View style={[styles.floatTop, { top: insets.top + 8 }]}>
          <IconBtn name="back" label="Back" onPress={() => router.back()} />
          <View style={styles.pill}>
            <T w="bold" size={13} numberOfLines={1}>
              {b.start_name} → {b.end_name}
            </T>
          </View>
          <SosButton bookingId={bookingId} />
        </View>
        <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]} onLayout={(e) => setPanelH(e.nativeEvent.layout.height)}>
          <Row style={{ gap: 12 }}>
            <Avatar name={who.name} size={46} />
            <View style={{ flex: 1 }}>
              <T w="bold" size={16} numberOfLines={1}>
                {who.name}
              </T>
              <T size={12} color={C.muted} numberOfLines={2}>
                Your driver is on the way{b.pickup_name ? ` · Pickup: ${b.pickup_name}` : ''}
              </T>
            </View>
            {phone ? (
              <Pressable style={[styles.round, { backgroundColor: C.good }]} onPress={() => Linking.openURL(`tel:${phone}`)} accessibilityLabel={`Call ${who.name}`}>
                <Icon name="phone" size={20} color="#fff" />
              </Pressable>
            ) : null}
            <Pressable style={[styles.round, { backgroundColor: C.o }]} onPress={() => router.push({ pathname: '/booking-chat', params: { id: String(bookingId) } })} accessibilityLabel={`Message ${who.name}`}>
              <Icon name="chat" size={20} color="#fff" />
            </Pressable>
          </Row>
        </View>
      </View>
    );
  }

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Live tracking" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {error && !b ? (
          <Card style={{ padding: 20, gap: 10, alignItems: 'center' }}>
            <T color={C.muted} style={{ textAlign: 'center' }}>
              {error}
            </T>
            <Btn label="Try again" small onPress={reload} />
          </Card>
        ) : !b ? (
          <ActivityIndicator color={C.o} style={{ marginTop: 32 }} />
        ) : (
          <>
            <Card style={{ padding: 14, gap: 4 }}>
              <T w="bold">
                {b.start_name} → {b.end_name}
              </T>
              <T size={13} color={C.muted}>
                {who?.role}: {who?.name}
              </T>
            </Card>
            {b.status === 'pending' ? (
              <Card style={{ padding: 16, opacity: 0.6 }}>
                <T w="bold">Live tracking</T>
                <T size={13} color={C.muted}>
                  Disabled until the driver accepts your request.
                </T>
              </Card>
            ) : b.status === 'cancelled' ? (
              <Card style={{ padding: 16, opacity: 0.6 }}>
                <T w="bold">Live tracking</T>
                <T size={13} color={C.muted}>
                  This booking was cancelled.
                </T>
              </Card>
            ) : (
              <>
                {who?.iAmDriver && b.ride_instance_id ? <DriverRideControl rideInstanceId={b.ride_instance_id} rideId={b.ride_id} day={day} instanceStatus={b.instance_status} onChanged={reload} /> : null}
                {b.ride_instance_id ? (
                  <LiveTracking
                    bookingId={bookingId}
                    rideInstanceId={b.ride_instance_id}
                    status={b.instance_status}
                    window={win}
                    pickup={coord(b.pickup_latitude, b.pickup_longitude)}
                    destination={coord(ride?.end_latitude, ride?.end_longitude)}
                  />
                ) : null}
                {b.ride_instance_id ? <TripMap bookingId={bookingId} running={b.instance_status === 'in_progress'} pickup={coord(b.pickup_latitude, b.pickup_longitude)} destination={coord(b.dropoff_latitude, b.dropoff_longitude) ?? coord(ride?.end_latitude, ride?.end_longitude)} /> : null}
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  floatTop: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: { flex: 1, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 1 } },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 14, gap: 10, elevation: 12, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: -2 } },
  round: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
