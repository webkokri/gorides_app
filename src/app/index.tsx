import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../auth';
import { Logo } from '../components/Logo';
import { logoIn, SPLASH, SplashRoad } from '../components/scenes/SplashRoad';
import { T } from '../components/ui';
import { ease, useTicker } from '../lib/anim';
import { F } from '../theme';

const WORD = 'GORIDES'.split('');
const LOGO = 140;
const unit = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Animated splash: an orange car drives up the road from the bottom of the screen, kicks up dust as it
 * passes the middle, and the GO logo fades in out of the dust. Then the letters rise and the tagline fades in.
 */
export default function Splash() {
  const { user, ready } = useAuth();
  const { width: W, height: H } = useWindowDimensions();
  const cy = H * 0.4;
  const t = useTicker(true, 50);
  // when the car crosses the logo spot; mirrors the car's path in SplashRoad
  const pass = useMemo(() => {
    const y0 = H + 90;
    const y1 = -200;
    for (let tt = SPLASH.carFrom; tt < SPLASH.carTo; tt += 0.005) {
      const k = (tt - SPLASH.carFrom) / (SPLASH.carTo - SPLASH.carFrom);
      if (y0 + (y1 - y0) * ease.inOut(k) <= cy) return tt;
    }
    return 1;
  }, [H, cy]);
  const k = logoIn(t, pass);

  // everything runs off the same clock as the car, so the letters never beat the logo
  const letter = (i: number) => ease.out(unit((t - pass - 0.6 - i * 0.07) / 0.45));
  const tag = unit((t - pass - 1.25) / 0.5);
  const foot = unit((t - SPLASH.carTo - 0.2) / 0.6); // only once the car has fully passed
  const done = t > Math.max(pass + 2.5, SPLASH.carTo + 1.2) && ready;
  useEffect(() => {
    if (done) router.replace(user ? '/home' : '/onboarding');
  }, [done, user]);

  return (
    <LinearGradient colors={['#0C0F20', '#14162C', '#2A1726']} locations={[0, 0.55, 1]} style={styles.root}>
      <StatusBar style="light" />
      <View style={StyleSheet.absoluteFill}>
        <SplashRoad width={W} height={H} cy={cy} />
      </View>
      <View style={[styles.logo, { top: cy - LOGO / 2, left: W / 2 - LOGO / 2, opacity: k, transform: [{ scale: 1.3 - 0.3 * k }] }]}>
        <Logo size={LOGO} motion={k >= 1 ? 'idle' : 'none'} />
      </View>
      <View style={[styles.word, { top: cy + LOGO / 2 + 26 }]}>
        {WORD.map((ch, i) => (
          <Text key={i} style={[styles.letter, { opacity: letter(i), transform: [{ translateY: 24 * (1 - letter(i)) }] }]}>
            {ch}
          </Text>
        ))}
      </View>
      <View style={[styles.tag, { top: cy + LOGO / 2 + 90, opacity: tag }]}>
        <T w="semi" size={15} color="rgba(255,255,255,0.9)">
          Share the ride. Split the cost.
        </T>
      </View>
      <T w="bold" size={12} color="rgba(255,255,255,0.6)" style={[styles.foot, { opacity: foot }]}>
        RIDESHARE ACROSS CANADA
      </T>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  logo: { position: 'absolute', width: LOGO, height: LOGO },
  word: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' },
  letter: { fontFamily: F.display, fontSize: 46, color: '#fff', lineHeight: 60, letterSpacing: 3, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 12 },
  tag: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  foot: { position: 'absolute', bottom: 60, letterSpacing: 1.8 },
});
