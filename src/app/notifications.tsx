import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Icon, IconName } from '../components/Icon';
import { Row, Screen, T, TopBar } from '../components/ui';
import { bookings, refunds } from '../lib/api';
import { fmtDay, t12 } from '../lib/format';
import { tripDate } from '../lib/rideMap';
import { C } from '../theme';

type Note = { key: string; icon: IconName; title: string; body: string; tone: 'o' | 'g' };

// There is no notifications endpoint, so activity is built from your bookings and refunds.
export default function Notifications() {
  const [notes, setNotes] = useState<Note[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([bookings.mine('all'), refunds.list()])
        .then(([bs, rs]) =>
          setNotes([
            ...rs.map((r): Note => ({ key: `r${r.id}`, icon: 'wallet', title: r.status === 'awaiting_choice' ? 'Choose where to send your refund' : `Refund ${r.status.replace('_', ' ')}`, body: 'Open Wallet to manage it.', tone: r.status === 'awaiting_choice' ? 'o' : 'g' })),
            ...bs.map((b): Note => ({
              key: `b${b.id}`,
              icon: b.status === 'cancelled' ? 'x' : 'ticket',
              title: `Booking ${b.status}`,
              body: `${b.start_name ?? ''} → ${b.end_name ?? ''}${b.departure_date ? ` · ${fmtDay(new Date(`${tripDate(b.departure_date)}T00:00:00`))}` : ''}${b.departure_time ? ` ${t12(b.departure_time.slice(0, 5))}` : ''}`,
              tone: b.status === 'pending' ? 'o' : 'g',
            })),
          ]),
        )
        .catch(() => setNotes([]));
    }, []),
  );

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Activity" />
      {!notes ? <ActivityIndicator color={C.o} style={{ marginTop: 32 }} /> : null}
      {notes && !notes.length ? (
        <T color={C.muted} style={{ textAlign: 'center', padding: 32 }}>
          Nothing yet. Booking and refund updates show up here.
        </T>
      ) : null}
      <ScrollView>
        {notes?.map((n) => (
          <Row key={n.key} style={{ alignItems: 'flex-start', padding: 16, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: n.tone === 'o' ? C.oSoft : C.goodSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={n.icon} color={n.tone === 'o' ? C.oDeep : C.good} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T w="bold" size={14}>
                {n.title}
              </T>
              <T size={13} color={C.muted} style={{ lineHeight: 18 }}>
                {n.body}
              </T>
            </View>
          </Row>
        ))}
      </ScrollView>
    </Screen>
  );
}
