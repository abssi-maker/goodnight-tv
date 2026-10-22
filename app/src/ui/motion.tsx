// The relaxing motion of the evening. Everything is slow (well under one cycle a second), and it
// slows down as the night goes on. Vega notes: moves use native `translateX/Y` from `interpolate`
// with plain pixel outputs (never `Animated.multiply`, friction #12); SVG uses fill-opacity only.
import React, {memo, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Easing, View} from 'react-native';
import {SvgXml} from '@amazon-devices/react-native-svg';

type Pt = {x: number; y: number};
type Box = {x: number; y: number; w: number; h: number};

/** Small seeded random, so the same firefly always takes the same path. */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** A firefly's light: warm core, soft halo. Sizes in px. */
const Glow = ({s, warm = 1}: {s: number; warm?: number}) => (
  <View style={{width: s, height: s, borderRadius: s / 2, backgroundColor: `rgba(255,214,110,${0.16 * warm})`, alignItems: 'center', justifyContent: 'center'}}>
    <View style={{width: s * 0.55, height: s * 0.55, borderRadius: s * 0.275, backgroundColor: `rgba(255,226,130,${0.38 * warm})`, alignItems: 'center', justifyContent: 'center'}}>
      <View style={{width: s * 0.24, height: s * 0.24, borderRadius: s * 0.12, backgroundColor: 'rgba(255,246,196,0.98)'}} />
    </View>
  </View>
);

type FlyPlan = {xs: number[]; ys: number[]; dur: number; on: number; off: number; size: number; delay: number};

const Fly = ({u, f}: {u: number; f: FlyPlan}) => {
  const t = useRef(new Animated.Value(0)).current;
  const fl = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(t, {toValue: 1, duration: f.dur, easing: Easing.linear, useNativeDriver: true}));
    const b = Animated.loop(
      Animated.sequence([
        Animated.delay(f.delay),
        Animated.timing(fl, {toValue: 1, duration: f.on, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(fl, {toValue: 0.15, duration: f.off, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ]),
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [t, fl, f]);
  const steps = f.xs.map((_, i) => i / (f.xs.length - 1));
  const s = f.size * u;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        opacity: fl,
        transform: [{translateX: t.interpolate({inputRange: steps, outputRange: f.xs.map(x => x * u - s / 2)})}, {translateY: t.interpolate({inputRange: steps, outputRange: f.ys.map(y => y * u - s / 2)})}],
      }}>
      <Glow s={s} />
    </Animated.View>
  );
};

/** Fireflies drifting in a box (design units), on slow looping paths. `slow` stretches every path. */
export const Fireflies = memo(({u, n, box, slow = 1, seed = 7}: {u: number; n: number; box: Box; slow?: number; seed?: number}) => {
  const flies = useMemo(
    () =>
      Array.from({length: n}, (_, i) => {
        const r = rng(seed * 1000 + i * 97);
        const cx = box.x + box.w * (0.15 + 0.7 * r());
        const cy = box.y + box.h * (0.15 + 0.7 * r());
        const ax = box.w * (0.08 + 0.12 * r());
        const ay = box.h * (0.08 + 0.12 * r());
        const p1 = r() * 6.28;
        const p2 = r() * 6.28;
        const K = 12;
        const xs = Array.from({length: K + 1}, (_, k) => cx + ax * Math.sin((2 * Math.PI * k) / K + p1));
        const ys = Array.from({length: K + 1}, (_, k) => cy + ay * Math.sin((4 * Math.PI * k) / K + p2) * 0.7 + ay * 0.3 * Math.cos((2 * Math.PI * k) / K));
        return {xs, ys, dur: (16000 + r() * 12000) * slow, on: 900 + r() * 1400, off: 1200 + r() * 2200, size: 12 + r() * 8, delay: r() * 2500};
      }),
    [n, box.x, box.y, box.w, box.h, slow, seed],
  );
  return (
    <>
      {flies.map((f, i) => (
        <Fly key={i} u={u} f={f} />
      ))}
    </>
  );
});

/** One firefly flying home: lifts out of the jar, loops once, rises and fades into the sky. */
export const Flight = ({u, from, to, onArrive}: {u: number; from: Pt; to: Pt; onArrive?: () => void}) => {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(p, {toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true}).start(() => onArrive?.());
  }, [p, onArrive]);
  const s = 26 * u;
  const mx = (from.x + to.x) / 2;
  const my = Math.min(from.y, to.y) + (Math.abs(from.y - to.y) || 120) * 0.45;
  const ir = [0, 0.18, 0.34, 0.5, 0.75, 1];
  const xs = [from.x, from.x - 26, from.x + 18, mx - 40, mx + 30, to.x];
  const ys = [from.y, from.y - 60, from.y - 96, my, my - 60, to.y];
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        opacity: p.interpolate({inputRange: [0, 0.06, 0.8, 1], outputRange: [0, 1, 1, 0]}),
        transform: [
          {translateX: p.interpolate({inputRange: ir, outputRange: xs.map(x => x * u - s / 2)})},
          {translateY: p.interpolate({inputRange: ir, outputRange: ys.map(y => y * u - s / 2)})},
          {scale: p.interpolate({inputRange: [0, 0.1, 0.85, 1], outputRange: [0.5, 1.25, 1, 1.7]})},
        ],
      }}>
      <Glow s={s} warm={1.3} />
    </Animated.View>
  );
};

const STAR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="22" fill="#FFF3C4" fill-opacity="0.18"/><path d="M50 14 L57 43 L86 50 L57 57 L50 86 L43 57 L14 50 L43 43 Z" fill="#FFF6D6"/></svg>`;

const Star = ({u, p, fresh, seed}: {u: number; p: Pt; fresh: boolean; seed: number}) => {
  const tw = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(fresh ? 0 : 1)).current;
  useEffect(() => {
    const r = rng(seed);
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(tw, {toValue: 1, duration: 1600 + r() * 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
        Animated.timing(tw, {toValue: 0, duration: 1800 + r() * 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      ]),
    );
    a.start();
    if (fresh) {
      Animated.sequence([Animated.delay(2600), Animated.spring(pop, {toValue: 1, friction: 4, tension: 50, useNativeDriver: true})]).start();
    }
    return () => a.stop();
  }, [tw, pop, fresh, seed]);
  const s = 18 * u;
  return (
    <Animated.View
      pointerEvents="none"
      style={{position: 'absolute', left: p.x * u - s / 2, top: p.y * u - s / 2, opacity: pop, transform: [{scale: pop.interpolate({inputRange: [0, 1], outputRange: [0.2, 1]})}]}}>
      {/* nested fades, not Animated.multiply (ignored by Vega's native driver, friction #12) */}
      <Animated.View style={{opacity: tw.interpolate({inputRange: [0, 1], outputRange: [0.55, 1]})}}>
        <SvgXml xml={STAR} width={s} height={s} />
      </Animated.View>
    </Animated.View>
  );
};

/** The fireflies that went home tonight, as stars in the sky; the newest one appears with a pop. */
export const Stars = ({u, points, count, fresh = -1}: {u: number; points: Pt[]; count: number; fresh?: number}) => (
  <>
    {points.slice(0, count).map((p, i) => (
      <Star key={i} u={u} p={p} fresh={i === fresh} seed={i * 31 + 5} />
    ))}
  </>
);

/** Breathe with Bear: a soft light grows for 4 s (in) and settles for 6 s (out). No words. */
export const Breath = ({u, x, y}: {u: number; x: number; y: number}) => {
  const v = useRef(new Animated.Value(0)).current;
  const show = useRef(new Animated.Value(0)).current;
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  useEffect(() => {
    Animated.timing(show, {toValue: 1, duration: 1200, useNativeDriver: true}).start();
    let alive = true;
    let id: ReturnType<typeof setTimeout>;
    const cycle = (inhale: boolean) => {
      if (!alive) {
        return;
      }
      setPhase(inhale ? 'in' : 'out');
      Animated.timing(v, {toValue: inhale ? 1 : 0, duration: inhale ? 4000 : 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true}).start();
      id = setTimeout(() => cycle(!inhale), inhale ? 4000 : 6000);
    };
    cycle(true);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [v, show]);
  const S = (n: number) => n * u;
  const R = 120;
  return (
    <Animated.View pointerEvents="none" style={{position: 'absolute', left: S(x - R), top: S(y - R), width: S(2 * R), height: S(2 * R), alignItems: 'center', justifyContent: 'center', opacity: show}}>
      <Animated.View style={{position: 'absolute', width: S(2 * R), height: S(2 * R), borderRadius: S(R), backgroundColor: 'rgba(255,220,140,0.10)', transform: [{scale: v.interpolate({inputRange: [0, 1], outputRange: [0.45, 1]})}]}} />
      <Animated.View style={{position: 'absolute', width: S(1.3 * R), height: S(1.3 * R), borderRadius: S(0.65 * R), backgroundColor: 'rgba(255,226,150,0.14)', transform: [{scale: v.interpolate({inputRange: [0, 1], outputRange: [0.5, 1]})}]}} />
      <View accessible aria-label={phase === 'in' ? 'Breathe in' : 'Breathe out'} style={{width: S(10), height: S(10), borderRadius: S(5), backgroundColor: 'rgba(255,246,196,0.9)'}} />
    </Animated.View>
  );
};

/** Bear blinks now and then: a fur-coloured lid over each painted eye, for a moment. */
export const Blink = ({u, eyes, fur}: {u: number; eyes: Array<{x: number; y: number; r: number}>; fur: string}) => {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    let alive = true;
    const next = () => {
      id = setTimeout(() => {
        if (!alive) {
          return;
        }
        const twice = Math.random() < 0.2;
        const one = [Animated.timing(v, {toValue: 1, duration: 70, useNativeDriver: true}), Animated.delay(90), Animated.timing(v, {toValue: 0, duration: 120, useNativeDriver: true})];
        Animated.sequence(twice ? [...one, Animated.delay(140), ...one] : one).start(next);
      }, 3500 + Math.random() * 4000);
    };
    next();
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [v]);
  return (
    <>
      {eyes.map((e, i) => (
        <Animated.View key={i} pointerEvents="none" style={{position: 'absolute', left: (e.x - e.r * 1.25) * u, top: (e.y - e.r * 1.25) * u, width: e.r * 2.5 * u, height: e.r * 2.5 * u, opacity: v, alignItems: 'center', justifyContent: 'center'}}>
          <View style={{position: 'absolute', width: e.r * 2.5 * u, height: e.r * 2.5 * u, borderRadius: e.r * 1.25 * u, backgroundColor: fur}} />
          <View style={{width: e.r * 1.9 * u, height: Math.max(1.5, e.r * 0.3) * u, borderRadius: e.r * u, backgroundColor: '#3E2412', marginTop: e.r * 0.5 * u}} />
        </Animated.View>
      ))}
    </>
  );
};
