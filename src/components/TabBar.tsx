import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, glow } from '../theme';
import { Icon, IconName } from './Icon';
import { useStore } from '../store';
import { T } from './ui';

type Tab = 'home' | 'my-rides' | 'inbox' | 'profile';
const TABS: { key: Tab; label: string; icon: IconName }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'my-rides', label: 'My rides', icon: 'ticket' },
  { key: 'inbox', label: 'Inbox', icon: 'chat' },
  { key: 'profile', label: 'Profile', icon: 'user' },
];

/** Floating tab bar shared by the four main screens, with the centre Publish button. */
export function TabBar({ current }: { current: Tab }) {
  const insets = useSafeAreaInsets();
  const { unread } = useStore();
  const item = (t: (typeof TABS)[number]) => {
    const on = t.key === current;
    return (
      <Pressable key={t.key} style={styles.item} onPress={() => !on && router.replace(`/${t.key}`)} accessibilityRole="tab" accessibilityState={{ selected: on }}>
        <View>
          <Icon name={t.icon} size={22} color={on ? C.oDeep : '#9A95A0'} />
          {t.key === 'inbox' && unread > 0 ? (
            <View style={styles.badge}>
              <T w="bold" size={10} color="#fff">
                {unread > 9 ? '9+' : unread}
              </T>
            </View>
          ) : null}
        </View>
        <T w="bold" size={11} color={on ? C.oDeep : '#9A95A0'}>
          {t.label}
        </T>
      </Pressable>
    );
  };
  return (
    <View style={[styles.bar, { bottom: Math.max(insets.bottom, 12) + 4 }]}>
      {item(TABS[0])}
      {item(TABS[1])}
      <Pressable style={styles.pub} onPress={() => router.push('/publish')} accessibilityLabel="Publish a ride">
        <Icon name="plus" size={26} color="#fff" strokeWidth={2.6} />
      </Pressable>
      {item(TABS[2])}
      {item(TABS[3])}
    </View>
  );
}

export const TAB_SPACE = 110;

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 12, right: 12, height: 70, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.97)', borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', shadowColor: '#28140A', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  badge: { position: 'absolute', top: -6, right: -10, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: C.o, alignItems: 'center', justifyContent: 'center' },
  item: { alignItems: 'center', gap: 3, width: 64 },
  pub: { width: 58, height: 58, borderRadius: 18, backgroundColor: C.o, alignItems: 'center', justifyContent: 'center', marginTop: -32, borderWidth: 4, borderColor: C.bg, ...glow },
});
