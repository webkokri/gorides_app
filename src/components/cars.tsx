import React from 'react';
import { Circle, ClipPath, Defs, Ellipse, G, Image as SvgImage, LinearGradient, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { C, F } from '../theme';

const LOGO = require('../../assets/images/logo.png');

/** Gradients shared by the car drawings. Render once inside every <Svg> that draws a car. */
export function CarDefs() {
  return (
    <Defs>
      <LinearGradient id="beamG" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#FFF6DD" stopOpacity={0.65} />
        <Stop offset="1" stopColor="#FFF6DD" stopOpacity={0} />
      </LinearGradient>
      <LinearGradient id="bodyG" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFC08A" />
        <Stop offset="0.3" stopColor="#FF8B37" />
        <Stop offset="0.55" stopColor={C.o} />
        <Stop offset="0.8" stopColor="#C9540C" />
        <Stop offset="1" stopColor="#8A3606" />
      </LinearGradient>
      <LinearGradient id="shineG" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
        <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.55} />
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
      </LinearGradient>
      <RadialGradient id="rimG" cx="0.4" cy="0.35" r="0.7">
        <Stop offset="0" stopColor="#F4F6F9" />
        <Stop offset="0.6" stopColor="#B9C0CA" />
        <Stop offset="1" stopColor="#6E7682" />
      </RadialGradient>
      <RadialGradient id="shadowG" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0" stopColor="#000000" stopOpacity={0.55} />
        <Stop offset="1" stopColor="#000000" stopOpacity={0} />
      </RadialGradient>
      <LinearGradient id="topShade" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#000000" stopOpacity={0.35} />
        <Stop offset="0.3" stopColor="#000000" stopOpacity={0} />
        <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.3} />
        <Stop offset="0.7" stopColor="#000000" stopOpacity={0} />
        <Stop offset="1" stopColor="#000000" stopOpacity={0.35} />
      </LinearGradient>
      <LinearGradient id="topGlass" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#3A4A5C" />
        <Stop offset="1" stopColor="#141A24" />
      </LinearGradient>
      <LinearGradient id="topBeam" x1="0" y1="1" x2="0" y2="0">
        <Stop offset="0" stopColor="#FFF6DD" stopOpacity={0.45} />
        <Stop offset="1" stopColor="#FFF6DD" stopOpacity={0} />
      </LinearGradient>
      <LinearGradient id="doorG" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFC08F" />
        <Stop offset="1" stopColor="#C9540F" />
      </LinearGradient>
      <LinearGradient id="glassG" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#5B6B80" />
        <Stop offset="0.5" stopColor="#26303F" />
        <Stop offset="1" stopColor="#11161F" />
      </LinearGradient>
      <LinearGradient id="routeG" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#FFD29E" />
        <Stop offset="1" stopColor="#FF6A00" />
      </LinearGradient>
      <RadialGradient id="underG" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0" stopColor="#FF7A1A" stopOpacity={0.7} />
        <Stop offset="1" stopColor="#FF7A1A" stopOpacity={0} />
      </RadialGradient>
      <RadialGradient id="glowO" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0" stopColor="#FF8A3D" stopOpacity={0.8} />
        <Stop offset="1" stopColor="#FF8A3D" stopOpacity={0} />
      </RadialGradient>
      <RadialGradient id="glowW" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.8} />
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
      </RadialGradient>
      <RadialGradient id="glowR" cx="0.5" cy="0.5" r="0.5">
        <Stop offset="0" stopColor="#FF2244" stopOpacity={0.9} />
        <Stop offset="1" stopColor="#FF2244" stopOpacity={0} />
      </RadialGradient>
    </Defs>
  );
}

/**
 * A sedan seen from above, nose pointing up (-y), about 58 x 120 around (0, 0): shaded paint, tinted glass,
 * mirrors, lights and the GO logo on the roof. `color` is the paint; `beam` draws the headlight cones.
 */
export function TopSedan({ color = C.o, beam = true, shadow = true, logo = true }: { color?: string; beam?: boolean; shadow?: boolean; logo?: boolean }) {
  const light = color === '#FFFFFF' ? '#F2F2F4' : color;
  return (
    <G>
      {shadow ? <Ellipse cx={0} cy={4} rx={34} ry={64} fill="#000" opacity={0.35} /> : null}
      {beam ? <Path d="M-14 -58 L-44 -150 L44 -150 L14 -58Z" fill="url(#topBeam)" /> : null}
      <Path d={TOP_BODY} fill={light} />
      <Path d={TOP_BODY} fill="url(#topShade)" />
      <Path d="M-10 -56 Q-12 -40 -12 -26 M10 -56 Q12 -40 12 -26" stroke="#fff" strokeOpacity={0.35} strokeWidth={1.2} fill="none" />
      <Ellipse cx={-31} cy={-16} rx={4} ry={2.6} fill={light} />
      <Ellipse cx={31} cy={-16} rx={4} ry={2.6} fill={light} />
      <Ellipse cx={-31} cy={-16} rx={4} ry={2.6} fill="#000" opacity={0.25} />
      <Ellipse cx={31} cy={-16} rx={4} ry={2.6} fill="#000" opacity={0.25} />
      <Path d="M-21 -22 Q0 -30 21 -22 L18 -6 Q0 -10 -18 -6Z" fill="url(#topGlass)" />
      <Path d="M-24 -14 L-21 -6 L-21 38 L-24 42Z M24 -14 L21 -6 L21 38 L24 42Z" fill="#1C2430" />
      <Rect x={-17} y={-6} width={34} height={33} rx={5} fill={light} />
      <Rect x={-17} y={-6} width={34} height={33} rx={5} fill="#fff" opacity={0.12} />
      {logo ? (
        <G>
          <Circle cx={0} cy={10} r={10.5} fill="#fff" opacity={0.9} />
          <SvgImage href={LOGO} x={-9.5} y={0.5} width={19} height={19} />
        </G>
      ) : null}
      <Path d="M-17 28 Q0 25 17 28 L20 44 Q0 48 -20 44Z" fill="url(#topGlass)" />
      <Path d="M-15 -24 Q-6 -27 2 -26 L-4 -12 Q-10 -12 -15 -11Z" fill="#fff" opacity={0.12} />
      <Ellipse cx={-14} cy={-56.5} rx={5} ry={1.8} fill="#F2FDFF" />
      <Ellipse cx={14} cy={-56.5} rx={5} ry={1.8} fill="#F2FDFF" />
      <Rect x={-19} y={56} width={10} height={2.6} rx={1.3} fill="#FF3355" />
      <Rect x={9} y={56} width={10} height={2.6} rx={1.3} fill="#FF3355" />
    </G>
  );
}

const TOP_BODY = 'M-20 -58 Q0 -62 20 -58 Q28 -54 28 -40 L29 30 Q29 56 18 59 Q0 62 -18 59 Q-29 56 -29 30 L-28 -40 Q-28 -54 -20 -58Z';

/**
 * Top-down car for the maps. The nose points along +x, so `deg` is simply the heading of travel,
 * and each car turns to face the way it is driving.
 */
export function TopCar({ x, y, deg, scale = 1, color = C.o, beam = true }: { x: number; y: number; deg: number; scale?: number; color?: string; beam?: boolean }) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${deg}) scale(${scale})`}>
      <Ellipse cx={0} cy={0} rx={30} ry={20} fill={color === '#FFFFFF' ? 'url(#glowW)' : 'url(#glowO)'} opacity={0.45} />
      <G transform="rotate(90) scale(0.36)">
        <TopSedan color={color} beam={beam} logo={false} />
      </G>
    </G>
  );
}

// side view, facing right: body, window frame and the two panes (rear door | front door)
const BODY = 'M12 52 C8 50 7 44 8 38 L10 32 C11 29 14 27.5 20 27 L40 25.5 C48 25 53 23 58 19 L70 10 C75 7 80 6 88 5.5 L118 5.5 C128 6 134 8 141 13 L156 24 C168 25 180 27 187 30 C191 32 193 36 193 41 L193 46 C193 50 191 52 187 53 L167 54 A17 17 0 0 0 133 54 L65 54 A17 17 0 0 0 31 54 L16 53 C14 53 12.5 52.8 12 52Z';
const FRAME = 'M60 22 L72 12 C77 9 82 8 90 8 L116 8 C124 8 130 10 136 14 L150 24.5 L62 24.5Z';
const GLASS1 = 'M64 23.5 L73 13.5 C77.5 10.5 82 9.5 90 9.5 L102 9.5 L102 23.5Z';
const GLASS2 = 'M108 9.5 L116 9.5 C123 9.5 129 11 134.5 15 L146.5 23.5 L108 23.5Z';
const SPOKE = 'M0 0 L-2.2 -8.4 A8.6 8.6 0 0 1 2.2 -8.4Z';

/** An alloy wheel: tyre, sidewall, five-spoke rim that spins with `deg`, and a fixed orange brake caliper. */
function Wheel({ x, deg }: { x: number; deg: number }) {
  return (
    <G transform={`translate(${x} 54)`}>
      <Circle r={14} fill="#141416" />
      <Circle r={12.6} fill="none" stroke="#2C2C31" strokeWidth={1.2} />
      <Circle r={9.6} fill="url(#rimG)" />
      <Path d="M-6.5 -6.2 A9 9 0 0 1 -1 -8.9 L-3.8 -3.4Z" fill="#E4571A" />
      <G transform={`rotate(${deg})`}>
        {[0, 72, 144, 216, 288].map((a) => (
          <Path key={a} d={SPOKE} fill="#2B2F38" transform={`rotate(${a + 36})`} />
        ))}
      </G>
      <Circle r={3.2} fill="#9AA2AD" />
      <Circle r={1.6} fill={C.o} />
    </G>
  );
}

const DOORWAY = 'M64 24 L73 13 C77.5 10 82 9 90 9 L103 9 L103 52 L64 52Z';
// the rear door, closed, as outlines in car units: window frame, glass and the painted skin
const DOOR_FRAME: [number, number][] = [[103, 8], [90, 8], [82, 8.3], [77, 9.4], [72, 12], [60.5, 22.5], [62, 24.5], [103, 24.5]];
const DOOR_GLASS: [number, number][] = [[101.5, 9.5], [90, 9.5], [82, 10], [77.5, 10.9], [73.5, 13.6], [64.5, 23.3], [101.5, 23.3]];
const DOOR_SKIN: [number, number][] = [[103, 24.5], [62, 24.5], [61, 34], [61.2, 44], [62, 49], [64, 52.5], [103, 52.5]];

/**
 * The rear door swinging open on its front hinge (x = 103). As it turns towards the viewer it foreshortens,
 * and its free edge grows and drops a little because it is nearer. `k` is 0 (shut) to 1 (open about 75 degrees).
 */
export function doorPoint(k: number, [px, py]: [number, number]): [number, number] {
  const a = (k * 75 * Math.PI) / 180;
  const sa = Math.sin(a);
  const u = Math.max(0, (103 - px) / 41);
  const s = 1 + 0.24 * sa * u;
  return [103 - (103 - px) * Math.cos(a), 30 + (py - 30) * s + 5 * sa * u];
}

/** Where the rear door's handle is, in car units, when the door is `k` open. */
export const DOOR_HANDLE: [number, number] = [94.5, 31.2];

function OpenDoor({ k }: { k: number }) {
  const sa = Math.sin((k * 75 * Math.PI) / 180);
  const map = (q: [number, number]) => doorPoint(k, q);
  const d = (pts: [number, number][]) => 'M' + pts.map((q) => map(q).map((v) => v.toFixed(2)).join(' ')).join(' L') + 'Z';
  const edge = [map([61.5, 12]), map([61, 34]), map([64, 52.5])];
  const th = 3.2 * sa;
  const handle = [map([90, 30]), map([99, 30]), map([99, 32.4]), map([90, 32.4])];
  return (
    <G>
      {/* the door's thickness along its rear edge, seen as it swings out */}
      <Path d={`M${edge[0][0]} ${edge[0][1]} L${edge[1][0]} ${edge[1][1]} L${edge[2][0]} ${edge[2][1]} L${edge[2][0] + th} ${edge[2][1] - 1} L${edge[1][0] + th} ${edge[1][1]} L${edge[0][0] + th} ${edge[0][1] + 1}Z`} fill="#6B2A04" />
      <Path d={d(DOOR_FRAME)} fill="#1A1D26" />
      <Path d={d(DOOR_GLASS)} fill="url(#glassG)" opacity={0.85} />
      <Path d={d(DOOR_SKIN)} fill="url(#bodyG)" />
      <Path d={d(DOOR_SKIN)} fill="#000" opacity={0.12 * sa} />
      <Path d={`M${handle.map((q) => q.join(' ')).join(' L')}Z`} fill="#FFD2AE" />
      <Path d="M103 9 L103 52.5" stroke="#3A1603" strokeWidth={1} opacity={0.6} />
    </G>
  );
}

/**
 * Side-view electric-style car facing right (drives to the right).
 * `wheelDeg` spins the rims; `door` 0..1 opens the rear door; `heads` is how many people sit inside.
 */
export function SideCar({ x, y, scale = 1, wheelDeg = 0, heads = 1, door = 0, brake = false, moving = false, t = 0, rider, riderCut = 200 }: { x: number; y: number; scale?: number; wheelDeg?: number; heads?: number; door?: number; brake?: boolean; moving?: boolean; t?: number; rider?: React.ReactNode; riderCut?: number }) {
  const o = (t * 300) % 40;
  const HEAD = [
    { x: 124, c: '#23232F' },
    { x: 74, c: '#2A1D17' },
    { x: 86, c: '#A8704A' },
    { x: 114, c: '#7A4B8C' },
  ];
  return (
    <G transform={`translate(${x} ${y}) scale(${scale})`}>
      {rider ? (
        <Defs>
          <ClipPath id="riderClip">
            <Rect x={-400} y={-400} width={1000} height={400 + riderCut} />
          </ClipPath>
        </Defs>
      ) : null}
      <Ellipse cx={100} cy={67} rx={98} ry={6} fill="url(#shadowG)" />
      <Ellipse cx={100} cy={64} rx={80} ry={5} fill="url(#underG)" opacity={0.6} />
      {moving ? (
        <G>
          {[
            [18, 46],
            [32, 60],
            [46, 34],
          ].map(([yy, l], i) => (
            <Path key={i} d={`M${-8 - o * 0.3} ${yy} h${-l}`} stroke="#fff" strokeWidth={2.4} strokeLinecap="round" opacity={0.3 + 0.5 * Math.abs(Math.sin(t * 8 + i))} />
          ))}
        </G>
      ) : null}
      <Path d="M190 33 L290 14 L290 62 Z" fill="url(#beamG)" />
      <Circle cx={48} cy={54} r={16.5} fill="#120904" />
      <Circle cx={150} cy={54} r={16.5} fill="#120904" />
      <Path d={BODY} fill="url(#bodyG)" />
      <Path d="M14 31 C60 29 140 29 189 32" stroke="#fff" strokeOpacity={0.45} strokeWidth={1.2} fill="none" />
      <Path d="M16 29 C60 27 140 27 186 30 L186 31.5 C140 29 60 29 16 31Z" fill="url(#shineG)" opacity={0.7} />
      <Path d={FRAME} fill="#1A1D26" />
      <Path d={GLASS1} fill="url(#glassG)" />
      <Path d={GLASS2} fill="url(#glassG)" />
      {HEAD.slice(0, heads).map((h) => (
        <Circle key={h.x} cx={h.x} cy={18.5} r={5.5} fill={h.c} />
      ))}
      <Path d="M76 23.5 L90 9.5 L97 9.5 L83 23.5Z M112 23.5 L122 10 L126 10.5 L116 23.5Z" fill="#fff" opacity={0.13} />
      <Rect x={102} y={9} width={6} height={15.5} fill="#1A1D26" />
      <Path d="M62 24.5 L150 24.5" stroke="#D9DDE4" strokeWidth={1} opacity={0.8} />
      <Path d="M62 25 C61 34 61 44 64 52 M104 25 L104 52 M147 25 C150 32 151 40 150 46" stroke="#6B2A04" strokeOpacity={0.55} strokeWidth={0.9} fill="none" />
      <Rect x={90} y={30} width={9} height={2.4} rx={1.2} fill="#FFD2AE" />
      <Rect x={130} y={30} width={9} height={2.4} rx={1.2} fill="#FFD2AE" />
      <Path d="M141 18 C145 16.5 149 17 150 19.5 L149 22 L142 22Z" fill="#D9600B" />
      <Path d="M142 18.5 C145 17.5 148 17.8 149 19.5" stroke="#FFC08A" strokeWidth={0.8} fill="none" />
      <Path d="M66 50.5 L132 50.5 L132 53.5 L66 53.5Z" fill="#6E2A04" opacity={0.6} />
      <Ellipse cx={186} cy={33} rx={12} ry={7} fill="url(#glowW)" />
      <Path d="M178 29.5 C184 30 189 31.5 191.5 34 L190 36 C185 35 180 34 177 32.5Z" fill="#EAF6FF" />
      <Path d="M179 31 C184 31.6 187 32.6 189.5 34" stroke="#7FD3FF" strokeWidth={0.9} fill="none" />
      <Path d="M179 45 L192 45 L191 49.5 L181 49.5Z" fill="#1A1D26" />
      <Ellipse cx={13} cy={35} rx={brake ? 18 : 9} ry={brake ? 11 : 5} fill="url(#glowR)" />
      <Path d="M8.5 34 L19 31.5 L19.5 34.5 L9 37.5Z" fill={brake ? '#FF4D66' : '#E0213F'} />
      <Path d="M9 35 L19 32.6" stroke="#FF8A9A" strokeWidth={0.7} />
      {/* GORIDES lettering across both doors, with a soft shadow; it fades while the rear door swings open */}
      <G opacity={1 - Math.min(1, door * 3)}>
        <SvgText x={104.6} y={44.6} fontSize={12} fontFamily={F.display} letterSpacing={1.2} textAnchor="middle" fill="#6B2A04" opacity={0.45}>
          GORIDES
        </SvgText>
        <SvgText x={104} y={44} fontSize={12} fontFamily={F.display} letterSpacing={1.2} textAnchor="middle" fill="#FFFFFF">
          GORIDES
        </SvgText>
      </G>
      {door > 0 ? (
        <G>
          <Path d={DOORWAY} fill="#10131F" />
                    <Path d="M64.5 26 C64.5 21.5 66 20 68.5 20 L70.5 20.5 C71.8 27 72 35 71.3 42 L65 44 C64.3 38 64.2 31 64.5 26Z" fill="#2A2F3E" />
          <Path d="M66 42 L101 41.5 L101 47.5 L65 48Z" fill="#232735" />
          <Path d="M64 51.2 L103 51.2" stroke="#3A3F52" strokeWidth={1.2} />
          {heads >= 2 ? <Circle cx={74} cy={18.5} r={5.5} fill="#2A1D17" /> : null}
          {rider ? (
            <G clipPath="url(#riderClip)">
              <G transform={`scale(${1 / scale}) translate(${-x} ${-y})`}>{rider}</G>
            </G>
          ) : null}
          <OpenDoor k={door} />
        </G>
      ) : null}
      <Wheel x={48} deg={wheelDeg} />
      <Wheel x={150} deg={wheelDeg} />
    </G>
  );
}
