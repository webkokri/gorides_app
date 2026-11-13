import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Field } from '../components/Field';
import { Btn, Card, Row, Screen, Section, Sheet, T, Tag, TopBar } from '../components/ui';
import { refunds, RefundRequest, wallet, WalletTx, Withdrawal } from '../lib/api';
import { money } from '../lib/format';
import { payWithStripe } from '../lib/stripe';
import { useStore } from '../store';
import { C } from '../theme';

const REFUND_LABEL: Record<RefundRequest['status'], string> = {
  awaiting_choice: 'Choose where to send it',
  processing: 'Processing',
  pending_verification: 'Verifying bank account',
  completed: 'Refunded',
  failed: 'Failed',
};

export default function Wallet() {
  const { toast } = useStore();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [outs, setOuts] = useState<Withdrawal[]>([]);
  const [refs, setRefs] = useState<RefundRequest[]>([]);
  const [sheet, setSheet] = useState<null | 'withdraw' | 'topup' | { refund: number }>(null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [last4, setLast4] = useState('');
  const [bank, setBank] = useState({ holder: '', inst: '', transit: '', acct: '' });

  const load = useCallback(async () => {
    try {
      const [w, o, r] = await Promise.all([wallet.get(), wallet.withdrawals(), refunds.list()]);
      setBalance(Number(w.balance));
      setTxs(w.transactions ?? []);
      setOuts(o);
      setRefs(r);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not load your wallet');
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      setSheet(null);
      toast(ok);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = () => {
    const n = Number(amount);
    if (!(n > 0) || last4.length !== 4) return toast('Enter an amount and the last 4 digits of your account');
    return run(() => wallet.withdraw(n, last4), 'Withdrawal requested');
  };
  const topup = async () => {
    const n = Number(topupAmount);
    if (!(n >= 5)) return toast('Enter an amount of at least $5');
    setBusy(true);
    try {
      const res = await wallet.topup(n);
      const paid = await payWithStripe(res.stripe_client_secret);
      setSheet(null);
      if (paid) {
        toast('Funds added to your wallet.');
        load();
      } else {
        toast('Payment not completed.');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not start payment');
    } finally {
      setBusy(false);
    }
  };
  const refundId = typeof sheet === 'object' && sheet ? sheet.refund : 0;
  const toBank = () => {
    if (!bank.holder || bank.inst.length !== 3 || bank.transit.length !== 5 || !bank.acct) return toast('Fill in the bank details (3-digit institution, 5-digit transit)');
    return run(() => refunds.choose(refundId, { method: 'bank_account', bank_account_holder_name: bank.holder, bank_institution_number: bank.inst, bank_transit_number: bank.transit, bank_account_number: bank.acct }), 'Bank refund submitted for verification');
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Wallet" />
      {loading ? (
        <ActivityIndicator color={C.o} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          <Card style={{ padding: 18, gap: 6, backgroundColor: C.night }}>
            <T size={13} color="rgba(255,255,255,0.7)">
              Wallet balance
            </T>
            <T w="display" size={40} color="#fff">
              {money(balance)}
            </T>
            <Row style={{ gap: 8 }}>
              <Btn label="Add funds" kind="sec" small style={{ flex: 1, width: undefined }} onPress={() => setSheet('topup')} />
              <Btn label="Withdraw to bank" kind="sec" small style={{ flex: 1, width: undefined }} onPress={() => setSheet('withdraw')} />
            </Row>
          </Card>

          {refs.length ? (
            <>
              <Section title="Refunds" />
              {refs.map((r) => (
                <Card key={r.id} style={{ padding: 14, gap: 10 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T w="bold">{r.amount !== undefined ? money(Number(r.amount)) : 'Refund'}</T>
                    <Tag label={REFUND_LABEL[r.status]} tone={r.status === 'completed' ? 'g' : 'o'} />
                  </Row>
                  {r.status === 'awaiting_choice' ? (
                    <Row style={{ gap: 8 }}>
                      <Btn small label="Original payment" style={{ flex: 1, width: undefined }} disabled={busy} onPress={() => run(() => refunds.choose(r.id, { method: 'stripe' }), 'Refund sent to your original payment method')} />
                      <Btn small kind="out" label="Bank account" style={{ flex: 1, width: undefined }} onPress={() => setSheet({ refund: r.id })} />
                    </Row>
                  ) : null}
                </Card>
              ))}
            </>
          ) : null}

          {outs.length ? (
            <>
              <Section title="Withdrawals" />
              {outs.map((o) => (
                <Card key={o.id} style={{ padding: 14 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View>
                      <T w="bold">{money(Number(o.amount))}</T>
                      <T size={12} color={C.muted}>
                        {o.bankAccountLast4 ? `Account •••• ${o.bankAccountLast4}` : 'Bank account'}
                        {o.rejectionReason ? ` · ${o.rejectionReason}` : ''}
                      </T>
                    </View>
                    <Tag label={o.status} tone={o.status === 'completed' || o.status === 'processed' ? 'g' : 'o'} />
                  </Row>
                </Card>
              ))}
            </>
          ) : null}

          <Section title="Transactions" />
          {txs.length ? (
            <Card style={{ paddingHorizontal: 14 }}>
              {txs.map((t, i) => (
                <Row key={t.id} style={[{ justifyContent: 'space-between', paddingVertical: 12 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
                  <View style={{ flex: 1 }}>
                    <T w="semi" size={14}>
                      {t.description ?? (t.transaction_type === 'credit' ? 'Credit' : 'Payment')}
                    </T>
                    {t.created_at ? (
                      <T size={12} color={C.muted}>
                        {new Date(t.created_at).toLocaleDateString()}
                      </T>
                    ) : null}
                  </View>
                  <T w="bold" color={t.transaction_type === 'credit' ? C.good : C.ink}>
                    {t.transaction_type === 'credit' ? '+' : '-'}
                    {money(Math.abs(Number(t.amount)))}
                  </T>
                </Row>
              ))}
            </Card>
          ) : (
            <T color={C.muted}>No transactions yet.</T>
          )}
        </ScrollView>
      )}

      <Sheet visible={sheet === 'topup'} title="Add funds" onClose={() => setSheet(null)}>
        <Field label="Amount (CAD)" value={topupAmount} onChangeText={setTopupAmount} keyboardType="decimal-pad" />
        <T size={12} color={C.muted}>
          Paid by card or bank debit via Stripe. Funds land in your wallet as soon as payment goes through.
        </T>
        <Btn label={busy ? 'Processing…' : 'Pay and add funds'} disabled={busy} onPress={topup} />
      </Sheet>
      <Sheet visible={sheet === 'withdraw'} title="Withdraw to bank" onClose={() => setSheet(null)}>
        <Field label="Amount (CAD)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Field label="Last 4 digits of your account" value={last4} onChangeText={(v) => setLast4(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" />
        <T size={12} color={C.muted}>
          The amount leaves your wallet right away and is held until our team reviews it. A rejection returns it.
        </T>
        <Btn label={busy ? 'Submitting…' : 'Request withdrawal'} disabled={busy} onPress={withdraw} />
      </Sheet>
      <Sheet visible={!!refundId} title="Refund to a bank account" onClose={() => setSheet(null)}>
        <Field label="Account holder name" value={bank.holder} onChangeText={(v) => setBank({ ...bank, holder: v })} autoCapitalize="words" />
        <Field label="Institution number (3 digits)" value={bank.inst} onChangeText={(v) => setBank({ ...bank, inst: v.replace(/\D/g, '').slice(0, 3) })} keyboardType="number-pad" />
        <Field label="Transit number (5 digits)" value={bank.transit} onChangeText={(v) => setBank({ ...bank, transit: v.replace(/\D/g, '').slice(0, 5) })} keyboardType="number-pad" />
        <Field label="Account number" value={bank.acct} onChangeText={(v) => setBank({ ...bank, acct: v.replace(/\D/g, '') })} keyboardType="number-pad" />
        <T size={12} color={C.muted}>
          Staff verify the account first. The transfer usually takes 8 to 10 business days.
        </T>
        <Btn label={busy ? 'Submitting…' : 'Submit'} disabled={busy} onPress={toBank} />
      </Sheet>
    </Screen>
  );
}
