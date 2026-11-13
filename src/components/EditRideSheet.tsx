import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Field } from './Field';
import { Icon, IconName } from './Icon';
import { Btn, Card, Chip, Row, Seg, Sheet, Stepper, T, Toggle } from './ui';
import { ApiRide, rides } from '../lib/api';
import { useStore } from '../store';
import { C, F } from '../theme';

const RULES: { key: string; icon: IconName; title: string }[] = [
  { key: 'back', icon: 'users', title: 'Max 2 in the back seat' },
  { key: 'pets', icon: 'paw', title: 'Pets welcome' },
  { key: 'winter_tires', icon: 'car', title: 'Winter tires' },
  { key: 'bikes', icon: 'car', title: 'Bikes allowed' },
  { key: 'skis_snowboards', icon: 'car', title: 'Skis and snowboards' },
];

/** A driver edits a ride they published: everything the server lets them change after publishing (not the route or the dates). */
export function EditRideSheet({ ride, onClose, onSaved }: { ride: ApiRide | null; onClose: () => void; onSaved: () => void }) {
  return (
    <Sheet visible={!!ride} title="Edit ride" onClose={onClose}>
      {ride ? <Body key={ride.id} ride={ride} onClose={onClose} onSaved={onSaved} /> : null}
    </Sheet>
  );
}

function Body({ ride, onClose, onSaved }: { ride: ApiRide; onClose: () => void; onSaved: () => void }) {
  const { toast } = useStore();
  const local = Number((ride as { daily_distance_km?: string | number }).daily_distance_km) > 0; // local rides are priced by GORIDES
  const [title, setTitle] = useState(ride.title ?? '');
  const [description, setDescription] = useState(ride.description ?? '');
  const [seats, setSeats] = useState(ride.total_seats);
  const [price, setPrice] = useState(String(Number(ride.price_per_seat)));
  const [mode, setMode] = useState<'instant' | 'request'>(ride.booking_mode === 'request' ? 'request' : 'instant');
  const [bag, setBag] = useState<string>(ride.luggage_size ?? 'none');
  const have = ride.amenities ?? [];
  const [rules, setRules] = useState<Record<string, boolean>>({
    back: ride.back_seat_max === 2,
    pets: have.includes('pets'),
    winter_tires: have.includes('winter_tires'),
    bikes: have.includes('bikes'),
    skis_snowboards: have.includes('skis_snowboards'),
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const p = Number(price);
    if (!local && !(p > 0)) return toast('Enter a price above 0');
    if (!title.trim()) return toast('Enter a title');

    setBusy(true);
    try {
      await rides.update(ride.id, {
        title: title.trim(),
        description: description.trim(),
        total_seats: seats,
        booking_mode: mode,
        back_seat_max: rules.back ? 2 : 3,
        luggage_size: bag,
        amenities: ['pets', 'winter_tires', 'bikes', 'skis_snowboards'].filter((k) => rules[k]),
        ...(local ? {} : { price_per_seat: p }),
      });
      toast('Ride updated');
      onSaved();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update the ride');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Field label="Title" value={title} onChangeText={setTitle} autoCapitalize="sentences" />
      <View style={{ gap: 6 }}>
        <T w="bold" size={13} color={C.ink2}>
          Notes for passengers
        </T>
        <TextInput value={description} onChangeText={setDescription} multiline placeholder="Anything passengers should know" placeholderTextColor="#A9A4AD" style={styles.notes} />
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <T w="bold" style={{ flex: 1 }}>
          Seats available
        </T>
        <Stepper value={seats} min={1} max={8} onChange={setSeats} />
      </Row>
      {local ? (
        <T size={13} color={C.muted}>
          Local ride prices are set by GORIDES from the route, so the price can&apos;t be edited here.
        </T>
      ) : (
        <Field label="Price per seat (CAD)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      )}
      <Seg
        value={mode}
        onChange={setMode}
        options={[
          { v: 'instant', label: 'Instant booking' },
          { v: 'request', label: 'Review requests' },
        ]}
      />
      <T w="bold" size={13} color={C.ink2}>
        Your car
      </T>
      <Card style={{ padding: 12 }}>
        <T w="bold" size={14}>
          {[ride.vehicle_make, ride.vehicle_model].filter(Boolean).join(' ') || 'Your verified car'}
        </T>
        <T size={12} color={C.muted}>
          {[ride.vehicle_year, ride.vehicle_color, ride.license_plate].filter(Boolean).join(' · ')}
        </T>
        <T size={12} color={C.muted}>
          Only your verified car can be driven, so the car can&apos;t be changed on a ride.
        </T>
      </Card>
      <T w="bold" size={13} color={C.ink2}>
        Luggage space
      </T>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        {[['none', 'None'], ['S', 'Small'], ['M', 'Medium'], ['L', 'Large']].map(([v, l]) => (
          <Chip key={v} label={l} on={bag === v} onPress={() => setBag(v)} />
        ))}
      </Row>
      <Card style={{ paddingHorizontal: 14 }}>
        {RULES.map((o, i) => (
          <Row key={o.key} style={[{ paddingVertical: 12 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
            <Icon name={o.icon} color={C.ink2} />
            <T w="bold" size={14} style={{ flex: 1 }}>
              {o.title}
            </T>
            <Toggle value={rules[o.key]} onChange={(v) => setRules({ ...rules, [o.key]: v })} />
          </Row>
        ))}
      </Card>
      <T size={12} color={C.muted}>
        The route, date and time can&apos;t be changed after publishing. To change them, delete the ride (if nobody has booked) and publish a new one. Changes apply to the upcoming departures of this ride. Seats can&apos;t go below what is already booked.
      </T>
      <Btn label={busy ? 'Saving…' : 'Save changes'} disabled={busy} onPress={save} />
    </>
  );
}

const styles = StyleSheet.create({
  notes: { minHeight: 90, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, padding: 12, fontFamily: F.regular, fontSize: 15, color: C.ink, textAlignVertical: 'top', backgroundColor: C.card },
});
