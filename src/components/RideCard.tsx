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
  const seatColor = full ? C.muted : ride.seats === 1 ? C.warn : C.good;
  return (
    <Card style={[styles.card, { borderLeftColor: local ? C.o : '#2F5DB8' }, full && { opacity: 0.55 }]} onPress={() => onOpen(ride)}>
      {(
        <View style={styles.head}>
          <View style={[styles.kind, { backgroundColor: local ? C.oSoft : '#E8EEFB' }]}>
            <Icon name={local ? 'pin' : 'route'} size={11} color={local ? C.oDeep : '#2F5DB8'} />
            <T w="xbold" size={10} color={local ? C.oDeep : '#2F5DB8'} style={{ letterSpacing: 0.4 }}>
              {local ? 'LOCAL RIDE' : 'LONG ROUTE'}
            </T>
          </View>
          {showDate && ride.day ? (
            <View style={styles.date}>
              <Icon name="calendar" size={12} color={C.oDeep} />
              <T w="bold" size={12} color={C.oDeep}>
                {ride.monthly ? 'Starts ' : ''}
                {fmtDay(new Date(`${ride.day}T00:00:00`))}
              </T>
            </View>
          ) : null}
          {isOwn ? <Tag label="Your published ride" tone="o" /> : null}
          {ride.monthly ? <Tag label="Monthly" icon="calendar" tone="g" /> : null}
          {ride.instant ? <Tag label="Instant" icon="bolt" tone="o" /> : null}
          {ride.away ? <Tag label={ride.away} icon="pin" /> : null}
          {ride.tags.includes('Round trip') ? <Tag label="Round trip" /> : null}
        </View>
      )}
      <View style={styles.tm}>
        <View style={{ flex: 1, gap: 1 }}>
          <Stop time={ride.dep} place={ride.from} sub={ride.fromS} />
          <View style={styles.midRow}>
            <T w="semi" size={10} color={C.muted} style={{ width: 42 }}>
              {ride.dur}
            </T>
            <View style={styles.line} />
          </View>
          <Stop time={ride.arr} place={ride.to} sub={ride.toS} end />
        </View>
        <View style={styles.price}>
          <T w="xbold" size={15} color={C.oDeep} style={full ? { textDecorationLine: 'line-through' } : undefined}>
            ${seatShare(ride, 1).now.toFixed(2)}
          </T>
          <T size={9} color={C.muted}>
            {local ? 'per rider' : 'per seat'}
          </T>
        </View>
      </View>
      <View style={styles.mid}>
        <View style={styles.feats}>
          {rideFeatures(ride).map((f) => (
            <FeatureIcon key={f.icon} {...f} size={22} />
          ))}
        </View>
        <View style={[styles.seats, { backgroundColor: full ? C.chip : ride.seats === 1 ? '#FFF4D6' : C.goodSoft }]}>
          <Icon name="users" size={12} color={seatColor} />
          <T w="bold" size={11} color={seatColor}>
            {full ? 'Full' : `${ride.seats} seat${ride.seats > 1 ? 's' : ''} left`}
          </T>
        </View>
      </View>
      <View style={styles.dv}>
        <Avatar name={ride.driver} size={28} uri={ride.avatar} verified={!!ride.verified} />
        <T w="bold" size={13} numberOfLines={1} style={{ flexShrink: 1 }}>
          {ride.driver}
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          {ride.rev ? <Icon name="star" size={12} color={C.star} fill /> : null}
          <T size={11} color={C.muted}>
            {ride.rev ? `${ride.rating.toFixed(1)} (${ride.rev})` : 'New driver'}
          </T>
        </View>
      </View>
    </Card>
  );
}

function Stop({ time, place, sub, end }: { time: string; place: string; sub: string; end?: boolean }) {
  return (
    <View style={styles.stop}>
      <T w="xbold" size={14} style={{ width: 42 }}>
        {time}
      </T>
      <View style={[styles.dot, end && { backgroundColor: C.ink }]} />
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
  card: { padding: 12, paddingBottom: 0, gap: 8, overflow: 'hidden', borderLeftWidth: 4, borderLeftColor: C.o },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  date: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 2 },
  price: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: C.oSoft, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  seats: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  tm: { flexDirection: 'row', gap: 10 },
  mid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  feats: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flexShrink: 1 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2.5, borderColor: C.ink, backgroundColor: C.card },
  midRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  line: { width: 2.5, height: 14, backgroundColor: C.ink, borderRadius: 2, marginLeft: 3.75 },
  // the driver strip: a light band across the bottom of the card shows where the card ends
  dv: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: -12, marginLeft: -12, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.oSoft, borderTopWidth: 1, borderTopColor: C.oTint },
});

// lists of many cards only redraw the cards whose ride actually changed
export const RideCard = React.memo(RideCardBase);
