// Bear's bedtime candle: the last light of the evening, and its clock. It is lit at "Start bedtime",
// sized to tonight's routine, and burns down in real time. The whole picture is lit by it: a warm
// glow that flickers (slowly, ≤ 8% in brightness, well under 3 changes a second for photosensitive
// safety) and a darkness that gathers on the far side of the room as the wax gets shorter.
// At the end the child blows it out with three slow "candle breaths".
// Vega notes: native-driver opacity/scale/rotate only, translate from fixed numbers or interpolate.
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, Image, View} from 'react-native';
import {SvgXml} from '@amazon-devices/react-native-svg';
import LinearGradient from '@amazon-devices/react-linear-gradient';

const GLOW = require('../art/scenes/glow.png');
const VIGNETTE = require('../art/scenes/vignette.png');

const FLAME = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 80" width="40" height="80">
<path d="M20 2 C 28 22, 38 40, 36 56 C 34 70, 27 78, 20 78 C 13 78, 6 70, 4 56 C 2 40, 12 22, 20 2 Z" fill="#FF9A3C" fill-opacity="0.9"/>
<path d="M20 18 C 26 34, 32 46, 30 58 C 28 69, 24 74, 20 74 C 16 74, 12 69, 10 58 C 8 46, 14 34, 20 18 Z" fill="#FFC857"/>
<path d="M20 38 C 24 48, 26 56, 25 63 C 24 69, 22 71, 20 71 C 18 71, 16 69, 15 63 C 14 56, 16 48, 20 38 Z" fill="#FFF3C4"/>
<ellipse cx="20" cy="73" rx="6" ry="4" fill="#7FA6F0" fill-opacity="0.45"/>
</svg>`;

/** Where the candle stands in each room (design units): on a real surface, sized to the room's depth. */
export type CandleSpot = {x: number; base: number; k: number};
export const CANDLE_SPOTS: Record<'teeth' | 'pajamas' | 'story', CandleSpot> = {
  teeth: {x: 905, base: 474, k: 0.7}, // on the sink counter, right of the toothbrush cup
  pajamas: {x: 826, base: 264, k: 0.5}, // on the dresser, left of the plant (further back: smaller)
  story: {x: 806, base: 354, k: 0.72}, // on the nightstand, by the firefly jar (also the goodnight finale)
};
export const spotFor = (scene: string): CandleSpot => (scene === 'teeth' || scene === 'pajamas' ? CANDLE_SPOTS[scene] : CANDLE_SPOTS.story);
const W = 34; // wax width (k = 1)
const H = 118; // a fresh candle (k = 1)
const FLAME_W = 24;
const FLAME_H = 48;

/** Where the flame is (design units) when `burned` of the candle has gone: sparks fly from here. */
export const flameAt = (burned: number, at: CandleSpot) => ({x: at.x, y: at.base - at.k * (H * (1 - 0.86 * Math.min(1, Math.max(0, burned))) + 30)});

type Props = {
  u: number;
  burned: number; // 0 fresh … 1 gone (the routine never takes it past ~0.9)
  room: number; // how much of the room's light is the candle's (0–1): low before the big light goes off
  dark: number; // the darkness gathered away from the candle (0–1)
  size: number; // flame size: 1, smaller after each candle breath, 0 = out
  bend: number; // changes on every breath: the flame bends away and recovers
  at: CandleSpot; // where it stands in this room
  glideMs?: number; // how fast the room's light follows the candle (short when the candle burns fast)
  onOut?: () => void;
};

export const Candle = ({u, burned, room, dark, size, bend, at, glideMs = 3000, onOut}: Props) => {
  const S = (n: number) => n * u;
  const flick = useRef(new Animated.Value(0.5)).current;
  const sz = useRef(new Animated.Value(size)).current;
  const lean = useRef(new Animated.Value(0)).current;
  const roomV = useRef(new Animated.Value(room)).current;
  const darkV = useRef(new Animated.Value(dark)).current;
  const smoke = useRef(new Animated.Value(0)).current;

  // The flicker: slow layered waves plus a little randomness, 140 ms per step. Computed once (~25 s,
  // returning to its start) and looped on the native side: no JS work per step, all evening long,
  // so the bedtime voice (fed from JS) never competes with it.
  useEffect(() => {
    const a = Math.random() * 6;
    const b = Math.random() * 6;
    const STEPS = 180;
    let last = 0.5;
    const targets: number[] = [];
    for (let k = 0; k < STEPS; k++) {
      const t = (k * 140) / 1000;
      const target = 0.5 + 0.22 * Math.sin(t * 1.3 + a) + 0.14 * Math.sin(t * 2.3 + b) + 0.12 * (Math.random() - 0.5);
      last = last + (Math.min(1, Math.max(0, target)) - last) * 0.6;
      targets.push(last);
    }
    targets.push(0.5); // back to where the loop starts
    flick.setValue(0.5);
    const loop = Animated.loop(Animated.sequence(targets.map(v => Animated.timing(flick, {toValue: v, duration: 140, easing: Easing.linear, useNativeDriver: true}))));
    loop.start();
    return () => loop.stop();
  }, [flick]);

  useEffect(() => {
    Animated.timing(roomV, {toValue: room, duration: glideMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true}).start();
    Animated.timing(darkV, {toValue: dark, duration: glideMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true}).start();
  }, [roomV, darkV, room, dark, glideMs]);

  // a candle breath: the flame bends away from the child, shrinks, and settles smaller
  useEffect(() => {
    if (!bend) {
      return;
    }
    Animated.sequence([
      Animated.timing(lean, {toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true}),
      Animated.timing(lean, {toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
    ]).start();
  }, [bend, lean]);

  useEffect(() => {
    if (size > 0) {
      smoke.setValue(0); // relit (Light lab)
      Animated.timing(sz, {toValue: size, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true}).start();
      return;
    }
    // out: the flame shrinks to nothing, a thread of smoke rises
    Animated.parallel([
      Animated.timing(sz, {toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true}),
      Animated.timing(roomV, {toValue: 0, duration: 1200, useNativeDriver: true}),
      Animated.timing(smoke, {toValue: 1, duration: 4200, easing: Easing.out(Easing.quad), useNativeDriver: true}),
    ]).start(() => onOut?.());
  }, [size, sz, roomV, smoke, onOut]);

  const k = at.k;
  const K = (n: number) => S(n * k); // candle-sized lengths
  const h = H * k * (1 - 0.86 * Math.min(1, Math.max(0, burned))); // wax left
  const left = at.x - (W * k) / 2;
  const top = at.base - h; // top of the wax
  const fx = at.x;
  const fy = top - FLAME_H * k * 0.55; // flame centre
  const glowR = 460;

  return (
    <View pointerEvents="none" style={{position: 'absolute', left: 0, top: 0, right: 0, bottom: 0}}>
      {/* the far side of the room sinks into darkness */}
      <Animated.Image source={VIGNETTE} resizeMode="stretch" style={{position: 'absolute', left: 0, top: 0, width: S(960), height: S(540), opacity: darkV}} />

      {/* candlelight on the room: warm, flickering, falling off with distance */}
      <Animated.View style={{position: 'absolute', left: S(fx - glowR), top: S(fy - glowR), opacity: roomV}}>
        <Animated.Image source={GLOW} style={{width: S(glowR * 2), height: S(glowR * 2), opacity: flick.interpolate({inputRange: [0, 1], outputRange: [0.84, 1]})}} />
      </Animated.View>

      {/* the holder: a small brass dish, catching the flame's light on its rim */}
      <View style={{position: 'absolute', left: S(at.x) - K(44), top: S(at.base) - K(6), width: K(88), height: K(20), borderRadius: K(44), backgroundColor: '#6E4519'}} />
      <View style={{position: 'absolute', left: S(at.x) - K(40), top: S(at.base) - K(8), width: K(80), height: K(15), borderRadius: K(40), backgroundColor: '#A8762F'}} />
      <View style={{position: 'absolute', left: S(at.x) - K(26), top: S(at.base) - K(6), width: K(52), height: K(6), borderRadius: K(26), backgroundColor: '#D9A85A'}} />

      {/* the wax: lit from its flame, warm near the top, falling into shadow at the base */}
      <LinearGradient
        colors={['#B89A6E', '#F4E2C2', '#E9D3AC', '#B0936A']}
        locations={[0, 0.35, 0.7, 1]}
        start={{x: 0, y: 0.5}}
        end={{x: 1, y: 0.5}}
        style={{position: 'absolute', left: S(left), top: S(top), width: K(W), height: S(h), borderTopLeftRadius: K(5), borderTopRightRadius: K(5)}}
      />
      <LinearGradient
        colors={['rgba(255,190,90,0.28)', 'rgba(40,22,10,0)', 'rgba(20,10,4,0.45)']}
        locations={[0, 0.35, 1]}
        style={{position: 'absolute', left: S(left), top: S(top), width: K(W), height: S(h), borderTopLeftRadius: K(5), borderTopRightRadius: K(5)}}
      />
      {/* as the room darkens, only the top of the candle and the dish's rim stay lit */}
      <Animated.View style={{position: 'absolute', left: S(left), top: S(top), width: K(W), height: S(h), opacity: darkV}}>
        <LinearGradient colors={['rgba(12,6,2,0)', 'rgba(12,6,2,0.35)', 'rgba(12,6,2,0.8)']} locations={[0, 0.3, 1]} style={{flex: 1, borderTopLeftRadius: K(5), borderTopRightRadius: K(5)}} />
      </Animated.View>
      <Animated.View style={{position: 'absolute', left: S(at.x) - K(44), top: S(at.base) - K(4), width: K(88), height: K(18), borderRadius: K(44), backgroundColor: 'rgba(12,6,2,0.7)', opacity: darkV}} />
      {/* melted pool, lit from the flame */}
      <View style={{position: 'absolute', left: S(left) + K(1), top: S(top) - K(4), width: K(W - 2), height: K(9), borderRadius: K(W / 2), backgroundColor: '#E8C894'}} />
      <Animated.View style={{position: 'absolute', left: S(left) + K(5), top: S(top) - K(2), width: K(W - 10), height: K(5), borderRadius: K(W / 2), backgroundColor: '#FFD27F', opacity: sz.interpolate({inputRange: [0, 1], outputRange: [0, 0.9]})}} />
      {/* wax drips */}
      <View style={{position: 'absolute', left: S(left) + K(3), top: S(top) + K(1), width: K(7), height: Math.min(K(20), S(h) * 0.4), borderRadius: K(4), backgroundColor: '#F2DDB8'}} />
      <View style={{position: 'absolute', left: S(left) + K(W - 11), top: S(top) + K(1), width: K(6), height: Math.min(K(12), S(h) * 0.3), borderRadius: K(3), backgroundColor: '#E8D0A6'}} />
      {/* wick */}
      <View style={{position: 'absolute', left: S(fx) - K(1.3), top: S(top) - K(7), width: K(2.6), height: K(8), borderRadius: K(1.3), backgroundColor: '#3A2618'}} />

      {/* the flame's own halo: the soft glow, not a disc */}
      <Animated.View style={{position: 'absolute', left: S(fx) - K(70), top: S(fy) - K(70), opacity: sz.interpolate({inputRange: [0, 1], outputRange: [0, 0.85]}), transform: [{scale: flick.interpolate({inputRange: [0, 1], outputRange: [0.92, 1.08]})}]}}>
        <Image source={GLOW} style={{width: K(140), height: K(140)}} />
      </Animated.View>

      {/* the flame: sized by the breaths, bending on each one, flickering always (anchored at the wick) */}
      <Animated.View
        style={{
          position: 'absolute',
          left: S(fx) - K(FLAME_W / 2),
          top: S(top) - K(4 + FLAME_H),
          width: K(FLAME_W),
          height: K(FLAME_H),
          transform: [
            {translateY: K(FLAME_H / 2)},
            {rotate: lean.interpolate({inputRange: [0, 1], outputRange: ['0deg', '-24deg']})},
            {scale: sz},
            {translateY: -K(FLAME_H / 2)},
          ],
        }}>
        <Animated.View
          style={{
            width: K(FLAME_W),
            height: K(FLAME_H),
            transform: [
              {translateY: K(FLAME_H / 2)},
              {scaleY: flick.interpolate({inputRange: [0, 1], outputRange: [0.9, 1.1]})},
              {scaleX: flick.interpolate({inputRange: [0, 1], outputRange: [1.05, 0.95]})},
              {rotate: flick.interpolate({inputRange: [0, 1], outputRange: ['-3deg', '3deg']})},
              {translateY: -K(FLAME_H / 2)},
            ],
          }}>
          <SvgXml xml={FLAME} width={K(FLAME_W)} height={K(FLAME_H)} />
        </Animated.View>
      </Animated.View>

      {/* smoke, after it goes out: thin soft wisps that rise, sway and thin out */}
      {[0, 1, 2, 3].map(i => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: S(fx) - K(9),
            top: S(top) - K(26),
            opacity: smoke.interpolate({inputRange: [0, 0.06 + i * 0.1, 0.45 + i * 0.1, 1], outputRange: [0, 0.55 - i * 0.08, 0.25, 0]}),
            transform: [
              {translateY: smoke.interpolate({inputRange: [0, 1], outputRange: [0, -K(120 + i * 40)]})},
              {translateX: smoke.interpolate({inputRange: [0, 0.3, 0.6, 1], outputRange: [0, K(7 - i * 4), -K(5 + i * 2), K(9 - i)]})},
              {scaleX: smoke.interpolate({inputRange: [0, 1], outputRange: [0.5, 1.4 + i * 0.3]})},
              {scaleY: smoke.interpolate({inputRange: [0, 1], outputRange: [1.4, 2.6 + i * 0.4]})},
            ],
          }}>
          <Image source={GLOW} style={{width: K(18), height: K(18), tintColor: '#C9CBD8'}} />
        </Animated.View>
      ))}
    </View>
  );
};
