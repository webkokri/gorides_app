import React from 'react';
import { View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Celebrate } from '../components/Done';
import { Avatar, Btn, Card, Row, Screen, T } from '../components/ui';
import { fmtDay, money, t12 } from '../lib/format';
import { useAuth } from '../auth';
import { useStore } from '../store';
import { C } from '../theme';

export default function Booked() {
  const { s } = useStore();
  const { user } = useAuth();
  const b = s.booked;
  if (!b) return <Redirect href="/home" />;
  const first = b.driver.split(' ')[0];
  return (
    <Screen>
      <StatusBar style="dark" />
      <Celebrate
        title={b.instant ? "You're booked!" : 'Request sent'}
        body={b.instant ? `${first} confirmed your seat. We sent your receipt to ${user?.email ?? 'your email'}.` : b.paidUpFront ? `${first} will review your request. If they decline, the amount is refunded.` : `${first} will review your request. We'll notify you as soon as they accept, and then you can pay to confirm your seat.`}
      >
        <Card style={{ width: '100%', padding: 14, marginTop: 8 }}>
          <Row>
            <Avatar name={b.driver} />
            <View style={{ flex: 1 }}>
              <T w="bold" numberOfLines={1}>
                {b.from} → {b.to}
              </T>
              <T size={12} color={C.muted}>
                {fmtDay(b.date)} · {t12(b.dep)} · {b.seatsBooked} seat{b.seatsBooked > 1 ? 's' : ''}
              </T>
            </View>
            <T w="xbold">{money(b.total)}</T>
          </Row>
        </Card>
        {b.bookingId ? <Btn label="Message driver" icon="chat" style={{ marginTop: 6 }} onPress={() => router.push({ pathname: '/booking-chat', params: { id: String(b.bookingId) } })} /> : null}
        <Btn label="View my rides" kind="out" onPress={() => router.replace('/my-rides')} />
      </Celebrate>
    </Screen>
  );
}
