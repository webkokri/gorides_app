import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../auth';
import { Btn, Card, Row, Screen, T, Tag, TopBar } from '../components/ui';
import SosButton from '../components/SosButton';
import { ConfirmCancel } from '../components/ConfirmCancel';
import { PayBookingSheet } from '../components/PayBookingSheet';
import { RateSheet } from '../components/TripCards';
import LiveTracking from '../components/LiveTracking';
import DriverRideControl from '../components/DriverRideControl';
import { PriceLine } from '../components/PriceLine';
import { ReportUserSheet } from '../components/ReportUserSheet';
import { ApiRide, bookings, BookingDetail, ratings, rides, users } from '../lib/api';
import { counterpart } from '../lib/booking';
import { usePolling } from '../lib/poll';
import { fmtLong, money, t12 } from '../lib/format';
import { tripDate, tripWindow } from '../lib/rideMap';
import { useStore } from '../store';
import { C } from '../theme';

export default function Booking() {
  const { id, pay } = useLocalSearchParams<{ id: string; pay?: string }>();
  const bookingId = Number(id);
  const { user } = useAuth();
  const uid = user?.id;
  const { toast, contactMode, bumpData } = useStore();
  const [b, setB] = useState<BookingDetail | null>(null);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [canBlock, setCanBlock] = useState(false); // false until /users/blocks answers (not deployed on every server yet)
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [rating, setRating] = useState<{ id: number; stars: number; comment?: string; isEdit?: boolean } | null>(null);
  const [myRating, setMyRating] = useState<{ stars: number; comment: string } | null>(null);
  const [askedPay, setAskedPay] = useState(false);
  const [rideInfo, setRideInfo] = useState<ApiRide | null>(null); // for the trip's estimated arrival time
  const rideId = b?.ride_id;
  useEffect(() => {
    if (rideId) rides.get(rideId).then(setRideInfo).catch(() => {});
  }, [rideId]);

  const reload = useCallback(() => {
    bookings.get(bookingId).then(setB).catch(() => {});
  }, [bookingId]);

  usePolling(reload, 15000);

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
          if (other && d.status === 'completed') {
            ratings
              .mine('given')
              .then((r) => {
                if (!live) return;
                const existing = r.ratings.find((x) => x.ratee_id === other);
                setMyRating(existing ? { stars: existing.rating, comment: existing.comment ?? '' } : null);
              })
              .catch(() => {});
          }
        } catch (e) {
          if (live) setError(e instanceof Error ? e.message : 'Could not load this booking');
        }
      })();
      return () => {
        live = false;
      };
    }, [bookingId, uid]),
  );

  const dueNow = !!b && b.status === 'confirmed' && b.payment_status !== 'paid' && counterpart(b, uid).iAmDriver === false;
  if (pay === '1' && dueNow && !askedPay) {
    // arrived from a Pay button or the acceptance pop-up: open the chooser once
    setAskedPay(true);
    setShowPay(true);
  }

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

        {b.total_price !== undefined && !Number.isNaN(Number(b.total_price)) ? (
          <Card style={{ padding: 16, gap: 10 }}>
            <T w="bold">Payment details</T>
            {(() => {
              const seats = b.seats_booked;
              const share = Number(b.total_price);
              const svc = Number(b.service_fee_amount ?? 0);
              const tax = Number(b.gst_hst_amount ?? 0);
              const proc = Number(b.processing_fee_amount ?? 0);
              const charged = Number(b.total_charged ?? share + svc + tax + proc);
              if (other.iAmDriver)
                return (
                  <>
                    <PriceLine label={`Passenger's seat price · ${seats} seat${seats > 1 ? 's' : ''}`} amount={share} why="This is the price you set per seat. It does not change when other passengers join." />
                    <T size={12} color={C.muted}>
                      The passenger also paid GORIDES fees and tax on top of this. Those are not taken from the share above. The GORIDES driver service fee is deducted when you are paid out; see Driver earnings.
                    </T>
                  </>
                );
              return (
                <>
                  <PriceLine label={`Seat price set by the driver · ${seats} seat${seats > 1 ? 's' : ''}`} amount={share} bold why="The driver sets this price per seat. It does not change when other passengers join." />
                  {svc > 0 ? <PriceLine label="GORIDES service fee" amount={svc} why="Paid to GORIDES for secure in-app payment, support and safety. The driver does not receive it." /> : null}
                  {tax > 0 ? <PriceLine label="GST/HST" amount={tax} why="Sales tax on the seat price plus the service fee." /> : null}
                  {proc > 0 ? <PriceLine label="Card processing fee" amount={proc} why="Charged by the card payment processor. Wallet payments have no processing fee." /> : null}
                  <PriceLine label="Total charged" amount={charged} bold />
                </>
              );
            })()}
          </Card>
        ) : null}

        {!other.iAmDriver && b.status === 'confirmed' && b.payment_status !== 'paid' ? (
          <Card style={{ padding: 16, gap: 10, borderColor: C.o, borderWidth: 1.5 }}>
            <T w="bold">Payment due</T>
            <T size={13} color={C.ink2}>
              The driver accepted your request. Pay inside GORIDES to confirm your seat. Never pay the driver directly.
            </T>
            <Btn label={`Pay ${money(Number(b.total_charged ?? b.total_price ?? 0))} to confirm`} onPress={() => setShowPay(true)} />
          </Card>
        ) : null}

        <Card style={{ padding: 16, gap: 10 }}>
          <T w="bold">
            {other.role}: {other.name}
          </T>
          {other.id ? <Btn label={`View ${other.name}'s profile`} icon="user" kind="sec" small onPress={() => router.push({ pathname: '/user', params: { id: String(other.id), name: other.name, rideId: String(b.ride_id ?? '') } })} /> : null}
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
          {other.id ? <Btn label={`Report ${other.name}`} icon="alert" kind="out" small onPress={() => setShowReport(true)} /> : null}
          {blocked ? (
            <T size={12} color={C.muted}>
              While blocked, neither of you can message the other, and a blocked passenger cannot book rides from that driver.
            </T>
          ) : null}
        </Card>

        {other.iAmDriver && b.ride_instance_id && (b.status === 'confirmed' || b.status === 'completed') ? (
          <DriverRideControl rideInstanceId={b.ride_instance_id} rideId={b.ride_id} day={b.departure_date ? tripDate(b.departure_date) : ''} instanceStatus={b.instance_status} onChanged={reload} />
        ) : null}

        {b.status === 'completed' ? (
          <Card style={{ padding: 16, gap: 10 }}>
            <T w="bold">How was your trip with {other.name}?</T>
            <T size={13} color={C.muted}>
              Leave a star rating and a short review. It helps other people choose.
            </T>
            <Btn
              label={myRating ? 'Edit your rating' : 'Write a review'}
              icon="star"
              kind="sec"
              small
              onPress={() => setRating({ id: bookingId, stars: myRating?.stars ?? 5, comment: myRating?.comment, isEdit: !!myRating })}
            />
          </Card>
        ) : null}

        {/* the tracking card is always here for a booked trip; it is disabled outside the ride's start-to-end time and goes live once the driver starts the ride */}
        {b.status === 'pending' ? (
          <Card style={{ padding: 16, gap: 4, opacity: 0.6 }}>
            <T w="bold">Live tracking</T>
            <T size={13} color={C.muted}>
              Disabled until the driver accepts the request.
            </T>
          </Card>
        ) : null}
        {b.ride_instance_id && (b.status === 'confirmed' || b.status === 'completed') ? (
          <>
            <LiveTracking bookingId={bookingId} rideInstanceId={b.ride_instance_id} status={b.instance_status} window={tripWindow(b.departure_date ?? '', b.departure_time, rideInfo?.instances?.find((i) => i.id === b.ride_instance_id)?.estimated_arrival_time)} pickup={Number(b.pickup_latitude) && Number(b.pickup_longitude) ? { lat: Number(b.pickup_latitude), lng: Number(b.pickup_longitude) } : null} destination={Number(rideInfo?.end_latitude) && Number(rideInfo?.end_longitude) ? { lat: Number(rideInfo?.end_latitude), lng: Number(rideInfo?.end_longitude) } : null} />
            <Btn label="Open live tracking" icon="pin" kind="sec" small onPress={() => router.push({ pathname: '/tracking', params: { id: String(bookingId) } })} />
          </>
        ) : null}

        {!other.iAmDriver && (b.status === 'pending' || b.status === 'confirmed') ? (
          <View style={{ marginTop: 28, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line, gap: 6 }}>
            <T w="bold" size={13} color={C.muted} style={{ letterSpacing: 0.8 }}>
              MANAGE BOOKING
            </T>
            <T size={13} color={C.muted}>
              Need to change your plans? You can cancel this booking.
            </T>
            <T w="bold" size={14} color={C.bad} style={{ paddingVertical: 10 }} onPress={() => setConfirmCancel(true)} accessibilityRole="button">
              Cancel this booking…
            </T>
          </View>
        ) : null}
      </ScrollView>
      <RateSheet
        rating={rating}
        setRating={setRating}
        onSubmit={async (rid, stars, comment) => {
          try {
            await ratings.rate(rid, stars, comment || undefined);
            setMyRating({ stars, comment });
            toast(rating?.isEdit ? 'Your rating was updated' : 'Thanks! Your review was saved');
            bumpData();
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not save your review');
          }
        }}
      />
      <PayBookingSheet visible={showPay} bookingId={bookingId} amount={Number(b.total_charged ?? b.total_price ?? 0)} onClose={() => setShowPay(false)} onPaid={reload} />
      <ReportUserSheet visible={showReport} userId={other.id} userName={other.name} bookingId={bookingId} onClose={() => setShowReport(false)} />
      <ConfirmCancel
        visible={confirmCancel}
        title="Cancel this booking?"
        body={`${b.start_name ?? ''} → ${b.end_name ?? ''}${when ? `, ${when}` : ''}. Your seat will be released. ${b.title?.endsWith('(Return)') ? 'This is a return trip, so it is not refundable.' : 'Wallet payments are refunded to your wallet; for card payments you choose where the refund goes under Wallet and refunds.'}`}
        confirmLabel="Yes, cancel this booking"
        keepLabel="Keep my booking"
        busy={busy}
        onClose={() => setConfirmCancel(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await bookings.cancel(bookingId);
            setConfirmCancel(false);
            toast('Booking cancelled');
            bumpData();
            reload();
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not cancel');
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
