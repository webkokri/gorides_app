import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { CountryCode } from 'libphonenumber-js';
import { C, F } from '../theme';
import { COUNTRIES, Country, detectCountry, findCountry, toE164 } from '../lib/phone';
import { Icon } from './Icon';
import { Row, Sheet, T } from './ui';

/**
 * Country-code dropdown (with flags, pre-selected from IP / device locale) + national number input.
 * `onChange` receives the full E.164 number, or '' while the number is incomplete or invalid.
 */
export function PhoneField({ label = 'Mobile number', initialCountry, initialNational = '', onChange }: { label?: string; initialCountry?: CountryCode | null; initialNational?: string; onChange: (e164: string) => void }) {
  const [country, setCountry] = useState<Country>(findCountry(initialCountry ?? 'CA'));
  const [national, setNational] = useState(initialNational);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [touched, setTouched] = useState(!!initialCountry);

  // detection is only a default: skipped once the user picked a country or one was provided
  useEffect(() => {
    if (initialCountry) return;
    let live = true;
    detectCountry().then((c) => live && !touched && setCountry(findCountry(c)));
    return () => {
      live = false;
    };
  }, [initialCountry, touched]);

  const update = (c: Country, n: string) => {
    setCountry(c);
    setNational(n);
    onChange(toE164(n, c.code) ?? '');
  };
  const list = COUNTRIES.filter((c) => `${c.name} ${c.dial}`.toLowerCase().includes(q.toLowerCase()));
  const invalid = national.length > 3 && !toE164(national, country.code);

  return (
    <View style={{ gap: 6 }}>
      <T w="bold" size={13} color={C.ink2}>
        {label}
      </T>
      <Row style={[styles.field, invalid && { borderColor: '#D64545' }]}>
        <Pressable style={styles.pre} onPress={() => setOpen(true)} accessibilityLabel="Choose country code">
          <T size={20}>{country.flag}</T>
          <T w="bold" color={C.ink2}>
            {country.dial}
          </T>
          <Icon name="down" size={14} color={C.muted} />
        </Pressable>
        <TextInput value={national} onChangeText={(v) => update(country, v)} keyboardType="phone-pad" placeholder="Phone number" placeholderTextColor="#A9A4AD" style={styles.input} />
      </Row>
      {invalid ? (
        <T size={12} color="#D64545">
          That does not look like a valid {country.name} number.
        </T>
      ) : null}
      <Sheet visible={open} title="Country code" onClose={() => setOpen(false)}>
        <TextInput value={q} onChangeText={setQ} placeholder="Search country or code" placeholderTextColor="#A9A4AD" style={styles.search} autoCorrect={false} />
        <FlatList
          data={list}
          keyExtractor={(c) => c.code}
          style={{ maxHeight: 360 }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setTouched(true);
                update(item, national);
                setOpen(false);
                setQ('');
              }}
            >
              <Row style={{ paddingVertical: 10, gap: 12 }}>
                <T size={22}>{item.flag}</T>
                <T w="semi" style={{ flex: 1 }}>
                  {item.name}
                </T>
                <T color={C.muted}>{item.dial}</T>
              </Row>
            </Pressable>
          )}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { height: 56, borderRadius: 16, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 12, gap: 8 },
  pre: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10, borderRightWidth: 1, borderRightColor: C.line, height: '100%' },
  input: { flex: 1, fontFamily: F.semi, fontSize: 16, color: C.ink },
  search: { height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: C.line, paddingHorizontal: 12, fontFamily: F.semi, fontSize: 15, color: C.ink },
});
