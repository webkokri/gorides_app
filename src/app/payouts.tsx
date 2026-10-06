import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Field } from '../components/Field';
import { Btn, Card, Chip, Row, Screen, Section, Sheet, T, Tag, TopBar } from '../components/ui';
import { drivers, EarningsSummary, Payout } from '../lib/api';
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
  const [last4, setLast4] = useState('');

  const load = useCallback(async () => {
    try {
      const [e, p] = await Promise.all([drivers.earnings(period), drivers.payouts()]);
      setSummary(e.summary ?? {});
      setList(p);
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
    if (!(n > 0) || last4.length !== 4) return toast('Enter an amount and the last 4 digits of your account');
    setBusy(true);
    try {
      await drivers.requestPayout({ amount: n, payment_method: 'bank_transfer', bank_account_last4: last4 });
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
            <Card style={{ padding: 16, gap: 8 }}>
              {summary.totalRides !== undefined ? (
                [
                  ['Rides', String(summary.totalRides)],
                  ['Gross earnings', money(summary.totalGrossAmount ?? 0)],
                  ['GORIDES commission', money(summary.totalCommission ?? 0)],
                  ['Net earnings', money(summary.totalNetAmount ?? 0)],
                ].map(([k, v]) => (
                  <Row key={k} style={{ justifyContent: 'space-between' }}>
                    <T color={C.muted} size={14}>
                      {k}
                    </T>
                    <T w="bold">{v}</T>
                  </Row>
                ))
              ) : (
                <T color={C.muted}>No earnings for this period.</T>
              )}
            </Card>
            <Btn label="Request a payout" onPress={() => setSheet(true)} />
            <Section title="Payouts" />
            {list.length ? (
              list.map((p) => (
                <Card key={p.id} style={{ padding: 14 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View>
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
        <Field label="Last 4 digits of your bank account" value={last4} onChangeText={(v) => setLast4(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" />
        <Btn label={busy ? 'Submitting…' : 'Request payout'} disabled={busy} onPress={request} />
      </Sheet>
    </Screen>
  );
}
