import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../auth';
import { Btn, Card, Row, Screen, T, Tag, TopBar } from '../components/ui';
import SosButton from '../components/SosButton';
import LiveTracking from '../components/LiveTracking';
import DriverRideControl from '../components/DriverRideControl';
import { bookings, BookingDetail, users } from '../lib/api';
import { counterpart } from '../lib/booking';
import { fmtLong, money, t12 } from '../lib/format';
import { tripDate } from '../lib/rideMap';
import { useStore } from '../store';
import { C } from '../theme';

export default function Booking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = Number(id);
  const { user } = useAuth();
  const uid = user?.id;
  const { toast, contactMode } = useStore();
  const [b, setB] = useState<BookingDetail | null>(null);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [canBlock, setCanBlock] = useState(false); // false until /users/blocks answers (not deployed on every server yet)
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    bookings.get(bookingId).then(setB).catch(() => {});
  }, [bookingId]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        try {
          const d = await bookings.get(bookingId);
          if (!live) return;
          setB(d);
          setError('');
          const other = counterpart(d, uid).id;
          users
            .blocks()
            .then((list) => {
              if (!live) return;
              setCanBlock(true);
              setBlocked(!!other && list.some((x) => x.user_id === other));
            })
            .catch(() => live && setCanBlock(false));
        } catch (e) {
          if (live) setError(e instanceof Error ? e.message : 'Could not load this booking');
        }
      })();
      return () => {
        live = false;
      };
    }, [bookingId, uid]),
  );

  if (error) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <TopBar title="Trip" />
        <T color={C.muted} style={{ textAlign: 'center', padding: 32 }}>
          {error}
        </T>
      </Screen>
    );
  }
  if (!b) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <TopBar title="Trip" />
        <ActivityIndicator color={C.o} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  const other = counterpart(b, uid);
  // the server only includes numbers when the platform is in 'public' contact mode
  const phone = other.iAmDriver ? b.passenger_mobile : b.driver_mobile;
  const when = b.departure_date ? `${fmtLong(new Date(`${tripDate(b.departure_date)}T00:00:00`))}${b.departure_time ? ` · ${t12(b.departure_time.slice(0, 5))}` : ''}` : '';
  const car = [b.vehicle_make, b.vehicle_model, b.vehicle_color].filter(Boolean).join(' · ');

  const toggleBlock = async () => {
    if (!other.id) return;
    setBusy(true);
    try {
      if (blocked) await users.unblock(other.id);
      else await users.block(other.id);
      setBlocked(!blocked);
      toast(blocked ? 'Unblocked' : 'Blocked. You can no longer message or book with each other.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Trip" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Card style={{ padding: 16, gap: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Tag label={b.status[0].toUpperCase() + b.status.slice(1)} tone={b.status === 'pending' ? 'o' : 'g'} />
            <Row style={{ gap: 10 }}>
              <T size={13} color={C.muted}>
                {b.seats_booked} seat{b.seats_booked > 1 ? 's' : ''}
              </T>
              <SosButton bookingId={bookingId} />
            </Row>
          </Row>
          <T w="xbold" size={18}>
            {b.start_name} → {b.end_name}
          </T>
          <T size={13} color={C.muted}>
            {when}
          </T>
          {b.pickup_name ? (
            <T size={13} color={C.ink2}>
              Pickup: {b.pickup_name}
              {b.dropoff_name ? `  ·  Drop-off: ${b.dropoff_name}` : ''}
            </T>
          ) : null}
          {car ? (
            <T size={13} color={C.ink2}>
              Car: {car}
              {b.driver_vehicle_license_plate || b.license_plate ? ` · ${b.driver_vehicle_license_plate || b.license_plate}` : ''}
            </T>
          ) : null}
          {b.driver_vehicle_photos?.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {b.driver_vehicle_photos.map((url) => (
                <Image key={url} source={{ uri: url }} style={{ width: 110, height: 80, borderRadius: 12 }} />
              ))}
            </ScrollView>
          ) : null}
          {b.total_price !== undefined ? (
            <T w="bold" size={14}>
              {money(Number(b.total_price))} · {b.payment_status === 'paid' ? 'Paid' : b.payment_status === 'pending' ? 'Payment pending' : b.payment_status ?? ''}
            </T>
          ) : null}
        </Card>

        <Card style={{ padding: 16, gap: 10 }}>
          <T w="bold">
            {other.role}: {other.name}
          </T>
          {contactMode === 'public' && phone ? (
            <Btn label={`Call ${phone}`} icon="phone" kind="sec" small onPress={() => Linking.openURL(`tel:${phone}`)} />
          ) : (
            <T size={13} color={C.muted}>
              Phone numbers are private. Use in-app chat to reach {other.name}.
            </T>
          )}
          {b.status !== 'cancelled' && b.status !== 'completed' && !blocked ? (
            <Btn label="Message" icon="chat" small onPress={() => router.push({ pathname: '/booking-chat', params: { id: String(bookingId) } })} />
          ) : null}
          {canBlock && other.id ? <Btn label={busy ? 'Please wait…' : blocked ? `Unblock ${other.name}` : `Block ${other.name}`} kind="out" small disabled={busy} onPress={toggleBlock} /> : null}
          {blocked ? (
            <T size={12} color={C.muted}>
              While blocked, neither of you can message the other, and a blocked passenger cannot book rides from that driver.
            </T>
          ) : null}
        </Card>

        {other.iAmDriver && b.ride_instance_id && (b.status === 'confirmed' || b.status === 'completed') ? (
          <DriverRideControl rideInstanceId={b.ride_instance_id} instanceStatus={b.instance_status} onChanged={reload} />
        ) : null}

        {b.instance_status === 'in_progress' && b.ride_instance_id ? <LiveTracking bookingId={bookingId} rideInstanceId={b.ride_instance_id} /> : null}
      </ScrollView>
    </Screen>
  );
}
