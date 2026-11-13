import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ConfirmCancel } from '../components/ConfirmCancel';
import { Btn, Card, Chip, Row, Screen, Section, Sheet, T, Tag, TopBar } from '../components/ui';
import { ApiRide, rides, Subscription, subscriptions } from '../lib/api';
import { money } from '../lib/format';
import { useStore } from '../store';
import { C } from '../theme';

export default function Subscriptions() {
  // with ?rideId the screen starts a new subscription for that local ride (its full route)
  const { rideId } = useLocalSearchParams<{ rideId?: string }>();
  const { toast, bumpData } = useStore();
  const [list, setList] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [ride, setRide] = useState<ApiRide | null>(null);
  const [cycle, setCycle] = useState<'monthly' | 'weekly'>('monthly');
  const [busy, setBusy] = useState(false);
  const [manage, setManage] = useState<Subscription | null>(null); // the subscription whose details sheet is open
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await subscriptions.list());
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not load subscriptions');
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => {
    if (rideId) rides.get(rideId).then(setRide).catch(() => toast('Could not load that ride'));
  }, [rideId, toast]);

  const subscribe = async () => {
    if (!ride?.start_location_id || !ride.end_location_id) return toast('This ride cannot be subscribed to');
    setBusy(true);
    try {
      await subscriptions.create(ride.id, ride.start_location_id, ride.end_location_id, cycle);
      toast('Subscribed');
      bumpData();
      router.replace('/subscriptions');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not subscribe');
    } finally {
      setBusy(false);
    }
  };
  const cancel = async (id: number) => {
    setBusy(true);
    try {
      await subscriptions.setStatus(id, 'cancelled');
      toast('Subscription cancelled');
      setConfirm(false);
      setManage(null);
      bumpData();
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not cancel');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Subscriptions" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {rideId ? (
          ride ? (
            <Card style={{ padding: 16, gap: 10 }}>
              <T w="display" size={24}>
                Subscribe to this commute
              </T>
              <T w="bold">{ride.title ?? `${ride.start_location_name} → ${ride.end_location_name}`}</T>
              <T size={13} color={C.muted}>
                {ride.start_address} → {ride.end_address}
              </T>
              <Row style={{ gap: 8 }}>
                <Chip label="Monthly" on={cycle === 'monthly'} onPress={() => setCycle('monthly')} />
                <Chip label="Weekly" on={cycle === 'weekly'} onPress={() => setCycle('weekly')} />
              </Row>
              <T size={12} color={C.muted}>
                The fee is worked out from the route distance when you subscribe.
              </T>
              <Btn label={busy ? 'Subscribing…' : 'Subscribe'} disabled={busy} onPress={subscribe} />
            </Card>
          ) : (
            <ActivityIndicator color={C.o} />
          )
        ) : null}
        <Section title="Your subscriptions" />
        {loading ? <ActivityIndicator color={C.o} /> : null}
        {!loading && !list.length ? <T color={C.muted}>No subscriptions yet. Open a local ride to subscribe to it.</T> : null}
        {list.map((sub) => (
          <Card key={sub.id} style={{ padding: 14, gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T w="bold" style={{ flex: 1 }} numberOfLines={1}>
                {sub.ride_title ?? `Ride #${sub.ride_id}`}
              </T>
              <Tag label={sub.status} tone={sub.status === 'active' ? 'g' : 'plain'} />
            </Row>
            <T size={13} color={C.muted}>
              {sub.pickup_name} → {sub.dropoff_name}
            </T>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T size={13}>
                {sub.billing_cycle} · {sub.monthly_fee !== undefined ? money(Number(sub.monthly_fee)) : ''}
              </T>
              {sub.next_billing_date ? (
                <T size={13} color={C.muted}>
                  Next billing {sub.next_billing_date.slice(0, 10)}
                </T>
              ) : null}
            </View>
            <Btn small kind="out" label="Manage" onPress={() => setManage(sub)} />
          </Card>
        ))}
      </ScrollView>

      <Sheet visible={!!manage && !confirm} title="Manage subscription" onClose={() => setManage(null)}>
        {manage ? (
          <>
            <T w="bold">{manage.ride_title ?? `Ride #${manage.ride_id}`}</T>
            <T size={13} color={C.muted}>
              {manage.pickup_name} → {manage.dropoff_name}
            </T>
            <T size={13} color={C.ink2}>
              {manage.billing_cycle} · {manage.monthly_fee !== undefined ? money(Number(manage.monthly_fee)) : ''}
              {manage.next_billing_date ? ` · next billing ${manage.next_billing_date.slice(0, 10)}` : ''}
            </T>
            <Btn label="Done" onPress={() => setManage(null)} />
            {manage.status === 'active' ? (
              <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line }}>
                <T size={13} color={C.muted}>
                  No longer need this commute?
                </T>
                <T w="bold" size={14} color={C.bad} style={{ paddingVertical: 10 }} onPress={() => setConfirm(true)} accessibilityRole="button">
                  Cancel this subscription…
                </T>
              </View>
            ) : null}
          </>
        ) : null}
      </Sheet>
      <ConfirmCancel
        visible={confirm && !!manage}
        title="Cancel this subscription?"
        body="Your regular rides on this commute will stop and you will no longer be billed for the next period."
        confirmLabel="Yes, cancel subscription"
        keepLabel="Keep my subscription"
        busy={busy}
        onClose={() => setConfirm(false)}
        onConfirm={() => manage && cancel(manage.id)}
      />
    </Screen>
  );
}
