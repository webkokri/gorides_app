import * as Location from 'expo-location';
import { settings } from './api';

export type Place = { name: string; address: string; city: string; state: string; country: string; latitude: number; longitude: number };

let token: string | null = null;
async function mapToken() {
  if (token === null) token = (await settings.map()).mapboxAccessToken ?? '';
  return token;
}

type Feature = { text: string; place_name: string; center: [number, number]; context?: { id: string; text: string; short_code?: string }[] };

function toPlace(f: Feature): Place {
  const ctx = (id: string) => f.context?.find((c) => c.id.startsWith(id));
  const place = ctx('place')?.text ?? f.text;
  return {
    name: f.text,
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
  const { coords } = await Location.getCurrentPositionAsync({});
  const f = (await mapbox(`${coords.longitude},${coords.latitude}`, { types: 'address,place', limit: '1' }))[0];
  return f ? { ...toPlace(f), latitude: coords.latitude, longitude: coords.longitude } : { name: 'Current location', address: '', city: '', state: '', country: 'Canada', latitude: coords.latitude, longitude: coords.longitude };
}

export const distanceKm = (a: Place, b: Place) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.latitude - a.latitude) / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(r(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

export const placeLabel = (p: Place) => (p.city && p.city !== p.name ? `${p.name}, ${p.city}` : p.name);
