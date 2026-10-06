import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleProp, View, ViewStyle } from 'react-native';

const DISC = require('../../assets/images/logo-disc.png');
const G = require('../../assets/images/logo-g.png');
const O = require('../../assets/images/logo-o.png');

/**
 * The round GO logo, built from three transparent layers (disc, G, O) so each part can move.
 * - `intro`: the disc pops in, the G slides in from the left and the O rolls in like a wheel, then it idles.
 * - `idle`: the O rolls a full turn every few seconds, like a wheel.
 * - `none`: static.
 */
export function Logo({ size = 40, motion = 'idle', style }: { size?: number; motion?: 'intro' | 'idle' | 'none'; style?: StyleProp<ViewStyle> }) {
  const [disc] = useState(() => new Animated.Value(motion === 'intro' ? 0 : 1));
  const [g] = useState(() => new Animated.Value(motion === 'intro' ? 0 : 1));
  const [o] = useState(() => new Animated.Value(motion === 'intro' ? 0 : 1));
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (motion === 'none') return;
    const idle = Animated.loop(
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(spin, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    if (motion === 'intro') {
      Animated.sequence([
        Animated.timing(disc, { toValue: 1, duration: 500, easing: Easing.out(Easing.back(1.8)), useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(g, { toValue: 1, duration: 550, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
          Animated.timing(o, { toValue: 1, duration: 700, delay: 120, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
        ]),
      ]).start(() => idle.start());
    } else idle.start();
    return () => idle.stop();
  }, [motion, disc, g, o, spin]);

  const layer = { position: 'absolute' as const, width: size, height: size };
  return (
    <View style={[{ width: size, height: size }, style]} accessible accessibilityLabel="GORIDES logo">
      <Animated.Image source={DISC} style={[layer, { opacity: disc, transform: [{ scale: disc.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }] }]} />
      <Animated.Image source={G} style={[layer, { opacity: g, transform: [{ translateX: g.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.35, 0] }) }] }]} />
      <Animated.View
        style={[
          layer,
          {
            opacity: o,
            transform: [{ translateX: o.interpolate({ inputRange: [0, 1], outputRange: [size * 0.45, 0] }) }],
          },
        ]}
      >
        {/* the O spins around its own centre (about 73% across, 51% down the logo) */}
        <Animated.Image
          source={O}
          style={[
            layer,
            {
              transformOrigin: [size * 0.728, size * 0.508, 0],
              transform: [
                { rotate: o.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) },
                { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
              ],
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}
