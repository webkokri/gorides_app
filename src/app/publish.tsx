import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { goBack } from '../lib/nav';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlaceSheet } from '../components/Pickers';
import { Icon, IconName } from '../components/Icon';
import { Btn, Card, Chip, IconBtn, Row, Screen, Seg, Stepper, T, Toggle, TopBar } from '../components/ui';
import { DriverVehicle, driverVehicle, rides, vehicles, VehicleModel } from '../lib/api';
import { distanceKm, Place } from '../lib/geo';
import { addDays, fmtDay, isoDate, today } from '../lib/format';
import { useAuth } from '../auth';
import { DriverRequirements } from '../components/DriverRequirements';
import { useDriverReady } from '../lib/driverReady';
import { SignInPrompt } from '../components/SignInPrompt';
import { useStore } from '../store';
import { C, F } from '../theme';

const STEPS = 7;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const OPTIONS: { key: string; icon: IconName; title: string; sub: string; label: string }[] = [
  { key: 'back', icon: 'users', title: 'Max 2 in the back', sub: 'More comfort for everyone', label: 'Max 2 in back' },
  { key: 'pets', icon: 'paw', title: 'Pets welcome', sub: 'Small pets in a carrier', label: 'Pets welcome' },
  { key: 'winter_tires', icon: 'car', title: 'Winter tires', sub: 'Fitted for snow and ice', label: 'Winter tires' },
  { key: 'bikes', icon: 'car', title: 'Bikes allowed', sub: 'Room for a bike', label: 'Bikes' },
  { key: 'skis_snowboards', icon: 'car', title: 'Skis and snowboards', sub: 'Room for winter gear', label: 'Skis and snowboards' },
];
const LUGGAGE: { v: 'none' | 'S' | 'M' | 'L'; label: string; sub: string }[] = [
  { v: 'none', label: 'None', sub: 'No luggage space' },
  { v: 'S', label: 'Small', sub: 'A backpack or a small bag each' },
  { v: 'M', label: 'Medium', sub: 'One carry-on suitcase each' },
  { v: 'L', label: 'Large', sub: 'A big suitcase each' },
];

export default function Publish() {
  const { set, toast, bumpData } = useStore();
  const { user } = useAuth();
  const driver = useDriverReady();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [rideType, setRideType] = useState<'intercity' | 'local'>('intercity');
  const [from, setFrom] = useState('');
  const [fromP, setFromP] = useState<Place | null>(null);
  const [to, setTo] = useState('');
  const [toP, setToP] = useState<Place | null>(null);
  const [picker, setPicker] = useState<null | 'from' | 'to'>(null);
  const [date, setDate] = useState(addDays(today(), 2));
  const [hour, setHour] = useState(7);
  const [min, setMin] = useState('30');
  const [ap, setAp] = useState<'AM' | 'PM'>('AM');
  const [ret, setRet] = useState(false);
  const [retDate, setRetDate] = useState(addDays(today(), 3));
  const [retHour, setRetHour] = useState(5);
  const [retMin, setRetMin] = useState('00');
  const [retAp, setRetAp] = useState<'AM' | 'PM'>('PM');
  const [seats, setSeats] = useState(3);
  const [price, setPrice] = useState(0);
  const [suggested, setSuggested] = useState<number | null>(null);
  const [vehicle, setVehicle] = useState<VehicleModel | null>(null);
  const [saved, setSaved] = useState<DriverVehicle | null>(null);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [bag, setBag] = useState<'none' | 'S' | 'M' | 'L'>('M');
  // local commute: how many days a week, and for how many months from the start date
  const [localDays, setLocalDays] = useState<5 | 6>(5);
  const [localMonths, setLocalMonths] = useState<1 | 2 | 3>(1);
  // The driver's car from Car and documents is used as-is: no catalogue picking. The catalogue entry is only looked up
  // quietly because the fare estimate needs a vehicle class; it falls back to any entry when their car isn't listed.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { vehicle: v } = await driverVehicle.get();
        if (!live) return;
        if (v?.make && v?.model) {
          setSaved(v);
          const same = (a?: string | null, b?: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
          let found = await vehicles.models(`${v.make} ${v.model}`).catch(() => [] as VehicleModel[]);
          if (!found.length) found = await vehicles.models(v.model).catch(() => [] as VehicleModel[]);
          if (!found.length) found = await vehicles.models().catch(() => [] as VehicleModel[]);
          const match = found.find((m) => same(m.make, v.make) && same(m.model, v.model) && (!v.year || m.year === v.year)) ?? found.find((m) => same(m.model, v.model)) ?? found.find((m) => same(m.make, v.make)) ?? found[0];
          if (live && match) setVehicle((cur) => cur ?? match);
        }
      } catch {
        // no saved car: the driver picks one below
      } finally {
        if (live) setSavedLoaded(true);
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  // only the driver's verified car can be driven: no picking another one
  const mine = saved?.make && saved?.model && saved.verification_status === 'verified' ? saved : null;
  const [opts, setOpts] = useState<Record<string, boolean>>({ instant: true, back: true, pets: false, winter_tires: false, bikes: false, skis_snowboards: false });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const time = `${hour}:${min} ${ap}`;
  const retTime = `${retHour}:${retMin} ${retAp}`;
  const h24 = (h: number, a: 'AM' | 'PM') => (h % 12) + (a === 'PM' ? 12 : 0);
  const stamp = (d: Date, h: number, m: string, a: 'AM' | 'PM') => d.getTime() + (h24(h, a) * 60 + Number(m)) * 60000;
  const depStamp = stamp(date, hour, min, ap);
  const retStamp = stamp(retDate, retHour, retMin, retAp);
  const km = fromP && toP ? distanceKm(fromP, toP) * 1.25 : 0; // straight line + road factor
  const local = rideType === 'local';
  // whole kilometres, rounded once, so the doubled and multiplied figures always add up
  const oneWayKm = Math.round(km);
  const dailyKm = oneWayKm * (ret ? 2 : 1);
  // Local rides are still auto-calculated from distance + maintenance, but
  // the driver can nudge it by up to +/-10% (the server clamps to that same
  // band regardless of what's submitted) -- intercity stays fully open.
  const localMin = suggested != null ? Math.round(suggested * 0.9) : 0;
  const localMax = suggested != null ? Math.round(suggested * 1.1) : 300;
  const shownPrice = price || suggested || 0;
  // a local commute is priced per month, so each tap moves it by more than a trip's per-seat price
  const priceStep = local ? 5 : 1;

  // fare suggestion once we know the route and vehicle
  useEffect(() => {
    if (!vehicle || !km) return;
    let live = true;
    rides
      .estimateFare(local ? { ride_type: 'local', vehicle_model_id: vehicle.id, total_seats: seats, daily_distance_km: dailyKm, days_per_week: localDays } : { ride_type: 'intercity', vehicle_model_id: vehicle.id, total_seats: seats, distance_km: Math.round(km) })
      .then((e) => {
        if (!live) return;
        const v = Math.round(e.suggested_price_per_seat);
        setSuggested(v);
        setPrice(0); // a new calculation (route, seats, days or return changed) starts the price from the calculated amount again
      })
      .catch(() => live && setSuggested(null));
    return () => {
      live = false;
    };
  }, [vehicle, km, seats, local, dailyKm, localDays]);

  const dayMin = (h: number, m: string, a: 'AM' | 'PM') => h24(h, a) * 60 + Number(m);
  // a local commute comes back the same day, so only the time of day has to be later; city to city needs a later date and time
  const retOk = !ret || (local ? dayMin(retHour, retMin, retAp) > dayMin(hour, min, ap) : retStamp > depStamp);
  const endDate = addDays(date, localMonths * 30 - 1);
  // commute days in the period: Mon-Fri (5 a week) or Mon-Sat (6 a week)
  const commuteDays = (() => {
    let n = 0;
    for (let d = date; d.getTime() <= endDate.getTime(); d = addDays(d, 1)) if (d.getDay() >= 1 && d.getDay() <= localDays) n++;
    return n;
  })();
  const stepOk = [!!fromP && !!toP, retOk, !!vehicle && !!mine, true, true, shownPrice > 0, true][step];

  const publish = async () => {
    if (!fromP || !toP || !vehicle || !mine) return;
    try {
      const { is_complete } = await driverVehicle.get();
      if (!is_complete) {
        toast('Add your vehicle photo, license plate, registration, and insurance before publishing.');
        router.push('/vehicle-documents');
        return;
      }
    } catch {
      // If the check itself fails, fall through and let the publish call's
      // own error (if any) be the source of truth.
    }
    const loc = (p: Place) => ({ name: p.name, address: p.address, latitude: p.latitude, longitude: p.longitude, city: p.city, state: p.state, country: p.country });
    const hh = String((hour % 12) + (ap === 'PM' ? 12 : 0)).padStart(2, '0');
    const base = {
      start_location: loc(fromP),
      end_location: loc(toP),
      title: `${fromP.city || fromP.name} to ${toP.city || toP.name}`,
      description: note.trim() || undefined,
      vehicle_make: mine.make ?? undefined,
      vehicle_model: mine.model ?? undefined,
      vehicle_year: mine.year ?? undefined,
      vehicle_color: mine.color ?? undefined,
      license_plate: mine.license_plate ?? undefined,
      vehicle_model_id: vehicle.id,
      total_seats: seats,
      price_per_seat: shownPrice,
      is_round_trip: ret,
      ride_type: rideType,
      posting_duration_days: 30,
      luggage_size: bag,
      back_seat_max: opts.back ? 2 : 3,
      amenities: ['pets', 'winter_tires', 'bikes', 'skis_snowboards'].filter((k) => opts[k]),
      booking_mode: opts.instant ? 'instant' : 'request',
    };
    const minutes = Math.max(10, Math.round((km / 90) * 60));
    const body = local
      ? {
          ...base,
          // the price covers the way back too when the driver returns the same day
          is_round_trip_daily: ret,
          pickup_locations: [loc(fromP)],
          // the drop stop carries the time the driver heads back
          drop_locations: [ret ? { ...loc(toP), return_time: `${String(h24(retHour, retAp)).padStart(2, '0')}:${retMin}` } : loc(toP)],
          // when the commute leaves each morning
          pickup_schedules: [{ pickup_time: `${hh}:${min}`, travel_time_minutes: minutes, is_active: true }],
          travel_calendar: { start_date: isoDate(date), end_date: isoDate(endDate), days_per_week: localDays },
        }
      : {
          ...base,
          schedules: [{ day_of_week: WEEKDAYS[date.getDay()], departure_time: `${hh}:${min}`, estimated_duration: minutes }],
          // the way back is a separate schedule list (the server creates the linked return ride)
          ...(ret ? { return_schedules: [{ day_of_week: WEEKDAYS[retDate.getDay()], departure_time: `${String(h24(retHour, retAp)).padStart(2, '0')}:${retMin}`, estimated_duration: minutes }] } : {}),
        };
    setBusy(true);
    try {
      await rides.publish(body);
      bumpData();
      set({ published: { from: from, to: to, date, time, seats, price: shownPrice } });
      router.replace('/published');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not publish your ride');
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (!stepOk) return toast(step === 0 ? 'Choose where you are leaving from and going to' : step === 1 ? 'The return must be after your departure' : step === 2 ? 'Choose your car' : 'Set a price');
    if (step < STEPS - 1) return setStep(step + 1);
    publish();
  };

  if (!user)
    return (
      <Screen>
        <StatusBar style="dark" />
        <TopBar title="Publish a ride" />
        <SignInPrompt title="Sign in to publish" body="Log in or create an account to offer your empty seats." />
      </Screen>
    );

  if (!driver.ready || !driver.vehicleVerified) return <DriverRequirements loading={driver.loading} vehicleOk={driver.vehicleOk} vehicleVerified={driver.vehicleVerified} licenceOk={driver.licenceOk} licenceVerified={driver.licenceVerified} />;

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Publish a ride" onBack={() => (step > 0 ? setStep(step - 1) : goBack())} right={<IconBtn name="help" tone="ghost" onPress={() => router.push('/help')} />} />
      <View style={styles.prog}>
        {Array.from({ length: STEPS }, (_, i) => (
          <View key={i} style={[styles.progSeg, i <= step && { backgroundColor: C.o }]} />
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <>
            <Head title="Where are you driving?" sub="Pick real places so passengers can find your ride." />
            <Seg
              value={rideType}
              onChange={setRideType}
              options={[
                { v: 'intercity', label: 'City to city' },
                { v: 'local', label: 'Local commute' },
              ]}
            />
            <Card style={{ overflow: 'hidden' }}>
              <PlaceField k="Leaving from" v={from || 'Search a place'} onPress={() => setPicker('from')} />
              <PlaceField k="Going to" v={to || 'Search a place'} filled onPress={() => setPicker('to')} border />
            </Card>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Head title={local ? 'Set up your commute' : 'When are you leaving?'} sub={local ? 'Passengers join your commute for the days you choose.' : 'Passengers see this as your departure time.'} />
            <T w="bold" size={13} color={C.ink2}>
              {local ? 'Start date' : 'Date'}
            </T>
            <View style={styles.wrap}>
              {Array.from({ length: local ? 14 : 8 }, (_, i) => addDays(today(), i)).map((d) => (
                <Chip key={d.toDateString()} label={fmtDay(d)} on={d.toDateString() === date.toDateString()} onPress={() => setDate(d)} />
              ))}
            </View>
            {local ? (
              <>
                <T w="bold" size={13} color={C.ink2}>
                  Days per week
                </T>
                <Seg
                  value={String(localDays)}
                  onChange={(v) => setLocalDays(v === '6' ? 6 : 5)}
                  options={[
                    { v: '5', label: 'Mon to Fri' },
                    { v: '6', label: 'Mon to Sat' },
                  ]}
                />
                <T w="bold" size={13} color={C.ink2}>
                  For how long
                </T>
                <Seg
                  value={String(localMonths)}
                  onChange={(v) => setLocalMonths(v === '3' ? 3 : v === '2' ? 2 : 1)}
                  options={[
                    { v: '1', label: '1 month' },
                    { v: '2', label: '2 months' },
                    { v: '3', label: '3 months' },
                  ]}
                />
                <T size={13} color={C.muted}>
                  {commuteDays} commute days, from {fmtDay(date)} to {fmtDay(endDate)}.
                </T>
              </>
            ) : null}
            <T w="bold" size={13} color={C.ink2}>
              Departure time
            </T>
            <Card style={styles.timeCard}>
              <Stepper value={hour} min={1} max={12} onChange={setHour} />
              <View style={styles.wrap}>
                {['00', '15', '30', '45'].map((m) => (
                  <Chip key={m} label={`:${m}`} on={m === min} onPress={() => setMin(m)} />
                ))}
              </View>
              <View style={styles.wrap}>
                {(['AM', 'PM'] as const).map((v) => (
                  <Chip key={v} label={v} on={v === ap} onPress={() => setAp(v)} />
                ))}
              </View>
              <T w="display" size={30} color={C.oDeep}>
                {time}
              </T>
            </Card>
            <>
                <Row style={{ paddingVertical: 8 }}>
                  <View style={{ flex: 1 }}>
                    <T w="bold" size={14}>
                      Return trip
                    </T>
                    <T size={12} color={C.muted}>
                      {local ? 'You drive back the same day. Passengers see the return time.' : 'Publish the way back too. Passengers can book it with the trip or on its own.'}
                    </T>
                  </View>
                  <Toggle value={ret} onChange={setRet} />
                </Row>
                {ret ? (
                  <>
                    {local ? null : (
                      <>
                        <T w="bold" size={13} color={C.ink2}>
                          Return date
                        </T>
                        <View style={styles.wrap}>
                          {Array.from({ length: 14 }, (_, i) => addDays(date, i)).map((d) => (
                            <Chip key={d.toDateString()} label={fmtDay(d)} on={d.toDateString() === retDate.toDateString()} onPress={() => setRetDate(d)} />
                          ))}
                        </View>
                      </>
                    )}
                    <T w="bold" size={13} color={C.ink2}>
                      Return departure time
                    </T>
                    <Card style={styles.timeCard}>
                      <Stepper value={retHour} min={1} max={12} onChange={setRetHour} />
                      <View style={styles.wrap}>
                        {['00', '15', '30', '45'].map((m) => (
                          <Chip key={m} label={`:${m}`} on={m === retMin} onPress={() => setRetMin(m)} />
                        ))}
                      </View>
                      <View style={styles.wrap}>
                        {(['AM', 'PM'] as const).map((v) => (
                          <Chip key={v} label={v} on={v === retAp} onPress={() => setRetAp(v)} />
                        ))}
                      </View>
                      <T w="display" size={30} color={C.oDeep}>
                        {retTime}
                      </T>
                    </Card>
                    {!retOk ? (
                      <T size={13} color="#D64545">
                        {local ? 'The return time has to be later than your departure time.' : 'The return has to be after your departure.'}
                      </T>
                    ) : null}
                  </>
                ) : null}
              </>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Head title="Your car and rules" sub="Passengers see these before they book." />
            {!savedLoaded ? (
              <ActivityIndicator color={C.o} />
            ) : mine ? (
              <Card style={{ padding: 14, gap: 10, borderColor: C.o, borderWidth: 1 }}>
                <Row>
                  {mine.photo_urls?.[0] ? <Image source={{ uri: mine.photo_urls[0] }} style={{ width: 72, height: 54, borderRadius: 8 }} /> : <Icon name="car" color={C.oDeep} />}
                  <View style={{ flex: 1 }}>
                    <T w="bold" size={15}>
                      {mine.make} {mine.model}
                    </T>
                    <T size={12} color={C.muted}>
                      {[mine.year, mine.color, mine.license_plate].filter(Boolean).join(' · ')}
                    </T>
                    <T size={12} w="bold" color={C.good}>
                      Verified
                    </T>
                  </View>
                </Row>
                <T size={12} color={C.muted}>
                  Only your verified car can be driven on GORIDES. To change it, update it under Car and documents and wait for it to be verified.
                </T>
              </Card>
            ) : null}
            <T w="bold" size={13} color={C.ink2}>
              Luggage space
            </T>
            <View style={styles.wrap}>
              {LUGGAGE.map((l) => (
                <Chip key={l.v} label={l.label} on={bag === l.v} onPress={() => setBag(l.v)} />
              ))}
            </View>
            <T size={12} color={C.muted}>
              {LUGGAGE.find((l) => l.v === bag)?.sub}
            </T>
            <Card style={{ paddingHorizontal: 14 }}>
              {OPTIONS.map((o, i) => (
                <Row key={o.key} style={[{ paddingVertical: 14 }, i > 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
                  <Icon name={o.icon} color={C.ink2} />
                  <View style={{ flex: 1 }}>
                    <T w="bold" size={14}>
                      {o.title}
                    </T>
                    <T size={12} color={C.muted}>
                      {o.sub}
                    </T>
                  </View>
                  <Toggle value={!!opts[o.key]} onChange={(v) => setOpts({ ...opts, [o.key]: v })} />
                </Row>
              ))}
            </Card>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Head title="How many seats?" sub="How many passengers can you take? Up to 8." />
            <Row style={{ justifyContent: 'space-between', paddingVertical: 8 }}>
              <T w="bold" size={16} style={{ flex: 1 }}>
                Seats available
              </T>
              <Stepper value={seats} min={1} max={8} onChange={setSeats} />
            </Row>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Head title="How should bookings work?" sub="You can change this for each ride you publish." />
            {(
              [
                [true, 'bolt', 'Instant booking', 'Passengers are confirmed right away. Fewer messages, more full cars.'],
                [false, 'chat', 'Review every request', 'You approve each passenger before they are confirmed.'],
              ] as [boolean, IconName, string, string][]
            ).map(([v, ic, t, sub]) => (
              <Pressable key={t} onPress={() => setOpts({ ...opts, instant: v })} style={[styles.car, !!opts.instant === v && { borderColor: C.o, backgroundColor: C.oSoft }]}>
                <Row>
                  <Icon name={ic} color={C.oDeep} />
                  <View style={{ flex: 1 }}>
                    <T w="bold" size={15}>
                      {t}
                    </T>
                    <T size={13} color={C.muted}>
                      {sub}
                    </T>
                  </View>
                </Row>
              </Pressable>
            ))}
          </>
        ) : null}

        {step === 5 ? (
          <>
            <Head title="Set your price" sub="Price is per seat. Keep it close to fuel and tolls." />
            {km > 0 ? (
              <Card style={{ padding: 14, gap: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T size={13} color={C.muted}>
                    One way
                  </T>
                  <T w="bold" size={14}>
                    {oneWayKm} km
                  </T>
                </Row>
                {ret ? (
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T size={13} color={C.muted}>
                      {local ? 'Up and down' : 'Round trip'}
                    </T>
                    <T w="bold" size={14}>
                      {oneWayKm * 2} km
                    </T>
                  </Row>
                ) : null}
                {local ? (
                  <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
                    <T size={13} color={C.muted} style={{ flex: 1 }}>
                      {commuteDays} days × {dailyKm} km
                    </T>
                    <T w="xbold" size={15}>
                      {dailyKm * commuteDays} km total
                    </T>
                  </Row>
                ) : null}
              </Card>
            ) : null}
            <Row style={{ justifyContent: 'center', gap: 20, paddingVertical: 14 }}>
              <Pressable
                style={[styles.round, local && shownPrice <= localMin && { opacity: 0.35 }]}
                onPress={() => setPrice(local ? Math.max(localMin, shownPrice - priceStep) : Math.max(5, shownPrice - priceStep))}
                disabled={local && shownPrice <= localMin}
                accessibilityLabel="Lower price"
              >
                <Icon name="minus" color={C.oDeep} />
              </Pressable>
              <T w="display" size={52} style={{ minWidth: 120, textAlign: 'center' }}>
                ${shownPrice}
              </T>
              <Pressable
                style={[styles.round, local && shownPrice >= localMax && { opacity: 0.35 }]}
                onPress={() => setPrice(local ? Math.min(localMax, shownPrice + priceStep) : Math.min(300, shownPrice + priceStep))}
                disabled={local && shownPrice >= localMax}
                accessibilityLabel="Raise price"
              >
                <Icon name="plus" color={C.oDeep} />
              </Pressable>
            </Row>
            {suggested !== null && shownPrice !== suggested ? (
              <T size={13} w="bold" color={shownPrice > suggested ? C.oDeep : C.good} style={{ textAlign: 'center' }}>
                {shownPrice > suggested ? '+' : '-'}${Math.abs(shownPrice - suggested)} from the calculated ${suggested}
              </T>
            ) : null}
            <View style={[styles.rec, { backgroundColor: C.goodSoft }]}>
              <T size={13} color={C.good} style={{ textAlign: 'center' }}>
                {suggested === null
                  ? 'Pick your car first and we will suggest a fair price.'
                  : local
                    ? `Calculated from distance and maintenance: $${suggested}/seat. Adjustable between $${localMin} and $${localMax}.`
                    : `Suggested for this route: $${suggested} per seat`}
              </T>
            </View>
            <T size={13} color={C.ink2}>
              {local
                ? 'Local commutes share the trip cost: the cost is split equally between you and every passenger, so a passenger pays less as more people join. GORIDES fees and tax are added at checkout.'
                : 'You set the price per seat. Every passenger pays exactly this amount per seat, however many others join, plus GORIDES fees and tax shown at checkout. Change it up or down from the suggestion as you need.'}
            </T>
            <Row style={styles.earn}>
              <View style={{ flex: 1 }}>
                <T size={12} color="rgba(255,255,255,0.7)">
                  If every seat fills (before GORIDES fees)
                </T>
                <T w="display" size={26} color="#fff">
                  ${shownPrice * seats}
                </T>
              </View>
              <Icon name="wallet" color="#fff" />
            </Row>
            <T size={12} color={C.muted}>
              This is the trip cost, not your payout. GORIDES deducts its service fee from your payout, and an early payout may carry an extra fee. Amounts are shown before you confirm.
            </T>
          </>
        ) : null}

        {step === 6 ? (
          <>
            <Head title="Check and publish" sub="You can edit or cancel the ride later from My rides." />
            <Card style={{ padding: 16, gap: 10 }}>
              {[
                ['Route', `${from} → ${to}`],
                ['Type', local ? 'Local commute' : 'City to city'],
                [local ? 'Starts' : 'Departure', `${fmtDay(date)}, ${time}`],
                ...(local ? [['Commute', `${commuteDays} days, ${localDays === 5 ? 'Mon to Fri' : 'Mon to Sat'}, until ${fmtDay(endDate)}`]] : []),
                ...(ret ? [['Return', local ? `Same day, ${retTime}` : `${fmtDay(retDate)}, ${retTime}`]] : []),
                ['Seats', String(seats)],
                ['Price per seat', `$${shownPrice}`],
                ['Car', mine ? `${mine.make} ${mine.model}` : ''],
                ['Luggage', LUGGAGE.find((l) => l.v === bag)?.label ?? ''],
                ['Booking', opts.instant ? 'Instant booking' : 'You review each request'],
                ['Options', OPTIONS.filter((o) => opts[o.key]).map((o) => o.label).join(', ') || 'None'],
              ].map(([k, v]) => (
                <Row key={k} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <T size={14} color={C.muted}>
                    {k}
                  </T>
                  <T w="bold" size={14} style={{ flex: 1, textAlign: 'right' }}>
                    {v}
                  </T>
                </Row>
              ))}
            </Card>
            <TextInput value={note} onChangeText={setNote} multiline placeholder="Anything passengers should know?" placeholderTextColor="#A9A4AD" style={styles.msg} />
          </>
        ) : null}
      </ScrollView>
      <View style={[styles.sticky, { paddingBottom: insets.bottom + 14 }]}>
        <Btn label={busy ? 'Publishing…' : step === STEPS - 1 ? 'Publish ride' : 'Continue'} onPress={next} disabled={busy} />
      </View>

      <PlaceSheet visible={picker === 'from'} title="Leaving from" onClose={() => setPicker(null)} onPick={(v, p) => (setFrom(v), setFromP(p))} />
      <PlaceSheet visible={picker === 'to'} title="Going to" onClose={() => setPicker(null)} onPick={(v, p) => (setTo(v), setToP(p))} />
    </Screen>
  );
}

function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={{ gap: 4 }}>
      <T w="display" size={30}>
        {title}
      </T>
      <T size={14} color={C.muted}>
        {sub}
      </T>
    </View>
  );
}

function PlaceField({ k, v, onPress, filled, border }: { k: string; v: string; onPress: () => void; filled?: boolean; border?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.pf, border && { borderTopWidth: 1, borderTopColor: C.line }]}>
      <View style={[styles.fdot, filled && { backgroundColor: C.o }]} />
      <View style={{ flex: 1 }}>
        <T w="bold" size={11} color={C.muted} style={{ letterSpacing: 0.9 }}>
          {k.toUpperCase()}
        </T>
        <T w="bold" numberOfLines={1}>
          {v}
        </T>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  prog: { flexDirection: 'row', gap: 6, paddingHorizontal: 20 },
  progSeg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#EAE5E1' },
  body: { padding: 20, gap: 14, paddingBottom: 30 },
  pf: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, minHeight: 58 },
  fdot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: C.o, marginHorizontal: 4 },
  stop: { backgroundColor: C.chip, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeCard: { padding: 16, gap: 12, alignItems: 'center' },
  round: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: C.o, alignItems: 'center', justifyContent: 'center' },
  rec: { borderRadius: 12, padding: 10 },
  earn: { backgroundColor: C.night, borderRadius: 16, padding: 14 },
  car: { flex: 1, borderWidth: 1.5, borderColor: C.line, borderRadius: 16, padding: 12, gap: 4, backgroundColor: C.card },
  search: { height: 50, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, fontFamily: F.semi, fontSize: 15, color: C.ink, backgroundColor: C.card },
  msg: { minHeight: 90, borderWidth: 1.5, borderColor: C.line, borderRadius: 14, padding: 12, fontFamily: F.regular, fontSize: 15, color: C.ink, textAlignVertical: 'top', backgroundColor: C.card },
  sticky: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line },
});
