import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Icon } from '../components/Icon';
import { Card, Row, Screen, Seg, T, TopBar } from '../components/ui';
import { MyRating, ratings } from '../lib/api';
import { useStore } from '../store';
import { C } from '../theme';

export default function Ratings() {
  const { toast } = useStore();
  const [dir, setDir] = useState<'received' | 'given'>('received');
  const [data, setData] = useState<{ key: string; list: MyRating[]; avg?: number; total?: number } | null>(null);
  const loading = data?.key !== dir;

  useEffect(() => {
    let live = true;
    ratings
      .mine(dir)
      .then((r) => live && setData({ key: dir, list: r.ratings ?? [], avg: r.averageRating, total: r.total }))
      .catch((e) => {
        if (live) {
          setData({ key: dir, list: [] });
          toast(e instanceof Error ? e.message : 'Could not load ratings');
        }
      });
    return () => {
      live = false;
    };
  }, [dir, toast]);

  return (
    <Screen>
      <StatusBar style="dark" />
      <TopBar title="Ratings and reviews" />
      <Seg
        value={dir}
        onChange={setDir}
        options={[
          { v: 'received', label: 'Received' },
          { v: 'given', label: 'Given' },
        ]}
        style={{ marginHorizontal: 16, marginBottom: 8 }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        {loading ? <ActivityIndicator color={C.o} /> : null}
        {!loading && dir === 'received' && data?.total ? (
          <T w="bold">
            {(data.avg ?? 0).toFixed(1)} average · {data.total} rating{data.total > 1 ? 's' : ''}
          </T>
        ) : null}
        {!loading && !data?.list.length ? <T color={C.muted}>No ratings yet.</T> : null}
        {!loading
          ? data?.list.map((r) => (
              <Card key={r.id} style={{ padding: 14, gap: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T w="bold">{dir === 'received' ? `${r.rater_first_name} ${r.rater_last_name}` : `${r.ratee_first_name} ${r.ratee_last_name}`}</T>
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {Array.from({ length: r.rating }, (_, i) => (
                      <Icon key={i} name="star" size={14} color={C.star} fill />
                    ))}
                  </View>
                </Row>
                {r.comment ? <T size={14}>{r.comment}</T> : null}
                <T size={12} color={C.muted}>
                  {new Date(r.created_at).toLocaleDateString()}
                </T>
              </Card>
            ))
          : null}
      </ScrollView>
    </Screen>
  );
}
