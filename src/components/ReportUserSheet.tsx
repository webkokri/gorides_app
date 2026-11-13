import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Btn, Row, Sheet, T } from './ui';
import { ReportReason, users } from '../lib/api';
import { useStore } from '../store';
import { C, F } from '../theme';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'fake_profile', label: 'Fake or impersonated profile' },
  { value: 'harassment', label: 'Harassment or inappropriate behaviour' },
  { value: 'unsafe_driving', label: 'Unsafe driving' },
  { value: 'fraud_or_scam', label: 'Fraud or scam' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'other', label: 'Something else' },
];

/** Flags another user's profile/behaviour for staff review. Shown next to Block wherever a profile/booking is visible. */
export function ReportUserSheet({ visible, userId, userName, bookingId, onClose }: { visible: boolean; userId: number | null | undefined; userName: string; bookingId?: number; onClose: () => void }) {
  return (
    <Sheet visible={visible} title={`Report ${userName}`} onClose={onClose}>
      {visible && userId ? <Body userId={userId} bookingId={bookingId} onClose={onClose} /> : null}
    </Sheet>
  );
}

function Body({ userId, bookingId, onClose }: { userId: number; bookingId?: number; onClose: () => void }) {
  const { toast } = useStore();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) return toast('Choose a reason first');
    setBusy(true);
    try {
      await users.report(userId, reason, details.trim() || undefined, bookingId);
      toast('Report submitted. Our team will review it.');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not submit report');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <T size={13} color={C.ink2}>
        Tell us what&apos;s wrong. Our team reviews every report -- this is separate from blocking, which just stops them from contacting or booking with you.
      </T>
      <View style={{ gap: 8 }}>
        {REASONS.map((r) => (
          <Btn key={r.value} label={r.label} kind={reason === r.value ? 'pri' : 'out'} small onPress={() => setReason(r.value)} />
        ))}
      </View>
      <TextInput
        value={details}
        onChangeText={setDetails}
        multiline
        maxLength={2000}
        placeholder="Add details (optional)"
        placeholderTextColor="#A9A4AD"
        style={{ minHeight: 90, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, padding: 12, fontFamily: F.regular, fontSize: 15, color: C.ink, textAlignVertical: 'top', backgroundColor: C.card }}
      />
      <Row style={{ gap: 8 }}>
        <Btn label="Cancel" kind="out" style={{ flex: 1, width: undefined }} onPress={onClose} />
        <Btn label={busy ? 'Submitting…' : 'Submit report'} style={{ flex: 1, width: undefined }} disabled={busy || !reason} onPress={submit} />
      </Row>
    </>
  );
}
