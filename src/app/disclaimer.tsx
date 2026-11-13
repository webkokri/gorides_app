import React from 'react';
import { Linking, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Btn, Card, Screen, T, TopBar } from '../components/ui';
import { PRIVACY_URL, SAFETY_URL, SERVICE_FEE_PERCENT, TERMS_URL } from '../lib/legal';
import { C } from '../theme';

const POINTS: [string, string][] = [
  ['A private rideshare', "GORIDES is a private rideshare platform for sharing travel expenses between people already making a journey. It is not a taxi, a transportation carrier or a commercial passenger service, and it can't be used for commercial purposes as per government law."],
  ['Independent drivers', 'Drivers are independent private members. GORIDES does not employ drivers, own the vehicles, or control how a trip is driven.'],
  ['Our limited role', 'GORIDES only connects members and processes payments made through the app. To the extent permitted by law, GORIDES is not liable for the conduct of drivers or passengers, accidents, delays, cancellations, lost belongings or any other loss, injury or damage during or around a shared trip.'],
  ['Payments and scams', "Only pay through the in-app online payment gateway. Never pay a driver directly or outside the app, and don't follow requests to move the conversation or the payment elsewhere. Payments made outside GORIDES can't be tracked, and GORIDES is not liable for any loss or mishap that results."],
  ['Costs and fees', `The trip cost is shared equally between everyone in the car, driver included. On top of a passenger's share, GORIDES charges a service fee (currently ${SERVICE_FEE_PERCENT}%). Card and bank payments also include a payment processing fee charged by our payment provider, Stripe, and taxes may apply. For drivers, GORIDES deducts its service fee from payouts, and an early payout may carry an additional fee. The exact amounts are shown before you pay or request a payout. Rates can change, and the rates shown when you book or request a payout are the ones that apply. The Terms of Service govern.`],
  ['Your responsibility', 'Check the driver, car and licence plate before you ride, follow the law, and use the SOS button or call 911 in an emergency.'],
];

export default function Disclaimer() {
  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Disclaimer and privacy" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        {POINTS.map(([h, b]) => (
          <Card key={h} style={{ padding: 16, gap: 6 }}>
            <T w="bold" size={15}>
              {h}
            </T>
            <T size={14} color={C.ink2} style={{ lineHeight: 21 }}>
              {b}
            </T>
          </Card>
        ))}
        <Btn label="Privacy policy" kind="sec" onPress={() => Linking.openURL(PRIVACY_URL)} />
        <Btn label="Terms of service" kind="out" onPress={() => Linking.openURL(TERMS_URL)} />
        <Btn label="Safety" kind="out" onPress={() => Linking.openURL(SAFETY_URL)} />
      </ScrollView>
    </Screen>
  );
}
