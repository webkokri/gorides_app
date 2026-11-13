import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BankPicker } from '../components/BankAccounts';
import { Field } from '../components/Field';
import { Icon, IconName } from '../components/Icon';
import { Btn, Card, Chip, Row, Screen, Sheet, T, Tag, TopBar } from '../components/ui';
import { BankAccount, bankAccounts, refunds, RefundRequest, wallet, WalletTx, Withdrawal } from '../lib/api';
import { money } from '../lib/format';
import { payWithStripe } from '../lib/stripe';
import { useStore } from '../store';
import { C } from '../theme';

const REFUND: Record<RefundRequest['status'], { label: string; tone: 'g' | 'o' | 'plain'; text: string }> = {
  awaiting_choice: { label: 'Action needed', tone: 'o', text: 'Choose where you want this refund sent.' },
  processing: { label: 'On its way', tone: 'o', text: 'Sent back to your original payment method.' },
  pending_verification: { label: 'Verifying', tone: 'o', text: 'We are checking your bank account. The transfer takes 8 to 10 business days.' },
  completed: { label: 'Refunded', tone: 'g', text: 'This refund has been paid out.' },
  failed: { label: 'Failed', tone: 'plain', text: 'This refund could not be completed. Contact support.' },
};
const OUT_TONE = (s: string): 'g' | 'o' | 'plain' => (s === 'completed' || s === 'processed' || s === 'approved' ? 'g' : s === 'rejected' || s === 'failed' ? 'plain' : 'o');
const AMOUNTS = [10, 25, 50, 100];
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

export default function Wallet() {
  const { toast } = useStore();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [outs, setOuts] = useState<Withdrawal[]>([]);
  const [refs, setRefs] = useState<RefundRequest[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [sheet, setSheet] = useState<null | 'withdraw' | 'topup' | { refund: number }>(null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [acct, setAcct] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [w, o, r, b] = await Promise.all([wallet.get(), wallet.withdrawals(), refunds.list(), bankAccounts.list().catch(() => [] as BankAccount[])]);
      setBalance(Number(w.balance));
      setTxs(w.transactions ?? []);
      setOuts(o);
      setRefs(r);
      setAccounts(b);
      setAcct((cur) => (cur && b.some((x) => x.id === cur) ? cur : (b.find((x) => x.isDefault) ?? b[0])?.id ?? null));
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
    if (!(n > 0)) return toast('Enter an amount to withdraw');
    if (n > balance) return toast(`You have ${money(balance)} available`);
    if (!acct) return toast('Choose a bank account');
    return run(() => wallet.withdraw(n, acct), 'Withdrawal requested');
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
    if (!acct) return toast('Choose a bank account');
    return run(() => refunds.choose(refundId, { method: 'bank_account', saved_bank_account_id: acct }), 'Bank refund submitted for verification');
  };

  const openWithdraw = () => {
    if (!accounts.length) {
      toast('Add a bank account first');
      return router.push('/add-bank-account');
    }
    setSheet('withdraw');
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Wallet" />
      {loading ? (
        <ActivityIndicator color={C.o} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
          <View style={styles.hero}>
            <T size={13} color="rgba(255,255,255,0.7)">
              Available balance
            </T>
            <T w="display" size={42} color="#fff" style={{ lineHeight: 52 }}>
              {money(balance)}
            </T>
            <View style={styles.actions}>
              <Action icon="plus" label="Add funds" onPress={() => setSheet('topup')} />
              <Action icon="bank" label="Withdraw" onPress={openWithdraw} />
              <Action icon="card" label="Bank accounts" onPress={() => router.push('/bank-accounts')} />
            </View>
          </View>

          {refs.length ? (
            <View style={{ gap: 10 }}>
              <Head title="Refunds" count={refs.length} />
              {refs.map((r) => {
                const st = REFUND[r.status];
                return (
                  <Card key={r.id} style={{ padding: 14, gap: 10 }}>
                    <Row style={{ gap: 10 }}>
                      <View style={[styles.ico, { backgroundColor: C.oSoft }]}>
                        <Icon name="wallet" size={18} color={C.oDeep} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <T w="xbold" size={17}>
                          {r.amount !== undefined ? money(Number(r.amount)) : 'Refund'}
                        </T>
                        <T size={12} color={C.muted}>
                          {st.text}
                        </T>
                      </View>
                      <Tag label={st.label} tone={st.tone} />
                    </Row>
                    {r.status === 'awaiting_choice' ? (
                      <Row style={{ gap: 8 }}>
                        <Choice icon="card" title="Original payment" sub="Fastest, back to your card" disabled={busy} onPress={() => run(() => refunds.choose(r.id, { method: 'stripe' }), 'Refund sent to your original payment method')} />
                        <Choice
                          icon="bank"
                          title="Bank account"
                          sub="8 to 10 business days"
                          onPress={() => {
                            if (!accounts.length) {
                              toast('Add a bank account first');
                              return router.push('/add-bank-account');
                            }
                            setSheet({ refund: r.id });
                          }}
                        />
                      </Row>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          ) : null}

          {outs.length ? (
            <View style={{ gap: 10 }}>
              <Head title="Withdrawals" count={outs.length} />
              {outs.map((o) => (
                <Card key={o.id} style={{ padding: 12 }}>
                  <Row style={{ gap: 10 }}>
                    <View style={styles.ico}>
                      <Icon name="bank" size={18} color={C.ink2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <T w="bold" size={15}>
                        {money(Number(o.amount))}
                      </T>
                      <T size={12} color={C.muted} numberOfLines={1}>
                        {o.bankAccountLast4 ? `Account •••• ${o.bankAccountLast4}` : 'Bank account'}
                        {o.requestedDate ? ` · ${day(o.requestedDate)}` : ''}
                      </T>
                      {o.rejectionReason ? (
                        <T size={12} color={C.warn}>
                          {o.rejectionReason}
                        </T>
                      ) : null}
                    </View>
                    <Tag label={o.status.charAt(0).toUpperCase() + o.status.slice(1)} tone={OUT_TONE(o.status)} />
                  </Row>
                </Card>
              ))}
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            <Head title="Activity" count={txs.length} />
            {txs.length ? (
              <Card style={{ paddingHorizontal: 12 }}>
                {txs.map((t, i) => {
                  const credit = t.transaction_type === 'credit';
                  return (
                    <Row key={t.id} style={[{ gap: 10, paddingVertical: 11 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
                      <View style={[styles.ico, { backgroundColor: credit ? C.goodSoft : C.chip }]}>
                        <Icon name={credit ? 'plus' : 'minus'} size={16} color={credit ? C.good : C.ink2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <T w="semi" size={14} numberOfLines={1}>
                          {t.description ?? (credit ? 'Credit' : 'Payment')}
                        </T>
                        {t.created_at ? (
                          <T size={12} color={C.muted}>
                            {day(t.created_at)}
                          </T>
                        ) : null}
                      </View>
                      <T w="bold" color={credit ? C.good : C.ink}>
                        {credit ? '+' : '-'}
                        {money(Math.abs(Number(t.amount)))}
                      </T>
                    </Row>
                  );
                })}
              </Card>
            ) : (
              <View style={styles.empty}>
                <Icon name="wallet" size={28} color={C.muted} />
                <T color={C.muted} size={13}>
                  No activity yet. Add funds or book a ride to get started.
                </T>
              </View>
            )}
          </View>
        </ScrollView>
      )}

      <Sheet visible={sheet === 'topup'} title="Add funds" onClose={() => setSheet(null)}>
        <Row style={{ gap: 8, flexWrap: 'wrap' }}>
          {AMOUNTS.map((a) => (
            <Chip key={a} label={`$${a}`} on={Number(topupAmount) === a} onPress={() => setTopupAmount(String(a))} />
          ))}
        </Row>
        <Field label="Amount (CAD, at least $5)" value={topupAmount} onChangeText={setTopupAmount} keyboardType="decimal-pad" />
        <T size={12} color={C.muted}>
          Paid by card or bank debit through Stripe. The funds land in your wallet as soon as the payment goes through.
        </T>
        <Btn label={busy ? 'Processing…' : `Pay${Number(topupAmount) > 0 ? ` ${money(Number(topupAmount))}` : ''} and add funds`} disabled={busy} onPress={topup} />
      </Sheet>

      <Sheet visible={sheet === 'withdraw'} title="Withdraw to bank" onClose={() => setSheet(null)}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T size={13} color={C.muted}>
            Available {money(balance)}
          </T>
          <Pressable onPress={() => setAmount(String(balance))} hitSlop={8}>
            <T w="bold" size={13} color={C.oDeep}>
              Withdraw all
            </T>
          </Pressable>
        </Row>
        <Field label="Amount (CAD)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <T w="bold" size={13} color={C.ink2}>
          To this account
        </T>
        <BankPicker accounts={accounts} value={acct} onChange={setAcct} onAdd={() => router.push('/add-bank-account')} />
        <T size={12} color={C.muted}>
          The amount leaves your wallet right away and is held until our team reviews it. If it is rejected, it returns to your wallet.
        </T>
        <Btn label={busy ? 'Submitting…' : 'Request withdrawal'} disabled={busy} onPress={withdraw} />
      </Sheet>

      <Sheet visible={!!refundId} title="Refund to a bank account" onClose={() => setSheet(null)}>
        <BankPicker accounts={accounts} value={acct} onChange={setAcct} onAdd={() => router.push('/add-bank-account')} />
        <T size={12} color={C.muted}>
          Our team verifies the account first. The transfer usually takes 8 to 10 business days.
        </T>
        <Btn label={busy ? 'Submitting…' : 'Send my refund here'} disabled={busy} onPress={toBank} />
      </Sheet>

    </Screen>
  );
}

function Head({ title, count }: { title: string; count: number }) {
  return (
    <T w="bold" size={13} color={C.muted} style={{ letterSpacing: 0.8 }}>
      {title.toUpperCase()} · {count}
    </T>
  );
}

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.action} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.actionIc}>
        <Icon name={icon} size={20} color="#fff" />
      </View>
      <T w="semi" size={12} color="#fff" numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

function Choice({ icon, title, sub, onPress, disabled }: { icon: IconName; title: string; sub: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.choice, disabled && { opacity: 0.5 }]} accessibilityRole="button">
      <Icon name={icon} size={18} color={C.oDeep} />
      <T w="bold" size={13}>
        {title}
      </T>
      <T size={11} color={C.muted}>
        {sub}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: C.night, borderRadius: 24, padding: 18, gap: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  action: { flex: 1, alignItems: 'center', gap: 6 },
  actionIc: { width: 46, height: 46, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  ico: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
  choice: { flex: 1, gap: 3, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
});
