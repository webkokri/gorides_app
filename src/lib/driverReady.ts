import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../auth';
import { driverVehicle, licence } from './api';
import { addPushListener } from './push';
import { getItem } from './storage';

export const LICENCE_FLAG = 'gorides.licence.uploaded';

const VERIFICATION_PUSH_TYPES = new Set(['vehicle_verified', 'vehicle_rejected', 'license_verified']);

/**
 * What a driver must have on file before publishing: the car (plate, photo, registration, insurance: the server's own
 * check) and a driving licence. The server only knows whether a licence is verified, so "uploaded" is remembered on this device.
 */
export function useDriverReady() {
  const { user } = useAuth();
  const [state, setState] = useState<{ loading: boolean; vehicleOk: boolean; vehicleVerified: boolean; licenceOk: boolean; licenceVerified: boolean }>({ loading: true, vehicleOk: false, vehicleVerified: false, licenceOk: false, licenceVerified: false });
  const [refreshKey, setRefreshKey] = useState(0);

  // Staff approving/rejecting the vehicle or license pushes immediately --
  // react to it right away instead of only refetching the next time this
  // screen regains focus.
  useEffect(() => {
    return addPushListener((data) => {
      if (VERIFICATION_PUSH_TYPES.has(String(data?.type))) setRefreshKey((k) => k + 1);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let live = true;
      (async () => {
        const [v, l, flag] = await Promise.all([
          driverVehicle.get().then((r) => ({ complete: r.is_complete, verified: r.vehicle?.verification_status === 'verified' })).catch(() => ({ complete: false, verified: false })),
          licence.status().then((r) => r.license.verified).catch(() => false),
          getItem(LICENCE_FLAG),
        ]);
        if (live) setState({ loading: false, vehicleOk: v.complete, vehicleVerified: v.verified, licenceVerified: l, licenceOk: l || flag === user.id.toString() });
      })();
      return () => {
        live = false;
      };
    }, [user, refreshKey]),
  );

  // 'verified' = the backend team confirmed BOTH the vehicle and the driving licence; only then is the person a Driver on their profile
  return { ...state, ready: !state.loading && state.vehicleOk && state.licenceOk, driverVerified: state.vehicleVerified && state.licenceVerified };
}
