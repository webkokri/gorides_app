import React, { useEffect, useState } from 'react';
import { LayoutAnimation, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { goBack } from '../lib/nav';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../components/Icon';
import { Card, IconBtn, Row, Section, T } from '../components/ui';
import { FAQ } from '../data';
import { faqs } from '../lib/api';
import { C, F } from '../theme';

const CATS: { key: string; label: string; icon: IconName }[] = [
  { key: 'book', label: 'Booking', icon: 'ticket' },
  { key: 'pay', label: 'Payments', icon: 'card' },
  { key: 'pub', label: 'Publishing', icon: 'car' },
  { key: 'cancel', label: 'Cancellations', icon: 'x' },
  { key: 'safe', label: 'Safety', icon: 'shield' },
  { key: 'acct', label: 'Account', icon: 'user' },
];

export default function Help() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [open, setOpen] = useState(0);
  const [all, setAll] = useState(FAQ);
  useEffect(() => {
    faqs
      .list()
      .then((r) => r.length && setAll(r.map((f) => ({ cat: f.category ?? 'general', q: f.question, a: f.answer }))))
      .catch(() => {});
  }, []);
  const cats = [...new Set(all.map((f) => f.cat))].map((key) => CATS.find((c) => c.key === key) ?? { key, label: key.charAt(0).toUpperCase() + key.slice(1), icon: 'help' as IconName });
  const list = all.filter((f) => (!cat || f.cat === cat) && (f.q + f.a).toLowerCase().includes(q.toLowerCase()));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <IconBtn name="back" tone="glass" label="Back" onPress={goBack} />
            <T w="bold" color="#fff">
              Help centre
            </T>
            <View style={{ width: 42 }} />
          </Row>
          <T w="display" size={32} color="#fff" style={{ lineHeight: 42 }}>
            How can we help you today?
          </T>
          <Row style={styles.search}>
            <Icon name="search" color="#fff" />
            <TextInput value={q} onChangeText={setQ} placeholder="Search: refund, cancel, luggage" placeholderTextColor="rgba(255,255,255,0.55)" style={styles.input} />
          </Row>
        </View>

        <View style={styles.cats}>
          {cats.map((c) => (
            <Card
              key={c.key}
              style={[styles.cat, cat === c.key && { borderColor: C.o, backgroundColor: C.oSoft }]}
              onPress={() => {
                setCat(cat === c.key ? '' : c.key);
                setOpen(0);
              }}
            >
              <View style={styles.catIc}>
                <Icon name={c.icon} color={C.oDeep} />
              </View>
              <T w="bold" size={12}>
                {c.label}
              </T>
            </Card>
          ))}
        </View>

        <Section title="Popular questions" />
        <View style={{ marginHorizontal: 16 }}>
          {list.length ? (
            list.map((f, i) => (
              <View key={f.q} style={styles.faq}>
                <Pressable
                  style={styles.faqQ}
                  onPress={() => {
                    LayoutAnimation.easeInEaseOut();
                    setOpen(open === i ? -1 : i);
                  }}
                >
                  <T w="bold" size={14} style={{ flex: 1 }}>
                    {f.q}
                  </T>
                  <View style={{ transform: [{ rotate: open === i ? '180deg' : '0deg' }] }}>
                    <Icon name="down" color={C.muted} />
                  </View>
                </Pressable>
                {open === i ? (
                  <T size={14} color={C.ink2} style={{ lineHeight: 21, paddingBottom: 12, paddingHorizontal: 4 }}>
                    {f.a}
                  </T>
                ) : null}
              </View>
            ))
          ) : (
            <T color={C.muted} style={{ padding: 12 }}>
              {'No answers match. Try "refund" or "cancel", or chat with us below.'}
            </T>
          )}
        </View>

        <Section title="Still need help?" />
        <View style={styles.contact}>
          <Card style={styles.cc} onPress={() => router.push('/chat')}>
            <Icon name="chat" color={C.oDeep} />
            <T w="bold" size={14}>
              Chat with us
            </T>
            <T size={13} color={C.muted}>
              Message our support team in the app
            </T>
          </Card>
          <Card style={styles.cc} onPress={() => Linking.openURL('mailto:support@gorides.ca')}>
            <Icon name="mail" color={C.oDeep} />
            <T w="bold" size={14}>
              Email support
            </T>
            <T w="bold" size={13} selectable>
              support@gorides.ca
            </T>
          </Card>
        </View>
        <Card style={[styles.cc, { marginHorizontal: 16, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
          <Icon name="shield" color={C.oDeep} />
          <View style={{ flex: 1 }}>
            <T w="bold" size={14}>
              Emergency during a ride?
            </T>
            <T size={13} color={C.muted}>
              Call 911 first, then report it in the app.
            </T>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: C.night, paddingHorizontal: 20, paddingBottom: 22, gap: 14 },
  search: { height: 56, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16 },
  input: { flex: 1, color: '#fff', fontFamily: F.semi, fontSize: 16 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 16, marginTop: 16 },
  cat: { width: '31%', flexGrow: 1, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', gap: 8 },
  catIc: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.oSoft, alignItems: 'center', justifyContent: 'center' },
  faq: { borderBottomWidth: 1, borderBottomColor: C.line },
  faqQ: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 4 },
  contact: { flexDirection: 'row', gap: 10, marginHorizontal: 16 },
  cc: { flex: 1, padding: 14, gap: 6 },
});
