import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Icon } from '../components/Icon';
import { Avatar, Btn, Card, Row, Screen, Section, T, Tag, TopBar } from '../components/ui';
import { ReportUserSheet } from '../components/ReportUserSheet';
import { useAuth } from '../auth';
import { isUnavailable, profiles, SIGNED_OUT, users } from '../lib/api';
import { fallbackProfile, ProfileView } from '../lib/profileFallback';
import { useStore } from '../store';
import { C } from '../theme';

const Stars = ({ n, size = 14 }: { n: number; size?: number }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Icon key={i} name="star" size={size} color={i <= Math.round(n) ? C.star : '#DDD7D2'} fill />
    ))}
  </View>
);

/** A driver's or passenger's profile: rating, reviews, history counts and (for drivers) the car. */
export default function UserProfile() {
  const { id, name, rideId } = useLocalSearchParams<{ id: string; name?: string; rideId?: string }>();
  const { user: me } = useAuth();
  const { toast } = useStore();
  const [data, setData] = useState<ProfileView | null>(null);
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [canBlock, setCanBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const isOwnProfile = !!me && String(me.id) === String(id);

  useEffect(() => {
    if (!me || isOwnProfile) return;
    users
      .blocks()
      .then((list) => {
        setCanBlock(true);
        setBlocked(list.some((x) => x.user_id === Number(id)));
      })
      .catch(() => setCanBlock(false));
  }, [me, id, isOwnProfile]);

  const toggleBlock = async () => {
    setBusy(true);
    try {
      if (blocked) await users.unblock(Number(id));
      else await users.block(Number(id));
      setBlocked(!blocked);
      toast(blocked ? 'Unblocked' : 'Blocked. You can no longer message or book with each other.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const d = await profiles.get(Number(id));
        if (live) setData(d);
      } catch (e) {
        // signed-out visitors can still see a driver's public ride card; the full profile needs an account
        const guest = e instanceof Error && e.message === SIGNED_OUT;
        if (!isUnavailable(e) && !guest) return live && setError(e instanceof Error ? e.message : 'Could not load this profile');
        // the full-profile route isn't deployed: show what the live endpoints can tell us
        try {
          const f = await fallbackProfile(Number(id), me, rideId ? Number(rideId) : undefined);
          if (live) {
            if (f) setData(f);
            else setError('This profile needs the latest server update. Reviews and history will show here once it is deployed.');
          }
        } catch {
          if (live) setError('Could not load this profile.');
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [id, rideId, me]);

  const u = data?.user;
  const full = u ? `${u.first_name} ${u.last_name}`.trim() : name ?? 'Profile';
  const isDriver = u?.role === 'driver';
  const dist = data?.ratings.distribution;

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title={isDriver ? 'Driver profile' : 'Profile'} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {!data && !error ? <ActivityIndicator color={C.o} style={{ marginTop: 32 }} /> : null}
        {error ? (
          <Card style={{ padding: 20, alignItems: 'center', gap: 10 }}>
            <Avatar name={full} size={64} verified={false} />
            <T w="bold" size={18}>
              {full}
            </T>
            <T size={14} color={C.muted} style={{ textAlign: 'center' }}>
              {error}
            </T>
          </Card>
        ) : null}

        {data && u ? (
          <>
            <Card style={{ padding: 18, alignItems: 'center', gap: 8 }}>
              <Avatar name={full} size={84} uri={u.avatar_url} verified={u.identity_verified} />
              <T w="display" size={26}>
                {full}
              </T>
              <Row style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                {(data.roles ?? (isDriver ? ['driver'] : ['passenger'])).includes('passenger') ? <Tag label="Passenger" icon="user" tone="o" /> : null}
                {(data.roles ?? (isDriver ? ['driver'] : ['passenger'])).includes('driver') ? <Tag label="Driver" icon="car" tone="g" /> : null}
                {u.identity_verified ? <Tag label="ID verified" icon="id" tone="g" /> : null}
                {isDriver && u.license_verified ? <Tag label="Licence verified" icon="check" tone="g" /> : null}
              </Row>
              <T size={13} color={C.muted}>
                {u.member_since ? `Member since ${new Date(u.member_since).toLocaleDateString([], { month: 'long', year: 'numeric' })}` : ' '}
              </T>
              {!isOwnProfile ? (
                <Row style={{ gap: 8, marginTop: 4, alignSelf: 'stretch' }}>
                  {canBlock ? (
                    <Btn label={busy ? 'Please wait…' : blocked ? 'Unblock' : 'Block'} kind="out" small disabled={busy} onPress={toggleBlock} style={{ flex: 1, width: undefined }} />
                  ) : null}
                  <Btn label="Report" icon="alert" kind="out" small onPress={() => setShowReport(true)} style={{ flex: 1, width: undefined }} />
                </Row>
              ) : null}
            </Card>

            {data.partial && !data.full ? (
              <Card style={{ padding: 14 }}>
                <T size={13} color={C.muted}>
                  Showing the rating, trips and car shared on this ride. The full history and written reviews appear here once the server is updated.
                </T>
              </Card>
            ) : null}

            <Card style={{ padding: 16, gap: 10 }}>
              <Row style={{ gap: 16 }}>
                <View style={{ alignItems: 'center', gap: 4 }}>
                  <T w="display" size={40}>
                    {data.ratings.total ? data.ratings.average.toFixed(1) : '–'}
                  </T>
                  <Stars n={data.ratings.average} />
                  <T size={12} color={C.muted}>
                    {data.ratings.total} rating{data.ratings.total === 1 ? '' : 's'}
                  </T>
                </View>
                {data.partial && !data.full ? null : (
                <View style={{ flex: 1, gap: 5 }}>
                  {([5, 4, 3, 2, 1] as const).map((s) => {
                    const c = dist?.[String(s) as '1'] ?? 0;
                    const pct = data.ratings.total ? (c / data.ratings.total) * 100 : 0;
                    return (
                      <Row key={s} style={{ gap: 8 }}>
                        <T size={12} color={C.muted} style={{ width: 10 }}>
                          {s}
                        </T>
                        <View style={styles.bar}>
                          <View style={[styles.fill, { width: `${pct}%` }]} />
                        </View>
                        <T size={12} color={C.muted} style={{ width: 22, textAlign: 'right' }}>
                          {c}
                        </T>
                      </Row>
                    );
                  })}
                </View>
                )}
              </Row>
            </Card>

            <Card style={styles.stats}>
              {(isDriver
                ? data.partial && !data.full
                  ? [[data.stats.trips_driven, 'Trips driven']]
                  : [
                    [data.stats.rides_published, 'Rides published'],
                    [data.stats.trips_driven, 'Trips driven'],
                    [data.stats.trips_cancelled_as_driver, 'Cancelled by driver'],
                    ]
                : [
                    [data.stats.bookings_total, 'Bookings'],
                    [data.stats.bookings_completed, 'Completed'],
                    [data.stats.bookings_cancelled, 'Cancelled'],
                  ]
              ).map(([n, l], i) => (
                <View key={String(l)} style={[styles.stat, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.line }]}>
                  <T w="xbold" size={20}>
                    {n}
                  </T>
                  <T size={12} color={C.muted} style={{ textAlign: 'center' }}>
                    {l}
                  </T>
                </View>
              ))}
            </Card>
            {isDriver && data.stats.bookings_total > 0 ? (
              <T size={13} color={C.muted}>
                As a passenger: {data.stats.bookings_total} booking{data.stats.bookings_total === 1 ? '' : 's'}, {data.stats.bookings_completed} completed, {data.stats.bookings_cancelled} cancelled.
              </T>
            ) : null}

            {isDriver && data.vehicle ? (
              <>
                <Section title="Car" />
                <Card style={{ padding: 14, gap: 8 }}>
                  <T w="bold">{[data.vehicle.color, data.vehicle.make, data.vehicle.model, data.vehicle.year].filter(Boolean).join(' ') || 'Car details not added'}</T>
                  {data.vehicle.license_plate ? <T size={13} color={C.ink2}>Plate: {data.vehicle.license_plate}</T> : null}
                  {data.vehicle.photo_urls?.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {data.vehicle.photo_urls.map((url) => (
                        <Image key={url} source={{ uri: url }} style={styles.photo} />
                      ))}
                    </ScrollView>
                  ) : null}
                </Card>
              </>
            ) : null}

            <Section title={`Reviews${data.reviews.length ? ` (${data.reviews.length})` : ''}`} />
            {data.reviews.length ? (
              data.reviews.map((r) => (
                <Card key={r.id} style={{ padding: 14, gap: 6 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <T w="bold">
                      {r.rater_first_name} {r.rater_last_initial ? `${r.rater_last_initial}.` : ''}
                    </T>
                    <Stars n={r.rating} size={13} />
                  </Row>
                  {r.comment ? <T size={14}>{r.comment}</T> : null}
                  <T size={12} color={C.muted}>
                    {r.rater_role === 'driver' ? 'Driver' : 'Passenger'} · {new Date(r.created_at).toLocaleDateString()}
                  </T>
                </Card>
              ))
            ) : (
              <T color={C.muted}>{data.partial && !data.full ? 'Written reviews are not available yet.' : 'No reviews yet.'}</T>
            )}
          </>
        ) : null}
      </ScrollView>
      <ReportUserSheet visible={showReport} userId={Number(id)} userName={full} onClose={() => setShowReport(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.chip, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: C.star },
  stats: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4 },
  photo: { width: 120, height: 90, borderRadius: 12, backgroundColor: C.chip },
});
