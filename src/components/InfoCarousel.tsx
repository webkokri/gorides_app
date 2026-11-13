import React, { useEffect, useRef, useState } from 'react';
import { Linking, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, ScrollViewInstance, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { Icon } from './Icon';
import { T } from './ui';
import { notices, Notice } from '../lib/api';
import { C, shadow } from '../theme';

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
        {list.map((n) => (
          <View key={n.id} style={{ width: cardW, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            {n.image_url ? (
              <Image source={{ uri: n.image_url }} style={styles.icon} contentFit="cover" accessibilityLabel={n.title ?? 'Notice'} />
            ) : (
              <View style={[styles.icon, { backgroundColor: C.oSoft, alignItems: 'center', justifyContent: 'center' }]}>
                <Icon name="bell" size={20} color={C.oDeep} />
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              {n.title ? (
                <T w="bold" size={15}>
                  {n.title}
                </T>
              ) : null}
              {n.subtitle ? (
                <T size={13} color={C.ink2} style={{ lineHeight: 19 }}>
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
  wrap: { alignSelf: 'center', backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: 'hidden', marginTop: 14, ...shadow },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.chip },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DDD7D2' },
  dotOn: { width: 18, backgroundColor: C.o },
});
