import React, { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../auth';
import { DateField } from '../components/DateField';
import { Field } from '../components/Field';
import { Btn, Card, Screen, Section, T, TopBar } from '../components/ui';
import { licence, PickedFile } from '../lib/api';
import { LICENCE_FLAG } from '../lib/driverReady';
import { shrinkImage } from '../lib/image';
import { setItem } from '../lib/storage';
import { useStore } from '../store';
import { C } from '../theme';

/** Driving licence for drivers: number, expiry, province and a photo of each side. */
export default function DrivingLicence() {
  const { toast } = useStore();
  const { user } = useAuth();
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [province, setProvince] = useState('');
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [locked, setLocked] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await licence.get();
      setNumber(r.license_number ?? '');
      setExpiry(r.license_expiry ?? '');
      setProvince(r.license_province ?? '');
      setFront(r.front_url);
      setBack(r.back_url);
      setVerified(r.verified);
      setLocked(r.locked);
    } catch {
      // Non-fatal -- form just starts empty.
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pick = async (): Promise<PickedFile | null> => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (r.canceled || !r.assets?.[0]) return null;
    const a = r.assets[0];
    return shrinkImage({ uri: a.uri, name: a.fileName ?? `licence-${Date.now()}.jpg`, type: a.mimeType ?? 'image/jpeg' }, a.width, a.height);
  };

  const upload = async (side: 'front' | 'back') => {
    if (side === 'front' && (!number.trim() || !expiry.trim())) return toast('Enter your licence number and pick an expiry date first');
    setBusy(true);
    try {
      const file = await pick();
      if (!file) return;
      if (side === 'front') {
        await licence.upload(file, 'driving_license_front', { license_number: number.trim(), license_expiry: expiry.trim(), license_province: province.trim() || undefined });
        await setItem(LICENCE_FLAG, String(user?.id ?? ''));
        setFront(file.uri);
      } else {
        await licence.upload(file, 'driving_license_back');
        setBack(file.uri);
      }
      toast(side === 'front' ? 'Front of licence uploaded' : 'Back of licence uploaded');
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const fieldsDisabled = locked || busy;

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Driving licence" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <T size={13} color={C.muted}>
          Required before you can publish a ride. Your licence is only reviewed by our team and is never shown to passengers.
        </T>

        {loaded && locked ? (
          <Card style={{ padding: 16, gap: 8, backgroundColor: verified ? C.goodSoft : C.oSoft }}>
            <T w="bold" size={15} color={verified ? C.good : C.oDeep}>
              {verified ? 'Licence verified' : 'Submitted -- waiting for approval'}
            </T>
            <T size={13} color={C.ink2}>
              {verified
                ? "Your driving licence is verified. If anything changed (renewal, new number), contact chat support."
                : "Your licence is under review. This can take 1-10 working days -- we'll try our best to reach you sooner. Need to fix something? Contact chat support, and we'll reopen it for you."}
            </T>
          </Card>
        ) : null}

        <Field label="Licence number" value={number} onChangeText={setNumber} autoCapitalize="characters" editable={!fieldsDisabled} />
        <DateField label="Expiry date" value={expiry} onChange={setExpiry} minimumDate={new Date()} disabled={fieldsDisabled} />
        <Field label="Province (optional)" value={province} onChangeText={setProvince} autoCapitalize="words" editable={!fieldsDisabled} />

        <Section title="Photos" />
        <T size={13} color={front ? C.good : C.muted}>
          {front ? 'Front uploaded ✓' : 'Front of licence not uploaded yet'}
        </T>
        <Btn label={front ? 'Replace front photo' : 'Upload front'} kind="out" small icon="id" disabled={fieldsDisabled} onPress={() => upload('front')} />
        <T size={13} color={back ? C.good : C.muted}>
          {back ? 'Back uploaded ✓' : 'Back of licence not uploaded yet'}
        </T>
        <Btn label={back ? 'Replace back photo' : 'Upload back'} kind="out" small icon="id" disabled={fieldsDisabled} onPress={() => upload('back')} />
        <Btn label="Done" disabled={!front || busy} onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
