import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBar, TAB_SPACE } from '../components/TabBar';
import { Icon, IconName } from '../components/Icon';
import { Card, IconBtn, Row, T, Tag } from '../components/ui';
import { useAuth } from '../auth';
import { MadeInCanada } from '../components/MadeInCanada';
import { SignInPrompt } from '../components/SignInPrompt';
import { bookings, profile as profileApi, rides, subscriptions } from '../lib/api';
import { useDriverReady } from '../lib/driverReady';
import { useStore } from '../store';
import { C } from '../theme';

type Item = { icon: IconName; title: string; sub?: string; onPress?: () => void; danger?: boolean };

export default function Profile() {
  const { user, setUser, signOut } = useAuth();
  const { toast } = useStore();
  const fullName = user ? `${user.first_name} ${user.last_name}`.trim() : '';
  const initials = fullName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const insets = useSafeAreaInsets();
  const { dataVersion } = useStore();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const changePhoto = async () => {
    if (!user) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingPhoto(true);
    try {
      const { url } = await profileApi.uploadPhoto({ uri: asset.uri, name: asset.fileName ?? `avatar-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' });
      setUser({ ...user, avatar_url: url });
      toast('Profile photo updated');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };
  const driver = useDriverReady();
  const [stats, setStats] = useState<{ booked: number; offered: number; subs: number } | null>(null);
  // refreshed every time the profile is shown and as soon as a booking or subscription changes anywhere in the app
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      Promise.all([bookings.mine('passenger'), rides.mine(), subscriptions.list()])
        .then(([b, r, sub]) => setStats({ booked: b.filter((x) => x.status !== 'cancelled').length, offered: r.length, subs: sub.filter((x) => x.status === 'active').length }))
        .catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, dataVersion]),
  );

  if (!user)
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top }}>
        <StatusBar style="dark" />
        <SignInPrompt />
        <TabBar current="profile" />
      </View>
    );

  const account: Item[] = [
    { icon: 'clock', title: 'History', sub: 'Completed and cancelled rides, bookings and subscriptions', onPress: () => router.push('/history') },
    { icon: 'wallet', title: 'Wallet and refunds', sub: 'Balance, withdrawals', onPress: () => router.push('/wallet') },
    { icon: 'car', title: 'Car and documents', sub: 'Plate, photos, registration, insurance', onPress: () => router.push('/vehicle-documents') },
    { icon: 'id', title: 'Driving licence', sub: 'Number, expiry and photos', onPress: () => router.push('/driving-licence') },
    { icon: 'user', title: 'My public profile', sub: 'How passengers and drivers see you', onPress: () => router.push({ pathname: '/user', params: { id: String(user.id), name: fullName } }) },
    { icon: 'car', title: 'Driver earnings', sub: 'Earnings and payouts', onPress: () => router.push('/payouts') },
    { icon: 'star', title: 'Ratings and reviews', sub: 'What drivers and passengers said', onPress: () => router.push('/ratings') },
    { icon: 'ticket', title: 'Subscriptions', sub: 'Recurring local commutes', onPress: () => router.push('/subscriptions') },
  ];
  const more: Item[] = [
    { icon: 'bell', title: 'Notifications', onPress: () => router.push('/notifications') },
    { icon: 'help', title: 'Help centre', onPress: () => router.push('/help') },
    { icon: 'shield', title: 'Disclaimer and privacy', sub: 'How GORIDES works and what we are not liable for', onPress: () => router.push('/disclaimer') },
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
          <Pressable onPress={changePhoto} disabled={uploadingPhoto}>
            {user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={[C.o, '#C94E00']} style={styles.avatar}>
                <T w="xbold" size={32} color="#fff">
                  {initials}
                </T>
              </LinearGradient>
            )}
            <View style={styles.vf}>
              <Icon name={uploadingPhoto ? 'clock' : 'edit'} size={13} color="#fff" strokeWidth={3.5} />
            </View>
          </Pressable>
          <T w="display" size={28}>
            {fullName}
          </T>
          <T size={14} color={C.muted}>
            {user.email}
          </T>
          <Row style={{ gap: 6 }}>
            <Tag label="Passenger" icon="user" tone="o" />
            {driver.driverVerified ? <Tag label="Driver" icon="car" tone="g" /> : driver.vehicleOk || driver.licenceOk ? <Tag label="Driver: pending verification" icon="clock" /> : null}
          </Row>
        </LinearGradient>

        <Card style={styles.stats}>
          {[
            [stats ? String(stats.booked) : '–', 'Bookings'],
            [stats ? String(stats.offered) : '–', 'Rides offered'],
            [stats ? String(stats.subs) : '–', 'Subscriptions'],
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
        <T size={12} color={C.muted} style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 4 }}>
          GORIDES version 1.1
        </T>
        <MadeInCanada />
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
