import { useEffect, useState } from 'react';
import { vehicles, VehicleModel } from './api';

export type VehicleField = 'make' | 'model' | 'color';

const COMMON_COLORS = ['Black', 'White', 'Silver', 'Grey', 'Blue', 'Red', 'Green', 'Brown', 'Beige', 'Gold', 'Orange', 'Yellow'];
const lc = (s?: string | null) => (s ?? '').trim().toLowerCase();
const uniq = (list: (string | null | undefined)[]) => [...new Set(list.map((x) => (x ?? '').trim()).filter(Boolean))];
/** prefix matches first, then anything containing the text, alphabetical within each */
const rank = (items: string[], q: string) => {
  const t = lc(q);
  return items
    .filter((i) => !t || lc(i).includes(t))
    .sort((a, b) => Number(!lc(a).startsWith(t)) - Number(!lc(b).startsWith(t)) || a.localeCompare(b));
};

/**
 * Suggestions for the make / model / colour being typed, straight from the vehicle catalogue in the backend database
 * (GET /vehicle-models, any signed-in user). The server searches make OR model by substring and returns at most 200 rows,
 * so the answer is narrowed here to the chosen make and model. Debounced; identical searches are cached by the API client.
 */
export function useVehicleSuggestions(active: VehicleField | null, make: string, model: string, color: string) {
  const [out, setOut] = useState<{ key: string; list: string[] }>({ key: '', list: [] });

  const term = active === 'make' ? make : active === 'model' ? model || make : model || make;
  const key = `${active}|${make}|${model}|${color}`;

  useEffect(() => {
    if (!active) return;
    if (active === 'make' && make.trim().length < 1) return;
    let live = true;
    const t = setTimeout(async () => {
      let rows: VehicleModel[] = [];
      try {
        rows = await vehicles.models(term.trim() || undefined);
      } catch {
        // no suggestions if the catalogue can't be reached; typing still works
      }
      let list: string[] = [];
      const sameMake = (r: VehicleModel) => !lc(make) || lc(r.make) === lc(make) || lc(r.make).startsWith(lc(make));
      const sameModel = (r: VehicleModel) => !lc(model) || lc(r.model) === lc(model) || lc(r.model).includes(lc(model));
      if (active === 'make') list = rank(uniq(rows.map((r) => r.make)), make);
      else if (active === 'model') list = rank(uniq(rows.filter(sameMake).map((r) => r.model)), model);
      else {
        const fromDb = uniq(rows.filter((r) => sameMake(r) && sameModel(r)).map((r) => r.color));
        list = rank(fromDb.length ? fromDb : COMMON_COLORS, color);
      }
      // hide a list that only repeats what is already typed in full
      const exact = list.length === 1 && lc(list[0]) === lc(active === 'make' ? make : active === 'model' ? model : color);
      if (live) setOut({ key, list: exact ? [] : list.slice(0, 8) });
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [active, make, model, color, term, key]);

  return active && out.key === key ? out.list : [];
}
