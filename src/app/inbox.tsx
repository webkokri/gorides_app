import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TabBar, TAB_SPACE } from '../components/TabBar';
import { Avatar, Btn, IconBtn, Screen, T, TopBar } from '../components/ui';
import { ApiBooking, bookings, support, Ticket } from '../lib/api';
import { useAuth } from '../auth';
import { SignInPrompt } from '../components/SignInPrompt';
import { useStore } from '../store';
import { C } from '../theme';

const LOGO = require('../../assets/images/logo.png');

export default function Inbox() {
  const { toast } = useStore();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<ApiBooking[]>([]);

  useFocusEffect(
    useCallback(() => {
      Promise.all([bookings.mine('all'), support.list()])
        .then(([b, t]) => {
          setTrips(b.filter((x) => x.status !== 'cancelled'));
          setTickets(t);
        })
        .catch((e) => toast(e instanceof Error ? e.message : 'Could not load your messages'))
        .finally(() => setLoading(false));
    }, [toast]),
  );

  if (!user)
    return (
      <Screen>
        <StatusBar style="dark" />
        <TopBar big title="Inbox" />
        <SignInPrompt body="Log in to message drivers and passengers, and to contact support." />
        <TabBar current="inbox" />
      </Screen>
    );

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar big title="Inbox" right={<IconBtn name="bell" label="Notifications" onPress={() => router.push('/notifications')} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_SPACE }}>
        <View style={{ padding: 16 }}>
          <Btn label="Contact support" icon="chat" onPress={() => router.push('/chat')} />
        </View>
        {trips.map((b) => (
          <Pressable key={`b${b.id}`} style={styles.row} onPress={() => router.push({ pathname: '/booking-chat', params: { id: String(b.id) } })}>
            <Avatar name={b.end_name ?? 'Trip'} size={48} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T w="bold" size={11} color={C.oDeep}>
                RIDE CHAT
              </T>
              <T w="bold" numberOfLines={1}>
                {b.start_name} → {b.end_name}
              </T>
            </View>
          </Pressable>
        ))}
        {loading ? <ActivityIndicator color={C.o} style={{ marginTop: 24 }} /> : null}
        {!loading && !tickets.length && !trips.length ? (
          <T color={C.muted} style={{ textAlign: 'center', padding: 24 }}>
            No conversations yet. Start one with support above.
          </T>
        ) : null}
        {tickets.map((t) => (
          <Pressable key={t.id} style={styles.row} onPress={() => router.push({ pathname: '/chat', params: { id: String(t.id) } })}>
            <Image source={LOGO} style={styles.logo} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T w="bold" size={11} color={C.oDeep}>
                {(t.category ?? 'support').toUpperCase()} · {t.status ?? 'open'}
              </T>
              <T w="bold" numberOfLines={1}>
                {t.subject}
              </T>
              {t.updated_at || t.created_at ? (
                <T size={12} color={C.muted}>
                  {new Date((t.updated_at ?? t.created_at) as string).toLocaleDateString()}
                </T>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <TabBar current="inbox" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  logo: { width: 48, height: 48 },
});
