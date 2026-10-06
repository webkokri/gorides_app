import React, { useMemo } from 'react';
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { CarDefs, TopSedan } from '../cars';
import { ease, seeded, useTicker } from '../../lib/anim';

const unit = (v: number) => Math.min(1, Math.max(0, v));

/** Splash timing, in seconds. */
export const SPLASH = { carFrom: 0.2, carTo: 2.2, dustHold: 0.1, logoIn: 0.7 };

/**
 * Splash scene: a road runs up the screen, the orange car drives up it trailing dust, and as it passes
 * the logo spot the dust bursts. The caller fades the logo in from `logoIn(t)`.
 */
export function SplashRoad({ width: W, height: H, cy }: { width: number; height: number; cy: number }) {
  const t = useTicker(true, 50);
  const y0 = H + 90;
  const y1 = -200;
  const carY = (tt: number) => y0 + (y1 - y0) * ease.inOut(unit((tt - SPLASH.carFrom) / (SPLASH.carTo - SPLASH.carFrom)));
  const pass = useMemo(() => {
    for (let tt = SPLASH.carFrom; tt < SPLASH.carTo; tt += 0.005) if (carY(tt) <= cy) return tt;
    return 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [H, cy]);
  const trail = useMemo(() => {
    const r = seeded(3);
    return Array.from({ length: 44 }, (_, i) => ({ at: SPLASH.carFrom + 0.05 + i * 0.045, dx: (r() - 0.5) * 40, side: r() > 0.5 ? 1 : -1 }));
  }, []);
  const burst = useMemo(() => {
    const r = seeded(9);
    return Array.from({ length: 20 }, (_, i) => ({ a: (i / 20) * Math.PI * 2 + r() * 0.3, reach: 50 + r() * 50, size: 10 + r() * 10, delay: r() * 0.15 }));
  }, []);
  const x = W / 2;
  const roadAlpha = 1 - 0.65 * unit((t - pass - 1) / 0.6);

  return (
    <Svg width={W} height={H} pointerEvents="none">
      <CarDefs />
      <Defs>
        <RadialGradient id="spDust" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#E6D2BD" stopOpacity={1} />
          <Stop offset="1" stopColor="#E6D2BD" stopOpacity={0} />
        </RadialGradient>
      </Defs>

      <G opacity={roadAlpha * unit(t / 0.3)}>
        <Rect x={x - 62} y={0} width={124} height={H} fill="#1A1C2E" />
        <Rect x={x - 62} y={0} width={3} height={H} fill="rgba(255,255,255,0.25)" />
        <Rect x={x + 59} y={0} width={3} height={H} fill="rgba(255,255,255,0.25)" />
        <Path d={`M${x} 0 V${H}`} stroke="#F2C14E" strokeWidth={3} strokeDasharray="22 18" />
      </G>

      {trail.map((p, i) => {
        const a = t - p.at;
        if (a <= 0 || a > 1.3) return null;
        const py = carY(p.at) + 80;
        return <Circle key={`t${i}`} cx={x + p.dx + p.side * a * 20} cy={py + a * 12} r={12 + a * 34} fill="url(#spDust)" opacity={0.55 * (1 - a / 1.3)} />;
      })}

      {burst.map((b, i) => {
        const a = t - pass - b.delay;
        if (a <= 0 || a > 1.8) return null;
        const d = ease.out(unit(a / 1.4)) * b.reach;
        return <Circle key={`b${i}`} cx={x + Math.cos(b.a) * d} cy={cy + Math.sin(b.a) * d * 0.8} r={b.size + a * 26} fill="url(#spDust)" opacity={0.6 * (1 - a / 1.8)} />;
      })}

      {carY(t) > -200 ? (
        <G transform={`translate(${x} ${carY(t)}) scale(1.3)`}>
          <TopSedan />
        </G>
      ) : null}
    </Svg>
  );
}

/** How far the logo has faded in out of the dust, 0..1, for a splash that started `t` seconds ago. */
export function logoIn(t: number, pass: number) {
  return ease.out(unit((t - pass - SPLASH.dustHold) / SPLASH.logoIn));
}
