import { CountryCode, getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js';

export type Country = { code: CountryCode; name: string; dial: string; flag: string };

const flag = (c: string) => String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
const names = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

export const COUNTRIES: Country[] = getCountries()
  .map((code) => ({ code, name: names?.of(code) ?? code, dial: `+${getCountryCallingCode(code)}`, flag: flag(code) }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const findCountry = (code: string) => COUNTRIES.find((c) => c.code === code) ?? COUNTRIES.find((c) => c.code === 'CA')!;

const fromLocale = (): string | null => {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = new Intl.Locale(loc).region;
    return region ?? null;
  } catch {
    return null;
  }
};

let detected: Promise<CountryCode> | null = null;
/** Country guess: IP geolocation, then device locale, then Canada. Cached for the session; the user can always override. */
export function detectCountry(): Promise<CountryCode> {
  detected ??= (async () => {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 3000);
      const res = await fetch('https://ipapi.co/json/', { signal: ctl.signal });
      clearTimeout(t);
      const cc = ((await res.json()) as { country_code?: string }).country_code;
      if (cc && COUNTRIES.some((c) => c.code === cc)) return cc as CountryCode;
    } catch {}
    const loc = fromLocale();
    return (loc && COUNTRIES.some((c) => c.code === loc) ? loc : 'CA') as CountryCode;
  })();
  return detected;
}

/** National digits typed by the user + the chosen country -> E.164 (e.g. +14165551234), or null when invalid. */
export const toE164 = (national: string, country: CountryCode) => {
  const p = parsePhoneNumberFromString(national, country);
  return p?.isValid() ? p.number : null;
};

/** Split a stored E.164 number back into country + national digits for editing. */
export const splitE164 = (e164: string): { country: CountryCode | null; national: string } => {
  const p = parsePhoneNumberFromString(e164);
  return p?.country ? { country: p.country, national: p.nationalNumber } : { country: null, national: e164.replace(/^\+/, '') };
};
