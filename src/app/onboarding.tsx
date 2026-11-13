import React, { useEffect, useRef, useState } from 'react';
import { Animated, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, ScrollViewInstance, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CityScene, PickupScene, SplitScene, VideoScene } from '../components/scenes/Slides';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { Btn, T } from '../components/ui';
import { useTicker } from '../lib/anim';
import { C } from '../theme';


const SLIDES = [
  { key: 'city', eyebrow: 'LOCAL RIDES', title: 'Share the ride, split the cost', body: 'Find people heading your way across town. Pay only for your seat and skip the parking.', ms: 5600 },
  { key: 'pickup', eyebrow: 'EASY PICKUPS', title: 'Your driver comes to you', body: 'Drop a pin, watch your driver pull up, hop in and go. Live tracking the whole way.', ms: 8800 },
  { key: 'split', eyebrow: 'FAIR SHARE', title: 'A clear price per seat', body: 'The driver sets the seat price, and every passenger pays the same. Fees and tax are shown before you pay.', ms: 9000 },
  { key: 'video', eyebrow: 'WATCH', title: 'GORIDES in 20 seconds', body: 'Search your route, book a seat and ride together. Here is how a trip works.', ms: 20000 },
] as const;

const VIDEO_LEN = 20;
// lowest point of each scene on its 844-high canvas (road, car, people); the video slide has no copy overlay.
const SCENE_BOTTOM = 470; // lowest point of every scene (road, car, people); wheels sit on y=440 in all three
const CARD_TOP = 138; // top of the slide-3 cost card on the canvas

export default function Onboarding() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollViewInstance>(null);
  const [index, setIndex] = useState(0);
  const [copyH, setCopyH] = useState(230);
  // bumps on every slide entry so the active scene remounts and its car drives in from the left again
  const [run, setRun] = useState(0);

  const enter = (n: number) => {
    setIndex(n);
    setRun((r) => r + 1);
  };

  const go = (i: number) => {
    const n = (i + SLIDES.length) % SLIDES.length;
    scroller.current?.scrollTo({ x: n * width, animated: true });
    enter(n);
  };

  // autoplay in a loop; each slide ends as its car drives off to the right, and the video slide hands back to the first
  useEffect(() => {
    const ms = SLIDES[index].ms;
    if (!ms) return;
    const id = setTimeout(() => go(index + 1), ms);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, width]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) enter(i);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd} scrollEventThrottle={16}>
        {SLIDES.map((s, i) => {
          // the scenes are drawn on a 390x844 canvas scaled to cover the screen; on tall phones the road and car would
          // land behind the copy, so lift the scene until its lowest point sits above the text block
          // The scenes are drawn on a 390x844 canvas scaled to cover the screen. One shared offset keeps the road on the
          // same line on every slide and satisfies two limits: the slide-3 cost card must start below the top bar, and
          // the road/car must end above the text block. If both cannot hold, the card wins (the road may dip behind text).
          const scale = Math.max(width / 390, height / 844);
          const topBarBottom = insets.top + 8 + 46 + 14;
          const copyTop = height - (insets.bottom + 176) - copyH;
          const mostLift = Math.max(0, SCENE_BOTTOM * scale - (copyTop - 12));
          const ty = Math.min(60, Math.max(topBarBottom - CARD_TOP * scale, -mostLift));
          return (
          <View key={s.key} style={{ width, flex: 1 }}>
            <View style={[StyleSheet.absoluteFill, { transform: [{ translateY: ty }] }]}>
            {i === 0 ? <CityScene key={index === 0 ? run : 'off'} active={index === 0} dur={s.ms / 1000} /> : null}
            {i === 1 ? <PickupScene key={index === 1 ? run : 'off'} active={index === 1} statusTop={topBarBottom - ty} /> : null}
            {i === 2 ? <SplitScene key={index === 2 ? run : 'off'} active={index === 2} dur={s.ms / 1000} /> : null}
            {i === 3 ? <VideoSlide key={index === 3 ? run : 'off'} active={index === 3} topInset={insets.top} /> : null}
            </View>
            {i !== 3 ? <Shade /> : null}
            <SlideCopy slide={s} active={index === i} bottom={insets.bottom + 176} onHeight={setCopyH} />
          </View>
          );
        })}
      </ScrollView>

      <View style={[styles.top, { top: insets.top + 8 }]}>
        <Pressable style={styles.glassRound} onPress={() => router.push('/help')} accessibilityLabel="Help">
          <Icon name="help" color="#fff" />
        </Pressable>
        <View style={styles.mini}>
          <Logo size={30} />
          <T w="display" size={20} color="#fff" style={{ letterSpacing: 1 }}>
            GORIDES
          </T>
        </View>
        <Pressable style={styles.glassPill} onPress={() => router.push('/signin')}>
          <T w="bold" color="#fff">
            Sign in
          </T>
        </Pressable>
      </View>

      <View style={[styles.bottom, { bottom: insets.bottom + 24 }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <Pressable key={s.key} onPress={() => go(i)} hitSlop={8} accessibilityLabel={`Slide ${i + 1}`}>
              <View style={[styles.dot, i === index && styles.dotOn]} />
            </Pressable>
          ))}
          <Pressable style={{ marginLeft: 'auto' }} onPress={() => router.replace('/home')}>
            <T w="bold" size={14} color="rgba(255,255,255,0.75)">
              Skip
            </T>
          </Pressable>
        </View>
        <Btn label="GET STARTED" onPress={() => router.replace('/home')} style={{ height: 58 }} />
      </View>
    </View>
  );
}

/** Darkens the lower half of a slide so the copy stays readable. */
function Shade() {
  return <LinearGradient colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(12,6,14,0.9)', '#0C060E']} locations={[0, 0.18, 0.52, 0.7, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />;
}

function SlideCopy({ slide, active, bottom, onHeight }: { slide: (typeof SLIDES)[number]; active: boolean; bottom: number; onHeight: (h: number) => void }) {
  const [a] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (active) {
      a.setValue(0);
      Animated.timing(a, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }
  }, [active, a]);
  return (
    <Animated.View onLayout={(e) => onHeight(Math.max(e.nativeEvent.layout.height, 0))} style={[styles.copy, { bottom, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        {slide.key === 'video' ? <Icon name="play" size={14} color="#FFB27A" /> : null}
        <T w="xbold" size={12} color="#FFB27A" style={{ letterSpacing: 1.4 }}>
          {slide.eyebrow}
        </T>
      </View>
      <T w="display" size={36} color="#fff" style={{ lineHeight: 46, marginBottom: 10 }}>
        {slide.title}
      </T>
      <T size={15} color="rgba(255,255,255,0.78)" style={{ lineHeight: 22 }}>
        {slide.body}
      </T>
    </Animated.View>
  );
}

function VideoSlide({ active, topInset }: { active: boolean; topInset: number }) {
  // remounted (via key) each time the slide is entered, so it starts from 0:00
  const t = Math.min(useTicker(active, 40), VIDEO_LEN - 0.01);
  const phase = t < 6 ? 0 : t < 13 ? 1 : 2;
  const CARD = [
    ['Search Toronto → Ottawa', '6 rides found for tomorrow'],
    ['Book 1 seat · $38', 'Priya confirmed instantly'],
    ['Ride together, rate after', 'Split fuel, save 62 kg CO₂'],
  ][phase];
  const CAP = ['Step 1. Search your route', 'Step 2. Book a seat', 'Step 3. Ride together'][phase];
  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoScene time={t} dur={VIDEO_LEN} />
      <Shade />
      <View style={[styles.vidBadge, { top: topInset + 62 }]}>
        <View style={styles.rec} />
        <T w="xbold" size={11} color="#fff" style={{ letterSpacing: 1 }}>
          VIDEO
        </T>
      </View>
      <T w="displayBold" size={22} color="#fff" style={[styles.cap, { top: topInset + 100 }]}>
        {CAP}
      </T>
      <View style={[styles.vidCard, { top: '24%' }]}>
        <View style={styles.vidNum}>
          <T w="display" size={20} color="#fff">
            {phase + 1}
          </T>
        </View>
        <View>
          <T w="xbold" size={15}>
            {CARD[0]}
          </T>
          <T w="semi" size={12} color={C.muted}>
            {CARD[1]}
          </T>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#120A14' },
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  glassRound: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  glassPill: { height: 40, paddingHorizontal: 18, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', justifyContent: 'center' },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bottom: { position: 'absolute', left: 24, right: 24, gap: 22 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { height: 8, width: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotOn: { width: 30, backgroundColor: C.o },
  copy: { position: 'absolute', left: 24, right: 24 },
  vidBadge: { position: 'absolute', left: 24, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  rec: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF4B3E' },
  cap: { position: 'absolute', left: 24, right: 24, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 12 },
  vidCard: { position: 'absolute', left: 40, right: 40, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  vidNum: { width: 46, height: 46, borderRadius: 12, backgroundColor: C.o, alignItems: 'center', justifyContent: 'center' },
});
