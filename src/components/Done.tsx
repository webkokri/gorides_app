import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { C } from '../theme';
import { seeded } from '../lib/anim';
import { Icon } from './Icon';
import { T } from './ui';

const COLORS = [C.o, '#FFB27A', C.good, '#3D7BD9', C.star, '#D9467A'];

/** Confetti burst plus a popping check mark, used by the booking and publish confirmations. */
export function Celebrate({ color = C.good, soft = C.goodSoft, title, body, children }: { color?: string; soft?: string; title: string; body: string; children?: React.ReactNode }) {
  const { height } = useWindowDimensions();
  const [pop] = useState(() => new Animated.Value(0));
  const [pieces] = useState(() => {
    const r = seeded(42);
    return Array.from({ length: 36 }, (_, i) => ({ left: r() * 100, delay: r() * 600, color: COLORS[i % COLORS.length], rot: r() * 180, v: new Animated.Value(0) }));
  });
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 70, useNativeDriver: true }).start();
    pieces.forEach((p) => Animated.timing(p.v, { toValue: 1, duration: 2400, delay: p.delay, easing: Easing.in(Easing.quad), useNativeDriver: true }).start());
  }, [pop, pieces]);
  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {pieces.map((p, i) => (
          <Animated.View
            key={i}
            style={[
              styles.piece,
              {
                left: `${p.left}%`,
                backgroundColor: p.color,
                opacity: p.v.interpolate({ inputRange: [0, 0.9, 1], outputRange: [1, 1, 0] }),
                transform: [{ translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [-20, height] }) }, { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: [`${p.rot}deg`, `${p.rot + 540}deg`] }) }],
              },
            ]}
          />
        ))}
      </View>
      <Animated.View style={[styles.ck, { backgroundColor: color, borderColor: soft, transform: [{ scale: pop }] }]}>
        <Icon name="check" size={54} color="#fff" strokeWidth={3} />
      </Animated.View>
      <T w="display" size={32} style={{ marginTop: 18, textAlign: 'center' }}>
        {title}
      </T>
      <T size={15} color={C.muted} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 22 }}>
        {body}
      </T>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  piece: { position: 'absolute', top: 0, width: 8, height: 14, borderRadius: 2 },
  ck: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center', borderWidth: 14 },
});
