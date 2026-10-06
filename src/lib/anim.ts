import { useEffect, useRef, useState } from 'react';

/** Seconds since mount, updated every animation frame while `active`. Drives the SVG scenes. */
export function useTicker(active = true, fps = 45) {
  const [t, setT] = useState(0);
  const acc = useRef(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = 0;
    let prev = Date.now();
    const step = 1000 / fps;
    const loop = () => {
      const now = Date.now();
      acc.current += (now - prev) / 1000;
      prev = now;
      if (now - last >= step) {
        last = now;
        setT(acc.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, fps]);
  return t;
}

export type Pt = [number, number];
export type Bez = [Pt, Pt, Pt, Pt];

export function bz(p: Bez, t: number): Pt {
  const u = 1 - t;
  const f = (k: 0 | 1) => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k];
  return [f(0), f(1)];
}

/** Position and heading (degrees) on a bezier, so a car can face its direction of travel. */
export function along(p: Bez, t: number) {
  const c = (v: number) => Math.min(1, Math.max(0, v));
  const a = bz(p, c(t));
  const b = bz(p, c(t + 0.002));
  return { x: a[0], y: a[1], deg: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
}

export const bezPath = (p: Bez) => `M${p[0][0]} ${p[0][1]} C${p[1][0]} ${p[1][1]} ${p[2][0]} ${p[2][1]} ${p[3][0]} ${p[3][1]}`;

/** Samples a path made of cubic segments ("M x y C ... C ...") into points for position/heading lookup. */
export function samplePath(d: string, n = 200): Pt[] {
  const nums = d.replace(/[MC]/g, ' ').trim().split(/[\s,]+/).map(Number);
  const segs: Bez[] = [];
  let start: Pt = [nums[0], nums[1]];
  for (let i = 2; i + 5 < nums.length; i += 6) {
    const seg: Bez = [start, [nums[i], nums[i + 1]], [nums[i + 2], nums[i + 3]], [nums[i + 4], nums[i + 5]]];
    segs.push(seg);
    start = seg[3];
  }
  const pts: Pt[] = [];
  const per = Math.ceil(n / segs.length);
  segs.forEach((s) => {
    for (let k = 0; k < per; k++) pts.push(bz(s, k / per));
  });
  pts.push(start);
  return pts;
}

export function onPoly(pts: Pt[], t: number) {
  const i = Math.min(pts.length - 2, Math.max(0, Math.floor(t * (pts.length - 1))));
  const f = t * (pts.length - 1) - i;
  const a = pts[i];
  const b = pts[i + 1];
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, deg: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
}

export const ease = {
  out: (x: number) => 1 - Math.pow(1 - x, 3),
  in: (x: number) => x * x * x,
  inOut: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
};
export const clamp01 = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));

/**
 * Where a slide's car sits over time: it drives in from the left edge to `rest` during the first
 * `inDur` seconds, and, when the slide lasts `dur` seconds, drives off to the right during the last `outDur`.
 */
export function driveInOut(t: number, rest: number, dur = 0, { from = -280, to = 460, inDur = 1.3, outDur = 1.1 } = {}) {
  if (t < inDur) return rest + (from - rest) * (1 - ease.out(t / inDur));
  if (dur && t > dur - outDur) return rest + (to - rest) * ease.in(Math.min(1, (t - (dur - outDur)) / outDur));
  return rest;
}

/** Deterministic pseudo random, so skylines look the same on every render. */
export function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}
