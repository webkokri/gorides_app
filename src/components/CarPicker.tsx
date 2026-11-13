import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Field } from './Field';
import { Icon } from './Icon';
import { Chip, Row, T } from './ui';
import { vehicles, VehicleModel } from '../lib/api';
import { C } from '../theme';

export type CarValue = { make: string; model: string; year: string; color: string; plate: string };
export const EMPTY_CAR: CarValue = { make: '', model: '', year: '', color: '', plate: '' };
export const carName = (c: { make?: string | null; model?: string | null; year?: number | string | null }) => [c.year, c.make, c.model].filter(Boolean).join(' ');

const COLORS = ['Black', 'White', 'Silver', 'Grey', 'Blue', 'Red', 'Green', 'Brown', 'Beige', 'Gold', 'Orange', 'Yellow'];
const lc = (s?: string | number | null) => String(s ?? '').trim().toLowerCase();

type Option = { make: string; model: string; year?: number };
const keyOf = (o: Option) => `${lc(o.make)}|${lc(o.model)}|${o.year ?? ''}`;

/** Catalogue cars matching what was typed: best matches first, newest year first. */
async function search(q: string): Promise<Option[]> {
  const rows: VehicleModel[] = await vehicles.models(q.trim()).catch(() => []);
  const t = lc(q);
  const seen = new Set<string>();
  const out: Option[] = [];
  for (const r of rows) {
    const o = { make: r.make, model: r.model, year: r.year };
    const text = lc(`${r.make} ${r.model} ${r.year ?? ''}`);
    // every typed word has to appear somewhere in "make model year"
    if (!t.split(/\s+/).every((w) => text.includes(w)) || seen.has(keyOf(o))) continue;
    seen.add(keyOf(o));
    out.push(o);
  }
  const start = (o: Option) => Number(!(lc(o.make).startsWith(t) || lc(`${o.make} ${o.model}`).startsWith(t) || lc(o.model).startsWith(t)));
  return out.sort((a, b) => start(a) - start(b) || (b.year ?? 0) - (a.year ?? 0) || a.make.localeCompare(b.make) || a.model.localeCompare(b.model)).slice(0, 8);
}

/**
 * Choosing a car: type a few letters, tap the car in the suggestions (make, model and year come from the catalogue), then tap
 * a colour. A car that is not in the catalogue can be entered by hand. Used at sign-up and in Vehicle documents.
 */
export function CarPicker({ value, onChange, showPlate }: { value: CarValue; onChange: (v: CarValue) => void; showPlate?: boolean }) {
  const [q, setQ] = useState('');
  const [options, setOptions] = useState<{ q: string; list: Option[] }>({ q: '', list: [] });
  const [manual, setManual] = useState(false);
  const chosen = !!value.make && !!value.model && !manual;

  useEffect(() => {
    if (chosen || manual || q.trim().length < 2) return;
    let live = true;
    const t = setTimeout(() => search(q).then((list) => live && setOptions({ q, list })), 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, chosen, manual]);
  const list = options.q === q && q.trim().length >= 2 ? options.list : [];

  const pick = (o: Option) => {
    onChange({ ...value, make: o.make, model: o.model, year: o.year ? String(o.year) : value.year });
    setQ('');
  };

  return (
    <View style={{ gap: 14 }}>
      {chosen ? (
        <View style={{ gap: 6 }}>
          <T w="bold" size={13} color={C.ink2}>
            Your car
          </T>
          <View style={styles.picked}>
            <View style={styles.carIc}>
              <Icon name="car" size={20} color={C.oDeep} />
            </View>
            <T w="bold" size={16} style={{ flex: 1 }} numberOfLines={2}>
              {carName(value)}
            </T>
            <Pressable onPress={() => onChange({ ...value, make: '', model: '', year: '' })} hitSlop={8} accessibilityLabel="Change car">
              <T w="bold" size={13} color={C.oDeep}>
                Change
              </T>
            </Pressable>
          </View>
        </View>
      ) : manual ? (
        <View style={{ gap: 10 }}>
          <Field label="Make" value={value.make} onChangeText={(v) => onChange({ ...value, make: v })} autoCapitalize="words" placeholder="Toyota" />
          <Field label="Model" value={value.model} onChangeText={(v) => onChange({ ...value, model: v })} autoCapitalize="words" placeholder="Camry" />
          <Field label="Year" value={value.year} onChangeText={(v) => onChange({ ...value, year: v.replace(/\D/g, '').slice(0, 4) })} keyboardType="number-pad" placeholder="2020" />
          <Pressable onPress={() => setManual(false)}>
            <T w="bold" size={13} color={C.oDeep}>
              Search the car list instead
            </T>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <Field label="Search your car" value={q} onChangeText={setQ} placeholder="Type a make or model, e.g. Camry" autoCapitalize="words" autoCorrect={false} />
          {list.length ? (
            <View style={styles.list}>
              {list.map((o, i) => (
                <Pressable key={keyOf(o)} onPress={() => pick(o)} accessibilityRole="button" style={[styles.item, i > 0 && styles.sep]}>
                  <T w="semi" size={15}>
                    {o.make} {o.model}
                  </T>
                  {o.year ? (
                    <T size={13} color={C.muted}>
                      {o.year}
                    </T>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ) : q.trim().length >= 2 ? (
            <T size={12} color={C.muted}>
              No matches yet.
            </T>
          ) : null}
          <Pressable onPress={() => setManual(true)}>
            <T size={13} color={C.muted}>
              Can&apos;t find your car? <T w="bold" size={13} color={C.oDeep}>Enter it manually</T>
            </T>
          </Pressable>
        </View>
      )}

      <View style={{ gap: 8 }}>
        <T w="bold" size={13} color={C.ink2}>
          Colour
        </T>
        <Row style={{ flexWrap: 'wrap', gap: 8 }}>
          {COLORS.map((c) => (
            <Chip key={c} label={c} on={lc(value.color) === lc(c)} onPress={() => onChange({ ...value, color: c })} />
          ))}
        </Row>
      </View>

      {showPlate ? <Field label="License plate" value={value.plate} onChangeText={(v) => onChange({ ...value, plate: v })} placeholder="ABC 123" autoCapitalize="characters" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  picked: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: C.o, backgroundColor: C.oSoft },
  carIc: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  list: { borderWidth: 1.5, borderColor: C.line, borderRadius: 14, backgroundColor: C.card, overflow: 'hidden' },
  item: { paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sep: { borderTopWidth: 1, borderTopColor: C.line },
});
