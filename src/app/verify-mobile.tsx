import React, { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Btn, Screen, T, TopBar } from '../components/ui';
import { useAuth } from '../auth';
import { auth as authApi } from '../lib/api';
import { goBack } from '../lib/nav';
import { useStore } from '../store';
import { C, F } from '../theme';

/** Verifies the signed-in person's own mobile number with a texted code. Drivers must do this before they can publish rides. */
export default function VerifyMobile() {
  const { user } = useAuth();
  const { toast } = useStore();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      await authApi.sendMobileVerification();
      setSent(true);
      toast('Code sent');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send the code');
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    if (code.length !== 6) return toast('Enter the 6-digit code');
    setBusy(true);
    try {
      await authApi.verifyOtp(user?.mobile_number ?? '', code);
      toast('Mobile number verified');
      if (router.canGoBack()) router.back();
      else router.replace('/home');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That code did not work');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Verify your number" onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        <T w="display" size={24}>
          {sent ? 'Enter the 6-digit code' : 'Confirm your mobile number'}
        </T>
        <T color={C.muted}>{sent ? `We sent a code to ${user?.mobile_number ?? 'your number'}. It is valid for 10 minutes.` : `We will text a verification code to ${user?.mobile_number ?? 'your number'}.`}</T>
        {sent ? (
          <>
            <TextInput value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} autoFocus style={styles.otp} />
            <Btn label={busy ? 'Please wait…' : 'Verify'} disabled={busy} onPress={verify} />
            <T size={14} color={C.muted} style={{ textAlign: 'center' }}>
              {"Didn't get it? "}
              <T w="bold" size={14} color={C.oDeep} onPress={busy ? undefined : send}>
                Send again
              </T>
            </T>
          </>
        ) : (
          <Btn label={busy ? 'Sending…' : 'Send code'} disabled={busy} onPress={send} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  otp: { height: 64, textAlign: 'center', letterSpacing: 10, fontSize: 26, fontFamily: F.xbold, borderRadius: 16, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, color: C.ink },
});
