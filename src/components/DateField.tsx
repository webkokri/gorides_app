import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { C } from '../theme';
import { T } from './ui';

const toISO = (d: Date) => d.toISOString().slice(0, 10);
const fromISO = (s: string) => {
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

/** A calendar date picker for YYYY-MM-DD values (e.g. document expiry dates) -- no free-text typing. */
export function DateField({ label, value, onChange, minimumDate, disabled }: { label: string; value: string; onChange: (iso: string) => void; minimumDate?: Date; disabled?: boolean }) {
  const [open, setOpen] = useState(false);

  const show = () => !disabled && setOpen(true);

  return (
    <View style={{ gap: 6 }}>
      <T w="bold" size={13} color={C.ink2}>
        {label}
      </T>
      <Pressable onPress={show} style={[styles.input, disabled && { opacity: 0.6 }]}>
        <T size={16} w="semi" color={value ? C.ink : C.muted}>
          {value || 'Select a date'}
        </T>
      </Pressable>
      {open && (
        <DateTimePicker
          value={value ? fromISO(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          onChange={(_, date) => {
            if (Platform.OS !== 'ios') setOpen(false);
            if (date) onChange(toISO(date));
          }}
        />
      )}
      {open && Platform.OS === 'ios' && (
        <Pressable onPress={() => setOpen(false)} style={styles.doneBtn}>
          <T w="bold" size={14} color={C.o}>
            Done
          </T>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 14, justifyContent: 'center' },
  doneBtn: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
});
