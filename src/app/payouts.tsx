import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BankPicker } from '../components/BankAccounts';
import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { Btn, Card, Chip, Row, Screen, Section, Sheet, T, Tag, TopBar } from '../components/ui';
import { BankAccount, bankAccounts, drivers, EarningsSummary, Payout } from '../lib/api';
import { money } from '../lib/format';
import { useStore } from '../store';
import { C } from '../theme';

const PERIODS = ['today', 'week', 'month'] as const;

export default function Payouts() {
  const { toast } = useStore();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('month');
  const [summary, setSummary] = useState<Partial<EarningsSummary>>({});
  const [list, setList] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState('');
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [acct, setAcct] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [e, p, b] = await Promise.all([drivers.earnings(period), drivers.payouts(), bankAccounts.list().catch(() => [] as BankAccount[])]);
      setSummary(e.summary ?? {});
      setList(p);
      setAccounts(b);
      setAcct((cur) => (cur && b.some((x) => x.id === cur) ? cur : (b.find((x) => x.isDefault) ?? b[0])?.id ?? null));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not load earnings');
    } finally {
      setLoading(false);
    }
  }, [period, toast]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const request = async () => {
    const n = Number(amount);
    if (!(n > 0)) return toast('Enter an amount to withdraw');
    if (!acct) return toast('Choose a bank account');
    setBusy(true);
    try {
      await drivers.requestPayout({ amount: n, payment_method: 'bank_transfer', bank_account_id: acct });
      setSheet(false);
      toast('Payout requested');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not request a payout');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Earnings" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Row style={{ gap: 8 }}>
          {PERIODS.map((p) => (
            <Chip key={p} label={p === 'today' ? 'Today' : p === 'week' ? 'This week' : 'This month'} on={p === period} onPress={() => setPeriod(p)} />
          ))}
        </Row>
        {loading ? (
          <ActivityIndicator color={C.o} style={{ marginTop: 24 }} />
        ) : (
          <>
            {summary.totalRides !== undefined ? (
              <View style={{ gap: 10 }}>
                <View style={{ backgroundColor: C.night, borderRadius: 22, padding: 18, gap: 2 }}>
                  <T size={13} color="rgba(255,255,255,0.7)">
                    Net earnings
                  </T>
                  <T w="display" size={38} color="#fff" style={{ lineHeight: 48 }}>
                    {money(summary.totalNetAmount ?? 0)}
                  </T>
                  <T size={12} color="rgba(255,255,255,0.7)">
                    from {summary.totalRides} ride{summary.totalRides === 1 ? '' : 's'}
                  </T>
                </View>
                <Row style={{ gap: 10 }}>
                  <Card style={{ flex: 1, padding: 12 }}>
                    <T size={12} color={C.muted}>
                      Gross earnings
                    </T>
                    <T w="xbold" size={17}>
                      {money(summary.totalGrossAmount ?? 0)}
                    </T>
                  </Card>
                  <Card style={{ flex: 1, padding: 12 }}>
                    <T size={12} color={C.muted}>
                      GORIDES commission
                    </T>
                    <T w="xbold" size={17}>
                      {money(summary.totalCommission ?? 0)}
                    </T>
                  </Card>
                </Row>
              </View>
            ) : (
              <Card style={{ padding: 16 }}>
                <T color={C.muted}>No earnings for this period.</T>
              </Card>
            )}
            <Btn label="Request a payout" onPress={() => setSheet(true)} />
            <Section title="Payouts" />
            {list.length ? (
              list.map((p) => (
                <Card key={p.id} style={{ padding: 14 }}>
                  <Row style={{ gap: 10 }}>
                    <Icon name="bank" size={18} color={C.ink2} />
                    <View style={{ flex: 1 }}>
                      <T w="bold">{money(Number(p.amount))}</T>
                      <T size={12} color={C.muted}>
                        {p.paymentMethod ?? ''} {p.requestedDate ? `· ${new Date(p.requestedDate).toLocaleDateString()}` : ''}
                      </T>
                    </View>
                    <Tag label={p.status} tone={p.status === 'completed' || p.status === 'paid' ? 'g' : 'o'} />
                  </Row>
                </Card>
              ))
            ) : (
              <T color={C.muted}>No payouts yet.</T>
            )}
          </>
        )}
      </ScrollView>
      <Sheet visible={sheet} title="Request a payout" onClose={() => setSheet(false)}>
        <Field label="Amount (CAD)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <T w="bold" size={13} color={C.ink2}>
          Pay it to
        </T>
        <BankPicker accounts={accounts} value={acct} onChange={setAcct} onAdd={() => router.push('/add-bank-account')} />
        <Btn label={busy ? 'Submitting…' : 'Request payout'} disabled={busy} onPress={request} />
      </Sheet>
    </Screen>
  );
}
