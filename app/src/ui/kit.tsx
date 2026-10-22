import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {TVFocusGuideView, useTVEventHandler} from '@amazon-devices/react-native-kepler';
import LinearGradient from '@amazon-devices/react-linear-gradient';
import {C, FONT, TYPE} from '../theme';
import type {SceneKey} from '../routine';
import {Icon} from './icons';
import {Blink, Fireflies} from './motion';

export const ART: Record<SceneKey, any> = {
  tonight: require('../art/scenes/tonight.jpg'),
  teeth: require('../art/scenes/teeth.jpg'),
  pajamas: require('../art/scenes/pajamas.jpg'),
  pajamasDark: require('../art/scenes/pajamas-dark.jpg'), // same room, lamp off, moonlight
  story: require('../art/scenes/story.jpg'),
  storyDark: require('../art/scenes/story-dark.jpg'), // same room, jar nearly empty, Bear asleep
  goodnight: require('../art/scenes/goodnight.jpg'),
  sounds: require('../art/scenes/sounds.jpg'),
};
export const BEAR_BUNNY = require('../art/scenes/bearbunny.png');

/** Mean luma of each frame (ffmpeg signalstats YAVG), for honest screen-light numbers. */
export const ART_LUMA: Record<SceneKey, number> = {tonight: 61.2, teeth: 74.8, pajamas: 71.6, pajamasDark: 48.4, story: 61.1, storyDark: 31.1, goodnight: 33.4, sounds: 58.3};

/** Bear's painted eyes (design units) and the fur around them, where he is awake and facing us. */
const EYES: Partial<Record<SceneKey, {eyes: Array<{x: number; y: number; r: number}>; fur: string}>> = {
  tonight: {eyes: [{x: 649.6, y: 226, r: 6.6}, {x: 706, y: 238, r: 6.4}], fur: '#C67C3C'},
};

/** Where the firefly jar glows in each frame (design units), if it is in the picture. */
const JAR: Partial<Record<SceneKey, {x: number; y: number; r: number}>> = {
  tonight: {x: 720, y: 352, r: 46},
  story: {x: 858, y: 272, r: 40},
  sounds: {x: 784, y: 406, r: 44},
};

export const text = (u: number) =>
  StyleSheet.create({
    eyebrow: {fontFamily: FONT.body, fontSize: TYPE.eyebrow * u, color: C.soft},
    title: {fontFamily: FONT.display, fontSize: TYPE.title * u, lineHeight: TYPE.title * 1.08 * u, color: C.ink, textShadowColor: 'rgba(5,8,25,0.55)', textShadowRadius: 10 * u},
    h2: {fontFamily: FONT.display, fontSize: TYPE.h2 * u, lineHeight: TYPE.h2 * 1.15 * u, color: C.ink},
    sub: {fontFamily: FONT.body, fontSize: TYPE.sub * u, lineHeight: TYPE.sub * 1.4 * u, color: C.soft, textShadowColor: 'rgba(5,8,25,0.6)', textShadowRadius: 8 * u},
    body: {fontFamily: FONT.body, fontSize: TYPE.body * u, lineHeight: TYPE.body * 1.35 * u, color: C.soft},
  });

const loop = (v: Animated.Value, ms: number, delay = 0) =>
  Animated.loop(
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, {toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
      Animated.timing(v, {toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true}),
    ]),
  );

/**
 * One frame of the scene: fades in over the previous one and breathes very slowly. `alt` is the same
 * picture later in the night (lamp off, Bear asleep); `altV` cross-fades to it.
 */
const Frame = ({scene, alt, altV, u, glow, night, onShown}: {scene: SceneKey; alt?: SceneKey; altV: Animated.Value | number; u: number; glow: number; night: number; onShown: () => void}) => {
  const fade = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, {toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: true}).start(() => onShown());
    const a = loop(breathe, 6000);
    const b = loop(pulse, 2200);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [fade, breathe, pulse, onShown]);
  const jar = JAR[scene];
  const eyes = EYES[scene];
  const full = {left: 0, top: 0, width: 960 * u, height: 540 * u};
  return (
    <Animated.View style={[st.fill, {opacity: fade}]}>
      <Animated.View style={[st.abs, full, {transform: [{scale: breathe.interpolate({inputRange: [0, 1], outputRange: [1, 1.012]})}]}]}>
        {/* Explicit size: on Vega an Image anchored by left/top/right/bottom draws at its pixel size. */}
        <Image source={ART[scene]} resizeMode="cover" style={[st.abs, full]} />
        {alt && <Animated.Image source={ART[alt]} resizeMode="cover" style={[st.abs, full, {opacity: altV}]} />}
        {eyes && <Blink u={u} eyes={eyes.eyes} fur={eyes.fur} />}
      </Animated.View>
      {jar && glow > 0 && (
        <Animated.View pointerEvents="none" style={[st.abs, {left: (jar.x - jar.r) * u, top: (jar.y - jar.r) * u, opacity: pulse.interpolate({inputRange: [0, 1], outputRange: [0.3 * glow, 0.75 * glow]})}]}>
          <View style={{width: jar.r * 2 * u, height: jar.r * 2 * u, borderRadius: jar.r * u, backgroundColor: 'rgba(255,214,110,0.16)', alignItems: 'center', justifyContent: 'center'}}>
            <View style={{width: jar.r * 1.2 * u, height: jar.r * 1.2 * u, borderRadius: jar.r * 0.6 * u, backgroundColor: 'rgba(255,224,130,0.22)'}} />
          </View>
        </Animated.View>
      )}
      {scene === 'tonight' && (
        <>
          <Fireflies u={u} n={6} box={{x: 60, y: 300, w: 520, h: 190}} seed={3} />
          <Fireflies u={u} n={5} box={{x: 560, y: 240, w: 380, h: 250}} seed={11} />
        </>
      )}
      {(scene === 'story' || scene === 'pajamas') && night < 0.9 && <Fireflies u={u} n={3} box={{x: 600, y: 120, w: 300, h: 260}} slow={1.6} seed={21} />}
    </Animated.View>
  );
};

/**
 * The picture behind every screen. `dim` (0–1) is the night: a black veil over the art that only
 * ever deepens during the routine, with a little warmth added as it goes (the blue leaves first, like
 * a sunset). `alt`/`altAmount` cross-fade to the same picture later in the night. `shade` darkens the
 * left side so text always reads.
 */
export const Scene = ({
  scene,
  u,
  dim,
  dimMs = 2500,
  glow = 1,
  shade = true,
  alt,
  altAmount = 0,
  altMs = 4000,
  warm: warmTo,
}: {
  scene: SceneKey;
  u: number;
  dim: number;
  dimMs?: number;
  glow?: number;
  shade?: boolean;
  alt?: SceneKey;
  altAmount?: number;
  altMs?: number;
  warm?: number; // the amber of candlelight laid over the picture (0–0.4); by default it follows `dim`
}) => {
  // Each frame keeps its own "later in the night" picture. When the room changes, the old frame
  // keeps its alt at the amount it had (the lamp stays off as it fades out), and the new one starts
  // at its own amount (the story room doesn't arrive asleep and wake up).
  type F = {k: SceneKey; alt?: SceneKey; frozen?: number};
  const [frames, setFrames] = useState<F[]>([{k: scene, alt}]);
  const veil = useRef(new Animated.Value(dim)).current;
  const warm = useRef(new Animated.Value(0)).current;
  const altV = useRef(new Animated.Value(altAmount)).current;
  const was = useRef({scene, alt, altAmount});
  useEffect(() => {
    const prev = was.current;
    if (prev.scene !== scene) {
      altV.setValue(altAmount);
      setFrames(f => [...f.slice(-1).map(x => ({...x, alt: prev.alt, frozen: prev.alt ? prev.altAmount : undefined})), {k: scene, alt}]);
    } else if (prev.alt !== alt) {
      setFrames(f => f.map((x, i) => (i === f.length - 1 ? {...x, alt} : x)));
    }
    was.current = {scene, alt, altAmount};
  }, [scene, alt, altAmount, altV]);
  useEffect(() => {
    Animated.timing(veil, {toValue: dim, duration: dimMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true}).start();
    Animated.timing(warm, {toValue: warmTo ?? Math.min(0.2, dim * 0.35), duration: dimMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true}).start();
  }, [veil, warm, dim, dimMs, warmTo]);
  useEffect(() => {
    Animated.timing(altV, {toValue: altAmount, duration: altMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true}).start();
  }, [altV, altAmount, altMs]);
  const shown = useRef(() => setFrames(f => f.slice(-1))).current;
  return (
    <View style={st.fill} pointerEvents="none">
      {frames.map(f => (
        <Frame key={f.k} scene={f.k} alt={f.alt} altV={f.frozen ?? altV} u={u} glow={glow} night={dim} onShown={shown} />
      ))}
      {shade && <LinearGradient colors={['rgba(10,14,36,0.78)', 'rgba(10,14,36,0.35)', 'rgba(10,14,36,0)']} locations={[0, 0.45, 0.7]} start={{x: 0, y: 0.5}} end={{x: 1, y: 0.5}} style={st.fill} />}
      <Animated.View style={[st.fill, {backgroundColor: '#2A1200', opacity: warm}]} />
      <Animated.View style={[st.fill, {backgroundColor: '#000', opacity: veil}]} />
    </View>
  );
};

/** Fades its children to `to` (0–1) over `ms`: the candle and the stars at the very end. */
export const Fade = ({to, ms, children}: {to: number; ms: number; children: React.ReactNode}) => {
  const v = useRef(new Animated.Value(to)).current;
  useEffect(() => {
    Animated.timing(v, {toValue: to, duration: ms, easing: Easing.inOut(Easing.quad), useNativeDriver: true}).start();
  }, [v, to, ms]);
  return (
    <Animated.View pointerEvents="none" style={[st.fill, {opacity: v}]}>
      {children}
    </Animated.View>
  );
};

/** Everything on screen dims with the night too: buttons, the ring. */
export const Dimmed = ({dim, ms, children}: {dim: number; ms: number; children: React.ReactNode}) => {
  const v = useRef(new Animated.Value(1 - dim * 0.62)).current;
  useEffect(() => {
    Animated.timing(v, {toValue: 1 - Math.min(1, dim) * 0.62, duration: ms, easing: Easing.inOut(Easing.quad), useNativeDriver: true}).start();
  }, [v, dim, ms]);
  return <Animated.View style={[st.fill, {opacity: v}]}>{children}</Animated.View>;
};

/** The honey button (one per screen) or a quiet outlined one. */
export const Button = ({u, label, icon, onPress, ghost = false, preferred = false, small = false}: {u: number; label: string; icon?: string; onPress: () => void; ghost?: boolean; preferred?: boolean; small?: boolean}) => {
  const [focused, setFocused] = useState(false);
  const S = (n: number) => n * u;
  const ink = ghost ? C.ink : C.honeyInk;
  return (
    <Pressable
      hasTVPreferredFocus={preferred}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      role="button"
      aria-label={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: S(small ? 16 : ghost ? 22 : 28),
        height: S(small ? 38 : 52),
        borderRadius: S(30),
        backgroundColor: ghost ? (focused ? 'rgba(255,255,255,0.18)' : 'rgba(14,20,48,0.55)') : focused ? '#FFE49B' : C.honey,
        borderWidth: S(2),
        borderColor: focused ? C.focus : ghost ? 'rgba(255,255,255,0.35)' : C.honeyEdge,
        transform: [{scale: focused ? 1.06 : 1}],
      }}>
      {icon && (
        <View style={{marginRight: S(10)}}>
          <Icon name={icon} size={S(small ? 16 : 20)} ink={ink} />
        </View>
      )}
      <Text style={{fontFamily: ghost ? FONT.body : FONT.display, fontSize: S(small ? 14 : ghost ? 16 : TYPE.button), color: ink}}>{label}</Text>
    </Pressable>
  );
};

/** A small round − / + button (Setup). */
export const Round = ({u, icon, onPress, label}: {u: number; icon: string; onPress: () => void; label: string}) => {
  const [focused, setFocused] = useState(false);
  const S = (n: number) => n * u;
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      role="button"
      aria-label={label}
      style={{width: S(30), height: S(30), borderRadius: S(15), alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? C.honey : 'rgba(255,255,255,0.10)', transform: [{scale: focused ? 1.12 : 1}]}}>
      <Icon name={icon} size={S(13)} ink={focused ? C.honeyInk : C.soft} />
    </Pressable>
  );
};

export const Toggle = ({u, on, onChange, label, preferred = false}: {u: number; on: boolean; onChange: (v: boolean) => void; label: string; preferred?: boolean}) => {
  const [focused, setFocused] = useState(false);
  const S = (n: number) => n * u;
  return (
    <Pressable
      hasTVPreferredFocus={preferred}
      onPress={() => onChange(!on)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      role="switch"
      aria-checked={on}
      aria-label={label}
      style={{width: S(52), height: S(30), borderRadius: S(15), padding: S(focused ? 2 : 3), backgroundColor: on ? C.honey : 'rgba(255,255,255,0.18)', borderWidth: S(focused ? 3 : 2), borderColor: focused ? '#FFFFFF' : 'transparent', justifyContent: 'center', transform: [{scale: focused ? 1.18 : 1}]}}>
      <View style={{width: S(20), height: S(20), borderRadius: S(10), backgroundColor: on ? C.honeyInk : C.soft, alignSelf: on ? 'flex-end' : 'flex-start'}} />
    </Pressable>
  );
};

/**
 * ◀ ▶ belong to the focused control (a level, a choice), not to the focus engine: without the trap,
 * the same key press changes the value *and* moves focus to the neighbour (friction #16).
 */
const HoldsArrows = ({children}: {children: React.ReactNode}) => (
  <TVFocusGuideView trapFocusLeft trapFocusRight>
    {children}
  </TVFocusGuideView>
);

/** ◀ ▶ while `focused`, as -1 / +1. */
const useArrows = (focused: boolean, onArrow: (d: -1 | 1) => void) => {
  const ref = useRef({focused, onArrow});
  ref.current = {focused, onArrow};
  useTVEventHandler((evt: {eventType: string; eventKeyAction?: number}) => {
    if (!ref.current.focused || evt.eventKeyAction !== 0) {
      return;
    }
    if (evt.eventType === 'left') {
      ref.current.onArrow(-1);
    } else if (evt.eventType === 'right') {
      ref.current.onArrow(1);
    }
  });
};

/** A level from 0 to 1: ◀ ▶ on the remote while focused; OK steps it up and wraps. */
export const Slider = ({u, value, onChange, label, width = 180}: {u: number; value: number; onChange: (v: number) => void; label: string; width?: number}) => {
  const [focused, setFocused] = useState(false);
  const S = (n: number) => n * u;
  const ref = useRef({value, onChange});
  ref.current = {value, onChange};
  useArrows(focused, d => ref.current.onChange(Math.round(Math.min(1, Math.max(0, ref.current.value + d * 0.1)) * 10) / 10));
  const w = S(width);
  return (
    <HoldsArrows>
    <Pressable
      onPress={() => ref.current.onChange(value >= 0.99 ? 0 : Math.round(Math.min(1, value + 0.2) * 10) / 10)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      role="slider"
      aria-label={label}
      aria-valuenow={Math.round(value * 100)}
      style={{width: w + S(24), height: S(34), justifyContent: 'center', paddingHorizontal: S(12), borderRadius: S(17), backgroundColor: focused ? 'rgba(255,255,255,0.10)' : 'transparent'}}>
      <View style={{height: S(6), borderRadius: S(3), backgroundColor: 'rgba(255,255,255,0.22)'}}>
        <View style={{width: w * value, height: S(6), borderRadius: S(3), backgroundColor: C.honey}} />
      </View>
      <View style={{position: 'absolute', left: S(12) + w * value - S(focused ? 11 : 9), width: S(focused ? 22 : 18), height: S(focused ? 22 : 18), borderRadius: S(11), backgroundColor: C.honey, borderWidth: S(2), borderColor: focused ? C.focus : C.honeyEdge}} />
    </Pressable>
    </HoldsArrows>
  );
};

/** "Add: ‹ Crickets ›": ◀ ▶ pick from `options`, OK adds it. */
export const Chooser = ({u, prefix, options, onPick}: {u: number; prefix: string; options: Array<{id: string; label: string}>; onPick: (id: string) => void}) => {
  const [focused, setFocused] = useState(false);
  const [at, setAt] = useState(0);
  const S = (n: number) => n * u;
  const n = options.length;
  const i = n ? Math.min(at, n - 1) : 0;
  useArrows(focused, d => n && setAt((i + d + n) % n));
  if (!n) {
    return null;
  }
  const arrow = {fontFamily: FONT.display, fontSize: S(18), color: focused ? C.honey : C.faint, marginHorizontal: S(8)};
  return (
    <HoldsArrows>
      <Pressable
        onPress={() => onPick(options[i].id)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        role="button"
        aria-label={`${prefix} ${options[i].label}. Left and right to choose.`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          paddingHorizontal: S(14),
          height: S(38),
          borderRadius: S(30),
          backgroundColor: focused ? 'rgba(255,255,255,0.18)' : 'rgba(14,20,48,0.55)',
          borderWidth: S(2),
          borderColor: focused ? C.focus : 'rgba(255,255,255,0.35)',
          transform: [{scale: focused ? 1.06 : 1}],
        }}>
        <Icon name="plus" size={S(16)} ink={C.ink} />
        <Text style={{fontFamily: FONT.body, fontSize: S(14), color: C.ink, marginLeft: S(10)}}>{prefix}</Text>
        <Text style={arrow}>‹</Text>
        <Text style={{fontFamily: FONT.body, fontSize: S(14), color: C.ink, minWidth: S(150), textAlign: 'center'}} numberOfLines={1}>
          {options[i].label}
        </Text>
        <Text style={arrow}>›</Text>
      </Pressable>
    </HoldsArrows>
  );
};

export type TrailItem = {icon: string; label: string; state: 'done' | 'now' | 'next'};

/** The evening's steps as pictures: where we are, what is left. Never a score. */
export const Trail = ({u, items, compact = false}: {u: number; items: TrailItem[]; compact?: boolean}) => {
  const S = (n: number) => n * u;
  const d = compact ? 34 : 40;
  return (
    <View style={{flexDirection: 'row', alignItems: 'flex-start'}} accessible aria-label={`Tonight: ${items.map(i => i.label).join(', ')}`}>
      {items.map((it, i) => (
        <View key={it.label} style={{flexDirection: 'row', alignItems: 'flex-start'}}>
          {i > 0 && compact && <View style={{width: S(18), height: S(2), marginTop: S(d / 2), backgroundColor: 'rgba(255,255,255,0.35)'}} />}
          <View style={{width: S(compact ? 64 : 82), alignItems: 'center'}}>
            <View style={{width: S(d), height: S(d), borderRadius: S(d / 2), alignItems: 'center', justifyContent: 'center', backgroundColor: it.state === 'now' ? C.honey : compact ? 'rgba(14,20,48,0.55)' : 'transparent'}}>
              <Icon name={it.icon} size={S(d * (compact ? 0.62 : 0.78))} ink={it.state === 'now' ? C.honeyInk : '#FFFFFF'} />
              {it.state === 'done' && (
                <View style={{position: 'absolute', right: -S(3), bottom: -S(3), width: S(16), height: S(16), borderRadius: S(8), backgroundColor: C.honey, alignItems: 'center', justifyContent: 'center'}}>
                  <Icon name="check" size={S(10)} ink={C.honeyInk} />
                </View>
              )}
            </View>
            <Text style={{fontFamily: FONT.body, fontSize: S(compact ? 12 : 14), color: it.state === 'next' && compact ? C.faint : C.ink, marginTop: S(5), textShadowColor: 'rgba(5,8,25,0.7)', textShadowRadius: S(6)}}>{it.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

export const st = StyleSheet.create({
  fill: {position: 'absolute', left: 0, top: 0, right: 0, bottom: 0},
  abs: {position: 'absolute'},
  row: {flexDirection: 'row', alignItems: 'center'},
});

export {Image};
