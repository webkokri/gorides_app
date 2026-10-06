import React, { useCallback, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { StatusBar } from 'expo-status-bar';
import { Field } from '../components/Field';
import { Btn, Row, Screen, Section, T, TopBar } from '../components/ui';
import { driverVehicle, DriverVehicle, PickedFile } from '../lib/api';
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
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await driverVehicle.get();
      setVehicle(res.vehicle);
      setIsComplete(res.is_complete);
      if (res.vehicle) {
        setMake(res.vehicle.make ?? '');
        setModel(res.vehicle.model ?? '');
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
      await driverVehicle.update({ make: make.trim(), model: model.trim(), color: color.trim(), license_plate: plate.trim() });
      toast('Vehicle details saved');
    });

  const pickAndUploadPhoto = () =>
    run(async () => {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const file: PickedFile = { uri: asset.uri, name: asset.fileName ?? `photo-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' };
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
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 48 }}>
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
        ) : null}

        <Section title="Vehicle details" />
        <Field label="Make" value={make} onChangeText={setMake} placeholder="Toyota" />
        <Field label="Model" value={model} onChangeText={setModel} placeholder="Camry" />
        <Field label="Color" value={color} onChangeText={setColor} placeholder="Silver" />
        <Field label="License plate" value={plate} onChangeText={setPlate} placeholder="ABC 123" autoCapitalize="characters" />
        <Btn label={busy ? 'Saving…' : 'Save details'} onPress={saveDetails} disabled={busy} kind="sec" small />

        <Section title="Photos (shown to passengers)" />
        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          {photos.map((url) => (
            <View key={url} style={{ gap: 6 }}>
              <Image source={{ uri: url }} style={{ width: 90, height: 90, borderRadius: 12, backgroundColor: C.card }} />
              <Btn label="Remove" kind="out" small disabled={busy} onPress={() => removePhoto(url)} />
            </View>
          ))}
        </Row>
        {photos.length < 6 ? <Btn label="Add photo" icon="bag" kind="out" small disabled={busy} onPress={pickAndUploadPhoto} /> : null}

        <Section title="Registration certificate (private)" />
        {vehicle?.registration_certificate_url ? <T size={13} color={C.good}>Uploaded ✓</T> : <T size={13} color={C.muted}>Not uploaded yet</T>}
        <Btn label="Upload registration" kind="out" small disabled={busy} onPress={() => pickAndUploadDoc('registration')} />

        <Section title="Insurance document (private)" />
        {vehicle?.insurance_document_url ? <T size={13} color={C.good}>Uploaded ✓</T> : <T size={13} color={C.muted}>Not uploaded yet</T>}
        <Btn label="Upload insurance" kind="out" small disabled={busy} onPress={() => pickAndUploadDoc('insurance')} />
      </ScrollView>
    </Screen>
  );
}
