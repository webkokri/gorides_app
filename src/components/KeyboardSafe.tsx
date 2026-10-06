import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, StyleProp, View, ViewStyle } from 'react-native';

/**
 * Keeps the bottom of its content above the on-screen keyboard.
 *
 * On Android with edge-to-edge the window does not resize for the keyboard, and React Native's KeyboardAvoidingView
 * is unreliable inside Modals, so this measures instead: when the keyboard opens it works out how much of THIS view the
 * keyboard actually covers (view bottom vs keyboard top, both in screen coordinates) and pads the content by exactly
 * that. If the window already resized itself the overlap is 0, so it never double-counts.
 */
export function KeyboardSafe({ children, style, onOverlap }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onOverlap?: (px: number) => void }) {
  const ref = useRef<View>(null);
  const [pad, setPad] = useState(0);

  useEffect(() => {
    const apply = (v: number) => {
      setPad(v);
      onOverlap?.(v);
    };
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      // the keyboard's top edge; take the higher of the two estimates so we never under-pad
      const kbTop = Math.min(e.endCoordinates.screenY, Dimensions.get('window').height - e.endCoordinates.height);
      // measure after layout has settled
      setTimeout(() => ref.current?.measureInWindow((_x, y, _w, h) => apply(Math.max(0, Math.round(y + h - kbTop)))), Platform.OS === 'ios' ? 0 : 60);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => apply(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [onOverlap]);

  return (
    <View ref={ref} collapsable={false} style={[{ flex: 1 }, style]}>
      <View style={{ flex: 1, paddingBottom: pad }}>{children}</View>
    </View>
  );
}
