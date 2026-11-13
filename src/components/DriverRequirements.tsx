import React from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Icon } from './Icon';
import { Btn, Card, Row, Screen, T, TopBar } from './ui';
import { C } from '../theme';

/** Blocks publishing until the driver's car and licence are on file. Shown instead of the publish form. */
export function DriverRequirements({ loading, vehicleOk, vehicleVerified = true, licenceOk, licenceVerified }: { loading: boolean; vehicleOk: boolean; vehicleVerified?: boolean; licenceOk: boolean; licenceVerified: boolean }) {
  const items = [
    { ok: vehicleOk && vehicleVerified, title: 'Verified car', sub: vehicleOk && !vehicleVerified ? 'Uploaded, waiting for review. Only a verified car can be driven.' : 'Plate number, car photos, registration and insurance. Only a verified car can be driven.', label: 'Add car details', to: '/vehicle-documents' as const },
    { ok: licenceOk, title: 'Driving licence', sub: licenceVerified ? 'Verified' : licenceOk ? 'Uploaded, waiting for review' : 'Licence number, expiry and photos of both sides', label: 'Add driving licence', to: '/driving-licence' as const },
  ];
  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Publish a ride" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <T w="display" size={28}>
          Complete your driver profile first
        </T>
        <T color={C.muted}>Passengers need to know who is driving and in what car. You can publish rides once both items below are done and verified.</T>
        {loading ? <ActivityIndicator color={C.o} style={{ marginTop: 16 }} /> : null}
        {!loading
          ? items.map((it) => (
              <Card key={it.title} style={{ padding: 16, gap: 10 }}>
                <Row style={{ gap: 12 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: it.ok ? C.goodSoft : C.oSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={it.ok ? 'check' : 'alert'} size={18} color={it.ok ? C.good : C.oDeep} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T w="bold">{it.title}</T>
                    <T size={13} color={C.muted}>
                      {it.sub}
                    </T>
                  </View>
                </Row>
                <Btn label={it.ok ? 'Review' : it.label} kind={it.ok ? 'out' : 'pri'} small onPress={() => router.push(it.to)} />
              </Card>
            ))
          : null}
      </ScrollView>
    </Screen>
  );
}
