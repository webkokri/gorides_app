import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { T } from './ui';
import { C } from '../theme';

/** App footer line: "Made with ♥ in Canada" with a red heart. */
export function MadeInCanada({ style }: { style?: StyleProp<TextStyle> }) {
  return (
    <T size={12} color={C.muted} style={[{ textAlign: 'center', paddingBottom: 24 }, style]} accessibilityLabel="Made with love in Canada">
      Made with{' '}
      <T size={14} color="#E5243B">
        ♥
      </T>{' '}
      in Canada
    </T>
  );
}
