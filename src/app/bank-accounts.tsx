import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BankAccountCard } from '../components/BankAccounts';
import { ConfirmCancel } from '../components/ConfirmCancel';
import { Icon } from '../components/Icon';
import { Btn, Card, Row, Screen, T, TopBar } from '../components/ui';
import { BankAccount, bankAccounts } from '../lib/api';
import { useStore } from '../store';
import { C } from '../theme';

/** The bank accounts a person has saved, to cash out the wallet, receive driver payouts and receive refunds. */
export default function BankAccounts() {
  const { toast } = useStore();
  const [list, setList] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<BankAccount | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    bankAccounts
      .list()
      .then(setList)
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not load your bank accounts'))
      .finally(() => setLoading(false));
  }, [toast]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await bankAccounts.remove(removing.id);
      toast('Bank account removed');
      setRemoving(null);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not remove the bank account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Bank accounts" />
      {loading ? (
        <ActivityIndicator color={C.o} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>
          <Card style={styles.note}>
            <Icon name="shield" size={20} color={C.good} />
            <T size={13} color={C.ink2} style={{ flex: 1, lineHeight: 19 }}>
              Save your Canadian bank account to withdraw your wallet, receive driver payouts and get refunds. One account is allowed, and only its last 4 digits are ever shown. To use a different account, remove this one and add the new one.
            </T>
          </Card>

          {list.length ? (
            list.map((a) => (
              <BankAccountCard
                key={a.id}
                a={a}
                right={
                  <Row style={{ gap: 6 }}>
                    <Pressable style={[styles.ico, { backgroundColor: '#FBE9E7' }]} hitSlop={6} accessibilityLabel="Remove account" onPress={() => setRemoving(a)}>
                      <Icon name="trash" size={16} color={C.bad} />
                    </Pressable>
                  </Row>
                }
              />
            ))
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIc}>
                <Icon name="bank" size={30} color={C.oDeep} />
              </View>
              <T w="bold" size={17}>
                No bank accounts yet
              </T>
              <T size={13} color={C.muted} style={{ textAlign: 'center' }}>
                Add one to withdraw money from your wallet or get paid for your rides.
              </T>
            </View>
          )}
        </ScrollView>
      )}
      {list.length || loading ? null : (
        <View style={styles.sticky}>
          <Btn label="Add a bank account" icon="plus" onPress={() => router.push('/add-bank-account')} />
        </View>
      )}
      <ConfirmCancel
        visible={!!removing}
        title="Remove this bank account?"
        body="It is removed from your saved accounts. Withdrawals and refunds already requested are not affected."
        confirmLabel="Yes, remove it"
        keepLabel="Keep it"
        busy={busy}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  ico: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  emptyIc: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.oSoft, alignItems: 'center', justifyContent: 'center' },
  sticky: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 28, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.line },
});
