import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { StatusBar } from 'expo-status-bar';
import { CarPicker, carName, CarValue, EMPTY_CAR } from '../components/CarPicker';
import { Icon } from '../components/Icon';
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
  // the details are shown as a card; the pencil opens the form, which is where the car is searched and chosen
  const [editing, setEditing] = useState(false);
  const [car, setCar] = useState<CarValue>(EMPTY_CAR);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await driverVehicle.get();
      setVehicle(res.vehicle);
      setIsComplete(res.is_complete);
      if (res.vehicle) setCar({ make: res.vehicle.make ?? '', model: res.vehicle.model ?? '', year: res.vehicle.year ? String(res.vehicle.year) : '', color: res.vehicle.color ?? '', plate: res.vehicle.license_plate ?? '' });
    } catch {
      // Non-fatal -- form just starts empty.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Documents and photos are locked while the vehicle is under review or verified (a rejected one is reopened for fixes).
  // The car itself can always be changed with the pencil: a change sends the vehicle back to verification.
  const locked = isComplete && vehicle?.verification_status !== 'rejected';
  const fieldsDisabled = locked || busy;
  const hasCar = !!vehicle?.make && !!vehicle?.model;
  const showForm = !hasCar || editing;

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

  const saveDetails = () => {
    if (!car.make.trim() || !car.model.trim()) return toast('Search and choose your car');
    if (!car.color.trim()) return toast('Choose your car colour');
    if (!car.plate.trim()) return toast('License plate is required');
    const yearNum = car.year.trim() ? Number(car.year.trim()) : undefined;
    if (car.year.trim() && (!Number.isInteger(yearNum) || yearNum! < 1980 || yearNum! > new Date().getFullYear() + 1)) return toast('Enter a valid vehicle year');
    const save = () =>
      run(async () => {
        await driverVehicle.update({ make: car.make.trim(), model: car.model.trim(), year: yearNum, color: car.color.trim(), license_plate: car.plate.trim() });
        setEditing(false);
        toast(vehicle?.verification_status === 'verified' ? 'Saved. Your vehicle is back in verification.' : 'Vehicle details saved');
      });
    const changed = !!vehicle && (vehicle.make !== car.make.trim() || vehicle.model !== car.model.trim() || (vehicle.year ?? undefined) !== yearNum || (vehicle.license_plate ?? '') !== car.plate.trim());
    if (vehicle?.verification_status === 'verified' && changed) {
      Alert.alert('Change your car?', 'Your profile goes back to verification, and you cannot publish rides until our team approves the new details.', [
        { text: 'Keep my car', style: 'cancel' },
        { text: 'Change it', style: 'destructive', onPress: save },
      ]);
      return;
    }
    return save();
  };

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
                ? 'Your vehicle is verified. To change your car or plate, tap the pencil under Vehicle details. Your profile then goes back to verification and publishing pauses until it is approved.'
                : "Your vehicle documents are under review. This can take 1-10 working days -- we'll try our best to reach you sooner. Need to fix something? Contact chat support, and we'll reopen it for you."}
            </T>
          </Card>
        ) : null}

        <Section title="Vehicle details" />
        {showForm ? (
          <View style={{ gap: 14 }}>
            <CarPicker value={car} onChange={setCar} showPlate />
            {vehicle?.verification_status === 'verified' ? (
              <T size={12} color={C.warn}>
                Changing your car sends your profile back to verification, and you cannot publish rides until it is approved.
              </T>
            ) : null}
            <Row style={{ gap: 8 }}>
              {hasCar ? (
                <Btn
                  label="Cancel"
                  kind="out"
                  small
                  style={{ flex: 1, width: undefined }}
                  onPress={() => {
                    setEditing(false);
                    load();
                  }}
                />
              ) : null}
              <Btn label={busy ? 'Saving…' : 'Save car'} small style={{ flex: 1, width: undefined }} disabled={busy} onPress={saveDetails} />
            </Row>
          </View>
        ) : (
          <Card style={styles.carCard}>
            <View style={styles.carIc}>
              <Icon name="car" size={22} color={C.oDeep} />
            </View>
            <View style={{ flex: 1 }}>
              <T w="xbold" size={16}>
                {carName(vehicle ?? {})}
              </T>
              <T size={13} color={C.muted}>
                {[vehicle?.color, vehicle?.license_plate].filter(Boolean).join(' · ')}
              </T>
            </View>
            <Pressable style={styles.pencil} hitSlop={8} accessibilityLabel="Edit vehicle details" onPress={() => setEditing(true)}>
              <Icon name="edit" size={18} color={C.ink2} />
            </Pressable>
          </Card>
        )}

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

const styles = StyleSheet.create({
  carCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  carIc: { width: 46, height: 46, borderRadius: 14, backgroundColor: C.oSoft, alignItems: 'center', justifyContent: 'center' },
  pencil: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
});
