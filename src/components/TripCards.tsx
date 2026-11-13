import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from './Icon';
import { Btn, Card, Row, Sheet, T, Tag } from './ui';
import { ApiBooking, ApiRide, bookings, rides, Subscription } from '../lib/api';
import { ConfirmCancel } from './ConfirmCancel';
import { EditRideSheet } from './EditRideSheet';
import { counterpart } from '../lib/booking';
import { money, t12 } from '../lib/format';
import { tripDate, tripWindow } from '../lib/rideMap';
import { dayOf, isPast, lastTrip, nextTrips, prettyDay } from '../lib/trips';
import { useNow } from '../lib/useNow';
import { useStore } from '../store';
import { C, F } from '../theme';

export function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <View style={{ gap: 10 }}>
      <T w="bold" size={13} color={C.muted} style={{ letterSpacing: 0.8, marginTop: 6 }}>
        {title.toUpperCase()} · {count}
      </T>
      {children}
    </View>
  );
}

/** A booking, seen by the passenger ("My booking") or by the driver ("Passenger on my ride"). */
export function BookingCard({
  b,
  role,
  uid,
  act,
  onRate,
  myGivenRatings,
}: {
  b: ApiBooking;
  role: 'Passenger' | 'Driver';
  uid: number;
  act: (fn: () => Promise<unknown>, ok: string) => void;
  onRate: (id: number, existing?: { stars: number; comment: string }) => void;
  /** Keyed by ratee user id -- one rating per profile, so this is enough to tell "rate" from "edit my rating" apart. */
  myGivenRatings?: Map<number, { stars: number; comment: string }>;
}) {
  const { set } = useStore();
  const who = counterpart(b, uid);
  const myRating = who.id != null ? myGivenRatings?.get(who.id) : undefined;
  const when = [prettyDay(dayOf(b)), b.departure_time ? t12(b.departure_time.slice(0, 5)) : ''].filter(Boolean).join(' · ');
  const cancelled = b.status === 'cancelled';
  const needsPayment = role === 'Passenger' && b.status === 'confirmed' && b.payment_status !== 'paid';

  // Live tracking is only on between the ride's departure and its end (arrival unknown here, so the default window is used)
  const win = b.status === 'confirmed' ? tripWindow(b.departure_date ?? '', b.departure_time) : null;
  const now = useNow();
  const inWindow = !!win && now >= win.start.getTime() && now <= win.end.getTime();
  const running = b.instance_status === 'in_progress';
  // once the driver has started the trip the button is there no matter what the clock says; otherwise until the trip's scheduled end
  const showTracking = b.status === 'confirmed' && (running || (!!win && now <= win.end.getTime()));

  return (
    <Card style={{ padding: 14, gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Tag label={role === 'Driver' ? 'Passenger on my ride' : 'My booking'} icon={role === 'Driver' ? 'car' : 'ticket'} tone={role === 'Driver' ? 'o' : 'plain'} />
        <Tag label={needsPayment ? 'Payment due' : b.status[0].toUpperCase() + b.status.slice(1)} tone={b.status === 'pending' || needsPayment ? 'o' : cancelled ? 'plain' : 'g'} />
      </Row>
      <View style={{ gap: 2 }}>
        <T w="xbold" size={16}>
          {b.start_name ?? 'Start'} → {b.end_name ?? 'Destination'}
        </T>
        <T size={13} color={C.muted}>
          {[when, `${b.seats_booked} seat${b.seats_booked > 1 ? 's' : ''}`, b.total_price !== undefined ? money(Number(b.total_price)) : ''].filter(Boolean).join(' · ')}
        </T>
        <T size={13} color={C.ink2}>
          {who.role}:{' '}
          <T w="bold" size={13} color={C.oDeep} onPress={who.id ? () => router.push({ pathname: '/user', params: { id: String(who.id), name: who.name, rideId: String(b.ride_id ?? '') } }) : undefined}>
            {who.name}
          </T>
        </T>
      </View>
      <Row style={{ gap: 8 }}>
        <Btn small kind="sec" icon="chat" label="Message" style={{ flex: 1, width: undefined }} disabled={cancelled} onPress={() => router.push({ pathname: '/booking-chat', params: { id: String(b.id) } })} />
        <Btn small kind="out" label="Trip details" style={{ flex: 1, width: undefined }} onPress={() => router.push({ pathname: '/booking', params: { id: String(b.id) } })} />
      </Row>

      {showTracking ? (
        <Btn
          small
          icon="pin"
          kind={running || inWindow ? 'pri' : 'out'}
          label={running ? 'Live tracking: ride in progress' : inWindow ? 'Live tracking' : `Live tracking opens ${win ? win.start.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : ''}`}
          disabled={!running && !inWindow}
          onPress={() => router.push({ pathname: '/tracking', params: { id: String(b.id) } })}
        />
      ) : null}
      {needsPayment ? <Btn small label={`Pay ${money(Number(b.total_charged ?? b.total_price ?? 0))} to confirm`} onPress={() => router.push({ pathname: '/booking', params: { id: String(b.id), pay: '1' } })} /> : null}
      {role === 'Driver' && b.status === 'pending' ? (
        <Row style={{ gap: 8 }}>
          <Btn small kind="sec" label="Accept" style={{ flex: 1, width: undefined }} onPress={() => act(() => bookings.accept(b.id), 'Accepted. The passenger has been notified.')} />
          <Btn small kind="out" label="Decline" style={{ flex: 1, width: undefined }} onPress={() => act(() => bookings.decline(b.id), 'Booking declined')} />
        </Row>
      ) : null}
      {b.status === 'completed' ? (
        <Row style={{ gap: 8 }}>
          <Btn
            small
            kind="sec"
            icon="star"
            label={myRating ? 'Edit your rating' : `Rate ${who.role.toLowerCase()}`}
            style={{ flex: 1, width: undefined }}
            onPress={() => onRate(b.id, myRating)}
          />
          {role === 'Passenger' ? (
            <Btn
              small
              kind="out"
              label="Book again"
              style={{ flex: 1, width: undefined }}
              onPress={() => {
                set({ mode: 'long', from: b.start_name ?? '', to: b.end_name ?? '', fromPlace: null, toPlace: null });
                router.push('/results');
              }}
            />
          ) : null}
        </Row>
      ) : null}
    </Card>
  );
}

/**
 * A ride the driver published. A ride with passengers booked is tinted (green while its trip is under way, orange when it
 * has upcoming passengers), so rides that need attention stand out. Upcoming rides can be edited or deleted.
 */
export function PublishedCard({ r, from, past, driverBookings, onChanged }: { r: ApiRide; from: string; past: boolean; driverBookings: ApiBooking[]; onChanged?: () => void }) {
  const { toast, bumpData } = useStore();
  const trips = nextTrips(r, from);
  const first = trips[0];
  const mine = driverBookings.filter((b) => b.ride_id === r.id && b.status !== 'cancelled' && (past || !isPast(b, from)));
  const pending = mine.filter((b) => b.status === 'pending').length;
  const underway = (r.instances ?? []).some((i) => i.status === 'in_progress');
  const withPassengers = !past && mine.length > 0;
  const [edit, setEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const tint = underway ? { backgroundColor: C.goodSoft, borderColor: C.good } : withPassengers ? { backgroundColor: C.oSoft, borderColor: C.o } : null;

  const remove = async () => {
    setBusy(true);
    try {
      await rides.remove(r.id);
      toast('Ride deleted');
      setConfirmDelete(false);
      bumpData();
      onChanged?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete the ride');
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={[{ padding: 14, gap: 8 }, tint && { borderWidth: 1.5, ...tint }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Tag label={past ? 'Past ride' : underway ? 'Trip in progress' : withPassengers ? 'Has passengers' : 'Published ride'} icon="car" tone={past ? 'plain' : underway ? 'g' : 'o'} />
        {pending ? <Tag label={`${pending} request${pending > 1 ? 's' : ''}`} tone="o" /> : <Tag label={`${r.total_seats} seats`} />}
      </Row>
      <T w="xbold" size={16}>
        {r.title ?? `${r.start_location_name ?? ''} → ${r.end_location_name ?? ''}`}
      </T>
      <T size={13} color={C.muted}>
        {!past && first
          ? `Next: ${prettyDay(tripDate(first.departure_date))}${first.departure_time ? ` · ${t12(first.departure_time.slice(0, 5))}` : ''} · ${trips.length} trip${trips.length > 1 ? 's' : ''} ahead`
          : `Last trip ${prettyDay(lastTrip(r)) || 'n/a'}`}
        {` · $${Number(r.price_per_seat)} per seat`}
      </T>
      <T size={13} color={withPassengers || underway ? C.ink : C.ink2} w={withPassengers ? 'bold' : 'regular'}>
        {mine.length} passenger booking{mine.length === 1 ? '' : 's'} on this ride
      </T>
      {!past ? (
        <Row style={{ gap: 8 }}>
          <Btn small kind="out" icon="edit" label="Edit" style={{ flex: 1, width: undefined }} onPress={() => setEdit(true)} />
          <Btn small kind="out" label="Delete" style={{ flex: 1, width: undefined }} onPress={() => setConfirmDelete(true)} />
        </Row>
      ) : null}
      <EditRideSheet ride={edit ? r : null} onClose={() => setEdit(false)} onSaved={() => (bumpData(), onChanged?.())} />
      <ConfirmCancel
        visible={confirmDelete}
        title="Delete this ride?"
        body="The ride is removed and its upcoming departures are cancelled. If passengers still have active bookings, decline or cancel those first. This can't be undone."
        confirmLabel="Yes, delete this ride"
        keepLabel="Keep my ride"
        busy={busy}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </Card>
  );
}

export function SubscriptionCard({ sub, past }: { sub: Subscription; past: boolean }) {
  return (
    <Card style={{ padding: 14, gap: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Tag label="Subscription" icon="route" tone={past ? 'plain' : 'o'} />
        <Tag label={sub.status} tone={sub.status === 'active' ? 'g' : 'plain'} />
      </Row>
      <T w="xbold" size={16}>
        {sub.ride_title ?? `Ride #${sub.ride_id}`}
      </T>
      <T size={13} color={C.muted}>
        {[sub.pickup_name && sub.dropoff_name ? `${sub.pickup_name} → ${sub.dropoff_name}` : '', sub.billing_cycle, sub.monthly_fee !== undefined ? money(Number(sub.monthly_fee)) : ''].filter(Boolean).join(' · ')}
      </T>
      {sub.next_billing_date && sub.status === 'active' ? (
        <T size={13} color={C.ink2}>
          Next billing {sub.next_billing_date.slice(0, 10)}
        </T>
      ) : null}
      {!past ? <Btn small kind="out" label="Manage subscription" onPress={() => router.push('/subscriptions')} /> : null}
    </Card>
  );
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

type RatingDraft = { id: number; stars: number; comment?: string; isEdit?: boolean };

/** Star rating plus a written review (up to 500 characters; the comment is optional). One rating per person, total -- rating again edits it, so this pre-fills from whatever's already there rather than offering a second blank input. */
export function RateSheet({ rating, setRating, onSubmit }: { rating: RatingDraft | null; setRating: (r: RatingDraft | null) => void; onSubmit: (id: number, stars: number, comment: string) => void }) {
  return (
    <Sheet visible={!!rating} title={rating?.isEdit ? 'Edit your rating' : 'Rate your trip'} onClose={() => setRating(null)}>
      {rating ? <RateBody key={rating.id} rating={rating} setRating={setRating} onSubmit={onSubmit} /> : null}
    </Sheet>
  );
}

function RateBody({ rating, setRating, onSubmit }: { rating: RatingDraft; setRating: (r: RatingDraft | null) => void; onSubmit: (id: number, stars: number, comment: string) => void }) {
  const [comment, setComment] = useState(rating.comment ?? '');
  return (
    <>
      <Row style={{ justifyContent: 'center', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating({ ...rating, stars: n })} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}>
            <Icon name="star" size={38} color={n <= rating.stars ? C.star : '#DDD7D2'} fill />
          </Pressable>
        ))}
      </Row>
      <T w="bold" size={14} color={C.ink2} style={{ textAlign: 'center' }}>
        {LABELS[rating.stars]}
      </T>
      <TextInput
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={500}
        placeholder="Write a review (optional): how was the trip?"
        placeholderTextColor="#A9A4AD"
        style={styles.review}
      />
      <T size={12} color={C.muted} style={{ textAlign: 'right' }}>
        {comment.length}/500
      </T>
      <Btn
        label={rating.isEdit ? 'Update review' : 'Submit review'}
        onPress={() => {
          const { id, stars } = rating;
          setRating(null);
          onSubmit(id, stars, comment.trim());
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  review: { minHeight: 110, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, padding: 12, fontFamily: F.regular, fontSize: 15, color: C.ink, textAlignVertical: 'top', backgroundColor: C.card },
});
