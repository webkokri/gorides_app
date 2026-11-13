import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Field } from '../components/Field';
import { Btn, Row, Screen, T, TopBar } from '../components/ui';
import { bankAccounts } from '../lib/api';
import { goBack } from '../lib/nav';
import { useStore } from '../store';
import { C } from '../theme';

const digits = (v: string, n: number) => v.replace(/\D/g, '').slice(0, n);

/** Save a Canadian bank account. A full screen rather than a pop-up, so the keyboard can never cover the fields. */
export default function AddBankAccount() {
  const { toast } = useStore();
  const [f, setF] = useState({ nickname: '', holder: '', inst: '', transit: '', acct: '' });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!f.holder.trim()) return toast('Enter the account holder name');
    if (f.inst.length !== 3) return toast('The institution number is 3 digits');
    if (f.transit.length !== 5) return toast('The transit number is 5 digits');
    if (f.acct.length < 7) return toast('The account number is 7 to 12 digits');
    setBusy(true);
    try {
      await bankAccounts.add({ holder_name: f.holder.trim(), institution_number: f.inst, transit_number: f.transit, account_number: f.acct, nickname: f.nickname.trim() || undefined, is_default: true });
      toast('Bank account saved');
      if (router.canGoBack()) router.back();
      else router.replace('/bank-accounts');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save the bank account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Add a bank account" onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Field label="Nickname (optional)" value={f.nickname} onChangeText={(v) => setF({ ...f, nickname: v })} placeholder="e.g. Chequing" autoCapitalize="words" maxLength={60} />
        <Field label="Account holder name" value={f.holder} onChangeText={(v) => setF({ ...f, holder: v })} autoCapitalize="words" />
        <Row style={{ gap: 10, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Field label="Institution (3)" value={f.inst} onChangeText={(v) => setF({ ...f, inst: digits(v, 3) })} keyboardType="number-pad" placeholder="004" />
          </View>
          <View style={{ flex: 1.3 }}>
            <Field label="Transit (5)" value={f.transit} onChangeText={(v) => setF({ ...f, transit: digits(v, 5) })} keyboardType="number-pad" placeholder="12345" />
          </View>
        </Row>
        <Field label="Account number (7 to 12 digits)" value={f.acct} onChangeText={(v) => setF({ ...f, acct: digits(v, 12) })} keyboardType="number-pad" />
        <T size={12} color={C.muted}>
          You can find these on a void cheque or in your online banking. Your account number is stored securely. After saving, only its last 4 digits are shown.
        </T>
        <Btn label={busy ? 'Saving…' : 'Save bank account'} disabled={busy} onPress={save} />
      </ScrollView>
    </Screen>
  );
}
