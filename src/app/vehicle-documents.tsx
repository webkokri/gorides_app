import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { StatusBar } from 'expo-status-bar';
import { Field } from '../components/Field';
import { SuggestField } from '../components/SuggestField';
import { useVehicleSuggestions, VehicleField } from '../lib/vehicleSuggest';
import { Btn, Card, Row, Screen, Section, T, TopBar } from '../components/ui';
import { driverVehicle, DriverVehicle, PickedFile } from '../lib/api';
import { shrinkImage } from '../lib/image';
import { useStore } from '../store';
import { C } from '../theme';

const STATUS_LABEL: Record<DriverVehicle['verification_status'], string> = {
  pending: 'Pending review',
  verified: 'Verified',
  rejected: 'Needs attention',
};
const STATUS_COLOR: Record<DriverVehicle['verification_status'], string> = {
  pending: C.muted,
  verified: C.good,
  rejected: C.bad,
};

export default function VehicleDocuments() {
  const { toast } = useStore();
  const [vehicle, setVehicle] = useState<DriverVehicle | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');
  const [focus, setFocus] = useState<VehicleField | null>(null);
  const suggestions = useVehicleSuggestions(focus, make, model, color);
  // close a field's list when it loses focus, but a beat later so tapping a suggestion still registers
  const blur = (f: VehicleField) => () => setTimeout(() => setFocus((cur) => (cur === f ? null : cur)), 200);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await driverVehicle.get();
      setVehicle(res.vehicle);
      setIsComplete(res.is_complete);
      if (res.vehicle) {
        setMake(res.vehicle.make ?? '');
        setModel(res.vehicle.model ?? '');
        setYear(res.vehicle.year ? String(res.vehicle.year) : '');
        setColor(res.vehicle.color ?? '');
        setPlate(res.vehicle.license_plate ?? '');
      }
    } catch {
      // Non-fatal -- form just starts empty.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Locked once the record is a complete submission, unless staff rejected
  // it (asking for a fix) -- the only way back in is contacting support,
  // who can have staff reject-with-reason to reopen it, or staff verifying
  // it as-is.
  const locked = isComplete && vehicle?.verification_status !== 'rejected';
  const fieldsDisabled = locked || busy;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = () =>
    run(async () => {
      if (!plate.trim()) return toast('License plate is required');
      const yearNum = year.trim() ? Number(year.trim()) : undefined;
      if (year.trim() && (!Number.isInteger(yearNum) || yearNum! < 1980 || yearNum! > new Date().getFullYear() + 1)) return toast('Enter a valid vehicle year');
      await driverVehicle.update({ make: make.trim(), model: model.trim(), year: yearNum, color: color.trim(), license_plate: plate.trim() });
      toast('Vehicle details saved');
    });

  const pickAndUploadPhoto = () =>
    run(async () => {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const file: PickedFile = await shrinkImage({ uri: asset.uri, name: asset.fileName ?? `photo-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' }, asset.width, asset.height);
      await driverVehicle.uploadPhoto(file);
      toast('Photo uploaded');
    });

  const removePhoto = (url: string) => run(() => driverVehicle.removePhoto(url).then(() => toast('Photo removed')));

  const pickAndUploadDoc = (kind: 'registration' | 'insurance') =>
    run(async () => {
      const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const file: PickedFile = { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' };
      if (kind === 'registration') await driverVehicle.uploadRegistration(file);
      else await driverVehicle.uploadInsurance(file);
      toast(kind === 'registration' ? 'Registration certificate uploaded' : 'Insurance document uploaded');
    });

  const photos = vehicle?.photo_urls ?? [];

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Vehicle Documents" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <T size={13} color={C.muted}>
          Required before you can publish a ride. Your photos and license plate are shown to passengers; your registration and
          insurance are only ever reviewed by our team -- they&apos;re kept as a compliance record for the company.
        </T>

        {vehicle ? (
          <Row style={{ gap: 8, alignItems: 'center' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STATUS_COLOR[vehicle.verification_status] }} />
            <T size={13} w="bold" color={STATUS_COLOR[vehicle.verification_status]}>
              {STATUS_LABEL[vehicle.verification_status]}
            </T>
          </Row>
        ) : null}
        {vehicle?.verification_status === 'rejected' && vehicle.rejection_reason ? (
          <T size={13} color={C.bad}>
            {vehicle.rejection_reason}
          </T>
        ) : null}
        {!isComplete ? (
          <T size={13} color={C.bad}>
            Incomplete -- add a photo, license plate, registration, and insurance to publish rides.
          </T>
        ) : locked ? (
          <Card style={{ padding: 16, gap: 8, backgroundColor: vehicle?.verification_status === 'verified' ? C.goodSoft : C.oSoft }}>
            <T w="bold" size={15} color={vehicle?.verification_status === 'verified' ? C.good : C.oDeep}>
              {vehicle?.verification_status === 'verified' ? 'Vehicle verified' : 'Submitted -- waiting for approval'}
            </T>
            <T size={13} color={C.ink2}>
              {vehicle?.verification_status === 'verified'
                ? 'Your vehicle is verified. If anything changed (new car, new plate), contact chat support.'
                : "Your vehicle documents are under review. This can take 1-10 working days -- we'll try our best to reach you sooner. Need to fix something? Contact chat support, and we'll reopen it for you."}
            </T>
          </Card>
        ) : null}

        <Section title="Vehicle details" />
        <SuggestField label="Make" value={make} onChangeText={setMake} placeholder="Start typing, e.g. Toyota" autoCapitalize="words" editable={!fieldsDisabled} onFocus={() => setFocus('make')} onBlur={blur('make')} suggestions={focus === 'make' ? suggestions : []} onPick={(v) => (setMake(v), setFocus(null))} />
        <SuggestField label="Model" value={model} onChangeText={setModel} placeholder={make ? `A ${make} model, e.g. Camry` : 'Pick a make first, or type a model'} autoCapitalize="words" editable={!fieldsDisabled} onFocus={() => setFocus('model')} onBlur={blur('model')} suggestions={focus === 'model' ? suggestions : []} onPick={(v) => (setModel(v), setFocus(null))} />
        <Field label="Year" value={year} onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))} placeholder="2020" keyboardType="number-pad" editable={!fieldsDisabled} />
        <SuggestField label="Color" value={color} onChangeText={setColor} placeholder="Start typing, e.g. Silver" autoCapitalize="words" editable={!fieldsDisabled} onFocus={() => setFocus('color')} onBlur={blur('color')} suggestions={focus === 'color' ? suggestions : []} onPick={(v) => (setColor(v), setFocus(null))} />
        <Field label="License plate" value={plate} onChangeText={setPlate} placeholder="ABC 123" autoCapitalize="characters" editable={!fieldsDisabled} />
        <Btn label={busy ? 'Saving…' : 'Save details'} onPress={saveDetails} disabled={fieldsDisabled} kind="sec" small />

        <Section title="Photos (shown to passengers)" />
        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          {photos.map((url) => (
            <View key={url} style={{ gap: 6 }}>
              <Image source={{ uri: url }} style={{ width: 90, height: 90, borderRadius: 12, backgroundColor: C.card }} />
              {!locked ? <Btn label="Remove" kind="out" small disabled={busy} onPress={() => removePhoto(url)} /> : null}
            </View>
          ))}
        </Row>
        {photos.length < 6 ? <Btn label="Add photo" icon="bag" kind="out" small disabled={fieldsDisabled} onPress={pickAndUploadPhoto} /> : null}

        <Section title="Registration certificate (private)" />
        {vehicle?.registration_certificate_url ? <T size={13} color={C.good}>Uploaded ✓</T> : <T size={13} color={C.muted}>Not uploaded yet</T>}
        <Btn label="Upload registration" kind="out" small disabled={fieldsDisabled} onPress={() => pickAndUploadDoc('registration')} />

        <Section title="Insurance document (private)" />
        {vehicle?.insurance_document_url ? <T size={13} color={C.good}>Uploaded ✓</T> : <T size={13} color={C.muted}>Not uploaded yet</T>}
        <Btn label="Upload insurance" kind="out" small disabled={fieldsDisabled} onPress={() => pickAndUploadDoc('insurance')} />
      </ScrollView>
    </Screen>
  );
}
