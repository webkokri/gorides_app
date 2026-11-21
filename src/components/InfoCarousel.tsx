import React, { useEffect, useRef, useState } from 'react';
import { Linking, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, ScrollViewInstance, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from './Icon';
import { T } from './ui';
import { notices, Notice } from '../lib/api';
import { shadow } from '../theme';

// slides take turns in warm orange, indigo, green and blue so the carousel catches the eye
const PALETTE: [string, string][] = [
  ['#FF9A4D', '#D9600B'],
  ['#5A46C8', '#2E2578'],
  ['#1FB383', '#0E7A58'],
  ['#2F6FE4', '#1B3F94'],
];

/**
 * Auto-advancing, swipeable notes card shown on Home. Every slide is a notice managed in Master > Hero Banners
 * (platform "Mobile Apps"): nothing is built into the app. A notice's image is shown as a small icon beside its text.
 * With no notices there is no carousel at all.
 */
export function InfoCarousel() {
  const { width } = useWindowDimensions();
  const cardW = width - 32;
  const ref = useRef<ScrollViewInstance>(null);
  const [i, setI] = useState(0);
  const touched = useRef(false);
  const [list, setList] = useState<Notice[]>([]);

  useEffect(() => {
    notices
      .list()
      .then((l) => setList(Array.isArray(l) ? [...l].sort((a, b) => a.sort_order - b.sort_order) : []))
      .catch(() => {});
  }, []);

  const count = list.length;
  useEffect(() => {
    if (count < 2) return;
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

  if (!count) return null;
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setI(Math.round(e.nativeEvent.contentOffset.x / cardW));

  return (
    <View style={[styles.wrap, { width: cardW }]}>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScrollBeginDrag={() => (touched.current = true)} onMomentumScrollEnd={onEnd} scrollEventThrottle={16}>
        {list.map((n, k) => (
          <LinearGradient key={n.id} colors={PALETTE[k % PALETTE.length]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: cardW, padding: 18, paddingBottom: count > 1 ? 36 : 18, minHeight: 132, flexDirection: 'row', gap: 14, alignItems: 'center', overflow: 'hidden' }}>
            <View style={styles.blobA} />
            <View style={styles.blobB} />
            {n.image_url ? (
              <Image source={{ uri: n.image_url }} style={styles.icon} contentFit="cover" accessibilityLabel={n.title ?? 'Notice'} />
            ) : (
              <View style={[styles.icon, { alignItems: 'center', justifyContent: 'center' }]}>
                <Icon name="bell" size={28} color="#fff" />
              </View>
            )}
            <View style={{ flex: 1, gap: 5 }}>
              {n.title ? (
                <T w="xbold" size={17} color="#fff" style={{ lineHeight: 22 }}>
                  {n.title}
                </T>
              ) : null}
              {n.subtitle ? (
                <T size={13} color="rgba(255,255,255,0.92)" style={{ lineHeight: 19 }} numberOfLines={3}>
                  {n.subtitle}
                </T>
              ) : null}
              {n.link_url ? (
                <Pressable onPress={() => Linking.openURL(n.link_url!)} hitSlop={8} style={styles.cta}>
                  <T w="bold" size={12} color="#1B1A1F">
                    Learn more
                  </T>
                  <Icon name="chev" size={13} color="#1B1A1F" />
                </Pressable>
              ) : null}
            </View>
          </LinearGradient>
        ))}
      </ScrollView>
      {count > 1 ? (
        <View style={styles.dots}>
          {list.map((n, k) => (
            <View key={n.id} style={[styles.dot, k === i && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', borderRadius: 24, overflow: 'hidden', marginTop: 18, backgroundColor: '#D9600B', ...shadow },
  icon: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  blobA: { position: 'absolute', right: -40, top: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.12)' },
  blobB: { position: 'absolute', right: 50, bottom: -70, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.08)' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 10, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotOn: { width: 18, backgroundColor: '#fff' },
});
