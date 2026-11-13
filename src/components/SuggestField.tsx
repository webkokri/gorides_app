import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Field } from './Field';
import { T } from './ui';
import { C } from '../theme';
import type { TextInputProps } from 'react-native';

/** A text field with a tappable suggestion list under it (shown while the field is focused and there is something to suggest). */
export function SuggestField({ suggestions, onPick, onFocus, onBlur, ...props }: TextInputProps & { label: string; suggestions: string[]; onPick: (value: string) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Field {...props} onFocus={onFocus} onBlur={onBlur} autoCorrect={false} />
      {suggestions.length ? (
        <View style={styles.list}>
          {suggestions.map((sug, i) => (
            <Pressable key={sug} onPress={() => onPick(sug)} accessibilityRole="button" style={[styles.item, i > 0 && styles.sep]}>
              <T w="semi" size={15}>
                {sug}
              </T>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderWidth: 1.5, borderColor: C.line, borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' },
  item: { paddingHorizontal: 14, paddingVertical: 12 },
  sep: { borderTopWidth: 1, borderTopColor: C.line },
});
