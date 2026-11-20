import React from 'react';
import { StyleSheet, View } from 'react-native';
import { C } from '../theme';
import { Icon } from './Icon';
import { T } from './ui';

/** Confirmation screen body used after booking and publishing: a check mark, a title and a line of text. */
export function Celebrate({ color = C.good, soft = C.goodSoft, title, body, children }: { color?: string; soft?: string; title: string; body: string; children?: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <View style={[styles.ck, { backgroundColor: soft }]}>
        <View style={[styles.inner, { backgroundColor: color }]}>
          <Icon name="check" size={34} color="#fff" strokeWidth={3} />
        </View>
      </View>
      <T w="display" size={26} style={{ marginTop: 10, textAlign: 'center' }}>
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
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  ck: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  inner: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
