import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../auth';
import DriverRideControl from '../components/DriverRideControl';
import LiveTracking from '../components/LiveTracking';
import { Btn, Card, Screen, T, TopBar } from '../components/ui';
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
              </>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
