import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { currentPlace, Place, placeLabel, searchPlaces } from '../lib/geo';
import { MONTHS, sameDay, today } from '../lib/format';
import { C, F } from '../theme';
import { Icon } from './Icon';
import { Btn, Chip, Divider, Row, Sheet, Stepper, T } from './ui';

export function PlaceSheet({ visible, title, onClose, onPick, withCurrent }: { visible: boolean; title: string; onClose: () => void; onPick: (label: string, place: Place) => void; withCurrent?: boolean }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // debounce typing; results arrive from Mapbox (Canada only)
  useEffect(() => {
    if (q.trim().length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      setBusy(true);
      searchPlaces(q)
        .then((r) => live && (setList(r), setErr('')))
        .catch((e) => live && setErr(e instanceof Error ? e.message : 'Search failed'))
        .finally(() => live && setBusy(false));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  const pick = (label: string, p: Place) => {
    setQ('');
    setList([]);
    onPick(label, p);
    onClose();
  };
  const useCurrent = async () => {
    try {
      setBusy(true);
      const p = await currentPlace();
      pick(`Current location · ${p.city || p.name}`, p);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not get your location');
    } finally {
      setBusy(false);
    }
  };
  const shown = q.trim().length < 2 ? [] : list;
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <View style={styles.field}>
        <Icon name="search" color={C.o} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search a city, station or address" placeholderTextColor="#A9A4AD" style={styles.input} autoCorrect={false} />
        {busy ? <ActivityIndicator color={C.o} /> : null}
      </View>
      {withCurrent ? <PlaceRow title="Use current location" sub="Using GPS" icon="target" accent onPress={useCurrent} /> : null}
      {shown.map((p) => (
        <PlaceRow key={`${p.latitude},${p.longitude}`} title={p.name} sub={p.address} onPress={() => pick(placeLabel(p), p)} />
      ))}
      {err ? <T color={C.muted}>{err}</T> : shown.length || busy || q.trim().length < 2 ? null : <T color={C.muted}>No places match. Try a city name.</T>}
    </Sheet>
  );
}

function PlaceRow({ title, sub, icon = 'pin', accent, onPress }: { title: string; sub: string; icon?: string; accent?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Row style={{ paddingVertical: 10 }}>
        <View style={[styles.ic, accent && { backgroundColor: C.oSoft }]}>
          <Icon name={icon} size={18} color={accent ? C.oDeep : C.ink2} />
        </View>
        <View style={{ flex: 1 }}>
          <T w="bold" size={14}>
            {title}
          </T>
          <T size={12} color={C.muted}>
            {sub}
          </T>
        </View>
      </Row>
      <Divider />
    </Pressable>
  );
}

export function DateSheet({ visible, title, value, onClose, onPick, quick }: { visible: boolean; title: string; value: Date; onClose: () => void; onPick: (d: Date, label?: string) => void; quick?: boolean }) {
  const t0 = today();
  const first = new Date(t0.getFullYear(), t0.getMonth(), 1);
  const days = new Date(t0.getFullYear(), t0.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => new Date(t0.getFullYear(), t0.getMonth(), i + 1))];
  const done = (d: Date, label?: string) => {
    onPick(d, label);
    onClose();
  };
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      {quick ? (
        <>
          <Row style={{ flexWrap: 'wrap', gap: 8 }}>
            <Chip label="Leave now" on onPress={() => done(t0, 'Leave now')} />
            <Chip label="In 30 min" onPress={() => done(t0, 'In 30 min')} />
            <Chip label="Tonight 8 PM" onPress={() => done(t0, 'Tonight, 8:00 PM')} />
          </Row>
          <T w="semi" size={13} color={C.muted} style={{ textAlign: 'center' }}>
            or pick a day
          </T>
        </>
      ) : null}
      <T w="bold">
        {MONTHS[t0.getMonth()]} {t0.getFullYear()}
      </T>
      <View style={styles.cal}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <T key={`h${i}`} w="bold" size={11} color={C.muted} style={styles.cell}>
            {d}
          </T>
        ))}
        {cells.map((d, i) =>
          d ? (
            <Pressable key={i} disabled={d < t0} onPress={() => done(d)} style={[styles.cell, styles.day, sameDay(d, value) && { backgroundColor: C.o }, sameDay(d, t0) && !sameDay(d, value) && { borderWidth: 1.5, borderColor: C.o }]}>
              <T w="bold" size={14} color={d < t0 ? '#CFCAD2' : sameDay(d, value) ? '#fff' : C.ink}>
                {d.getDate()}
              </T>
            </Pressable>
          ) : (
            <View key={i} style={styles.cell} />
          ),
        )}
      </View>
    </Sheet>
  );
}

export function PaxSheet({ visible, label, value, onClose, onPick, min = 1, max = 8, hint = 'Up to 8 per booking' }: { visible: boolean; label: string; value: number; onClose: () => void; onPick: (n: number) => void; min?: number; max?: number; hint?: string }) {
  return (
    <Sheet visible={visible} title={label} onClose={onClose}>
      {visible ? <PaxBody label={label} value={value} min={min} max={max} hint={hint} onDone={(n) => (onPick(n), onClose())} /> : null}
    </Sheet>
  );
}

function PaxBody({ label, value, min, max, hint, onDone }: { label: string; value: number; min: number; max: number; hint: string; onDone: (n: number) => void }) {
  const [n, setN] = useState(value);
  return (
    <>
      <Row style={{ justifyContent: 'space-between', paddingVertical: 10 }}>
        <View>
          <T w="bold">{label}</T>
          <T size={12} color={C.muted}>
            {hint}
          </T>
        </View>
        <Stepper value={n} min={min} max={max} onChange={setN} />
      </Row>
      <Btn label="Done" onPress={() => onDone(n)} />
    </>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 56, borderRadius: 16, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 16 },
  input: { flex: 1, fontFamily: F.semi, fontSize: 16, color: C.ink },
  ic: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F2EEEB', alignItems: 'center', justifyContent: 'center' },
  cal: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 42, textAlign: 'center', alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
  day: { borderRadius: 12, paddingTop: 0 },
});
