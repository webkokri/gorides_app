import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ride } from '../data';
import { C } from '../theme';
import { Icon, IconName } from './Icon';
import { T } from './ui';

export type Feature = { icon: IconName; on: boolean; badge?: string; label: string };

export function rideFeatures(r: Ride): Feature[] {
  return [
    { icon: 'paw', on: !!r.pets, label: r.pets ? 'Pets welcome' : 'No pets' },
    { icon: 'snow', on: !!r.winter, label: r.winter ? 'Winter tires' : 'No winter tires' },
    { icon: 'bike', on: !!r.bikes, label: r.bikes ? 'Bikes allowed' : 'No bikes' },
    { icon: 'ski', on: !!r.skis, label: r.skis ? 'Skis and snowboards allowed' : 'No skis or snowboards' },
    { icon: 'bag', on: !!r.bag, badge: r.bag ? String(r.bag) : undefined, label: r.bag ? `Luggage space: ${r.bag}` : 'No luggage space' },
    { icon: 'users', on: r.back === 2, badge: r.back ? String(r.back) : undefined, label: r.back ? `Up to ${r.back} in the back seat` : 'Back seat' },
  ];
}

/** One preference as an icon: orange when the driver offers it, grey when not. `size` is the circle's diameter. */
export function FeatureIcon({ icon, on, badge, label, size = 20 }: Feature & { size?: number }) {
  const bs = Math.max(11, Math.round(size * 0.5));
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: on ? C.o : C.chip }, styles.c]} accessibilityLabel={`${label}${on ? '' : ', not offered'}`}>
      <Icon name={icon} size={Math.round(size * 0.52)} color={on ? '#fff' : '#B9B4BD'} />
      {badge ? (
        <View style={[styles.badge, { minWidth: bs, height: bs, borderRadius: bs / 2 }, on && { backgroundColor: C.ink }]}>
          <T w="bold" size={Math.max(7, Math.round(size * 0.3))} color={on ? '#fff' : C.muted}>
            {badge}
          </T>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  c: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: -4, bottom: -4, paddingHorizontal: 2, backgroundColor: '#E4E0E6', alignItems: 'center', justifyContent: 'center' },
});
