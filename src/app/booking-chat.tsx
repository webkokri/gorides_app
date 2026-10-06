import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { goBack } from '../lib/nav';
import { usePolling } from '../lib/poll';
import { counterpart } from '../lib/booking';
import { connectChatSocket } from '../lib/chatSocket';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import { Icon } from '../components/Icon';
import { Avatar, IconBtn, Row, Screen, T } from '../components/ui';
import { bookings, BookingDetail, ChatMessage, isUnavailable, users } from '../lib/api';
import { useStore } from '../store';
import { C, F } from '../theme';

// Safety-net only -- the socket delivers new messages instantly. This just
// re-syncs if a socket event was ever missed, so the thread can't go
// silently stale on a flaky mobile connection.
const SAFETY_POLL_MS = 15000;

/** Passenger <-> driver chat for one booking. Real-time via Socket.IO (/chat namespace); REST is used for the
 * initial history load and as a safety-net re-sync, same split as the web app. */
export default function BookingChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookingId = Number(id);
  const { user } = useAuth();
  const { toast, refreshUnread } = useStore();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const lastId = useRef(0);
  const seenIds = useRef(new Set<number>());
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);

  const addMessage = useCallback(
    (m: ChatMessage) => {
      if (seenIds.current.has(m.id)) return;
      seenIds.current.add(m.id);
      lastId.current = Math.max(lastId.current, m.id);
      setMsgs((prev) => [...prev, m].sort((a, b) => a.id - b.id));
      refreshUnread();
    },
    [refreshUnread],
  );

  const off = useRef(false); // chat endpoints missing on this server: stop polling
  const sync = useCallback(async () => {
    if (off.current) return;
    try {
      const fresh = await bookings.messages(bookingId, lastId.current || undefined);
      fresh.forEach(addMessage);
      setError('');
    } catch (e) {
      if (isUnavailable(e)) off.current = true;
      setError(e instanceof Error ? e.message : 'Could not load messages');
    }
  }, [bookingId, addMessage]);

  useEffect(() => {
    bookings.get(bookingId).then(setBooking).catch(() => {});
  }, [bookingId]);
  usePolling(sync, SAFETY_POLL_MS);

  // Live socket connection + room membership, only while this screen is focused.
  useFocusEffect(
    useCallback(() => {
      const socket = connectChatSocket();

      const join = () => {
        setLive(true);
        socket.emit('join_booking', { booking_id: bookingId }, (res: { success: boolean; error?: string }) => {
          if (!res?.success) setError(res?.error ?? 'Could not open this chat.');
        });
      };
      const onDisconnect = () => setLive(false);
      const onNewMessage = (m: ChatMessage) => {
        if (m.booking_id === bookingId) addMessage(m);
      };

      socket.on('connect', join);
      socket.on('disconnect', onDisconnect);
      socket.on('new_message', onNewMessage);
      if (socket.connected) join();

      return () => {
        socket.emit('leave_booking', { booking_id: bookingId });
        socket.off('connect', join);
        socket.off('disconnect', onDisconnect);
        socket.off('new_message', onNewMessage);
      };
    }, [bookingId, addMessage]),
  );

  // the other person's user id: from the booking when present, else from their messages
  const other = booking ? counterpart(booking, user?.id) : null;
  const otherId = other?.id ?? msgs.find((m) => m.sender_id !== user?.id)?.sender_id;
  useEffect(() => {
    if (!otherId) return;
    users.blocks().then((b) => setBlockedByMe(b.some((x) => x.user_id === otherId))).catch(() => {});
  }, [otherId]);

  const send = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    const socket = connectChatSocket();
    socket.emit(
      'send_message',
      { booking_id: bookingId, message: v.slice(0, 2000) },
      (res: { success: boolean; data?: ChatMessage; error?: string }) => {
        setBusy(false);
        if (res?.success && res.data) {
          addMessage(res.data);
          setText('');
        } else {
          toast(res?.error ?? 'Message not sent');
        }
      },
    );
  };

  const name = other?.name ?? 'Chat';
  const closed = booking?.status === 'cancelled' || booking?.status === 'completed';

  return (
    <Screen>
      <StatusBar style="dark" />
      <Row style={styles.top}>
        <IconBtn name="back" label="Back" onPress={goBack} />
        <Avatar name={name} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Row style={{ gap: 6, alignItems: 'center' }}>
            <T w="bold" numberOfLines={1}>
              {name}
            </T>
            {!closed ? <View style={[styles.dot, { backgroundColor: live ? C.good : C.muted }]} /> : null}
          </Row>
          <T size={12} color={C.muted} numberOfLines={1}>
            {booking ? `${booking.start_name ?? ''} → ${booking.end_name ?? ''}` : ' '}
          </T>
        </View>
        <Pressable onPress={() => router.push({ pathname: '/booking', params: { id: String(bookingId) } })}>
          <T w="bold" size={13} color={C.oDeep}>
            Trip
          </T>
        </Pressable>
      </Row>
      <View style={{ flex: 1 }}>
        <ScrollView ref={scroller} contentContainerStyle={{ padding: 16, gap: 8 }} onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
          {!msgs.length && !error ? (
            <T color={C.muted} style={{ textAlign: 'center' }}>
              No messages yet. Say hello.
            </T>
          ) : null}
          {error ? (
            <T color={C.muted} style={{ textAlign: 'center' }}>
              {error}
            </T>
          ) : null}
          {msgs.map((m) => (
            <View key={m.id} style={[styles.bub, m.sender_id === user?.id ? styles.me : styles.them]}>
              <T size={14} color={m.sender_id === user?.id ? '#fff' : C.ink} style={{ lineHeight: 20 }}>
                {m.message}
              </T>
            </View>
          ))}
        </ScrollView>
        {blockedByMe || closed ? (
          <View style={[styles.notice, { paddingBottom: insets.bottom + 12 }]}>
            <T size={13} color={C.muted} style={{ textAlign: 'center' }}>
              {blockedByMe ? 'You blocked this person. Unblock them from the trip screen to chat again.' : 'This ride has ended, so chat is closed.'}
            </T>
          </View>
        ) : (
          <Row style={[styles.input, { paddingBottom: insets.bottom + 12 }]}>
            <TextInput value={text} onChangeText={setText} placeholder="Write a message" placeholderTextColor="#A9A4AD" maxLength={2000} style={styles.field} onSubmitEditing={send} returnKeyType="send" />
            <Pressable style={[styles.send, busy && { opacity: 0.5 }]} onPress={send} accessibilityLabel="Send">
              <Icon name="send" color="#fff" />
            </Pressable>
          </Row>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 10 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  bub: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  me: { alignSelf: 'flex-end', backgroundColor: C.o, borderBottomRightRadius: 6 },
  them: { alignSelf: 'flex-start', backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderBottomLeftRadius: 6 },
  notice: { paddingHorizontal: 20, paddingTop: 14, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line },
  input: { paddingHorizontal: 12, paddingTop: 10, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line, gap: 8 },
  field: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: C.line, paddingHorizontal: 16, backgroundColor: C.bg, fontFamily: F.regular, fontSize: 15, color: C.ink },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.o, alignItems: 'center', justifyContent: 'center' },
});
