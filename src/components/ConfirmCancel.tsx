import React, { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Btn, Row, Sheet, T, Toggle } from './ui';
import { C } from '../theme';

/**
 * Deliberate, two-step confirmation for destructive cancellations. The safe choice ("Keep") is the big primary
 * button; the destructive one stays disabled until the person switches on "I understand", so it can't be hit by accident.
 */
export function ConfirmCancel({ visible, title, body, confirmLabel, keepLabel, busy, onConfirm, onClose }: { visible: boolean; title: string; body: string; confirmLabel: string; keepLabel: string; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      {visible ? <Body body={body} confirmLabel={confirmLabel} keepLabel={keepLabel} busy={busy} onConfirm={onConfirm} onClose={onClose} /> : null}
    </Sheet>
  );
}

function Body({ body, confirmLabel, keepLabel, busy, onConfirm, onClose }: { body: string; confirmLabel: string; keepLabel: string; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  const [sure, setSure] = useState(false);
  return (
    <>
      <T size={14} color={C.ink2} style={{ lineHeight: 21 }}>
        {body}
      </T>
      <Btn label={keepLabel} onPress={onClose} />
      <Row style={styles.sure}>
        <T size={14} style={{ flex: 1 }}>
          I understand this can&apos;t be undone
        </T>
        <Toggle value={sure} onChange={setSure} />
      </Row>
      <Pressable
        disabled={!sure || busy}
        onPress={onConfirm}
        accessibilityRole="button"
        accessibilityState={{ disabled: !sure || busy }}
        style={[styles.danger, (!sure || busy) && { opacity: 0.35 }]}
      >
        <T w="bold" size={15} color={C.bad}>
          {busy ? 'Cancelling…' : confirmLabel}
        </T>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  sure: { backgroundColor: C.chip, borderRadius: 14, padding: 12, marginTop: 4 },
  danger: { height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: C.bad, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
