import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ride } from '../data';
import { fmtDay } from '../lib/format';
import { seatShare } from '../lib/rideMap';
import { C } from '../theme';
import { Icon } from './Icon';
import { FeatureIcon, rideFeatures } from './RideFeatures';
import { Avatar, Card, Tag, T } from './ui';

function RideCardBase({ ride, local, onOpen, isOwn, showDate }: { ride: Ride; local: boolean; onOpen: (r: Ride) => void; isOwn?: boolean; showDate?: boolean }) {
  const full = ride.seats === 0;
  const accent = local ? C.oDeep : '#2F5DB8';
  const seatColor = full ? C.muted : ride.seats === 1 ? C.warn : C.good;
  return (
    <Card style={[styles.card, full && { opacity: 0.55 }]} onPress={() => onOpen(ride)}>
      {/* 1. what kind of ride, when, and how many seats are left */}
      <View style={styles.head}>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <View style={[styles.kind, { backgroundColor: local ? C.oSoft : '#E8EEFB' }]}>
            <Icon name={local ? 'pin' : 'route'} size={11} color={accent} />
            <T w="xbold" size={10} color={accent} style={{ letterSpacing: 0.5 }}>
              {local ? 'LOCAL RIDE' : 'LONG ROUTE'}
            </T>
          </View>
          {showDate && ride.day ? (
            <T w="bold" size={12} color={C.ink2}>
              {ride.monthly ? 'Starts ' : ''}
              {fmtDay(new Date(`${ride.day}T00:00:00`))}
            </T>
          ) : null}
          {ride.instant ? <Icon name="bolt" size={14} color={C.o} fill /> : null}
          {isOwn ? <Tag label="Yours" tone="o" /> : null}
        </View>
        <T w="bold" size={12} color={seatColor}>
          {full ? 'Full' : `${ride.seats} seat${ride.seats > 1 ? 's' : ''} left`}
        </T>
      </View>

      {/* 2. the route on the left, the price on the right */}
      <View style={styles.body}>
        <View style={{ flex: 1 }}>
          <Stop time={ride.dep} place={ride.from} sub={ride.fromS} />
          <View style={styles.midRow}>
            <View style={{ width: 44 }} />
            <View style={styles.rail}>
              <View style={styles.line} />
            </View>
            <T size={11} color={C.muted}>
              {ride.dur}
              {ride.monthly ? ' · Monthly' : ''}
              {ride.tags.includes('Round trip') ? ' · Round trip' : ''}
              {ride.away ? ` · ${ride.away}` : ''}
            </T>
          </View>
          <Stop time={ride.arr} place={ride.to} sub={ride.toS} end />
        </View>
        <View style={styles.price}>
          <T w="xbold" size={19} color={C.ink} style={full ? { textDecorationLine: 'line-through' } : undefined}>
            ${seatShare(ride, 1).now.toFixed(2)}
          </T>
          <T size={10} color={C.muted}>
            {local ? 'per rider' : 'per seat'}
          </T>
        </View>
      </View>

      {/* 3. the driver and what the car offers */}
      <View style={styles.foot}>
        <Avatar name={ride.driver} size={30} uri={ride.avatar} verified={!!ride.verified} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T w="bold" size={13} numberOfLines={1}>
            {ride.driver}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            {ride.rev ? <Icon name="star" size={11} color={C.star} fill /> : null}
            <T size={11} color={C.muted}>
              {ride.rev ? `${ride.rating.toFixed(1)} (${ride.rev})` : 'New driver'}
            </T>
          </View>
        </View>
        <View style={styles.feats}>
          {rideFeatures(ride).map((f) => (
            <FeatureIcon key={f.icon} {...f} size={20} />
          ))}
        </View>
      </View>
    </Card>
  );
}

function Stop({ time, place, sub, end }: { time: string; place: string; sub: string; end?: boolean }) {
  return (
    <View style={styles.stop}>
      <T w="xbold" size={14} style={{ width: 44 }}>
        {time}
      </T>
      <View style={styles.rail}>
        <View style={[styles.dot, end ? { backgroundColor: C.ink, borderColor: C.ink } : { borderColor: C.o }]} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T w="bold" size={13} numberOfLines={1}>
          {place}
        </T>
        {sub ? (
          <T size={11} color={C.muted} numberOfLines={1}>
            {sub}
          </T>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 12, overflow: 'hidden', borderRadius: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  body: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  price: { alignItems: 'flex-end', minWidth: 62, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: C.line },
  stop: { flexDirection: 'row', alignItems: 'center' },
  rail: { width: 22, alignItems: 'center' },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 3, backgroundColor: C.card },
  midRow: { flexDirection: 'row', alignItems: 'center', height: 24 },
  line: { width: 2, height: 24, backgroundColor: '#DDD7D1', borderRadius: 1 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line },
  feats: { flexDirection: 'row', gap: 5 },
});

// lists of many cards only redraw the cards whose ride actually changed
export const RideCard = React.memo(RideCardBase);
