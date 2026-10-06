import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../auth';
import { Field } from '../components/Field';
import { PhoneField } from '../components/PhoneField';
import { splitE164 } from '../lib/phone';
import { Btn, Screen, Section, T, TopBar } from '../components/ui';
import { users } from '../lib/api';
import { useStore } from '../store';
import { C } from '../theme';

export default function EditProfile() {
  const { user, setUser, signOut } = useAuth();
  const { toast } = useStore();
  const [first, setFirst] = useState(user?.first_name ?? '');
  const [last, setLast] = useState(user?.last_name ?? '');
  const [initial] = useState(() => splitE164(user?.mobile_number ?? ''));
  const [phone, setPhone] = useState(user?.mobile_number ?? '');
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [del, setDel] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!phone) return toast('Enter a valid mobile number');
    return run(async () => {
      setUser(await users.updateAccount({ first_name: first.trim(), last_name: last.trim(), mobile_number: phone }));
      toast('Profile saved');
    });
  };
  const changePw = () => {
    if (!cur || next.length < 6) return toast('Enter your current password and a new one (6+ characters)');
    return run(async () => {
      await users.changePassword(cur, next);
      setCur('');
      setNext('');
      toast('Password changed');
    });
  };
  const remove = () => {
    if (!del) return toast('Enter your password to deactivate');
    return run(async () => {
      await users.deleteAccount(del);
      await signOut();
      router.replace('/onboarding');
    });
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Edit profile" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Field label="First name" value={first} onChangeText={setFirst} autoCapitalize="words" />
        <Field label="Last name" value={last} onChangeText={setLast} autoCapitalize="words" />
        <PhoneField initialCountry={initial.country} initialNational={initial.national} onChange={setPhone} />
        <Btn label={busy ? 'Saving…' : 'Save changes'} disabled={busy} onPress={save} />

        {user?.role === 'driver' ? (
          <>
            <Section title="Vehicle" />
            <Btn label="Vehicle documents" kind="out" onPress={() => router.push('/vehicle-documents')} />
          </>
        ) : null}

        <Section title="Change password" />
        <Field label="Current password" value={cur} onChangeText={setCur} secureTextEntry />
        <Field label="New password" value={next} onChangeText={setNext} secureTextEntry />
        <Btn label="Change password" kind="out" disabled={busy} onPress={changePw} />

        <Section title="Deactivate account" />
        <T size={13} color={C.muted}>
          This deactivates your account. Enter your password to confirm.
        </T>
        <Field label="Password" value={del} onChangeText={setDel} secureTextEntry />
        <Btn label="Deactivate my account" kind="out" disabled={busy} onPress={remove} />
      </ScrollView>
    </Screen>
  );
}
