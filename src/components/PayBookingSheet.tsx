import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Btn, Row, Sheet, T } from './ui';
import { bookings, rides, wallet } from '../lib/api';
import { money } from '../lib/format';
import { payWithStripe, stripeSupported } from '../lib/stripe';
import { useStore } from '../store';
import { C } from '../theme';

/**
 * "How do you want to pay?" for a booking the driver accepted: GORIDES wallet (shows the balance, disabled when it is
 * less than the amount) or card/bank through Stripe. Replaces the old "insufficient wallet balance" error.
 */
export function PayBookingSheet({ visible, bookingId, instanceId, amount, onClose, onPaid }: { visible: boolean; bookingId: number; instanceId?: number | null; amount: number; onClose: () => void; onPaid: () => void }) {
  const { toast, bumpData } = useStore();
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState<'wallet' | 'card' | null>(null);
  const [rate, setRate] = useState<{ pct: number; fixed: number } | null>(null); // Stripe's card rate, to show the exact card total

  useEffect(() => {
    if (!visible) return;
    wallet
      .get()
      .then((w) => setBalance(Number(w.balance)))
      .catch(() => setBalance(null));
  }, [visible]);
  useEffect(() => {
    if (!visible || !instanceId) return;
    rides
      .quote(instanceId, 1)
      .then((q) => setRate(q.stripe_card_percent !== undefined ? { pct: q.stripe_card_percent, fixed: q.stripe_card_fixed_cad ?? 0 } : null))
      .catch(() => setRate(null));
  }, [visible, instanceId]);
  // the same gross-up the server applies: the card total covers Stripe's cut, so the driver and GORIDES receive their full amounts
  const cardTotal = rate ? Math.round(((amount + rate.fixed) / (1 - rate.pct / 100)) * 100) / 100 : null;
  const cardFee = cardTotal !== null ? Math.round((cardTotal - amount) * 100) / 100 : null;

  const walletOk = balance !== null && balance + 0.001 >= amount;
  const short = balance !== null && !walletOk ? amount - balance : 0;

  const finish = (msg: string) => {
    toast(msg);
    bumpData();
    onPaid();
    onClose();
  };

  const payWallet = async () => {
    setBusy('wallet');
    try {
      await bookings.pay(bookingId, 'wallet');
      finish('Paid. Your seat is confirmed.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setBusy(null);
    }
  };

  const payCard = async () => {
    setBusy('card');
    try {
      const res = await bookings.pay(bookingId, 'stripe');
      if (!res.stripe_client_secret) throw new Error('Could not start the card payment.');
      const paid = await payWithStripe(res.stripe_client_secret);
      if (paid) {
        bookings.syncPayment(bookingId).catch(() => {});
        finish('Payment received. We are confirming your seat.');
      } else toast('Payment not completed.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet visible={visible} title="How do you want to pay?" onClose={onClose}>
      <T size={14} color={C.ink2}>
        Pay {money(amount)} to confirm your seat. Always pay inside GORIDES, never the driver directly.
      </T>

      <View style={[styles.opt, !walletOk && styles.optOff]}>
        <Row>
          <View style={styles.badge}>
            <T w="xbold" size={11} color="#fff">
              GO
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T w="bold">Pay by wallet</T>
            <T size={13} color={C.muted}>
              Balance {balance === null ? '…' : money(balance)}
            </T>
          </View>
        </Row>
        {balance !== null && !walletOk ? (
          <T size={12} color={C.bad}>
            Your wallet is {money(short)} short, so wallet payment is not available. Pay by card instead.
          </T>
        ) : null}
        <Btn label={busy === 'wallet' ? 'Paying…' : `Pay ${money(amount)} from wallet`} small disabled={!walletOk || busy !== null} onPress={payWallet} />
      </View>

      <View style={styles.opt}>
        <Row>
          <View style={[styles.badge, { backgroundColor: '#1A1F71' }]}>
            <T w="xbold" size={10} color="#fff">
              CARD
            </T>
          </View>
          <View style={{ flex: 1 }}>
            <T w="bold">Pay by card or bank</T>
            <T size={13} color={C.muted}>
              {cardFee !== null && cardTotal !== null ? `Secure checkout by Stripe. A ${money(cardFee)} processing fee is added, so you pay ${money(cardTotal)}.` : 'Secure checkout by Stripe. A card processing fee is added to the amount; the exact total is shown before you confirm.'}
            </T>
          </View>
        </Row>
        {cardFee !== null && rate ? (
          <View style={styles.fee}>
            <T size={12} color={C.ink2}>
              {money(amount)} booking + {money(cardFee)} Stripe fee ({rate.pct}% + {money(rate.fixed)}) = {money(cardTotal ?? amount)}. Pay from your wallet to avoid this fee.
            </T>
          </View>
        ) : null}
        <Btn label={busy === 'card' ? 'Opening checkout…' : cardTotal !== null ? `Pay ${money(cardTotal)} by card` : 'Pay by card'} small kind={walletOk ? 'out' : 'pri'} disabled={!stripeSupported || busy !== null} onPress={payCard} />
        {!stripeSupported ? (
          <T size={12} color={C.muted}>
            Card payment is only available in the mobile app.
          </T>
        ) : null}
      </View>
      <Pressable onPress={onClose} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 8 }}>
        <T w="bold" size={14} color={C.muted}>
          Not now
        </T>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fee: { backgroundColor: C.oSoft, borderRadius: 10, padding: 10 },
  opt: { borderWidth: 1.5, borderColor: C.line, borderRadius: 16, padding: 14, gap: 10, backgroundColor: C.card },
  optOff: { backgroundColor: C.chip },
  badge: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.o, alignItems: 'center', justifyContent: 'center' },
});
