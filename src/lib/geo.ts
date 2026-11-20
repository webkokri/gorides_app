import * as Location from 'expo-location';
import { settings } from './api';

export type Place = { name: string; address: string; city: string; state: string; country: string; latitude: number; longitude: number };

let token: string | null = null;
async function mapToken() {
  if (token === null) token = (await settings.map()).mapboxAccessToken ?? '';
  return token;
}

type Feature = { text: string; address?: string; place_type?: string[]; place_name: string; center: [number, number]; context?: { id: string; text: string; short_code?: string }[] };

function toPlace(f: Feature): Place {
  const ctx = (id: string) => f.context?.find((c) => c.id.startsWith(id));
  const place = ctx('place')?.text ?? ctx('locality')?.text ?? f.text;
  const name = f.place_type?.[0] === 'address' && f.address ? `${f.address} ${f.text}` : f.text;
  return {
    name,
    address: f.place_name,
    city: place,
    state: ctx('region')?.short_code?.replace(/^CA-/, '') ?? ctx('region')?.text ?? '',
    country: ctx('country')?.text ?? 'Canada',
    longitude: f.center[0],
    latitude: f.center[1],
  };
}

async function mapbox(path: string, params: Record<string, string>) {
  const t = await mapToken();
  if (!t) throw new Error('Place search is not configured yet.');
  const qs = new URLSearchParams({ access_token: t, ...params }).toString();
  const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${path}.json?${qs}`);
  if (!res.ok) throw new Error('Place search failed.');
  return ((await res.json()).features ?? []) as Feature[];
}

export async function searchPlaces(q: string): Promise<Place[]> {
  if (q.trim().length < 2) return [];
  return (await mapbox(encodeURIComponent(q.trim()), { country: 'ca', autocomplete: 'true', limit: '6', types: 'place,locality,address,poi' })).map(toPlace);
}

const cache = new Map<string, Place | null>();
/** Resolve a typed label (e.g. "Toronto, ON") to coordinates. Cached. */
export async function geocode(label: string): Promise<Place | null> {
  const key = label.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  const p = (await searchPlaces(label))[0] ?? null;
  cache.set(key, p);
  return p;
}

export async function currentPlace(): Promise<Place> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') throw new Error('Location permission was denied.');
  // best accuracy available, so the address matches where the phone really is (default accuracy can be blocks away)
  const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const here = { latitude: coords.latitude, longitude: coords.longitude };
  let f: Feature | undefined;
  try {
    const found = await mapbox(`${coords.longitude},${coords.latitude}`, { types: 'address,poi,neighborhood,locality,place', limit: '1' });
    f = found[0];
  } catch {
    // fall through to the coordinates-only place
  }
  return f ? { ...toPlace(f), ...here } : { name: 'Current location', address: '', city: '', state: '', country: 'Canada', ...here };
}

export const distanceKm = (a: Place, b: Place) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.latitude - a.latitude) / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(r(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

export const placeLabel = (p: Place) => (p.city && p.city !== p.name ? `${p.name}, ${p.city}` : p.name);

const driveCache = new Map<string, { at: number; sec: number | null }>();
/** Driving time in seconds between two points (Mapbox Directions); null when unavailable. Cached for 30 s. */
export async function drivingSeconds(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): Promise<number | null> {
  const key = `${a.latitude.toFixed(4)},${a.longitude.toFixed(4)};${b.latitude.toFixed(4)},${b.longitude.toFixed(4)}`;
  const hit = driveCache.get(key);
  if (hit && Date.now() - hit.at < 30000) return hit.sec;
  let sec: number | null = null;
  try {
    const t = await mapToken();
    if (t) {
      const res = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=false&access_token=${t}`);
      sec = (await res.json())?.routes?.[0]?.duration ?? null;
    }
  } catch {
    sec = null;
  }
  driveCache.set(key, { at: Date.now(), sec });
  return sec;
}

type LL = { latitude: number; longitude: number };
type Route = { line: string | null; full: string | null; legs: number[] | null };
const routeCache = new Map<string, { at: number; value: Route }>();
/** Driving route through the points (Mapbox Directions): the encoded line for drawing and the seconds of each leg. Cached for 8 s. */
export async function drivingRoute(points: LL[]): Promise<Route> {
  if (points.length < 2) return { line: null, full: null, legs: null };
  const coords = points.map((p) => `${p.longitude},${p.latitude}`).join(';');
  const hit = routeCache.get(coords);
  if (hit && Date.now() - hit.at < 8000) return hit.value;
  let value: Route = { line: null, full: null, legs: null };
  try {
    const t = await mapToken();
    if (t) {
      const res = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?overview=simplified&geometries=polyline&access_token=${t}`);
      const r = (await res.json())?.routes?.[0];
      // a line too long for the map image address is left out (the markers still show)
      value = { line: r?.geometry && encodeURIComponent(r.geometry).length < 5500 ? r.geometry : null, full: r?.geometry ?? null, legs: r?.legs?.map((l: { duration: number }) => l.duration) ?? null };
    }
  } catch {
    // no route: the markers still show
  }
  routeCache.set(coords, { at: Date.now(), value });
  return value;
}

export const mapboxToken = mapToken;
