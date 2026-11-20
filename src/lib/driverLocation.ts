import * as Location from 'expo-location';
import { drivers } from './api';
import { setItem } from './storage';

export const LAST_PING = 'gorides.lastPing';

/**
 * Reads the phone's position right now and reports it to the server as the driver's last known location.
 * `ask` shows the system permission dialog when it has not been answered yet. Returns what happened so callers can tell the person.
 */
export async function reportDriverLocation(ask = false, precise = false): Promise<'ok' | 'denied' | 'error'> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && ask && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return 'denied';
    // a fix from the last couple of minutes is fine and instant; otherwise ask the GPS
    // while a ride is under way (precise) always take a fresh GPS reading
    const recent = precise ? null : await Location.getLastKnownPositionAsync({ maxAge: 120000 });
    const pos = recent ?? (await Location.getCurrentPositionAsync({ accuracy: precise ? Location.Accuracy.High : Location.Accuracy.Balanced }));
    await drivers.pingLocation(pos.coords.latitude, pos.coords.longitude);
    await setItem(LAST_PING, String(Date.now()));
    return 'ok';
  } catch {
    return 'error';
  }
}
