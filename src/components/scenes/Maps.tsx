import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import { along, Bez, bezPath, onPoly, samplePath, useTicker } from '../../lib/anim';
import { C, F } from '../../theme';
import { CarDefs, TopCar } from '../cars';

type Traffic = { road: number; t: number; v: number; color: string; scale: number };

/**
 * Live "digital map" behind the home header: roads with flowing lane marks, traffic cars that
 * rotate to their direction of travel, and a neon pickup-to-drop-off route with the ride car on it.
 */
export function HeroMap({ active }: { active: boolean }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const tm = useTicker(active && size.w > 0, 40);
  const { w: W, h: H } = size;

  const { roads, route, traffic } = useMemo(() => {
    const roads: Bez[] = [
      [[-30, H * 0.3], [W * 0.3, H * 0.18], [W * 0.6, H * 0.42], [W + 30, H * 0.34]],
      [[-30, H * 0.62], [W * 0.35, H * 0.72], [W * 0.6, H * 0.5], [W + 30, H * 0.6]],
      [[-30, H * 0.88], [W * 0.4, H * 0.8], [W * 0.7, H * 0.95], [W + 30, H * 0.82]],
      [[W * 0.22, -30], [W * 0.3, H * 0.4], [W * 0.12, H * 0.7], [W * 0.2, H + 30]],
      [[W * 0.7, -30], [W * 0.62, H * 0.35], [W * 0.8, H * 0.62], [W * 0.72, H + 30]],
      [[W * 0.95, -30], [W * 0.86, H * 0.4], [W * 1.02, H * 0.7], [W * 0.9, H + 30]],
      [[-30, H * 0.08], [W * 0.4, H * 0.14], [W * 0.7, H * 0.02], [W + 30, H * 0.12]],
    ];
    const route: Bez = [[W * 0.5, H * 0.82], [W * 0.6, H * 0.56], [W * 0.98, H * 0.7], [W * 0.84, H * 0.38]];
    const cols = [C.o, '#FFFFFF', '#7FD6FF', C.o, '#FFFFFF', '#B79CFF'];
    const traffic: Traffic[] = Array.from({ length: 9 }, (_, i) => ({ road: i % roads.length, t: (i * 0.37) % 1, v: (0.06 + ((i * 7) % 5) * 0.02) * (i % 2 ? 1 : -1), color: cols[i % cols.length], scale: 0.42 + (i % 3) * 0.05 }));
    return { roads, route, traffic };
  }, [W, H]);

  const T = (tm % 7) / 6;
  const pr = Math.min(1, T);
  const car = along(route, pr);
  const eta = pr >= 1 ? 'Arrived' : `${Math.max(1, Math.ceil((1 - pr) * 8))} min`;
  const pulse = (ph: number) => ((tm + ph) % 1.6) / 1.6;
  const sweep = ((tm * 60) % (H + 120)) - 60;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {W > 0 ? (
        <Svg width={W} height={H}>
          <CarDefs />
          <Defs>
            <Pattern id="dots" width={18} height={18} patternUnits="userSpaceOnUse">
              <Circle cx={1} cy={1} r={1} fill="#fff" opacity={0.09} />
            </Pattern>
          </Defs>
          <Rect width={W} height={H} fill="url(#dots)" />
          {roads.map((p, i) => (
            <G key={i}>
              <Path d={bezPath(p)} stroke="#fff" strokeOpacity={0.045} strokeWidth={16} strokeLinecap="round" fill="none" />
              <Path d={bezPath(p)} stroke="#7FD6FF" strokeOpacity={0.12} strokeWidth={1} strokeDasharray="2 10" strokeDashoffset={-tm * 12} fill="none" />
            </G>
          ))}
          <Rect x={0} y={sweep - 40} width={W} height={80} fill={C.o} opacity={0.05} />
          {traffic.map((k, i) => {
            const p = roads[k.road];
            const tt = (((k.t + k.v * tm) % 1) + 1) % 1;
            const pos = along(p, tt);
            const trail = Array.from({ length: 8 }, (_, j) => along(p, tt - Math.sign(k.v) * 0.012 * (j + 1)));
            return (
              <G key={i}>
                {trail.map((q, j) => (
                  <Circle key={j} cx={q.x} cy={q.y} r={3.2 * (1 - j / 10)} fill={k.color === C.o ? C.o : '#fff'} opacity={0.2 * (1 - j / 8)} />
                ))}
                <TopCar x={pos.x} y={pos.y} deg={pos.deg + (k.v < 0 ? 180 : 0)} scale={k.scale} color={k.color} />
              </G>
            );
          })}
          <Path d={bezPath(route)} stroke={C.o} strokeOpacity={0.18} strokeWidth={10} strokeLinecap="round" fill="none" />
          <Path d={bezPath(route)} stroke={C.o} strokeOpacity={0.35} strokeWidth={9} strokeLinecap="round" fill="none" />
          <Path d={bezPath(route)} stroke="url(#routeG)" strokeWidth={4} strokeDasharray="10 8" strokeDashoffset={-tm * 40} strokeLinecap="round" fill="none" />
          {[
            { p: route[0], col: '#FFFFFF', ph: 0 },
            { p: route[3], col: '#FF7A1A', ph: 0.8 },
          ].map(({ p, col, ph }, i) => (
            <G key={i}>
              <Circle cx={p[0]} cy={p[1]} r={6 + pulse(ph) * 24} stroke={col} strokeWidth={2} strokeOpacity={0.7 * (1 - pulse(ph))} fill="none" />
              <Circle cx={p[0]} cy={p[1]} r={6} fill={col} />
              <Circle cx={p[0]} cy={p[1]} r={2.5} fill="#0C0F20" />
            </G>
          ))}
          <TopCar x={car.x} y={car.y} deg={car.deg} scale={0.7} />
          <G transform={`translate(${route[3][0] - 72} ${route[3][1] - 12})`}>
            <Rect width={56} height={24} rx={12} fill="#0C0F20" opacity={0.85} stroke="#FF7A1A" strokeOpacity={0.7} />
            <SvgText x={28} y={16} fontSize={11} fill="#fff" fontFamily={F.bold} textAnchor="middle">
              {eta}
            </SvgText>
          </G>
        </Svg>
      ) : null}
    </View>
  );
}

/** Dark route map on the ride details screen; the car follows the route facing forward. */
export function RideMap({ local, height = 220 }: { local: boolean; height?: number }) {
  const tm = useTicker(true, 40);
  const d = local ? 'M70 175 C130 150 150 110 210 105 C270 100 300 70 330 50' : 'M40 180 C110 170 120 120 180 115 C240 110 260 90 290 70 C320 50 340 40 360 36';
  const pts = useMemo(() => samplePath(d), [d]);
  const car = onPoly(pts, (tm % 6) / 6);
  const a = pts[0];
  const b = pts[pts.length - 1];
  const draw = Math.min(1, tm / 1.4);
  const pulse = (tm % 1.6) / 1.6;
  return (
    <View style={{ height, backgroundColor: '#10142A', overflow: 'hidden' }}>
      <Svg width="100%" height="100%" viewBox="0 0 390 210" preserveAspectRatio="xMidYMid slice">
        <CarDefs />
        <Defs>
          <Pattern id="mapDots" width={16} height={16} patternUnits="userSpaceOnUse">
            <Circle cx={1} cy={1} r={1} fill="#fff" opacity={0.08} />
          </Pattern>
        </Defs>
        <Rect width={390} height={210} fill="url(#mapDots)" />
        <Path d="M0 150 Q120 120 200 170 T390 140 V210 H0Z" fill="#14302A" opacity={0.8} />
        <Ellipse cx={320} cy={60} rx={54} ry={28} fill="#13284A" />
        {Array.from({ length: 14 }, (_, i) => (
          <Path key={`v${i}`} d={`M${-20 + i * 32} 0 L${40 + i * 28} 210`} stroke="#222A48" strokeWidth={i % 4 ? 2 : 6} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <Path key={`h${i}`} d={`M0 ${i * 30} L390 ${i * 30 + 18}`} stroke="#222A48" strokeWidth={i % 3 ? 2 : 6} />
        ))}
        <Path d={d} stroke={C.o} strokeOpacity={0.25} strokeWidth={12} strokeLinecap="round" fill="none" />
        <Path d={d} stroke="url(#routeG)" strokeWidth={4} strokeLinecap="round" fill="none" strokeDasharray="600" strokeDashoffset={600 * (1 - draw)} />
        <Path d={d} stroke="#fff" strokeOpacity={0.7} strokeWidth={1.5} fill="none" strokeDasharray="4 10" strokeDashoffset={-tm * 28} />
        <Circle cx={a[0]} cy={a[1]} r={8 + pulse * 14} fill="#fff" opacity={0.5 * (1 - pulse)} />
        <Circle cx={a[0]} cy={a[1]} r={7} fill="#fff" />
        <Circle cx={b[0]} cy={b[1]} r={14} fill="url(#glowO)" />
        <Circle cx={b[0]} cy={b[1]} r={9} fill={C.o} />
        <Circle cx={b[0]} cy={b[1]} r={3} fill="#10142A" />
        {!local ? <Circle cx={180} cy={115} r={5} fill="#10142A" stroke="#fff" strokeWidth={2.5} /> : null}
        <TopCar x={car.x} y={car.y} deg={car.deg} scale={0.75} />
      </Svg>
    </View>
  );
}
