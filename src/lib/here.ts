import * as Location from 'expo-location';
import { askNotificationPermission } from './push';

export type Here = { latitude: number; longitude: number };

let cached: { at: number; here: Here } | null = null;

/** The phone's position, or null when location is off or refused. Reuses a fix for two minutes; never asks for permission. */
export async function getHere(): Promise<Here | null> {
  if (cached && Date.now() - cached.at < 120000) return cached.here;
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    if (!pos) return null;
    const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    cached = { at: Date.now(), here };
    return here;
  } catch {
    return null;
  }
}

/** Straight-line distance in km. */
export const kmBetween = (a: Here, b: Here) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.latitude - a.latitude) / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(r(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

export const awayLabel = (km: number) => (km < 1 ? 'Under 1 km away' : `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`);

/** Right after the app opens: the location dialog first, then the notification one. Each is only shown while still undecided. */
export async function askStartupPermissions() {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) await Location.requestForegroundPermissionsAsync();
  } catch {
    // Non-fatal: the app asks again where it needs the location.
  }
  await askNotificationPermission();
}
