import React, { useState } from 'react';
import { Btn } from './ui';
import { startRoute } from '../lib/route';
import { useStore } from '../store';

/** Opens the driver's maps app with every pickup point on the trip as stops in one route. */
export function StartRouteButton({ rideId, day, kind = 'sec', style }: { rideId?: number; day: string; kind?: 'pri' | 'sec' | 'out' | 'dark'; style?: React.ComponentProps<typeof Btn>['style'] }) {
  const { toast } = useStore();
  const [busy, setBusy] = useState(false);
  if (!rideId) return null;
  return (
    <Btn
      label={busy ? 'Building route…' : 'Start route'}
      icon="route"
      kind={kind}
      small
      disabled={busy}
      style={style}
      onPress={async () => {
        setBusy(true);
        try {
          await startRoute(rideId, day, toast);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
