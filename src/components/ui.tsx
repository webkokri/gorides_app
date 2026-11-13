import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, ScrollViewInstance, StyleProp, StyleSheet, Switch, Text, TextProps, TextStyle, useWindowDimensions, View, ViewInstance, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { goBack } from '../lib/nav';
import { C, F, glow, shadow } from '../theme';
import { KeyboardSafe } from './KeyboardSafe';
import { Icon, IconName } from './Icon';

type W = keyof typeof F;
export function T({ w = 'regular', size = 15, color = C.ink, style, ...rest }: TextProps & { w?: W; size?: number; color?: string }) {
  return <Text {...rest} style={[{ fontFamily: F[w], fontSize: size, color, flexShrink: 1 }, (w === 'display' || w === 'displayBold') && { lineHeight: size * 1.3 }, style]} />;
}

export function Btn({ label, onPress, kind = 'pri', icon, small, style, disabled }: { label: string; onPress?: () => void; kind?: 'pri' | 'sec' | 'out' | 'dark'; icon?: IconName; small?: boolean; style?: StyleProp<ViewStyle>; disabled?: boolean }) {
  const bg = { pri: C.o, sec: C.oSoft, out: C.card, dark: C.ink }[kind];
  const fg = { pri: '#fff', sec: C.oDeep, out: C.ink, dark: '#fff' }[kind];
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, height: small ? 42 : 54, borderRadius: small ? 12 : 16, opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        kind === 'out' && { borderWidth: 1.5, borderColor: C.line },
        kind === 'pri' && glow,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <T w="bold" size={small ? 14 : 16} color={fg}>
        {label}
      </T>
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, { transform: [{ scale: pressed ? 0.99 : 1 }] }]}>
        {children}
      </Pressable>
    );
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Tag({ label, icon, tone = 'plain' }: { label: string; icon?: IconName; tone?: 'plain' | 'o' | 'g' }) {
  const bg = { plain: C.chip, o: C.oSoft, g: C.goodSoft }[tone];
  const fg = { plain: C.ink2, o: C.oDeep, g: C.good }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={13} color={fg} /> : null}
      <T w="semi" size={12} color={fg}>
        {label}
      </T>
    </View>
  );
}

export function IconBtn({ name, onPress, dot, tone = 'light', label }: { name: IconName; onPress?: () => void; dot?: boolean; tone?: 'light' | 'glass' | 'ghost'; label?: string }) {
  const st = tone === 'glass' ? { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: 'rgba(255,255,255,0.25)' } : tone === 'ghost' ? { backgroundColor: 'transparent', borderColor: 'transparent' } : null;
  return (
    <Pressable accessibilityLabel={label ?? name} onPress={onPress} style={[styles.ib, st]} hitSlop={6}>
      <Icon name={name} size={20} color={tone === 'glass' ? '#fff' : C.ink} />
      {dot ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

export function TopBar({ title, right, big, onBack }: { title?: string; right?: React.ReactNode; big?: boolean; onBack?: () => void }) {
  return (
    <View style={styles.topbar}>
      {big ? null : <IconBtn name="back" label="Back" onPress={onBack ?? (goBack)} />}
      <T w={big ? 'display' : 'bold'} size={big ? 28 : 18} numberOfLines={1} style={{ flex: 1, textAlign: big ? 'left' : 'center' }}>
        {title}
      </T>
      {right ?? <View style={{ width: 42 }} />}
    </View>
  );
}

export function Screen({ children, bg = C.bg, edges = true, style }: { children: React.ReactNode; bg?: string; edges?: boolean; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor: bg, paddingTop: edges ? insets.top : 0 }, style]}>
      <KeyboardSafe>{children}</KeyboardSafe>
    </View>
  );
}

export function Seg<V extends string>({ value, options, onChange, style }: { value: V; options: { v: V; label: string; icon?: IconName }[]; onChange: (v: V) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.seg, style]}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <Pressable key={o.v} onPress={() => onChange(o.v)} style={[styles.segBtn, on && styles.segOn]}>
            {o.icon ? <Icon name={o.icon} size={16} color={on ? C.oDeep : C.muted} /> : null}
            <T w="bold" size={14} color={on ? C.oDeep : C.muted}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Pressable accessibilityLabel="Decrease" disabled={value <= min} onPress={() => onChange(value - 1)} style={[styles.step, value <= min && { opacity: 0.35 }]}>
        <Icon name="minus" size={18} />
      </Pressable>
      <T w="xbold" size={22} style={{ minWidth: 24, textAlign: 'center' }}>
        {value}
      </T>
      <Pressable accessibilityLabel="Increase" disabled={value >= max} onPress={() => onChange(value + 1)} style={[styles.step, value >= max && { opacity: 0.35 }]}>
        <Icon name="plus" size={18} />
      </Pressable>
    </View>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return <Switch value={value} onValueChange={onChange} trackColor={{ true: C.o, false: '#DDD8D3' }} thumbColor="#fff" ios_backgroundColor="#DDD8D3" />;
}

const AV_COLORS = ['#E8674A', '#3D7BD9', '#1D9A6C', '#8E5BD6', '#D9467A', '#C98A06', '#2B9BB5', '#5A6273'];
export function Avatar({ name, size = 44, verified = true, ring, uri }: { name: string; size?: number; verified?: boolean; ring?: boolean; uri?: string | null }) {
  const ini = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const col = AV_COLORS[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV_COLORS.length];
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }, ring && { borderWidth: 2, borderColor: '#fff' }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <T w="xbold" size={Math.round(size * 0.36)} color="#fff">
          {ini}
        </T>
      )}
      {verified ? (
        <View style={styles.vf}>
          <Icon name="check" size={9} color="#fff" strokeWidth={3.5} />
        </View>
      ) : null}
    </View>
  );
}

export function Section({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sect}>
      <T w="xbold" size={18}>
        {title}
      </T>
      {action ? (
        <Pressable onPress={onAction}>
          <T w="bold" size={13} color={C.oDeep}>
            {action}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Chip({ label, on, icon, onPress }: { label: string; on?: boolean; icon?: IconName; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && { backgroundColor: C.oSoft, borderColor: C.o }]}>
      {icon ? <Icon name={icon} size={15} color={on ? C.oDeep : C.ink} /> : null}
      <T w="semi" size={13} color={on ? C.oDeep : C.ink}>
        {label}
      </T>
    </Pressable>
  );
}

/** Lets a field inside a Sheet ask for itself to be scrolled into view when the keyboard opens over it. */
export const SheetScrollContext = React.createContext<((target: ViewInstance | null) => void) | null>(null);

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [lift, setLift] = useState(0);
  const scroller = React.useRef<ScrollViewInstance>(null);
  const inner = React.useRef<ViewInstance>(null);
  // after the keyboard has opened and the sheet has resized, scroll the focused field to the top of the visible area
  const reveal = React.useCallback((target: ViewInstance | null) => {
    if (!target || !inner.current) return;
    setTimeout(() => {
      target.measureLayout(
        inner.current as ViewInstance,
        (_x: number, y: number) => scroller.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }),
        () => {},
      );
    }, 350);
  }, []);
  // the sheet sits above the keyboard (KeyboardSafe pads the modal by the covered amount) and never grows taller than the space left
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardSafe onOverlap={setLift}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={styles.scrim} onPress={onClose} />
          <View style={[styles.sheet, { paddingBottom: lift ? 12 : insets.bottom + 20, maxHeight: Math.max(220, height - lift - insets.top - 24) }]}>
            <View style={styles.grab} />
            <View style={styles.sheetHead}>
              <T w="bold" size={18}>
                {title}
              </T>
              <IconBtn name="x" tone="ghost" onPress={onClose} label="Close" />
            </View>
            <ScrollView ref={scroller} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: lift ? 24 : 8 }} keyboardShouldPersistTaps="handled">
              <SheetScrollContext.Provider value={reveal}>
                <View ref={inner} collapsable={false} style={{ gap: 12 }}>
                  {children}
                </View>
              </SheetScrollContext.Provider>
            </ScrollView>
          </View>
        </View>
      </KeyboardSafe>
    </Modal>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, style]}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: C.line }, style]} />;
}

export const muted: TextStyle = { color: C.muted };

export const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%' },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 20 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', flexShrink: 1, maxWidth: '100%' },
  ib: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  dot: { position: 'absolute', top: 8, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: C.bad, borderWidth: 2, borderColor: '#fff' },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  seg: { flexDirection: 'row', backgroundColor: '#F1EDEA', borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  segOn: { backgroundColor: C.card, ...shadow, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  step: { width: 40, height: 40, borderRadius: 12, borderWidth: 1.5, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card },
  vf: { position: 'absolute', right: -2, bottom: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: C.good, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sect: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 26, marginBottom: 12, marginHorizontal: 20 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 6 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(20,15,20,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '86%', backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  grab: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#DAD5D0', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
});
