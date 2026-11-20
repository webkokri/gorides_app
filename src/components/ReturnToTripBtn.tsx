import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { T } from './ui';
import { C } from '../theme';

/** The button shown in place of "Start trip" once a trip is under way: bright green with a soft pulse so it cannot be missed. */
export function ReturnToTripBtn({ onPress, small, style, label = 'Return to trip' }: { onPress: () => void; small?: boolean; style?: StyleProp<ViewStyle>; label?: string }) {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const h = small ? 38 : 46;
  return (
    <View style={[{ height: h, width: '100%' }, style]}>
      <Animated.View pointerEvents="none" style={[styles.halo, { borderRadius: 14, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }]} />
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.btn, { height: h, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
        <Icon name="route" size={18} color="#fff" />
        <T w="xbold" size={small ? 14 : 15} color="#fff">
          {label}
        </T>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#7CFFB5' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: C.good, borderWidth: 2, borderColor: '#BFF5DD', elevation: 4, shadowColor: C.good, shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
});
