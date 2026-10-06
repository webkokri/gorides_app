import React from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { C, F } from '../theme';
import { T } from './ui';

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T w="bold" size={13} color={C.ink2}>
        {label}
      </T>
      <TextInput placeholderTextColor="#A9A4AD" autoCapitalize="none" {...props} style={[styles.input, props.style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  input: { height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 14, fontFamily: F.semi, fontSize: 16, color: C.ink },
});
