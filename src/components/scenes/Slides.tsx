import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { C, F } from '../../theme';
import { clamp01, driveInOut, ease, seeded, useTicker } from '../../lib/anim';
import { CarDefs, DOOR_HANDLE, doorPoint, SideCar, TopCar } from '../cars';
import { blendPose, IDLE, joints, Person, Pose, reachTo, walkPose } from '../person';
import { T } from '../ui';

// All slide scenes draw in a 390 x 844 viewBox that is cropped to fill the screen.
const VW = 390;
const VH = 844;

function Skyline({ base, color, seed, tower }: { base: number; color: string; seed: number; tower?: number }) {
  const rects = useMemo(() => {
    const r = seeded(seed);
    const out: { x: number; y: number; w: number; h: number }[] = [];
    let x = -10;
    while (x < VW + 10) {
      const w = 18 + r() * 34;
      const h = 50 + r() * 150;
      out.push({ x, y: base - h, w, h: h + 400 });
      x += w + 2;
    }
    return out;
  }, [base, seed]);
  return (
    <G>
      {rects.map((b, i) => (
        <Rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={color} />
      ))}
      {tower ? (
        <G>
          <Rect x={tower - 4} y={base - 330} width={8} height={340} fill={color} />
          <Rect x={tower - 2} y={base - 420} width={4} height={92} fill={color} />
          <Path d={`M${tower - 17} ${base - 250} a17 11 0 1 0 34 0 a17 11 0 1 0 -34 0`} fill={color} />
          <Rect x={tower - 9} y={base - 270} width={18} height={10} rx={3} fill={color} />
        </G>
      ) : null}
    </G>
  );
}

function Stars({ n, seed, t }: { n: number; seed: number; t: number }) {
  const stars = useMemo(() => {
    const r = seeded(seed);
    return Array.from({ length: n }, () => ({ x: r() * VW, y: r() * 420, r: r() * 1.6 + 0.4, p: r() * 6, s: 2 + r() * 3 }));
  }, [n, seed]);
  return (
    <G>
      {stars.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={0.25 + 0.75 * Math.abs(Math.sin(t / s.s + s.p))} />
      ))}
    </G>
  );
}

/** Slide 1: dusk over Toronto, the GORIDES car drives in from the left, cruises, then drives off right before the slide changes. */
export function CityScene({ active, dur = 0 }: { active: boolean; dur?: number }) {
  const t = useTicker(active);
  const dash = (t * 90) % 56;
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice">
      <CarDefs />
      <Defs>
        <LinearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2A1640" />
          <Stop offset="0.45" stopColor="#C4456A" />
          <Stop offset="0.75" stopColor="#FF9A3C" />
        </LinearGradient>
      </Defs>
      <Rect width={VW} height={VH} fill="#1A0D1F" />
      <G transform="translate(0 -241)">
        <Rect width={VW} height={VH} fill="url(#g1)" />
        <Circle cx={270} cy={410} r={80} fill="#FFD28F" opacity={0.95} />
        <G opacity={0.55}>
          <Skyline base={579} color="#6B2E55" seed={7} />
        </G>
        <Skyline base={619} color="#2A1330" seed={3} tower={110} />
        <Rect y={619} width={VW} height={620} fill="#1A0D1F" />
        <Path d={`M${-20 - dash} 700 H${VW + 60}`} stroke="#FFB36B" strokeWidth={5} strokeDasharray="30 26" />
        <SideCar x={driveInOut(t, 90, dur, { from: -300, to: 480 })} y={600 - 2 * Math.abs(Math.sin(t * 6))} scale={1.15} heads={3} wheelDeg={t * 800} moving t={t} />
      </G>
    </Svg>
  );
}

/** Slide 2: the car pulls up from the left, stops, the passenger gets in, then the car drives off right. */
const STAND: Pose = { ...IDLE, nearArm: 4, nearElbow: 14, tilt: 0, phone: false };
const DUCK: Pose = { nearHip: 35, nearKnee: 55, farHip: 5, farKnee: 35, nearArm: 80, nearElbow: 30, farArm: 30, farElbow: 40, lean: 42, tilt: 12, phone: false };
const SIT: Pose = { nearHip: 88, nearKnee: 88, farHip: 84, farKnee: 84, nearArm: 30, nearElbow: 55, farArm: 25, farElbow: 55, lean: 4, tilt: 0, phone: false };

export function PickupScene({ active, statusTop }: { active: boolean; statusTop?: number }) {
  const raw = useTicker(active);
  const t = Math.min(raw, 9.9);
  const road = VH * 0.36;
  const wheel = VH * 0.43;
  const walkY = VH * 0.485;
  const stopX = VW * 0.5 - 130;
  const pinX = stopX + 14;
  const standX = stopX + 70;
  const MAN = 1.18; // a grown man stands a head taller than the sedan's roof
  const curbY = wheel + 17;
  const carY = wheel - 67.5;

  let carX: number;
  let moving = false;
  let brake = false;
  if (t < 2.6) {
    const k = ease.out(t / 2.6);
    carX = -230 + (stopX + 230) * k;
    moving = k < 0.97;
    brake = t > 1.6;
  } else if (t < 6.75) {
    carX = stopX;
    brake = true;
  } else {
    const k = ease.in(clamp01(t, 6.75, 9.1));
    carX = stopX + (VW + 80 - stopX) * k;
    moving = k > 0.02;
  }
  const wheelDeg = ((carX / 13.5) * 180) / Math.PI;
  // he walks in from the left to the rear door, takes the handle and steps back as the door swings out towards him,
  // then steps up into the opening, ducks under the roof and sits facing forward; then the door swings shut
  const door = t < 4.45 ? 0 : t < 5.15 ? ease.inOut(clamp01(t, 4.45, 5.15)) : t < 6.25 ? 1 : t < 6.65 ? 1 - ease.inOut(clamp01(t, 6.25, 6.65)) : 0;
  const onboard = t >= 6.6 && t < 9.1;
  const handle = (k: number): [number, number] => {
    const [hx, hy] = doorPoint(k, DOOR_HANDLE);
    return [carX + hx, carY + hy];
  };

  let man: React.ReactNode = null;
  let rider: React.ReactNode = null;
  let riderCut = 200;
  const backY = curbY + 8;
  if (t < 2.8 || t >= 9.2) {
    man = <Person x={pinX} y={walkY} pose={IDLE} scale={MAN} facing={1} opacity={t >= 9.2 ? clamp01(t, 9.2, 9.9) : 1} />;
  } else if (t < 5.15) {
    // walk to the curb by the rear door, take the handle, and step back with it as the door swings out
    const k = ease.inOut(clamp01(t, 2.8, 4.2));
    const back = ease.inOut(clamp01(t, 4.55, 5.0));
    const px = pinX + (standX - pinX) * k;
    const py = walkY + (curbY - walkY) * k + (backY - curbY) * back;
    let pose = blendPose(IDLE, walkPose(((px - pinX) / 26) * Math.PI), clamp01(t, 2.8, 3.05));
    pose = blendPose(pose, STAND, clamp01(t, 4.0, 4.25));
    const [hx, hy] = handle(door);
    const grip = ease.inOut(clamp01(t, 4.2, 4.45)) * (1 - ease.inOut(clamp01(t, 4.95, 5.15)));
    pose = blendPose(pose, reachTo({ ...STAND, lean: 6 }, px, py, MAN, true, hx, hy, 1), grip);
    man = <Person x={px} y={py} pose={pose} scale={MAN} facing={1} />;
  } else if (t < 5.45) {
    // let go and step up into the opening, between the open door and the car
    const k = ease.inOut(clamp01(t, 5.15, 5.45));
    const pose = blendPose(STAND, walkPose(k * Math.PI), Math.sin(k * Math.PI) * 0.7);
    rider = <Person x={standX} y={backY + (curbY - backY) * k} pose={pose} scale={MAN} facing={1} />;
  } else if (t < 6.65) {
    // duck under the roof and lower onto the rear seat, ending where the seated head sits behind the glass
    const k = clamp01(t, 5.45, 6.2);
    const e = ease.inOut(k);
    const s = MAN + (0.82 - MAN) * e;
    const pose = k < 0.45 ? blendPose(STAND, DUCK, ease.inOut(k / 0.45)) : blendPose(DUCK, SIT, ease.inOut((k - 0.45) / 0.55));
    const stand = joints(STAND, true).lift;
    const hip0: [number, number] = [standX, curbY + MAN * (stand - 34)];
    const hip1: [number, number] = [carX + 70.5, carY + 43.5];
    const hx = hip0[0] + (hip1[0] - hip0[0]) * e;
    const hy = hip0[1] + (hip1[1] - hip0[1]) * e;
    riderCut = 200 + (47 - 200) * ease.inOut(clamp01(k, 0.1, 0.6));
    rider = <Person x={hx} y={hy + 34 * s} pose={pose} scale={s} ground={false} shadow={false} facing={1} />;
  }
  const pr = (raw % 1.4) / 1.4;
  const bob = Math.sin(raw * 3) * 4;
  const showPin = t < 5.6 || t > 9.2;
  const step = t < 2.6 ? 0 : t < 5.45 ? 1 : t < 6.75 ? 2 : 3;
  const STATUS = [
    ['Driver arriving', 'Priya · Orange EV · 1 min away'],
    ['Your driver is here', 'Walk to the car at the pickup pin'],
    ['Passenger on board', 'Door closing · seat 2'],
    ['On the way', 'Brampton → Pearson T1 · 32 min'],
  ];

  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice">
        <CarDefs />
        <Defs>
          <LinearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#5FB4F2" />
            <Stop offset="0.5" stopColor="#FFE3C6" />
          </LinearGradient>
        </Defs>
        <G transform="translate(0 74)">
        <Rect y={-120} width={VW} height={120} fill="#5FB4F2" />
        <Rect width={VW} height={VH} fill="url(#g2)" />
        <Circle cx={VW * 0.78} cy={VH * 0.3} r={30} fill="#FFF4DA" />
        <Skyline base={road} color="#A9BCDD" seed={17} />
        <Skyline base={road} color="#6F86B0" seed={29} />
        <Rect y={road} width={VW} height={wheel - road + 14} fill="#2A2B36" />
        {Array.from({ length: 9 }, (_, i) => (
          <Rect key={i} x={8 + i * 46} y={road + 10} width={24} height={3} fill="#fff" opacity={0.6} />
        ))}
        <Rect y={wheel + 14} width={VW} height={5} fill="#E7E1DA" />
        <Rect y={wheel + 19} width={VW} height={VH} fill="#C9C2BA" />
        {showPin ? (
          <G>
            <Path d={`M${pinX - (10 + pr * 26)} ${walkY + 2} a${10 + pr * 26} ${3 + pr * 8} 0 1 0 ${2 * (10 + pr * 26)} 0 a${10 + pr * 26} ${3 + pr * 8} 0 1 0 ${-2 * (10 + pr * 26)} 0`} stroke={C.o} strokeWidth={2} fill="none" opacity={0.7 * (1 - pr)} />
            <Circle cx={pinX} cy={walkY - 90 + bob} r={22} fill="url(#glowO)" />
            <Path d={`M${pinX} ${walkY - 74 + bob} L${pinX - 9} ${walkY - 90 + bob} A11 11 0 1 1 ${pinX + 9} ${walkY - 90 + bob} Z`} fill={C.o} />
            <Circle cx={pinX} cy={walkY - 96 + bob} r={4.5} fill="#fff" />
          </G>
        ) : null}
        <SideCar x={carX} y={carY} wheelDeg={wheelDeg} heads={onboard ? 2 : 1} moving={moving} brake={brake} door={door} t={raw} rider={rider} riderCut={riderCut} />
        {man}
        </G>
      </Svg>
      <View style={[styles.status, statusTop !== undefined && { top: statusTop }]}>
        <View style={styles.statusIc}>
          <Svg width={40} height={40} viewBox="-20 -20 40 40">
            <CarDefs />
            <TopCar x={0} y={0} deg={step === 3 ? 0 : -90} scale={0.62} color="#FFFFFF" beam={false} />
          </Svg>
        </View>
        <View style={{ flex: 1 }}>
          <T w="xbold" size={15}>
            {STATUS[step][0]}
          </T>
          <T w="semi" size={12} color={C.muted}>
            {STATUS[step][1]}
          </T>
        </View>
        <View style={styles.statusBar}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.statusSeg, { backgroundColor: i <= step ? C.o : '#EAE5E1' }]} />
          ))}
        </View>
      </View>
    </View>
  );
}

/** Slide 3: the trip cost counts up, splits into equal shares and drops onto everyone in the car, driver included. */
const SPLIT_TOTAL = 152;
const SPLIT_PEOPLE = [
  { name: 'You', role: 'Driver', init: 'Y', c: C.o },
  { name: 'Anu', role: 'Rider', init: 'P', c: '#6C5CE7' },
  { name: 'Chloe', role: 'Rider', init: 'N', c: '#00A884' },
  { name: 'Tom', role: 'Rider', init: 'T', c: '#E84393' },
];
const SPLIT_LOOP = 9;
const unit = (v: number) => Math.min(1, Math.max(0, v));

export function SplitScene({ active, dur = 0 }: { active: boolean; dur?: number }) {
  const T0 = useTicker(active);
  // plays once per visit; holds on the last frame if the slide stays open a moment longer
  const t = Math.min(T0, SPLIT_LOOP - 0.01);
  const n = SPLIT_PEOPLE.length;
  const share = SPLIT_TOTAL / n;
  // the road and roadside posts slide left at the car's speed so the car reads as driving right
  const ROAD = 170;
  const dash = (T0 * ROAD) % 48;
  const posts = [0, 1, 2, 3].map((i) => ((((i * 130 - T0 * ROAD) % 520) + 520) % 520) - 40);
  const fade = 1 - unit((t - 8.5) / 0.5);
  const count = ease.out(unit(t / 1.4));
  const gap = 10 * ease.inOut(unit((t - 1.6) / 1));
  const avatarsIn = ease.out(unit((t - 1.4) / 0.6));
  const big = t < 1.5 ? `$${Math.round(SPLIT_TOTAL * count)}` : t < 3 ? `$${SPLIT_TOTAL} ÷ ${n}` : `$${share} each`;
  const sub = t < 1.5 ? 'Fuel $118 + 407 tolls $34' : t < 3 ? `Shared by ${n} people in the car` : 'The driver pays the same share';
  const BAR = { x: 40, y: 252, w: 310, h: 16 };
  const seg = BAR.w / n;
  const cx = (i: number) => 60 + i * 90;
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice">
      <CarDefs />
      <Defs>
        <LinearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0B1230" />
          <Stop offset="0.55" stopColor="#2E2C6E" />
          <Stop offset="1" stopColor="#0B0E22" />
        </LinearGradient>
      </Defs>
      <Rect width={VW} height={VH} fill="#0B0E22" />
      <Rect width={VW} height={470} fill="url(#g3)" />
      <Stars n={50} seed={5} t={T0} />
      <Skyline base={378} color="#1A1E45" seed={11} />
      <Rect y={378} width={VW} height={VH} fill="#0B0E22" />
      <Path d={`M${-20 - dash} 452 H${VW + 60}`} stroke="#8C8FB8" strokeWidth={4} strokeDasharray="26 22" />
      {posts.map((x, i) => (
        <G key={i}>
          <Rect x={x} y={410} width={4} height={24} rx={2} fill="#3A3F66" />
          <Rect x={x - 0.5} y={413} width={5} height={5} rx={1} fill="#FFB27A" />
        </G>
      ))}
      <SideCar x={driveInOut(T0, 96, dur)} y={369.5 + 1.2 * Math.sin(T0 * 16)} heads={4} wheelDeg={T0 * 1000} moving t={T0} />

      <G opacity={fade}>
        <Rect x={24} y={138} width={342} height={100} rx={20} fill="#fff" />
        <SvgLabel x={44} y={164} size={11} color={C.muted} text="TRIP COST · TORONTO → OTTAWA" />
        <SvgLabel x={44} y={204} size={t < 1.5 ? 34 : 30} color={t >= 3 ? C.oDeep : C.ink} text={big} />
        <SvgLabel x={44} y={226} size={12} color={C.muted} text={sub} />
        <G transform={`translate(330 188) scale(${t >= 3 ? 1 + 0.08 * Math.sin(t * 4) : 1})`}>
          <Circle r={22} fill={C.oSoft} />
          <SvgLabel x={0} y={6} size={16} color={C.oDeep} text={`÷${n}`} anchor="middle" />
        </G>

        {SPLIT_PEOPLE.map((p, i) => {
          const d = ease.inOut(unit((t - 3 - i * 0.45) / 0.6));
          const x0 = BAR.x + i * seg + gap / 2;
          const w0 = seg - gap;
          const x1 = cx(i) - 32;
          const x = x0 + (x1 - x0) * d;
          const w = w0 + (64 - w0) * d;
          const y = BAR.y + (284 - BAR.y) * d;
          const h = BAR.h + (26 - BAR.h) * d;
          const landed = d >= 1;
          return (
            <G key={p.name}>
              <G opacity={avatarsIn} transform={`translate(0 ${(1 - avatarsIn) * 14})`}>
                <Circle cx={cx(i)} cy={334} r={23} fill={p.c} stroke={i === 0 ? '#FFD2AE' : 'rgba(255,255,255,0.35)'} strokeWidth={i === 0 ? 3 : 2} />
                <SvgLabel x={cx(i)} y={340} size={17} color="#fff" text={p.init} anchor="middle" />
                <SvgLabel x={cx(i)} y={370} size={13} color="#fff" text={p.name} anchor="middle" />
                <SvgLabel x={cx(i)} y={383} size={10} color={i === 0 ? '#FFB27A' : 'rgba(255,255,255,0.6)'} text={p.role.toUpperCase()} anchor="middle" />
              </G>
              {landed ? <Circle cx={cx(i)} cy={297} r={24 + 10 * unit((t - 3.6 - i * 0.45) / 0.5)} fill="url(#glowO)" opacity={1 - unit((t - 3.6 - i * 0.45) / 0.8)} /> : null}
              <Rect x={x} y={y} width={w} height={h} rx={h / 2} fill={C.o} />
              {landed ? <SvgLabel x={cx(i)} y={302} size={14} color="#fff" text={`$${share}`} anchor="middle" /> : null}
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

function SvgLabel({ x, y, size, color, text, anchor = 'start' }: { x: number; y: number; size: number; color: string; text: string; anchor?: 'start' | 'middle' }) {
  return (
    <SvgText x={x} y={y} fontSize={size} fill={color} fontFamily={F.xbold} textAnchor={anchor}>
      {text}
    </SvgText>
  );
}

/** Slide 4: a looping 20 second explainer that plays like a video. */
export function VideoScene({ time, dur = 0 }: { time: number; dur?: number }) {
  const t = time;
  const sp = t * 120;
  const phase = t < 6 ? 0 : t < 13 ? 1 : 2;
  const top = ['#FF9A4A', '#6EC3F5', '#1B1F4A'][phase];
  const mid = ['#FFD7A8', '#DDF1FF', '#6A3E8C'][phase];
  const H = VH;
  const hill = (k: number, y: number, amp: number) => {
    let d = `M0 ${H}`;
    for (let x = 0; x <= VW; x += 10) d += ` L${x} ${y + Math.sin((x + sp * k) / 70) * amp + Math.sin((x + sp * k) / 31) * amp * 0.4}`;
    return d + ` L${VW} ${H}Z`;
  };
  const horizon = H * 0.46;
  const trees = Array.from({ length: 12 }, (_, i) => {
    const x = ((((i * 90 - sp * 0.8) % 1080) + 1080) % 1080) - 60;
    return { x, h: 62 + ((i * 37) % 48), kind: (i * 7) % 3 };
  });
  const TREE = [
    { dark: '#2E5E2F', light: '#4F8F45', trunk: '#5A3A22', grass: '#3E7A38' },
    { dark: '#2F6B3A', light: '#56A456', trunk: '#6B4226', grass: '#4B8F44' },
    { dark: '#141C33', light: '#1F2B48', trunk: '#110D20', grass: '#151A30' },
  ][phase];
  const dashOff = (sp * 2) % 60;
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice">
      <CarDefs />
      <Defs>
        <LinearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="0.6" stopColor={mid} />
        </LinearGradient>
      </Defs>
      <Rect width={VW} height={VH} fill="url(#gv)" />
      <Circle cx={VW * 0.75} cy={H * 0.2} r={38} fill={phase === 2 ? '#FFE7B0' : '#FFF4D6'} />
      <Path d={hill(0.2, H * 0.34, 18)} fill={phase === 2 ? '#3A2E6B' : '#F2A36B'} />
      <Path d={hill(0.45, H * 0.4, 14)} fill={phase === 2 ? '#2A2555' : '#E07A3A'} />
      <Rect y={horizon - 6} width={VW} height={10} fill={TREE.grass} />
      {trees.map((tr, i) => (
        <RoadsideTree key={i} x={tr.x + 13} base={horizon} h={tr.h} kind={tr.kind} c={TREE} />
      ))}
      <Rect y={horizon} width={VW} height={H - horizon} fill="#24222C" />
      <Path d={`M${-dashOff} ${H * 0.53 + 2.5} H${VW + 60}`} stroke="#FFD66B" strokeWidth={5} strokeDasharray="32 28" />
      <SideCar x={driveInOut(t, VW * 0.5 - 99, dur)} y={horizon - 8 + Math.sin(t * 14)} wheelDeg={t * 800} heads={phase + 1} moving t={t} />
    </Svg>
  );
}

/** A tree standing at the roadside: a pine, a round leafy tree or a tall poplar, with a lit side and a shaded side. */
function RoadsideTree({ x, base, h, kind, c }: { x: number; base: number; h: number; kind: number; c: { dark: string; light: string; trunk: string } }) {
  if (kind === 0) {
    const w = h * 0.5;
    return (
      <G>
        <Rect x={x - 3} y={base - h * 0.2} width={6} height={h * 0.2} fill={c.trunk} />
        {[0, 1, 2].map((k) => {
          const top = base - h + k * h * 0.22;
          const bot = base - h * 0.14 - (2 - k) * h * 0.2;
          const hw = (w / 2) * (0.6 + k * 0.2);
          return (
            <G key={k}>
              <Path d={`M${x} ${top} L${x + hw} ${bot} L${x - hw} ${bot}Z`} fill={c.dark} />
              <Path d={`M${x} ${top} L${x} ${bot} L${x - hw} ${bot}Z`} fill={c.light} />
            </G>
          );
        })}
      </G>
    );
  }
  if (kind === 1) {
    const r = h * 0.26;
    return (
      <G>
        <Path d={`M${x - 3.5} ${base} L${x - 2.5} ${base - h * 0.5} L${x + 2.5} ${base - h * 0.5} L${x + 3.5} ${base}Z`} fill={c.trunk} />
        <Path d={`M${x} ${base - h * 0.42} L${x - r * 0.6} ${base - h * 0.62} M${x} ${base - h * 0.45} L${x + r * 0.5} ${base - h * 0.66}`} stroke={c.trunk} strokeWidth={2.5} strokeLinecap="round" />
        <Circle cx={x - r * 0.6} cy={base - h * 0.62} r={r * 0.8} fill={c.dark} />
        <Circle cx={x + r * 0.65} cy={base - h * 0.6} r={r * 0.75} fill={c.dark} />
        <Circle cx={x} cy={base - h + r} r={r} fill={c.dark} />
        <Circle cx={x - r * 0.35} cy={base - h + r * 1.05} r={r * 0.62} fill={c.light} />
        <Circle cx={x - r * 0.8} cy={base - h * 0.64} r={r * 0.45} fill={c.light} />
      </G>
    );
  }
  const rw = h * 0.14;
  return (
    <G>
      <Rect x={x - 2.5} y={base - h * 0.16} width={5} height={h * 0.16} fill={c.trunk} />
      <Path d={`M${x} ${base - h} C${x + rw * 1.4} ${base - h * 0.75} ${x + rw * 1.3} ${base - h * 0.3} ${x} ${base - h * 0.13} C${x - rw * 1.3} ${base - h * 0.3} ${x - rw * 1.4} ${base - h * 0.75} ${x} ${base - h}Z`} fill={c.dark} />
      <Path d={`M${x} ${base - h} C${x - rw * 1.4} ${base - h * 0.75} ${x - rw * 1.3} ${base - h * 0.3} ${x} ${base - h * 0.13}Z`} fill={c.light} />
    </G>
  );
}

const styles = StyleSheet.create({
  status: { position: 'absolute', left: 24, right: 24, top: '13%', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 18, paddingTop: 14, paddingHorizontal: 14, paddingBottom: 26, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIc: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.o, alignItems: 'center', justifyContent: 'center', shadowColor: C.o, shadowOpacity: 0.7, shadowRadius: 10, elevation: 6 },
  statusBar: { position: 'absolute', left: 14, right: 14, bottom: 12, flexDirection: 'row', gap: 6 },
  statusSeg: { flex: 1, height: 5, borderRadius: 3 },
});
