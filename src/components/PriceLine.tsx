import React from 'react';
import { View } from 'react-native';
import { Row, T } from './ui';
import { money } from '../lib/format';
import { C } from '../theme';

/** One line of a price breakdown: the amount, and in small print why it is charged. */
export function PriceLine({ label, amount, why, bold, minus }: { label: string; amount: number; why?: string; bold?: boolean; minus?: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <Row style={{ justifyContent: 'space-between', gap: 12 }}>
        <T size={14} w={bold ? 'bold' : undefined} color={bold ? C.ink : C.ink2} style={{ flex: 1 }}>
          {label}
        </T>
        <T size={14} w={bold ? 'bold' : undefined} color={minus ? C.good : bold ? C.ink : C.ink2}>
          {minus ? '-' : ''}
          {money(Math.abs(amount))}
        </T>
      </Row>
      {why ? (
        <T size={12} color={C.muted}>
          {why}
        </T>
      ) : null}
    </View>
  );
}
