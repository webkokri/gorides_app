import React, { useEffect, useRef, useState } from 'react';
import { Linking, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, ScrollViewInstance, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Icon, IconName } from './Icon';
import { T } from './ui';
import { PRIVACY_URL, SERVICE_FEE_PERCENT } from '../lib/legal';
import { notices, Notice } from '../lib/api';
import { C, shadow } from '../theme';

type Slide = { icon: IconName; tone: 'o' | 'bad' | 'good' | 'ink'; title: string; body: string; link?: 'legal' | 'privacy' };

const SLIDES: Slide[] = [
  {
    icon: 'shield',
    tone: 'ink',
    title: 'A private rideshare, not a taxi',
    body: "GORIDES is a private rideshare app for sharing travel expenses. It can't be used for commercial purposes, as per government law. GORIDES is a platform only and is not liable for what happens during a shared trip.",
    link: 'legal',
  },
  {
    icon: 'alert',
    tone: 'bad',
    title: 'Pay only through the app',
    body: "Always use the online payment gateway. Don't fall for scams that ask you to pay the driver directly or outside the app. We can't track those payments, so we can't help or be held liable for any loss or mishap that follows.",
    link: 'legal',
  },
  {
    icon: 'users',
    tone: 'o',
    title: 'Expenses shared equally',
    body: 'Everyone in the car, driver included, splits the trip cost equally. The more people who join, the less each person pays.',
  },
  {
    icon: 'wallet',
    tone: 'good',
    title: 'How fees work',
    body: `The trip cost is split equally between everyone in the car, driver included. GORIDES adds a service fee (currently ${SERVICE_FEE_PERCENT}%) on top of each passenger's share. Card and bank payments also include a payment processing fee charged by Stripe, and taxes may apply. Drivers: the service fee is deducted from your payout, and an early payout may carry an extra fee. You always see the full amount before you pay or withdraw.`,
    link: 'legal',
  },
  {
    icon: 'bolt',
    tone: 'o',
    title: 'Instant or request bookings',
    body: 'Instant rides confirm your seat as soon as you pay. For request rides the driver reviews your request first, and you pay once they accept.',
  },
  {
    icon: 'id',
    tone: 'ink',
    title: 'Check before you ride',
    body: "Confirm the driver's name, car and licence plate before you get in, keep your chat inside GORIDES, and use the SOS button or call 911 in an emergency.",
  },
];

const TONES = { o: [C.oSoft, C.oDeep], bad: ['#FDECEA', C.bad], good: [C.goodSoft, C.good], ink: [C.chip, C.ink2] } as const;

/** Auto-advancing, swipeable notes card shown on Home. Shows the fixed
 * legal/how-it-works slides first, then any admin-managed notices from
 * Master > Hero Banners & Notices (Master chooses per notice whether it's
 * text-only, image-only, or both, with an optional link). */
export function InfoCarousel() {
  const { width } = useWindowDimensions();
  const cardW = width - 32;
  const ref = useRef<ScrollViewInstance>(null);
  const [i, setI] = useState(0);
  const touched = useRef(false);
  const [adminNotices, setAdminNotices] = useState<Notice[]>([]);

  useEffect(() => {
    notices
      .list()
      .then((list) => setAdminNotices(Array.isArray(list) ? [...list].sort((a, b) => a.sort_order - b.sort_order) : []))
      .catch(() => {});
  }, []);

  const count = SLIDES.length + adminNotices.length;

  useEffect(() => {
    const t = setInterval(() => {
      if (touched.current) return;
      setI((n) => {
        const next = (n + 1) % count;
        ref.current?.scrollTo({ x: next * cardW, animated: true });
        return next;
      });
    }, 7000);
    return () => clearInterval(t);
  }, [cardW, count]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setI(Math.round(e.nativeEvent.contentOffset.x / cardW));

  return (
    <View style={[styles.wrap, { width: cardW }]}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => (touched.current = true)}
        onMomentumScrollEnd={onEnd}
        scrollEventThrottle={16}
      >
        {SLIDES.map((s) => {
          const [bg, fg] = TONES[s.tone];
          return (
            <View key={s.title} style={{ width: cardW, padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.ic, { backgroundColor: bg }]}>
                  <Icon name={s.icon} color={fg} />
                </View>
                <T w="bold" size={16} style={{ flex: 1 }}>
                  {s.title}
                </T>
              </View>
              <T size={13.5} color={C.ink2} style={{ lineHeight: 20 }}>
                {s.body}
              </T>
              {s.link ? (
                <Pressable onPress={() => (s.link === 'privacy' ? Linking.openURL(PRIVACY_URL) : router.push('/disclaimer'))} hitSlop={8}>
                  <T w="bold" size={13} color={C.oDeep}>
                    {s.link === 'privacy' ? 'Read the privacy policy' : 'Privacy policy and disclaimer'}
                  </T>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {adminNotices.map((n) => (
          <View key={`notice-${n.id}`} style={{ width: cardW, gap: 10 }}>
            {n.image_url ? <Image source={{ uri: n.image_url }} style={{ width: cardW, height: 140 }} contentFit="cover" /> : null}
            <View style={{ padding: 16, paddingTop: n.image_url ? 0 : 16, gap: 10 }}>
              {n.title ? (
                <T w="bold" size={16}>
                  {n.title}
                </T>
              ) : null}
              {n.subtitle ? (
                <T size={13.5} color={C.ink2} style={{ lineHeight: 20 }}>
                  {n.subtitle}
                </T>
              ) : null}
              {n.link_url ? (
                <Pressable onPress={() => Linking.openURL(n.link_url!)} hitSlop={8}>
                  <T w="bold" size={13} color={C.oDeep}>
                    Learn more
                  </T>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {Array.from({ length: count }).map((_, n) => (
          <View key={n} style={[styles.dot, n === i && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: 'hidden', marginTop: 14, ...shadow },
  ic: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DDD7D2' },
  dotOn: { width: 18, backgroundColor: C.o },
});
