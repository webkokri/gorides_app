import React, { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../auth';
import { SignInPrompt } from '../components/SignInPrompt';
import { TabBar, TAB_SPACE } from '../components/TabBar';
import { RateSheet } from '../components/TripCards';
import { TripTabs } from '../components/TripTabs';
import { Btn, IconBtn, Screen, TopBar } from '../components/ui';
import { ratings } from '../lib/api';
import { useTripData } from '../lib/trips';
import { useStore } from '../store';

/** Current activity only. Completed and cancelled items live in Profile > History. */
export default function MyRides() {
  const { toast, bumpData } = useStore();
  const { user } = useAuth();
  const { asPassenger, asDriver, published, subs, loading, load } = useTripData();
  const [rating, setRating] = useState<{ id: number; stars: number; comment?: string; isEdit?: boolean } | null>(null);
  const [myGivenRatings, setMyGivenRatings] = useState<Map<number, { stars: number; comment: string }>>(new Map());

  useFocusEffect(
    useCallback(() => {
      ratings
        .mine('given')
        .then((r) => setMyGivenRatings(new Map(r.ratings.map((x) => [x.ratee_id, { stars: x.rating, comment: x.comment ?? '' }]))))
        .catch(() => {});
    }, []),
  );

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok);
      bumpData();
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

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar big title="My rides" right={<IconBtn name="plus" label="Publish a ride" onPress={() => router.push('/publish')} />} />
      <TripTabs
        history={false}
        uid={user.id}
        data={{ asPassenger, asDriver, published, subs }}
        loading={loading}
        bottomSpace={TAB_SPACE}
        act={act} onReload={load}
        onRate={(id, existing) => setRating({ id, stars: existing?.stars ?? 5, comment: existing?.comment, isEdit: !!existing })}
        myGivenRatings={myGivenRatings}
        footer={<Btn label="Completed and cancelled: see History" kind="out" small icon="clock" onPress={() => router.push('/history')} style={{ marginTop: 6 }} />}
      />
      <RateSheet
        rating={rating}
        setRating={setRating}
        onSubmit={(id, stars, comment) =>
          act(() => ratings.rate(id, stars, comment || undefined), rating?.isEdit ? 'Your rating was updated' : 'Thanks! Your review was saved')
        }
      />
      <TabBar current="my-rides" />
    </Screen>
  );
}
