import React, { useCallback, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { goBack } from '../lib/nav';
import { usePolling } from '../lib/poll';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { IconBtn, Row, Screen, T } from '../components/ui';
import { support, TicketMessage } from '../lib/api';
import { connectSupportSocket } from '../lib/supportSocket';
import { useAuth } from '../auth';
import { useStore } from '../store';
import { C, F } from '../theme';

const LOGO = require('../../assets/images/logo.png');
type Msg = { id: number | string; from: 'me' | 'them' | 'sys'; text: string };

// Safety-net only -- the /support socket delivers an agent's reply instantly. This just re-syncs if an
// event was ever missed, same split as booking-chat.tsx.
const SAFETY_POLL_MS = 15000;

export default function Chat() {
  // `id` = an existing support ticket; no id = a new request (the first message opens the ticket)
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { toast } = useStore();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const [ticketId, setTicketId] = useState<number | null>(id ? Number(id) : null);
  const [subject, setSubject] = useState('Support request');
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 'sys-0', from: 'sys', text: 'Tell us what you need help with. Our team will reply here.' }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const seenIds = useRef(new Set<number>());

  const uid = user?.id;
  const load = useCallback(async (tid: number) => {
    try {
      const t = await support.get(tid);
      setSubject(t.subject);
      const mine = (m: TicketMessage) => m.sender_id === uid;
      (t.messages ?? []).forEach((m) => seenIds.current.add(m.id));
      setMsgs(t.messages?.length ? t.messages.map((m) => ({ id: m.id, from: mine(m) ? 'me' : 'them', text: m.message })) : []);
    } catch {}
  }, [uid]);

  const refresh = useCallback(() => {
    if (ticketId) load(ticketId);
  }, [ticketId, load]);
  usePolling(refresh, SAFETY_POLL_MS);

  // Live updates for the current ticket. Only joins once a ticket actually exists -- a brand new
  // request has nothing to subscribe to until the first message creates one.
  useFocusEffect(
    useCallback(() => {
      if (!ticketId) return;
      const socket = connectSupportSocket();

      const join = () => {
        setLive(true);
        socket.emit('join_ticket', { ticket_id: ticketId });
      };
      const onDisconnect = () => setLive(false);
      const onNewMessage = (m: TicketMessage & { ticket_id: number }) => {
        if (m.ticket_id !== ticketId || seenIds.current.has(m.id)) return;
        seenIds.current.add(m.id);
        setMsgs((prev) => [...prev, { id: m.id, from: m.sender_id === uid ? 'me' : 'them', text: m.message }]);
      };

      socket.on('connect', join);
      socket.on('disconnect', onDisconnect);
      socket.on('new_ticket_message', onNewMessage);
      if (socket.connected) join();

      return () => {
        socket.emit('leave_ticket', { ticket_id: ticketId });
        socket.off('connect', join);
        socket.off('disconnect', onDisconnect);
        socket.off('new_ticket_message', onNewMessage);
      };
    }, [ticketId, uid]),
  );

  const send = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      if (ticketId) {
        await support.message(ticketId, v);
        await load(ticketId);
      } else {
        const t = await support.open(v.slice(0, 60), v);
        setTicketId(t.id);
      }
      setText('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Message not sent');
    } finally {
      setBusy(false);
    }
  };
  const thread = { name: 'GORIDES Support', sub: ticketId ? subject : 'New request' };

  return (
    <Screen>
      <StatusBar style="dark" />
      <Row style={styles.top}>
        <IconBtn name="back" label="Back" onPress={goBack} />
        <Image source={LOGO} style={{ width: 40, height: 40 }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Row style={{ gap: 6, alignItems: 'center' }}>
            <T w="bold" numberOfLines={1}>
              {thread.name}
            </T>
            {ticketId ? <View style={[styles.dot, { backgroundColor: live ? C.good : C.muted }]} /> : null}
          </Row>
          <T size={12} color={C.muted}>
            {thread.sub}
          </T>
        </View>
        <View style={{ width: 42 }} />
      </Row>
      <View style={{ flex: 1 }}>
        <ScrollView ref={scroller} contentContainerStyle={{ padding: 16, gap: 8 }} onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}>
          {msgs.map((m) => (
            <View key={m.id} style={[styles.bub, m.from === 'me' ? styles.me : m.from === 'them' ? styles.them : styles.sys]}>
              <T size={m.from === 'sys' ? 12 : 14} color={m.from === 'me' ? '#fff' : m.from === 'sys' ? C.muted : C.ink} style={{ lineHeight: 20 }}>
                {m.text}
              </T>
            </View>
          ))}
        </ScrollView>
        <Row style={[styles.input, { paddingBottom: insets.bottom + 12 }]}>
          <TextInput value={text} onChangeText={setText} placeholder="Write a message" placeholderTextColor="#A9A4AD" style={styles.field} onSubmitEditing={send} returnKeyType="send" />
          <Pressable style={[styles.send, busy && { opacity: 0.5 }]} onPress={send} accessibilityLabel="Send">
            <Icon name="send" color="#fff" />
          </Pressable>
        </Row>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 10 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  pin: { marginHorizontal: 16, padding: 12, borderRadius: 14, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, gap: 10 },
  bub: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  me: { alignSelf: 'flex-end', backgroundColor: C.o, borderBottomRightRadius: 6 },
  them: { alignSelf: 'flex-start', backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderBottomLeftRadius: 6 },
  sys: { alignSelf: 'center', backgroundColor: '#F1EDEA', borderRadius: 999, paddingVertical: 6 },
  input: { paddingHorizontal: 12, paddingTop: 10, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line, gap: 8 },
  field: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: C.line, paddingHorizontal: 16, backgroundColor: C.bg, fontFamily: F.regular, fontSize: 15, color: C.ink },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.o, alignItems: 'center', justifyContent: 'center' },
});
