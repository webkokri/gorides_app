import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../auth';
import { SignInPrompt } from '../components/SignInPrompt';
import { TabBar, TAB_SPACE } from '../components/TabBar';
import { Avatar, Btn, IconBtn, Screen, Seg, T, Tag, TopBar } from '../components/ui';
import { ApiBooking, bookings, support, Ticket } from '../lib/api';
import { counterpart } from '../lib/booking';
import { byDate, dayOf, prettyDay } from '../lib/trips';
import { useStore } from '../store';
import { C } from '../theme';

const LOGO = require('../../assets/images/logo.png');
const ticketClosed = (t: Ticket) => ['resolved', 'closed', 'completed'].includes(t.status ?? '');
// chat stays open only while the two people are connected by a live booking
const chatClosed = (b: ApiBooking) => b.status === 'cancelled' || b.status === 'completed';

function Heading({ children }: { children: string }) {
  return (
    <T w="bold" size={12} color={C.muted} style={{ letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>
      {children.toUpperCase()}
    </T>
  );
}

export default function Inbox() {
  const { toast, unread, dataVersion } = useStore();
  const { user } = useAuth();
  const [tab, setTab] = useState<'chat' | 'support'>('chat');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [trips, setTrips] = useState<ApiBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      Promise.all([bookings.mine('all'), support.list()])
        .then(([b, t]) => {
          setTrips(b);
          setTickets(t);
        })
        .catch((e) => toast(e instanceof Error ? e.message : 'Could not load your messages'))
        .finally(() => setLoading(false));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, toast, dataVersion]),
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

  const active = trips.filter((b) => !chatClosed(b)).sort(byDate(1));
  const closed = trips.filter(chatClosed).sort(byDate(-1));
  const openTickets = tickets.filter((t) => !ticketClosed(t));
  const closedTickets = tickets.filter(ticketClosed);

  const chatRow = (b: ApiBooking, frozen: boolean) => {
    const who = counterpart(b, user.id);
    return (
      <Pressable key={b.id} style={[styles.row, frozen && { opacity: 0.6 }]} onPress={() => router.push({ pathname: '/booking-chat', params: { id: String(b.id) } })}>
        <Avatar name={who.name} size={48} verified={false} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T w="bold" style={{ flexShrink: 1 }} numberOfLines={1}>
              {who.name}
            </T>
            <Tag label={who.role} />
          </View>
          <T size={13} color={C.ink2} numberOfLines={1}>
            {b.start_name} → {b.end_name}
          </T>
          <T size={12} color={C.muted}>
            {prettyDay(dayOf(b))} · {frozen ? (b.status === 'cancelled' ? 'Cancelled · chat closed' : 'Completed · chat closed') : b.status === 'pending' ? 'Request pending' : 'Active'}
          </T>
        </View>
      </Pressable>
    );
  };

  const ticketRow = (t: Ticket, frozen: boolean) => (
    <Pressable key={t.id} style={[styles.row, frozen && { opacity: 0.6 }]} onPress={() => router.push({ pathname: '/chat', params: { id: String(t.id) } })}>
      <Image source={LOGO} style={styles.logo} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T w="bold" numberOfLines={1}>
          {t.subject}
        </T>
        <T size={12} color={C.muted}>
          {(t.category ?? 'support').toUpperCase()} · {frozen ? 'Closed by support' : (t.status ?? 'open').replace('_', ' ')}
          {t.updated_at || t.created_at ? ` · ${new Date((t.updated_at ?? t.created_at) as string).toLocaleDateString()}` : ''}
        </T>
      </View>
    </Pressable>
  );

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar big title="Inbox" right={<IconBtn name="bell" label="Notifications" onPress={() => router.push('/notifications')} />} />
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { v: 'chat', label: `Chat${unread ? ` (${unread})` : ''}` },
          { v: 'support', label: 'Support' },
        ]}
        style={{ marginHorizontal: 16, marginBottom: 4 }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_SPACE }}>
        {loading ? <ActivityIndicator color={C.o} style={{ marginTop: 24 }} /> : null}

        {tab === 'chat' ? (
          <>
            {!loading && !trips.length ? (
              <T color={C.muted} style={{ textAlign: 'center', padding: 28 }}>
                No chats yet. You can message your driver or passenger once you are connected through a booking.
              </T>
            ) : null}
            {active.length ? <Heading>Active</Heading> : null}
            {active.map((b) => chatRow(b, false))}
            {closed.length ? <Heading>booking completed or cancelled</Heading> : null}
            {closed.map((b) => chatRow(b, true))}
          </>
        ) : (
          <>
            <View style={{ padding: 16, paddingBottom: 0 }}>
              <Btn label="Start a new chat" icon="chat" onPress={() => router.push('/chat')} />
            </View>
            {!loading && !tickets.length ? (
              <T color={C.muted} style={{ textAlign: 'center', padding: 28 }}>
                No support chats yet. Start one if you need help.
              </T>
            ) : null}
            {openTickets.length ? <Heading>Open</Heading> : null}
            {openTickets.map((t) => ticketRow(t, false))}
            {closedTickets.length ? <Heading>Closed</Heading> : null}
            {closedTickets.map((t) => ticketRow(t, true))}
          </>
        )}
      </ScrollView>
      <TabBar current="inbox" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  logo: { width: 48, height: 48 },
});
