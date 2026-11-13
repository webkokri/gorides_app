import React, { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../lib/nav';
import { StatusBar } from 'expo-status-bar';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { Btn, IconBtn, Row, Screen, Seg, T, TopBar } from '../components/ui';
import { useAuth } from '../auth';
import { PhoneField } from '../components/PhoneField';
import { auth as authApi, driverVehicle } from '../lib/api';
import { CarPicker, CarValue, EMPTY_CAR } from '../components/CarPicker';
import { useStore } from '../store';
import { C, F } from '../theme';


export default function SignIn() {
  const { toast } = useStore();
  const { signIn, signUp } = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'in' | 'up'>(params.mode === 'up' ? 'up' : 'in');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);

  const [stage, setStage] = useState<'form' | 'otp'>('form');
  const [otp, setOtp] = useState('');
  const [profileType, setProfileType] = useState<'passenger' | 'driver'>('passenger');
  const [car, setCar] = useState<CarValue>(EMPTY_CAR);

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

  const submit = () => {
    if (!email.trim() || !pass) return toast(mode === 'in' ? 'Enter your email or mobile number and password' : 'Enter your email and password');
    if (mode === 'in') return run(async () => (await signIn(email, pass), router.replace('/home')));
    if (!first.trim() || !last.trim()) return toast('Fill in all fields');
    if (!phone) return toast('Enter a valid mobile number');
    if (pass.length < 6) return toast('Password must be at least 6 characters');
    // sign-up: mobile OTP first, account is created after it is verified
    return run(async () => {
      await authApi.sendOtp(phone.trim(), email.trim());
      setStage('otp');
    });
  };
  const verify = () => {
    if (otp.length !== 6) return toast('Enter the 6-digit code');
    return run(async () => {
      await authApi.verifyOtp(phone.trim(), otp);
      await signUp({ mobile_number: phone.trim(), first_name: first.trim(), last_name: last.trim(), email: email.trim(), password: pass, profile_type: profileType });
      // a driver's chosen car is saved to their profile right away (it is verified later, with their documents)
      if (profileType === 'driver' && car.make && car.model) {
        await driverVehicle
          .update({ make: car.make.trim(), model: car.model.trim(), year: car.year ? Number(car.year) : undefined, color: car.color.trim() || undefined, license_plate: car.plate.trim() || undefined })
          .catch(() => {});
      }
      router.replace('/home');
    });
  };
  const resend = () => run(async () => (await authApi.resendOtp(phone.trim(), email.trim()), toast('New code sent')));

  const field = (label: string, icon: 'mail' | 'lock' | 'phone' | 'user', props: React.ComponentProps<typeof TextInput>) => (
    <View style={{ gap: 6 }}>
      <T w="bold" size={13} color={C.ink2}>
        {label}
      </T>
      <Row style={styles.field}>
        <Icon name={icon} color={C.muted} />
        <TextInput placeholderTextColor="#A9A4AD" autoCapitalize="none" style={styles.input} {...props} />
      </Row>
    </View>
  );

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar onBack={() => (stage === 'otp' ? setStage('form') : goBack())} right={<IconBtn name="help" tone="ghost" label="Help" onPress={() => router.push('/help')} />} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {stage === 'otp' ? (
          <>
            <T w="display" size={34} style={{ lineHeight: 44 }}>
              Enter the 6-digit code
            </T>
            <T color={C.muted}>We sent a verification code for {phone}. Enter it below to finish creating your account.</T>
            <TextInput value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} autoFocus style={styles.otp} />
            <Btn label={busy ? 'Please wait…' : 'Verify and create account'} onPress={busy ? () => {} : verify} />
            <T size={14} color={C.muted} style={{ textAlign: 'center' }}>
              {"Didn't get it? "}
              <T w="bold" size={14} color={C.oDeep} onPress={resend}>
                Resend code
              </T>
            </T>
          </>
        ) : (
          <>
        <Logo size={64} motion="intro" />
        <T w="display" size={34} style={{ lineHeight: 44 }}>
          {mode === 'in' ? 'Welcome back to GORIDES' : 'Create your account'}
        </T>
        <T color={C.muted}>Sign in to book seats, publish rides and chat with your driver.</T>
        {mode === 'up' ? (
          <>
            <Seg
              value={profileType}
              onChange={setProfileType}
              options={[
                { v: 'passenger', label: 'I want to ride' },
                { v: 'driver', label: 'I want to drive' },
              ]}
            />
            {field('First name', 'user', { value: first, onChangeText: setFirst, autoCapitalize: 'words' })}
            {field('Last name', 'user', { value: last, onChangeText: setLast, autoCapitalize: 'words' })}
            <PhoneField onChange={setPhone} />
            {profileType === 'driver' ? (
              <View style={{ gap: 10 }}>
                <T w="bold" size={15}>
                  Your car
                </T>
                <T size={13} color={C.muted}>
                  Choose the car you will drive. You can also do this later in your profile. Our team verifies it before you can publish rides.
                </T>
                <CarPicker value={car} onChange={setCar} showPlate />
              </View>
            ) : null}
          </>
        ) : null}
        {mode === 'in'
          ? field('Email or mobile number', 'user', { value: email, onChangeText: setEmail, autoCorrect: false })
          : field('Email', 'mail', { value: email, onChangeText: setEmail, keyboardType: 'email-address' })}
        {field('Password', 'lock', { value: pass, onChangeText: setPass, secureTextEntry: true, placeholder: 'Your password' })}
        <Btn label={busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'} onPress={busy ? () => {} : submit} />
        <T size={14} color={C.muted} style={{ textAlign: 'center' }}>
          {mode === 'in' ? 'New to GORIDES? ' : 'Already have an account? '}
          <T w="bold" size={14} color={C.oDeep} onPress={() => setMode(mode === 'in' ? 'up' : 'in')}>
            {mode === 'in' ? 'Create an account' : 'Sign in'}
          </T>
        </T>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 40, gap: 18 },
  field: { height: 56, borderRadius: 16, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 16, gap: 10 },
  pre: { paddingRight: 10, borderRightWidth: 1, borderRightColor: C.line },
  input: { flex: 1, fontFamily: F.semi, fontSize: 16, color: C.ink },
  or: { flex: 1, height: 1, backgroundColor: C.line },
  otpIc: { width: 64, height: 64, borderRadius: 18, backgroundColor: C.oSoft, alignItems: 'center', justifyContent: 'center' },
  otp: { height: 66, textAlign: 'center', letterSpacing: 10, fontSize: 26, fontFamily: F.xbold, borderRadius: 16, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, color: C.ink },
});
