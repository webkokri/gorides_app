import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import { C, F } from '../theme';
import { Icon } from './Icon';

export type ToastItem = { id: number; text: string };

const looksLikeError = (t: string) => /fail|error|can't|cannot|couldn't|could not|unable|invalid|insufficient|denied|not available|not allowed|too many|wrong/i.test(t);

/**
 * Top-of-screen notice. It slides in from above and, when it leaves, travels its whole height plus the status-bar inset
 * (measured, not a fixed number) and fades out, so no edge of it is left poking into the top of the screen, even for
 * long, multi-line messages or tall status bars. Tap it to dismiss.
 */
const slideOut = (progress: Animated.Value) => Animated.timing(progress, { toValue: 0, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start();

export function Toaster({ toast, top }: { toast: ToastItem | null; top: number }) {
  const [height, setHeight] = useState(0);
  const [progress] = useState(() => new Animated.Value(0)); // 0 = hidden above the screen, 1 = shown
  const item = toast; // the store keeps the last notice, so its text stays on screen while it animates out

  const id = toast?.id;
  const length = toast?.text.length ?? 0;
  useEffect(() => {
    if (id === undefined) return;
    progress.stopAnimation();
    Animated.timing(progress, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // long messages stay a little longer
    const t = setTimeout(() => slideOut(progress), Math.min(6000, 2200 + length * 35));
    return () => clearTimeout(t);
  }, [id, length, progress]);

  if (!item) return null;
  const err = looksLikeError(item.text);
  // far enough above the screen that nothing of it can show: its own height + the inset + the 10px gap + a margin
  const away = -(Math.max(height, 80) + top + 10 + 24);

  return (
    <Animated.View
      style={[styles.wrap, { top: top + 10, opacity: progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [away, 0], extrapolate: 'clamp' }) }] }]}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      <Pressable onPress={() => slideOut(progress)} accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.toast, err && styles.err]}>
        <Icon name={err ? 'alert' : 'check'} size={18} color={err ? '#FFB4AE' : '#7EE2B8'} />
        <Text style={styles.text} numberOfLines={4}>
          {item.text}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 100 },
  toast: { backgroundColor: C.ink, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '100%', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  err: { backgroundColor: '#3A1714', borderWidth: 1, borderColor: 'rgba(255,180,174,0.35)' },
  text: { color: '#fff', fontFamily: F.semi, fontSize: 14, lineHeight: 20, flexShrink: 1 },
});
