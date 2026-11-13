import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ride } from '../data';
import { fmtDay } from '../lib/format';
import { seatShare } from '../lib/rideMap';
import { C } from '../theme';
import { Icon, IconName } from './Icon';
import { Avatar, Card, Tag, T } from './ui';

export function RideCard({ ride, local, onPress, isOwn, showDate }: { ride: Ride; local: boolean; onPress: () => void; isOwn?: boolean; showDate?: boolean }) {
  const full = ride.seats === 0;
  return (
    <Card style={[styles.card, full && { opacity: 0.55 }]} onPress={onPress}>
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
        <View style={{ alignItems: 'flex-end' }}>
          <T w="xbold" size={22} style={full ? { textDecorationLine: 'line-through' } : undefined}>
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
        <Feat icon="paw" on={ride.pets} label="Pets welcome" />
        <Feat icon="snow" on={!!ride.winter} label="Winter tires" />
        <Feat icon="bike" on={!!ride.bikes} label="Bikes allowed" />
        <Feat icon="ski" on={!!ride.skis} label="Skis and snowboards" />
        <Feat icon="bag" on={!!ride.bag} badge={ride.bag} label={ride.bag ? `Luggage space: ${ride.bag}` : 'No luggage space'} />
        <Feat icon="users" on={ride.back === 2} badge={ride.back ? String(ride.back) : undefined} label={ride.back ? `Up to ${ride.back} in the back seat` : 'Back seat'} />
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

/** One ride feature: coloured when the driver offers it, grey when not. */
function Feat({ icon, on, badge, label }: { icon: IconName; on: boolean; badge?: string; label: string }) {
  return (
    <View style={[styles.feat, on && styles.featOn]} accessibilityLabel={`${label}${on ? '' : ', not offered'}`}>
      <Icon name={icon} size={10} color={on ? '#fff' : '#B9B4BD'} />
      {badge ? (
        <View style={[styles.badge, on && { backgroundColor: C.ink }]}>
          <T w="bold" size={7} color={on ? '#fff' : C.muted}>
            {badge}
          </T>
        </View>
      ) : null}
    </View>
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
  feats: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  feat: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' },
  featOn: { backgroundColor: C.o },
  badge: { position: 'absolute', right: -4, bottom: -4, minWidth: 11, height: 11, paddingHorizontal: 2, borderRadius: 6, backgroundColor: '#E4E0E6', alignItems: 'center', justifyContent: 'center' },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: C.ink, backgroundColor: C.card },
  midRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { width: 3, height: 22, backgroundColor: C.ink, borderRadius: 2, marginLeft: 4.5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dv: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: C.line, paddingTop: 12 },
});
