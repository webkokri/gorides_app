import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Btn, Card, Row, Screen, Stepper, T, TopBar } from '../components/ui';
import { fmtLong, money, t12, today } from '../lib/format';
import { ApiRide, bookings, rides, wallet } from '../lib/api';
import { seatShare } from '../lib/rideMap';
import { PriceLine } from '../components/PriceLine';
import { payWithStripe, stripeSupported } from '../lib/stripe';
import { useAuth } from '../auth';
import { useStore } from '../store';
import { C, F } from '../theme';

export default function Book() {
  const { s, set, toast, bumpData } = useStore();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [pickup, setPickup] = useState(0);
  const [pay, setPay] = useState(0);
  // request-mode rides: the driver reviews first and the passenger pays after they accept. Some servers still take
  // payment with the request; when this server says so, the payment choices appear.
  const [needsPay, setNeedsPay] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [detail, setDetail] = useState<ApiRide | null>(null);
  const [tripType, setTripType] = useState<'one_way' | 'round_trip'>('one_way');
  const [returnInstanceId, setReturnInstanceId] = useState<number | null>(null);
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof rides.quote>> | null>(null);
  const r = s.ride;
  const rideId = r?.rideId;
  useEffect(() => {
    wallet.get().then((w) => setBalance(Number(w.balance))).catch(() => {});
    if (rideId) rides.get(rideId).then(setDetail).catch(() => {});
  }, [rideId]);
  useEffect(() => {
    if (r?.instanceId) rides.quote(r.instanceId, s.seats).then(setQuote).catch(() => setQuote(null));
  }, [r?.instanceId, s.seats]);
  if (!r || (r.driverId !== undefined && r.driverId === user?.id)) return <Redirect href="/home" />; // a driver can't book their own ride
  const local = s.mode === 'local';
  const share = seatShare(r, s.seats);
  // Round trip: each leg is its own independently-priced booking (see
  // POST /rides/[id]/book) -- the return leg is always the same
  // price_per_seat as the outbound (see rides/route.ts), so doubling the
  // outbound share is exact, not an estimate.
  const isReturnRide = !!detail?.title?.endsWith('(Return)');
  const canRoundTrip = !local && !!detail?.is_round_trip && !!detail?.return_ride?.instances?.length;
  const pays: { method: 'wallet' | 'stripe'; badge: string; bg: string; t: string; s: string }[] = [
    { method: 'wallet', badge: 'GO', bg: C.o, t: 'GORIDES Wallet', s: balance === null ? 'Checking balance…' : `Balance ${money(balance)}${quote ? ` · total ${money(quote.by_payment_method.wallet.total_charged * (tripType === 'round_trip' ? 2 : 1))}` : ''}` },
    ...(stripeSupported ? [{ method: 'stripe' as const, badge: 'CARD', bg: '#1A1F71', t: 'Card or bank debit', s: `Secure checkout by Stripe${quote ? ` · total ${money(quote.by_payment_method.stripe.total_charged * (tripType === 'round_trip' ? 2 : 1))} incl. card fee` : ''}` }] : []),
  ];
  // Pay-after-accept settles via wallet (see /bookings/:id/pay), so quote
  // with wallet math until the passenger actually picks Stripe.
  const quoteMethod = needsPay ? pays[pay]?.method ?? 'wallet' : 'wallet';
  const charge = quote?.by_payment_method[quoteMethod];
  const baseShare = quote ? quote.base_amount : share.now;
  const serviceFee = charge?.service_fee_amount ?? 0;
  const gstHst = charge?.gst_hst_amount ?? 0;
  const processingFee = charge?.processing_fee_amount ?? 0;
  const legMultiplier = tripType === 'round_trip' ? 2 : 1;
  // every seat costs what the driver set; fees and tax come on top
  const seatPrice = baseShare * legMultiplier;
  const feePercent = quote?.service_fee_percent;
  const taxPercent = quote?.gst_hst_percent;
  const cardTotal = quote ? quote.by_payment_method.stripe.total_charged * legMultiplier : null;
  const walletTotal = quote ? quote.by_payment_method.wallet.total_charged * legMultiplier : null;
  const seatsLabel = ` · ${s.seats} seat${s.seats > 1 ? 's' : ''}${tripType === 'round_trip' ? ' · both legs' : ''}`;
  const total = charge ? charge.total_charged * legMultiplier : share.now * legMultiplier; // falls back to the local estimate while the quote loads

  const confirm = async () => {
    if (!r.instanceId) return toast('This ride cannot be booked');
    if (detail?.driver_id !== undefined && detail.driver_id === user?.id) return toast("You can't book a ride you published.");
    if (tripType === 'round_trip' && !returnInstanceId) return toast('Pick a return date first');
    setBusy(true);
    try {
      // payment is part of the booking call: wallet is charged immediately, card returns a PaymentIntent to confirm
      const requestFirst = !r.instant && !needsPay;
      const method = requestFirst ? undefined : pays[pay].method;
      const res = await rides.book(r.instanceId, {
        seats_booked: s.seats,
        payment_method: method,
        special_requests: note.trim() || undefined,
        pickup_location: pickups[pickup].loc,
        trip_type: tripType,
      });
      if (method === 'stripe' && res.stripe_client_secret) {
        const paid = await payWithStripe(res.stripe_client_secret);
        if (!paid) {
          toast('Payment not completed. Your seat is held for now.');
          router.replace('/my-rides');
          return;
        }
        // Don't wait on the webhook to learn this succeeded -- tell the
        // server right now, same moment Stripe just told us.
        bookings.syncPayment(res.booking_id).catch(() => {});
      }
      if (tripType === 'round_trip' && returnInstanceId) {
        try {
          const returnRes = await rides.book(returnInstanceId, {
            seats_booked: s.seats,
            payment_method: method,
            trip_type: 'round_trip',
            linked_booking_id: res.booking_id,
          });
          if (method === 'stripe' && returnRes.stripe_client_secret) {
            const paid = await payWithStripe(returnRes.stripe_client_secret);
            if (!paid) toast('Outbound booked. Return payment not completed -- your return seat is held for now.');
            else bookings.syncPayment(returnRes.booking_id).catch(() => {});
          }
        } catch (e) {
          toast(`Outbound booked, but the return leg failed: ${e instanceof Error ? e.message : 'unknown error'}`);
        }
      }
      set({ booked: { ...r, bookingId: res.booking_id, date: local ? today() : s.date, seatsBooked: s.seats, total, local, instant: res.status === 'confirmed', paidUpFront: method !== undefined } });
      bumpData();
      router.replace('/booked');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Booking failed';
      if (!r.instant && !needsPay && /payment_method/i.test(msg)) {
        setNeedsPay(true);
        toast('This ride takes payment with the request. Choose how to pay, then send it again.');
      } else toast(msg);
    } finally {
      setBusy(false);
    }
  };

  const pl = (detail?.pickup_schedules ?? []).filter((p) => p.location_type === 'pickup');
  const pickups: { t: string; s: string; loc?: object }[] = pl.length
    ? pl.map((p) => ({
        t: p.location_name,
        s: `${p.location_address ?? ''}${p.pickup_time ? ` · ${t12(p.pickup_time.slice(0, 5))}` : ''}`,
        loc: { name: p.location_name, address: p.location_address, latitude: Number(p.location_latitude), longitude: Number(p.location_longitude) },
      }))
    : [{ t: r.from, s: `${r.fromS} · ${t12(r.dep)}` }];

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Confirm booking" />
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
        <Card style={styles.blk}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T w="bold">
                {r.from} → {r.to}
              </T>
              <T size={12} color={C.muted}>
                {local ? 'Today' : fmtLong(s.date)} · {t12(r.dep)}
              </T>
            </View>
            <Avatar name={r.driver} />
          </Row>
        </Card>
        <Card style={styles.blk}>
          <T w="bold" style={styles.h4}>
            Seats
          </T>
          <Row style={{ justifyContent: 'space-between' }}>
            <T size={14} color={C.muted}>
              {r.seats} seat{r.seats > 1 ? 's' : ''} available
            </T>
            <Stepper value={s.seats} min={1} max={r.seats} onChange={(n) => set({ seats: n })} />
          </Row>
        </Card>
        {canRoundTrip ? (
          <Card style={styles.blk}>
            <T w="bold" style={styles.h4}>
              Trip type
            </T>
            <Row style={{ gap: 10 }}>
              <Pressable
                style={[styles.typeChip, tripType === 'one_way' && { borderColor: C.o, backgroundColor: C.oSoft }]}
                onPress={() => setTripType('one_way')}
              >
                <T w="bold" size={13}>
                  One way
                </T>
              </Pressable>
              <Pressable
                style={[styles.typeChip, tripType === 'round_trip' && { borderColor: C.o, backgroundColor: C.oSoft }]}
                onPress={() => setTripType('round_trip')}
              >
                <T w="bold" size={13}>
                  Round trip
                </T>
              </Pressable>
            </Row>
            {tripType === 'round_trip' ? (
              <View style={{ marginTop: 10, gap: 8 }}>
                <T size={12} color={C.muted}>
                  Choose your return date
                </T>
                {detail!.return_ride!.instances.map((inst) => (
                  <Radio
                    key={inst.id}
                    on={returnInstanceId === inst.id}
                    onPress={() => setReturnInstanceId(inst.id)}
                    title={fmtLong(new Date(`${String(inst.departure_date).slice(0, 10)}T00:00:00`))}
                    sub={`${t12(inst.departure_time?.slice(0, 5) ?? '')} · ${inst.available_seats} seats left`}
                  />
                ))}
              </View>
            ) : null}
          </Card>
        ) : null}
        <Card style={styles.blk}>
          <T w="bold" style={styles.h4}>
            Pickup point
          </T>
          {pickups.map((p, i) => (
            <Radio key={i} on={pickup === i} onPress={() => setPickup(i)} title={p.t} sub={p.s} />
          ))}
        </Card>
        <Card style={styles.blk}>
          <T w="bold" style={styles.h4}>
            Message the driver
          </T>
          <TextInput value={note} onChangeText={setNote} multiline placeholder="Anything the driver should know? (optional)" placeholderTextColor="#A9A4AD" style={styles.msg} />
        </Card>
        {r.instant || needsPay ? (
          <Card style={styles.blk}>
            <T w="bold" style={styles.h4}>
              Payment
            </T>
            {pays.map((p, i) => (
              <Radio key={i} on={pay === i} onPress={() => setPay(i)} title={p.t} sub={p.s} badge={p.badge} badgeBg={p.bg} />
            ))}
            <T size={12} color={C.muted} style={{ marginTop: 8 }}>
              Always pay inside GORIDES. Never pay a driver directly or outside the app: we cannot track or protect those payments.
            </T>
          </Card>
        ) : (
          <Card style={styles.blk}>
            <T w="bold" style={styles.h4}>
              How this booking works
            </T>
            <T size={14} color={C.ink2}>
              The driver reviews every request. You pay nothing now. When the driver accepts, we notify you and you pay in the app to confirm your seat.
            </T>
          </Card>
        )}
        <Card style={styles.blk}>
          <T w="bold" style={styles.h4}>
            Price breakdown
          </T>
          <View style={{ gap: 10 }}>
            <PriceLine
              label={`Seat price set by the driver${seatsLabel}`}
              amount={seatPrice}
              bold
              why={`The driver set ${money(r.price)} per seat. It stays the same however many passengers join.`}
            />
            {serviceFee > 0 ? (
              <PriceLine
                label={`GORIDES service fee${feePercent ? ` (${feePercent}%)` : ''}`}
                amount={serviceFee * legMultiplier}
                why={`${feePercent ? `${feePercent}% of the ${money(seatPrice)} seat price. ` : ''}Paid to GORIDES for secure in-app payment, support and safety. The driver does not receive it.`}
              />
            ) : null}
            {gstHst > 0 ? (
              <PriceLine label={`GST/HST${taxPercent ? ` (${taxPercent}%)` : ''}`} amount={gstHst * legMultiplier} why={`Sales tax${taxPercent ? ` of ${taxPercent}%` : ''} on the seat price plus the GORIDES service fee (${money(seatPrice + serviceFee * legMultiplier)}), collected on behalf of the government.`} />
            ) : null}
            {processingFee > 0 ? (
              <PriceLine label="Card processing fee" amount={processingFee * legMultiplier} why={`${quote?.stripe_card_percent ? `${quote.stripe_card_percent}% + ${money(quote.stripe_card_fixed_cad ?? 0)} ` : ''}charged by Stripe, the card payment processor, on this payment. It is added so the driver and GORIDES still receive their full amounts. Paying from your GORIDES wallet has no processing fee.`} />
            ) : null}
            <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
              <T w="xbold" size={17}>
                Total now (CAD){tripType === 'round_trip' ? ' · both legs' : ''}
              </T>
              <T w="xbold" size={17}>
                {money(total)}
              </T>
            </Row>
            {cardTotal !== null && walletTotal !== null && Math.abs(cardTotal - walletTotal) >= 0.01 ? (
              <T size={12} color={C.muted}>
                {quoteMethod === 'wallet' ? `Paying by card instead adds a card processing fee, so the total would be ${money(cardTotal)}.` : `Paying from your GORIDES wallet has no card fee, so the total would be ${money(walletTotal)}.`}
              </T>
            ) : null}
            {total - seatPrice >= 0.01 ? (
              <T size={12} color={C.muted}>
                Your total is {money(total - seatPrice)} more than the seat price: {[
                  serviceFee > 0 ? `${money(serviceFee * legMultiplier)} service fee` : '',
                  gstHst > 0 ? `${money(gstHst * legMultiplier)} tax` : '',
                  processingFee > 0 ? `${money(processingFee * legMultiplier)} card fee` : '',
                ]
                  .filter(Boolean)
                  .join(', ')}.
              </T>
            ) : null}
          </View>
        </Card>
        {tripType === 'round_trip' || isReturnRide ? (
          <T size={12} w="bold" color={C.oDeep} style={{ marginHorizontal: 20, marginTop: 14, lineHeight: 18 }}>
            {tripType === 'round_trip' ? 'The return seat is charged now with the trip and is not refundable.' : 'A return seat is charged now and is not refundable.'}
          </T>
        ) : null}
        <T size={12} color={C.muted} style={{ marginHorizontal: 20, marginTop: 14, lineHeight: 18 }}>
          You can cancel from My rides while the booking is pending or confirmed, and the amount is refunded. By booking you agree to the GORIDES Terms of Service and Community Guidelines.
        </T>
      </ScrollView>
      <View style={[styles.sticky, { paddingBottom: insets.bottom + 14 }]}>
        <Btn label={busy ? 'Please wait…' : r.instant || needsPay ? `Confirm and pay · ${money(total)}` : 'Send booking request'} onPress={confirm} disabled={busy} />
      </View>
    </Screen>
  );
}

function Radio({ on, onPress, title, sub, badge, badgeBg }: { on: boolean; onPress: () => void; title: string; sub: string; badge?: string; badgeBg?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.radio, on && { borderColor: C.o, backgroundColor: C.oSoft }]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
      <View style={[styles.rOuter, on && { borderColor: C.o }]}>{on ? <View style={styles.rInner} /> : null}</View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: badgeBg }]}>
          <T w="xbold" size={10} color="#fff">
            {badge}
          </T>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <T w="bold" size={14}>
          {title}
        </T>
        <T size={12} color={C.muted}>
          {sub}
        </T>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  blk: { marginHorizontal: 16, marginTop: 14, padding: 16 },
  h4: { marginBottom: 10 },
  radio: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: C.line, marginTop: 8 },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: C.line, alignItems: 'center' },
  rOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#C9C4C0', alignItems: 'center', justifyContent: 'center' },
  rInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.o },
  badge: { width: 42, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  msg: { minHeight: 80, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, padding: 12, fontFamily: F.regular, fontSize: 15, color: C.ink, textAlignVertical: 'top' },
  sticky: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line },
});
