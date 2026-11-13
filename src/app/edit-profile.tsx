import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../auth';
import { Field } from '../components/Field';
import { Icon } from '../components/Icon';
import { PhoneField } from '../components/PhoneField';
import { splitE164 } from '../lib/phone';
import { Btn, Row, Screen, Section, T, TopBar } from '../components/ui';
import { profile as profileApi, users } from '../lib/api';
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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const changePhoto = async () => {
    if (!user) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingPhoto(true);
    try {
      const { url } = await profileApi.uploadPhoto({ uri: asset.uri, name: asset.fileName ?? `avatar-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' });
      setUser({ ...user, avatar_url: url });
      toast('Profile photo updated');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

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
        <Section title="Profile photo" />
        <Row style={{ gap: 14, alignItems: 'center' }}>
          {user?.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={{ width: 64, height: 64, borderRadius: 32 }} />
          ) : (
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="user" size={28} color={C.muted} />
            </View>
          )}
          <Pressable onPress={changePhoto} disabled={uploadingPhoto}>
            <T w="bold" size={14} color={C.o}>
              {uploadingPhoto ? 'Uploading…' : user?.avatar_url ? 'Change photo' : 'Add a photo'}
            </T>
          </Pressable>
        </Row>

        <Section title="Name and phone" />
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
