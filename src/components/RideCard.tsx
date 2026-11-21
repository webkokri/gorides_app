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
  return (
    <Card style={[styles.card, full && { opacity: 0.55 }]} onPress={() => onOpen(ride)}>
      {showDate && ride.day ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="calendar" size={14} color={C.oDeep} />
          <T w="bold" size={13} color={C.oDeep}>
            {ride.monthly ? 'Starts ' : ''}
            {fmtDay(new Date(`${ride.day}T00:00:00`))}
          </T>
        </View>
      ) : null}
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
        <View style={styles.price}>
          <T w="xbold" size={22} color={C.oDeep} style={full ? { textDecorationLine: 'line-through' } : undefined}>
            ${seatShare(ride, 1).now.toFixed(2)}
          </T>
          <T size={11} color={C.muted}>
            {local ? 'per rider' : 'per seat'}
          </T>
        </View>
      </View>
      <View style={styles.tags}>
        {isOwn ? <Tag label="Your published ride" tone="o" /> : null}
        {ride.monthly ? <Tag label="Monthly ride" icon="calendar" tone="g" /> : null}
        {ride.away ? <Tag label={ride.away} icon="pin" /> : null}
        {ride.instant ? <Tag label="Instant" icon="bolt" tone="o" /> : null}
        {ride.tags.filter((t) => t === 'Round trip').map((t) => (
          <Tag key={t} label={t} />
        ))}
      </View>
      <View style={styles.feats}>
        {rideFeatures(ride).map((f) => (
          <FeatureIcon key={f.icon} {...f} size={26} />
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
        <View style={[styles.seats, { backgroundColor: full ? C.chip : ride.seats === 1 ? '#FFF4D6' : C.goodSoft }]}>
          <Icon name="users" size={13} color={full ? C.muted : ride.seats === 1 ? C.warn : C.good} />
          <T w="bold" size={12} color={full ? C.muted : ride.seats === 1 ? C.warn : C.good}>
            {full ? 'Full' : `${ride.seats} seat${ride.seats > 1 ? 's' : ''} left`}
          </T>
        </View>
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
  card: { padding: 16, paddingBottom: 0, gap: 14, overflow: 'hidden', borderLeftWidth: 5, borderLeftColor: C.o },
  price: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: C.oSoft, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  seats: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tm: { flexDirection: 'row', gap: 12 },
  feats: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: C.ink, backgroundColor: C.card },
  midRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { width: 3, height: 22, backgroundColor: C.ink, borderRadius: 2, marginLeft: 4.5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  // the driver and seats strip: a light band across the bottom of the card shows where the card ends
  dv: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: -16, marginLeft: -16, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.oSoft, borderTopWidth: 1, borderTopColor: C.oTint },
});

// lists of many cards only redraw the cards whose ride actually changed
export const RideCard = React.memo(RideCardBase);
