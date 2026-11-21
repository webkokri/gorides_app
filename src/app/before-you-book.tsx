import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from '../components/Icon';
import { Btn, Card, Row, Screen, T, Toggle, TopBar } from '../components/ui';
import { goBack } from '../lib/nav';
import { isUnavailable, users } from '../lib/api';
import { useStore } from '../store';
import { C } from '../theme';

// bump this whenever the three rules above change, so the saved agreement says which wording was agreed to
const RULES_VERSION = 'v1-2026-11';

const RULES: { icon: IconName; tone: string; bg: string; title: string; body: string }[] = [
  {
    icon: 'shield',
    tone: C.oDeep,
    bg: C.oSoft,
    title: 'This is not a taxi service',
    body: 'GORIDES is a private rideshare platform. Drivers share the cost of a trip they are already making. They are not taxi drivers.',
  },
  {
    icon: 'wallet',
    tone: C.bad,
    bg: '#FDECEA',
    title: 'Cash is not allowed',
    body: 'Pay only inside the app. Never give cash to a driver or pay outside GORIDES.',
  },
  {
    icon: 'clock',
    tone: C.good,
    bg: C.goodSoft,
    title: 'Show up on time',
    body: 'Drivers leave on time. Be at your pickup a few minutes early.',
  },
];

/** A short stop before booking: three plain rules, and a switch to confirm them. Booking continues only once the switch is on. */
export default function BeforeYouBook() {
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();
  const { toast } = useStore();

  // the agreement is saved on the person's account (date and rules version) before the booking screen opens
  const next = async () => {
    setBusy(true);
    try {
      await users.acceptBookingRules(RULES_VERSION);
      router.replace('/book');
    } catch (e) {
      // a server that does not have this feature yet must not stop people booking; any other failure does, so the record is never lost
      if (isUnavailable(e)) router.replace('/book');
      else toast(e instanceof Error ? e.message : 'Could not save your agreement. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bottom={false}>
      <StatusBar style="dark" />
      <TopBar title="Before you book" onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 190 }}>
        <T w="display" size={20}>
          What you need to know
        </T>
        {RULES.map((r) => (
          <Card key={r.title} style={{ padding: 12 }}>
            <Row style={{ gap: 12, alignItems: 'flex-start' }}>
              <View style={[styles.ic, { backgroundColor: r.bg }]}>
                <Icon name={r.icon} size={18} color={r.tone} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T w="bold" size={14}>
                  {r.title}
                </T>
                <T size={12.5} color={C.ink2} style={{ lineHeight: 18 }}>
                  {r.body}
                </T>
              </View>
            </Row>
          </Card>
        ))}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 16 }]}>
        <Row style={[styles.agree, agree && { borderColor: C.o, backgroundColor: C.oSoft }]}>
          <T w="semi" size={12} style={{ flex: 1, lineHeight: 17 }}>
            I understand that my account could be suspended if I break these rules.
          </T>
          <Toggle value={agree} onChange={setAgree} />
        </Row>
        <Btn label={busy ? 'Saving…' : 'Continue to book'} icon="chev" disabled={!agree || busy} onPress={next} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ic: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 24, gap: 10, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.line },
  agree: { gap: 12, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card },
});
