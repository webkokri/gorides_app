import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../auth';
import { SignInPrompt } from '../components/SignInPrompt';
import { TabBar, TAB_SPACE } from '../components/TabBar';
import { Btn, Card, Chip, IconBtn, Row, Screen, Seg, Sheet, T, Tag, TopBar } from '../components/ui';
import { ApiBooking, ApiRide, bookings, ratings, rides } from '../lib/api';
import { counterpart } from '../lib/booking';
import { fmtDay, t12 } from '../lib/format';
import { tripDate } from '../lib/rideMap';
import { useStore } from '../store';
import { C } from '../theme';

type Row_ = { b: ApiBooking; role: 'Passenger' | 'Driver' };

export default function MyRides() {
  const { toast, set } = useStore();
  const { user } = useAuth();
  const [tab, setTab] = useState<'up' | 'past'>('up');
  const [rows, setRows] = useState<Row_[]>([]);
  const [published, setPublished] = useState<ApiRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState<{ id: number; stars: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, d, mine] = await Promise.all([bookings.mine('passenger'), bookings.mine('driver'), rides.mine()]);
      setRows([...p.map((b) => ({ b, role: 'Passenger' as const })), ...d.map((b) => ({ b, role: 'Driver' as const }))]);
      setPublished(mine);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not load your rides');
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useFocusEffect(
    useCallback(() => {
      if (user) load();
    }, [load, user]),
  );

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    }
  };

  if (!user)
    return (
      <Screen>
        <StatusBar style="dark" />
        <TopBar big title="My rides" />
        <SignInPrompt />
        <TabBar current="my-rides" />
      </Screen>
    );

  const isPast = (b: ApiBooking) => b.status === 'completed' || b.status === 'cancelled';
  const list = rows.filter(({ b }) => (tab === 'past' ? isPast(b) : !isPast(b)));

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar big title="My rides" right={<IconBtn name="plus" label="Publish a ride" onPress={() => router.push('/publish')} />} />
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { v: 'up', label: 'Upcoming' },
          { v: 'past', label: 'Past' },
        ]}
        style={{ marginHorizontal: 16, marginBottom: 8 }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: TAB_SPACE }}>
        {loading ? <ActivityIndicator color={C.o} style={{ marginTop: 32 }} /> : null}
        {!loading && !list.length && !(tab === 'up' && published.length) ? (
          <T color={C.muted} style={{ textAlign: 'center', marginTop: 32 }}>
            No {tab === 'up' ? 'upcoming' : 'past'} rides yet.
          </T>
        ) : null}

        {tab === 'up'
          ? published.map((r) => (
              <Card key={`ride${r.id}`} style={{ padding: 14, gap: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Tag label="Driver" icon="car" tone="o" />
                  <Tag label={`${r.total_seats} seats`} />
                </Row>
                <T w="xbold" size={16}>
                  {r.title ?? `${r.start_location_name ?? ''} → ${r.end_location_name ?? ''}`}
                </T>
                <T size={13} color={C.muted}>
                  ${Number(r.price_per_seat)} per seat · {r.instances?.length ?? 0} scheduled trip{(r.instances?.length ?? 0) === 1 ? '' : 's'}
                </T>
              </Card>
            ))
          : null}

        {list.map(({ b, role }) => {
          const who = counterpart(b, user.id);
          const when = b.departure_date ? fmtDay(new Date(`${tripDate(b.departure_date)}T00:00:00`)) : '';
          const time = b.departure_time ? t12(b.departure_time.slice(0, 5)) : '';
          const cancelled = b.status === 'cancelled';
          return (
            <Card key={`${role}${b.id}`} style={{ padding: 14, gap: 12 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Tag label={role} icon={role === 'Driver' ? 'car' : 'ticket'} tone={role === 'Driver' ? 'o' : 'plain'} />
                <Tag label={b.status[0].toUpperCase() + b.status.slice(1)} tone={b.status === 'pending' ? 'o' : 'g'} />
              </Row>
              <View>
                <T w="xbold" size={16}>
                  {b.start_name ?? 'Start'} → {b.end_name ?? 'Destination'}
                </T>
                <T size={13} color={C.muted}>
                  {[when, time, `${b.seats_booked} seat${b.seats_booked > 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
                </T>
                <T size={13} color={C.ink2}>
                  {who.role}: {who.name}
                </T>
              </View>
              <Row style={{ gap: 8 }}>
                <Btn small kind="sec" icon="chat" label="Message" style={{ flex: 1, width: undefined }} disabled={cancelled} onPress={() => router.push({ pathname: '/booking-chat', params: { id: String(b.id) } })} />
                <Btn small kind="out" label="Trip details" style={{ flex: 1, width: undefined }} onPress={() => router.push({ pathname: '/booking', params: { id: String(b.id) } })} />
              </Row>
              {role === 'Passenger' && (b.status === 'pending' || b.status === 'confirmed') ? (
                <Btn small kind="out" label="Cancel booking" onPress={() => act(() => bookings.cancel(b.id), 'Booking cancelled')} />
              ) : null}
              {role === 'Driver' && b.status === 'pending' ? (
                <Row style={{ gap: 8 }}>
                  <Btn small kind="sec" label="Accept" style={{ flex: 1, width: undefined }} onPress={() => act(() => bookings.accept(b.id), 'Booking accepted')} />
                  <Btn small kind="out" label="Decline" style={{ flex: 1, width: undefined }} onPress={() => act(() => bookings.decline(b.id), 'Booking declined')} />
                </Row>
              ) : null}
              {b.status === 'completed' ? (
                <Row style={{ gap: 8 }}>
                  <Btn small kind="sec" icon="star" label={`Rate ${who.role.toLowerCase()}`} style={{ flex: 1, width: undefined }} onPress={() => setRating({ id: b.id, stars: 5 })} />
                  {role === 'Passenger' ? (
                    <Btn
                      small
                      kind="out"
                      label="Book again"
                      style={{ flex: 1, width: undefined }}
                      onPress={() => {
                        set({ mode: 'long', from: b.start_name ?? '', to: b.end_name ?? '', fromPlace: null, toPlace: null });
                        router.push('/results');
                      }}
                    />
                  ) : null}
                </Row>
              ) : null}
            </Card>
          );
        })}
      </ScrollView>
      <Sheet visible={!!rating} title="Rate your trip" onClose={() => setRating(null)}>
        <Row style={{ justifyContent: 'center', gap: 8 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Chip key={n} label={`${n} ★`} on={(rating?.stars ?? 0) === n} onPress={() => rating && setRating({ ...rating, stars: n })} />
          ))}
        </Row>
        <Btn
          label="Submit rating"
          onPress={() => {
            if (!rating) return;
            const { id, stars } = rating;
            setRating(null);
            act(() => ratings.rate(id, stars), 'Thanks! Rating saved');
          }}
        />
      </Sheet>
      <TabBar current="my-rides" />
    </Screen>
  );
}
