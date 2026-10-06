import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ride } from '../data';
import { C } from '../theme';
import { Icon } from './Icon';
import { Avatar, Card, Tag, T } from './ui';

export function RideCard({ ride, local, onPress }: { ride: Ride; local: boolean; onPress: () => void }) {
  const full = ride.seats === 0;
  return (
    <Card style={[styles.card, full && { opacity: 0.55 }]} onPress={onPress}>
      <View style={styles.tm}>
        <View style={{ flex: 1, gap: 2 }}>
          <Stop time={ride.dep} place={ride.from} sub={ride.fromS} />
          <View style={styles.midRow}>
            <T w="semi" size={11} color={C.muted} style={{ width: 48 }}>
              {ride.dur}
            </T>
            <View style={styles.line} />
          </View>
          <Stop time={ride.arr} place={ride.to} sub={ride.toS} end />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T w="xbold" size={22} style={full ? { textDecorationLine: 'line-through' } : undefined}>
            ${ride.price}
          </T>
          <T size={11} color={C.muted}>
            {local ? 'per rider' : 'per seat'}
          </T>
        </View>
      </View>
      <View style={styles.tags}>
        {ride.instant ? <Tag label="Instant" icon="bolt" tone="o" /> : null}
        {ride.tags.map((t) => (
          <Tag key={t} label={t} />
        ))}
        
      </View>
      <View style={styles.dv}>
        <Avatar name={ride.driver} size={40} uri={ride.avatar} verified={!!ride.verified} />
        <View style={{ flex: 1 }}>
          <T w="bold" size={14}>
            {ride.driver}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {ride.rev ? <Icon name="star" size={13} color={C.star} fill /> : null}
            <T size={12} color={C.muted}>
              {ride.rev ? `${ride.rating.toFixed(1)} · ${ride.rev} review${ride.rev > 1 ? 's' : ''}` : 'New driver'}
            </T>
          </View>
        </View>
        <T w="bold" size={12} color={full ? C.muted : ride.seats === 1 ? C.warn : C.good}>
          {full ? 'Full' : `${ride.seats} seat${ride.seats > 1 ? 's' : ''} left`}
        </T>
      </View>
    </Card>
  );
}

function Stop({ time, place, sub, end }: { time: string; place: string; sub: string; end?: boolean }) {
  return (
    <View style={styles.stop}>
      <T w="xbold" size={16} style={{ width: 48 }}>
        {time}
      </T>
      <View style={[styles.dot, end && { backgroundColor: C.ink }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w="bold" size={14} numberOfLines={1}>
          {place}
        </T>
        <T size={12} color={C.muted} numberOfLines={1}>
          {sub}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 14 },
  tm: { flexDirection: 'row', gap: 12 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: C.ink, backgroundColor: C.card },
  midRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { width: 3, height: 22, backgroundColor: C.ink, borderRadius: 2, marginLeft: 4.5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dv: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: C.line, paddingTop: 12 },
});
