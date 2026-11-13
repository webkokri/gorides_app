import React, { useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { Seg, T } from './ui';
import { PassengerTripCard } from './PassengerTripCard';
import { BookingCard, PublishedCard, Section, SubscriptionCard } from './TripCards';
import { ApiBooking, ApiRide, Subscription } from '../lib/api';
import { isoDate, today } from '../lib/format';
import { tripDate } from '../lib/rideMap';
import { byDate, isPast, lastTrip, nextTrips } from '../lib/trips';
import { C } from '../theme';

type Tab = 'published' | 'bookings' | 'subscriptions';

/**
 * The three tabs shared by My rides (current) and History (finished): Published rides, Bookings, Subscriptions.
 * `history` flips every list to its finished counterpart: past rides, completed/cancelled bookings, ended subscriptions.
 */
export function TripTabs({
  history,
  uid,
  data,
  loading,
  bottomSpace,
  act,
  onRate,
  myGivenRatings,
  footer,
  onReload,
}: {
  history: boolean;
  uid: number;
  data: { asPassenger: ApiBooking[]; asDriver: ApiBooking[]; published: ApiRide[]; subs: Subscription[] };
  loading: boolean;
  bottomSpace: number;
  act: (fn: () => Promise<unknown>, ok: string) => void;
  onRate: (id: number, existing?: { stars: number; comment: string }) => void;
  myGivenRatings?: Map<number, { stars: number; comment: string }>;
  footer?: React.ReactNode;
  onReload?: () => void;
}) {
  const [tab, setTab] = useState<Tab>('published');
  const t0 = isoDate(today());
  const want = (b: ApiBooking) => (history ? isPast(b, t0) : !isPast(b, t0));
  const dir = history ? -1 : 1;

  const myBookings = data.asPassenger.filter(want).sort(byDate(dir));
  const passengersOnMine = data.asDriver.filter(want).sort(byDate(dir));
  // Published rides. Upcoming: the trip that starts soonest on top, then onwards. History: the most recent ride first.
  const myRides = data.published
    .filter((r) => (nextTrips(r, t0).length > 0) !== history)
    .sort((a, b) => {
      const next = (r: ApiRide) => {
        const i = nextTrips(r, t0)[0];
        return `${tripDate(i.departure_date)} ${i.departure_time ?? ''}`;
      };
      return history ? lastTrip(b).localeCompare(lastTrip(a)) : next(a).localeCompare(next(b));
    });
  const mySubs = data.subs.filter((s) => (s.status === 'active') !== history);

  const counts = { published: myRides.length + passengersOnMine.length, bookings: myBookings.length, subscriptions: mySubs.length };
  const empty = !loading && counts[tab] === 0;
  const emptyText: Record<Tab, string> = history
    ? { published: 'No past published rides yet.', bookings: 'No completed or cancelled bookings yet.', subscriptions: 'No ended subscriptions yet.' }
    : { published: 'You have no upcoming published rides. Tap + to publish one.', bookings: 'No upcoming bookings. Find a ride and book your seat.', subscriptions: 'No active subscriptions. Open a local ride to subscribe to it.' };

  return (
    <>
      <Seg
        value={tab}
        onChange={setTab}
        options={[
          { v: 'published', label: 'Published' },
          { v: 'bookings', label: 'Bookings' },
          { v: 'subscriptions', label: 'Subscriptions' },
        ]}
        style={{ marginHorizontal: 16, marginBottom: 8 }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomSpace }}>
        {!history ? <PassengerTripCard /> : null}
        {loading ? <ActivityIndicator color={C.o} style={{ marginTop: 32 }} /> : null}
        {empty ? (
          <T color={C.muted} style={{ textAlign: 'center', marginTop: 24 }}>
            {emptyText[tab]}
          </T>
        ) : null}

        {tab === 'published' ? (
          <>
            <Section title={history ? 'Past published rides' : 'Published rides'} count={myRides.length}>
              {myRides.map((r) => (
                <PublishedCard key={r.id} r={r} from={t0} past={history} driverBookings={data.asDriver} onChanged={onReload} />
              ))}
            </Section>
            <Section title="Passenger bookings on my rides" count={passengersOnMine.length}>
              {passengersOnMine.map((b) => (
                <BookingCard key={`d${b.id}`} b={b} role="Driver" uid={uid} act={act} onRate={onRate} myGivenRatings={myGivenRatings} />
              ))}
            </Section>
          </>
        ) : null}

        {tab === 'bookings' ? (
          <Section title="My bookings" count={myBookings.length}>
            {myBookings.map((b) => (
              <BookingCard key={`p${b.id}`} b={b} role="Passenger" uid={uid} act={act} onRate={onRate} myGivenRatings={myGivenRatings} />
            ))}
          </Section>
        ) : null}

        {tab === 'subscriptions' ? (
          <Section title="Subscriptions" count={mySubs.length}>
            {mySubs.map((sub) => (
              <SubscriptionCard key={sub.id} sub={sub} past={history} />
            ))}
          </Section>
        ) : null}

        {footer}
      </ScrollView>
    </>
  );
}
