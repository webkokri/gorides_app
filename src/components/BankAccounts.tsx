import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from './Icon';
import { Row, T, Tag } from './ui';
import { BankAccount } from '../lib/api';
import { C } from '../theme';

export const accountTitle = (a: BankAccount) => a.nickname || `Account •••• ${a.last4}`;

/** One saved bank account. Pass `selected` + `onPress` to use it as a choice in a list, or `right` for actions. */
export function BankAccountCard({ a, selected, onPress, right }: { a: BankAccount; selected?: boolean; onPress?: () => void; right?: React.ReactNode }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={[styles.card, selected && { borderColor: C.o, backgroundColor: C.oSoft }]} accessibilityRole={onPress ? 'radio' : undefined} accessibilityState={onPress ? { checked: !!selected } : undefined}>
      <View style={[styles.ic, selected && { backgroundColor: C.o }]}>
        <Icon name="bank" size={20} color={selected ? '#fff' : C.oDeep} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Row style={{ gap: 6 }}>
          <T w="bold" size={15} numberOfLines={1} style={{ flexShrink: 1 }}>
            {accountTitle(a)}
          </T>
          {a.isDefault ? <Tag label="Default" tone="g" /> : null}
        </Row>
        <T size={12} color={C.muted} numberOfLines={1}>
          {a.holderName} · •••• {a.last4}
        </T>
        <T size={11} color={C.muted}>
          Institution {a.institutionNumber} · Transit {a.transitNumber}
        </T>
      </View>
      {right ?? (onPress ? <View style={[styles.radio, selected && { borderColor: C.o }]}>{selected ? <View style={styles.dot} /> : null}</View> : null)}
    </Pressable>
  );
}

/** Pick one of the saved accounts, or add a new one. */
export function BankPicker({ accounts, value, onChange, onAdd }: { accounts: BankAccount[]; value: number | null; onChange: (id: number) => void; onAdd: () => void }) {
  return (
    <View style={{ gap: 8 }}>
      {accounts.map((a) => (
        <BankAccountCard key={a.id} a={a} selected={a.id === value} onPress={() => onChange(a.id)} />
      ))}
      {accounts.length ? null : (
        <Pressable onPress={onAdd} style={styles.add} accessibilityRole="button">
          <Icon name="plus" size={18} color={C.oDeep} />
          <T w="bold" size={14} color={C.oDeep}>
            Add a bank account
          </T>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card },
  ic: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.oSoft, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.o },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.o },
});
