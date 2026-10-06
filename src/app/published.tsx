import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Celebrate } from '../components/Done';
import { Icon } from '../components/Icon';
import { Btn, Card, Row, Screen, T } from '../components/ui';
import { fmtDay, today } from '../lib/format';
import { useStore } from '../store';
import { C } from '../theme';

export default function Published() {
  const { s } = useStore();
  const p = s.published ?? { from: '', to: '', date: today(), time: '', seats: 0, price: 0 };
  return (
    <Screen>
      <StatusBar style="dark" />
      <Celebrate color={C.o} soft={C.oSoft} title="Your ride is live" body="Passengers can now find and book your seats. We'll notify you for every booking.">
        <Card style={{ width: '100%', padding: 14, marginTop: 8 }}>
          <Row>
            <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: C.oSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="car" color={C.oDeep} />
            </View>
            <View style={{ flex: 1 }}>
              <T w="bold" numberOfLines={1}>
                {p.from} → {p.to}
              </T>
              <T size={12} color={C.muted}>
                {fmtDay(p.date)} · {p.time} · {p.seats} seats · ${p.price} each
              </T>
            </View>
          </Row>
        </Card>
        <Btn label="Manage my rides" style={{ marginTop: 6 }} onPress={() => router.replace('/my-rides')} />
      </Celebrate>
    </Screen>
  );
}
