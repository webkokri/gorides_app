import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Icon, IconName } from '../components/Icon';
import { Card, IconBtn, Row, Screen, T } from '../components/ui';
import { goBack } from '../lib/nav';
import { C } from '../theme';

const STEPS: [string, string][] = [
  ['Search your route', 'Local hops across your city or long trips between cities. Pick a date and seats.'],
  ['Book a seat', 'Compare drivers by rating, price and pickup point. Pay in the app.'],
  ['Ride and rate', 'Meet at the pickup point, travel together, then rate each other.'],
];
const TRUST: [IconName, string][] = [
  ['star', 'Ratings after every ride'],
  ['card', 'Secure in-app payments'],
];

export default function HowItWorks() {
  return (
    <Screen bg={C.bg}>
      <StatusBar style="dark" />
      <Row style={{ gap: 10, paddingHorizontal: 16, paddingVertical: 8 }}>
        <IconBtn name="back" onPress={goBack} label="Back" />
        <T w="display" size={22}>
          How GORIDES works
        </T>
      </Row>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 10 }}>
        {STEPS.map(([t, d], i) => (
          <Card key={t} style={styles.step}>
            <View style={styles.n}>
              <T w="display" size={18} color="#fff">
                {i + 1}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T w="bold">{t}</T>
              <T size={13} color={C.muted} style={{ lineHeight: 19 }}>
                {d}
              </T>
            </View>
          </Card>
        ))}
        <View style={styles.trust}>
          <T w="display" size={22} color="#fff" style={{ lineHeight: 30 }}>
            Travel with people you can trust
          </T>
          <View style={styles.grid}>
            {TRUST.map(([ic, label]) => (
              <View key={label} style={styles.cell}>
                <Icon name={ic} color={C.o} />
                <T size={13} color="#fff">
                  {label}
                </T>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: 14, padding: 14, alignItems: 'flex-start' },
  n: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.o, alignItems: 'center', justifyContent: 'center' },
  trust: { marginTop: 12, padding: 18, borderRadius: 22, backgroundColor: C.night, gap: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48%', flexGrow: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 12, gap: 6 },
});
