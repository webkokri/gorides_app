import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Btn, Row, Sheet, T } from './ui';
import { bookings, wallet } from '../lib/api';
import { money } from '../lib/format';
import { payWithStripe, stripeSupported } from '../lib/stripe';
import { useStore } from '../store';
import { C } from '../theme';

/**
 * "How do you want to pay?" for a booking the driver accepted: GORIDES wallet (shows the balance, disabled when it is
 * less than the amount) or card/bank through Stripe. Replaces the old "insufficient wallet balance" error.
 */
export function PayBookingSheet({ visible, bookingId, amount, onClose, onPaid }: { visible: boolean; bookingId: number; amount: number; onClose: () => void; onPaid: () => void }) {
  const { toast, bumpData } = useStore();
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState<'wallet' | 'card' | null>(null);

  useEffect(() => {
    if (!visible) return;
    wallet
      .get()
      .then((w) => setBalance(Number(w.balance)))
      .catch(() => setBalance(null));
  }, [visible]);

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
              Secure checkout by Stripe. A payment processing fee is included in the total shown there.
            </T>
          </View>
        </Row>
        <Btn label={busy === 'card' ? 'Opening checkout…' : 'Pay by card'} small kind={walletOk ? 'out' : 'pri'} disabled={!stripeSupported || busy !== null} onPress={payCard} />
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
  opt: { borderWidth: 1.5, borderColor: C.line, borderRadius: 16, padding: 14, gap: 10, backgroundColor: C.card },
  optOff: { backgroundColor: C.chip },
  badge: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.o, alignItems: 'center', justifyContent: 'center' },
});
