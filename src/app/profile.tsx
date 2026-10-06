import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBar, TAB_SPACE } from '../components/TabBar';
import { Icon, IconName } from '../components/Icon';
import { Card, IconBtn, Row, T, Tag } from '../components/ui';
import { useAuth } from '../auth';
import { SignInPrompt } from '../components/SignInPrompt';
import { bookings, rides } from '../lib/api';
import { C } from '../theme';

type Item = { icon: IconName; title: string; sub?: string; onPress?: () => void; danger?: boolean };

export default function Profile() {
  const { user, signOut } = useAuth();
  const fullName = user ? `${user.first_name} ${user.last_name}`.trim() : '';
  const initials = fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<{ taken: number; offered: number } | null>(null);
  useEffect(() => {
    if (!user) return;
    Promise.all([bookings.mine('passenger', 'completed'), rides.mine()])
      .then(([b, r]) => setStats({ taken: b.length, offered: r.length }))
      .catch(() => {});
  }, [user]);

  if (!user)
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
        <StatusBar style="dark" />
        <SignInPrompt />
        <TabBar current="profile" />
      </View>
    );

  const account: Item[] = [
    { icon: 'wallet', title: 'Wallet and refunds', sub: 'Balance, withdrawals', onPress: () => router.push('/wallet') },
    { icon: 'car', title: 'Driver earnings', sub: 'Earnings and payouts', onPress: () => router.push('/payouts') },
    { icon: 'star', title: 'Ratings and reviews', sub: 'What drivers and passengers said', onPress: () => router.push('/ratings') },
    { icon: 'ticket', title: 'Subscriptions', sub: 'Recurring local commutes', onPress: () => router.push('/subscriptions') },
  ];
  const more: Item[] = [
    { icon: 'bell', title: 'Notifications', onPress: () => router.push('/notifications') },
    { icon: 'help', title: 'Help centre', onPress: () => router.push('/help') },
    { icon: 'sliders', title: 'Account settings', sub: 'Name, phone, password', onPress: () => router.push('/edit-profile') },
    { icon: 'logout', title: 'Sign out', danger: true, onPress: async () => { await signOut(); router.replace('/onboarding'); } },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_SPACE }}>
        <LinearGradient colors={[C.oSoft, C.bg]} style={[styles.head, { paddingTop: insets.top + 8 }]}>
          <Row style={{ alignSelf: 'stretch', justifyContent: 'space-between' }}>
            <View style={{ width: 42 }} />
            <T w="bold">Profile</T>
            <IconBtn name="edit" label="Edit profile" onPress={() => router.push('/edit-profile')} />
          </Row>
          <LinearGradient colors={[C.o, '#C94E00']} style={styles.avatar}>
            <T w="xbold" size={32} color="#fff">
              {initials}
            </T>
            <View style={styles.vf}>
              <Icon name="check" size={13} color="#fff" strokeWidth={3.5} />
            </View>
          </LinearGradient>
          <T w="display" size={28}>
            {fullName}
          </T>
          <T size={14} color={C.muted}>
            {user.email}
          </T>
          <Row style={{ gap: 6 }}>
            <Tag label={user.role === 'driver' ? 'Driver' : 'Passenger'} icon={user.role === 'driver' ? 'car' : 'user'} tone="o" />
          </Row>
        </LinearGradient>

        <Card style={styles.stats}>
          {[
            [stats ? String(stats.taken) : '–', 'Rides taken'],
            [stats ? String(stats.offered) : '–', 'Rides offered'],
          ].map(([n, l], i) => (
            <View key={l} style={[styles.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.line }]}>
              <T w="xbold" size={20}>
                {n}
              </T>
              <T size={12} color={C.muted}>
                {l}
              </T>
            </View>
          ))}
        </Card>

        <Card style={styles.menu}>
          {account.map((it) => (
            <MenuItem key={it.title} {...it} />
          ))}
        </Card>
        <Card style={styles.menu}>
          {more.map((it, i) => (
            <MenuItem key={it.title} {...it} first={i === 0} />
          ))}
        </Card>
        <T size={12} color={C.muted} style={{ textAlign: 'center', paddingVertical: 24 }}>
          GORIDES version 1.0
        </T>
      </ScrollView>
      <TabBar current="profile" />
    </View>
  );
}

function MenuItem({ icon, title, sub, onPress, danger, first }: Item & { first?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.item, first && { borderTopWidth: 0 }]}>
      <View style={styles.ic}>
        <Icon name={icon} color={danger ? C.bad : C.ink2} />
      </View>
      <View style={{ flex: 1 }}>
        <T w="semi" color={danger ? C.bad : C.ink}>
          {title}
        </T>
        {sub ? (
          <T size={12} color={C.muted}>
            {sub}
          </T>
        ) : null}
      </View>
      {danger ? null : <Icon name="chev" size={18} color="#B9B4BD" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingBottom: 20 },
  avatar: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  vf: { position: 'absolute', right: 0, bottom: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: C.good, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', marginHorizontal: 16 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  menu: { marginHorizontal: 16, marginTop: 14, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: C.line },
  ic: { width: 36, height: 36, borderRadius: 11, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
});
