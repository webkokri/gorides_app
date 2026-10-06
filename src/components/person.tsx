import React from 'react';
import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/**
 * A man seen from the side, facing left (or right with `facing={1}`), drawn as a jointed figure so he can walk, reach and climb into a car.
 * Units: about 70 tall with the feet at y = 0 (hips at -34, top of the head at -69).
 */

type Pt = [number, number];
export type Pose = {
  /** leg swing from vertical, degrees; positive is forward (to the left) */
  nearHip: number;
  nearKnee: number;
  farHip: number;
  farKnee: number;
  /** upper arm swing and elbow bend, degrees; positive is forward */
  nearArm: number;
  nearElbow: number;
  farArm: number;
  farElbow: number;
  /** forward lean of the upper body and head tilt (negative looks down), degrees */
  lean: number;
  tilt: number;
  phone: boolean;
};

const rad = (d: number) => (d * Math.PI) / 180;
const dir = (a: number, l: number): Pt => [-Math.sin(rad(a)) * l, Math.cos(rad(a)) * l];
const add = (p: Pt, q: Pt): Pt => [p[0] + q[0], p[1] + q[1]];
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

export const HIP: Pt = [0, -34];
const SHOULDER: Pt = [0.5, -50.5];

/** Walking pose for gait phase `ph` (radians; one full turn is two steps). */
export function walkPose(ph: number): Pose {
  const s = Math.sin(ph);
  return {
    nearHip: 24 * s,
    nearKnee: 6 + 38 * Math.max(0, Math.cos(ph - 0.5)),
    farHip: -24 * s,
    farKnee: 6 + 38 * Math.max(0, -Math.cos(ph - 0.5)),
    nearArm: -20 * s,
    nearElbow: 18 + 10 * Math.max(0, -s),
    farArm: 20 * s,
    farElbow: 18 + 10 * Math.max(0, s),
    lean: 4,
    tilt: 0,
    phone: false,
  };
}

/** Standing and looking down at a phone held at chest height. */
export const IDLE: Pose = { nearHip: 3, nearKnee: 3, farHip: -3, farKnee: 3, nearArm: 22, nearElbow: 100, farArm: -2, farElbow: 12, lean: 2, tilt: -16, phone: true };

/** Blend two poses. */
export function blendPose(a: Pose, b: Pose, k: number): Pose {
  const o = { ...a };
  (Object.keys(a) as (keyof Pose)[]).forEach((key) => {
    if (key !== 'phone') (o[key] as number) = mix(a[key] as number, b[key] as number, k);
  });
  o.phone = k < 0.5 ? a.phone : b.phone;
  return o;
}

/** Joint positions for a pose, with the lowest sole resting on y = 0 when `ground` is true. */
export function joints(p: Pose, ground = true) {
  const leg = (h: number, k: number) => {
    const knee = add(HIP, dir(h, 17));
    const ankle = add(knee, dir(h - k, 16));
    return { knee, ankle, foot: h - k };
  };
  const near = leg(p.nearHip, p.nearKnee);
  const far = leg(p.farHip, p.farKnee);
  const lift = ground ? -(Math.max(near.ankle[1], far.ankle[1]) + 2.6) : 0;
  const arm = (a: number, e: number) => {
    const elbow = add(SHOULDER, dir(a, 12));
    const wrist = add(elbow, dir(a + e, 11));
    return { elbow, wrist };
  };
  return { lift, near, far, nearArm: arm(p.nearArm, p.nearElbow), farArm: arm(p.farArm, p.farElbow) };
}

const COL = {
  skin: '#C58A60',
  skinShade: '#A5704A',
  hair: '#221813',
  jacket: '#3E5670',
  jacketFar: '#2E4157',
  jeans: '#34425E',
  jeansFar: '#27324A',
  shoe: '#F4F4F4',
  shoeFar: '#D5D8DD',
  sole: '#8E949B',
};

const FACE = 'M3.5 -6.5 C-1 -8 -5.5 -6 -6 -2 L-6.2 0.4 L-7.7 2.6 L-6 3.1 L-5.8 5 C-5.6 7.2 -3.5 8.4 -1 8.2 L2.5 7.5 C5 6.5 6.5 3 6.5 -1 C6.5 -4.5 5.5 -6 3.5 -6.5Z';
const HAIR = 'M-6.1 -2.6 C-6.6 -8 -2 -10.2 2 -10 C6.2 -9.6 7.8 -6 7.1 -1 L5.6 1.4 C5.2 -2 3.8 -3.6 1.6 -4.1 C-1 -4.6 -3.6 -4.6 -6.1 -2.6Z';
const BEARD = 'M-5.9 4.4 C-5.5 7.6 -3 8.7 -0.5 8.4 L2.6 7.6 C4.2 6.9 5 5.2 5.2 3.4 L3.6 2.8 C2.6 5 0 5.9 -2 5.7 L-5.1 3.9Z';
const TORSO = 'M-5.4 -33.5 L-6.2 -44 C-6.7 -49.5 -5 -53.4 -1 -54.2 L2.6 -54.2 C6.2 -53.4 7.3 -49.2 6.8 -44 L6 -33.5Z';
const HIPS = 'M-5.6 -37 H6.1 L6.3 -31.5 C4 -29 -4 -29 -5.8 -31.5Z';
const SHOE = 'M2.2 -1.8 C2.6 0.4 2.2 1.6 1.2 2 L-7.4 2 C-8.6 2 -8.9 0.6 -7.8 -0.2 C-6 -1.2 -3.2 -1.6 -1.6 -2.6Z';

function Leg({ leg, jeans, shoe }: { leg: { knee: Pt; ankle: Pt; foot: number }; jeans: string; shoe: string }) {
  const toe = Math.max(-18, Math.min(22, leg.foot * 0.55));
  return (
    <G>
      <Path d={`M${HIP[0]} ${HIP[1]} L${leg.knee[0]} ${leg.knee[1]} L${leg.ankle[0]} ${leg.ankle[1]}`} stroke={jeans} strokeWidth={6.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <G transform={`translate(${leg.ankle[0]} ${leg.ankle[1]}) rotate(${-toe})`}>
        <Path d={SHOE} fill={shoe} />
        <Rect x={-8.2} y={1.3} width={10.4} height={1.2} rx={0.6} fill={COL.sole} />
      </G>
    </G>
  );
}

function Arm({ arm, sleeve }: { arm: { elbow: Pt; wrist: Pt }; sleeve: string }) {
  return (
    <G>
      <Path d={`M${SHOULDER[0]} ${SHOULDER[1]} L${arm.elbow[0]} ${arm.elbow[1]} L${arm.wrist[0]} ${arm.wrist[1]}`} stroke={sleeve} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={arm.wrist[0]} cy={arm.wrist[1]} r={2} fill={COL.skin} />
    </G>
  );
}

/** The man himself. `x, y` is where his feet touch the ground (or, with `ground={false}`, the unshifted figure origin). */
export function Person({ x, y, pose, scale = 1, opacity = 1, ground = true, shadow = true, facing = -1 }: { x: number; y: number; pose: Pose; scale?: number; opacity?: number; ground?: boolean; shadow?: boolean; facing?: 1 | -1 }) {
  const j = joints(pose, ground);
  const w = j.nearArm.wrist;
  return (
    <G transform={`translate(${x} ${y}) scale(${-facing * scale} ${scale})`} opacity={opacity}>
      {shadow ? <Ellipse cx={-1} cy={1} rx={15} ry={2.8} fill="#000" opacity={0.2} /> : null}
      <G transform={`translate(0 ${j.lift})`}>
        <G transform={`rotate(${-pose.lean} ${HIP[0]} ${HIP[1]})`}>
          <Arm arm={j.farArm} sleeve={COL.jacketFar} />
        </G>
        <Leg leg={j.far} jeans={COL.jeansFar} shoe={COL.shoeFar} />
        <Path d={HIPS} fill={COL.jeans} />
        <Leg leg={j.near} jeans={COL.jeans} shoe={COL.shoe} />
        <G transform={`rotate(${-pose.lean} ${HIP[0]} ${HIP[1]})`}>
          <Rect x={-1.9} y={-57.5} width={3.8} height={5} rx={1.4} fill={COL.skinShade} />
          <Path d={TORSO} fill={COL.jacket} />
          <Path d="M-5.6 -36.2 L6.1 -36.2 L6 -33.5 L-5.4 -33.5Z" fill="#2B3C50" />
          <Path d="M-4.9 -52 C-5.6 -46 -5.6 -41 -5.1 -36.5" stroke="#9FB3C8" strokeWidth={0.6} opacity={0.7} fill="none" />
          <Path d="M-2.6 -54.6 L1.8 -54.6 L2.6 -51.4 L-1.4 -51.8Z" fill="#DDE6EE" />
          <G transform={`translate(-0.6 -62.4) rotate(${pose.tilt})`}>
            <Path d={FACE} fill={COL.skin} />
            <Path d={BEARD} fill={COL.hair} opacity={0.85} />
            <Path d={HAIR} fill={COL.hair} />
            <Ellipse cx={2.3} cy={0.8} rx={1.4} ry={2.1} fill={COL.skinShade} />
            <Circle cx={-3.8} cy={-0.6} r={0.65} fill="#1A1210" />
            <Path d="M-5.2 -2.3 L-2.6 -2.6" stroke={COL.hair} strokeWidth={0.8} strokeLinecap="round" />
          </G>
          <Arm arm={j.nearArm} sleeve={COL.jacket} />
          {pose.phone ? (
            <G>
              <Circle cx={w[0] - 1} cy={w[1] - 2} r={7} fill="url(#glowO)" opacity={0.8} />
              <Rect x={w[0] - 2.6} y={w[1] - 5.2} width={3.4} height={6} rx={0.8} fill="#FF8A3D" transform={`rotate(-15 ${w[0]} ${w[1]})`} />
            </G>
          ) : null}
        </G>
      </G>
    </G>
  );
}

/**
 * Bend the near arm so the hand lands on a point in the scene (for a figure drawn at `x, y` with `scale`),
 * e.g. to keep hold of a door handle while the door moves. Out-of-reach points are reached as far as the arm goes.
 */
export function reachTo(p: Pose, x: number, y: number, scale: number, ground: boolean, tx: number, ty: number, facing: 1 | -1 = -1): Pose {
  const { lift } = joints(p, ground);
  const th = rad(-p.lean);
  const rx = SHOULDER[0] - HIP[0];
  const ry = SHOULDER[1] - HIP[1];
  const sx = HIP[0] + rx * Math.cos(th) - ry * Math.sin(th);
  const sy = HIP[1] + rx * Math.sin(th) + ry * Math.cos(th);
  // target relative to the shoulder, in the unscaled, un-leaned torso frame
  const wx = (-facing * (tx - x) - scale * sx) / scale;
  const wy = (ty - (y + scale * (sy + lift))) / scale;
  const dx = wx * Math.cos(-th) - wy * Math.sin(-th);
  const dy = wx * Math.sin(-th) + wy * Math.cos(-th);
  const dist = Math.min(22.8, Math.max(2, Math.hypot(dx, dy)));
  const a0 = (Math.atan2(-dx, dy) * 180) / Math.PI;
  const alpha = (Math.acos(Math.min(1, (144 + dist * dist - 121) / (24 * dist))) * 180) / Math.PI;
  const u = a0 - alpha;
  const [ex, ey] = dir(u, 12);
  const f = (Math.atan2(-(dx - ex), dy - ey) * 180) / Math.PI;
  let e = f - u;
  while (e > 180) e -= 360;
  while (e < -180) e += 360;
  return { ...p, nearArm: u, nearElbow: e };
}

