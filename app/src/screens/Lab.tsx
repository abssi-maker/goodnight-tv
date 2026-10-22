import React, {useEffect, useRef} from 'react';
import {Text, View} from 'react-native';
import {Light, lightAt, screenLight} from '../light';
import type {SceneKey} from '../routine';
import {C, FONT} from '../theme';
import {Candle, CANDLE_SPOTS} from '../ui/candle';
import {ART_LUMA, Button, Scene, st} from '../ui/kit';
import {Stars} from '../ui/motion';

// Light lab (testing only, config LAB): the candle-lit room with the real candle and the real light
// curve, and controls to move through the candle's life: step it, play a 20 s burn, switch the big
// light, change room, blow it out. The hub can set it too (/api/debug/lab), to tune the curve live.

export type LabState = {
  burned: number;
  lampOff: boolean;
  room: 'teeth' | 'pajamas' | 'story';
  flame: number;
  bend: number;
  playing: boolean;
  override: Partial<Light> | null; // tuning from the hub: these replace the curve's values
};

export const LAB_START: LabState = {burned: 0, lampOff: false, room: 'story', flame: 1, bend: 0, playing: false, override: null};
const ROOMS: LabState['room'][] = ['story', 'pajamas', 'teeth'];
const STARS = [{x: 615, y: 46}, {x: 700, y: 128}, {x: 655, y: 168}, {x: 868, y: 70}];
const PLAY_S = 20;

export const Lab = ({u, s, set, onExit}: {u: number; s: LabState; set: (p: Partial<LabState>) => void; onExit: () => void}) => {
  const S = (n: number) => n * u;
  const ref = useRef(s);
  ref.current = s;

  // ▶: burn from here to the stub in 20 s, as the routine does with "Candle burns in: 20 s"
  useEffect(() => {
    if (!s.playing) {
      return;
    }
    const id = setInterval(() => {
      const b = Math.min(0.9, ref.current.burned + 0.9 / (PLAY_S * 10));
      set({burned: b, playing: b < 0.9});
    }, 100);
    return () => clearInterval(id);
  }, [s.playing, set]);

  const l = {...lightAt(s.burned, s.lampOff), ...(s.override ?? {})};
  const scene: SceneKey = s.room;
  const alt: SceneKey | undefined = scene === 'pajamas' ? 'pajamasDark' : scene === 'story' ? 'storyDark' : undefined;
  const altAmount = scene === 'pajamas' ? (s.lampOff ? 1 : 0) : scene === 'story' ? Math.min(1, s.burned / 0.9) : 0;
  const lit: SceneKey = alt && altAmount > 0.5 ? alt : scene;
  const pct = screenLight(ART_LUMA[lit], l, s.flame > 0);
  const step = (d: number) => set({burned: Math.round(Math.min(0.9, Math.max(0, s.burned + d)) * 100) / 100, playing: false});

  return (
    <View style={st.fill}>
      <Scene scene={scene} u={u} dim={l.veil} dimMs={600} warm={l.warm} alt={alt} altAmount={altAmount} altMs={1200} shade={false} />
      {scene === 'story' && <Stars u={u} points={STARS} count={Math.round((s.burned / 0.9) * STARS.length)} />}
      <Candle u={u} burned={s.burned} room={s.flame > 0 ? l.room : 0} dark={l.dark} size={s.flame} bend={s.bend} at={CANDLE_SPOTS[s.room]} glideMs={600} />

      <View style={[st.abs, {left: S(24), top: S(18), paddingHorizontal: S(12), paddingVertical: S(6), borderRadius: S(10), backgroundColor: 'rgba(0,0,0,0.45)'}]}>
        <Text style={{fontFamily: FONT.body, fontSize: S(13), color: C.soft}}>
          LIGHT LAB · candle {Math.round((s.burned / 0.9) * 100)}% burned · big light {s.lampOff ? 'off' : 'on'} · flame {s.flame > 0 ? s.flame.toFixed(2) : 'out'}
        </Text>
        <Text style={{fontFamily: FONT.body, fontSize: S(13), color: C.faint}}>
          veil {l.veil.toFixed(2)} · warm {l.warm.toFixed(2)} · glow {l.room.toFixed(2)} · dark {l.dark.toFixed(2)} · ~{l.cct} K · screen light {pct}%{s.override ? ' · OVERRIDE' : ''}
        </Text>
      </View>

      <View style={[st.abs, st.row, {left: S(24), bottom: S(20), flexWrap: 'wrap', width: S(700)}]}>
        {[
          {label: '−10%', on: () => step(-0.09)},
          {label: '+10%', on: () => step(0.09)},
          {label: s.playing ? 'Pause' : `Play ${PLAY_S} s`, on: () => set({playing: !s.playing, burned: !s.playing && s.burned >= 0.9 ? 0 : s.burned})},
          {label: s.lampOff ? 'Big light on' : 'Big light off', on: () => set({lampOff: !s.lampOff})},
          {label: `Room: ${s.room}`, on: () => set({room: ROOMS[(ROOMS.indexOf(s.room) + 1) % ROOMS.length]})},
          {label: 'Breath', on: () => set({bend: s.bend + 1, flame: Math.max(0.3, s.flame - 0.24)})},
          {label: s.flame > 0 ? 'Blow out' : 'Relight', on: () => set({flame: s.flame > 0 ? 0 : 1})},
          {label: 'Open app', on: onExit},
        ].map((b, i) => (
          <View key={b.label} style={{marginRight: S(8), marginTop: S(6)}}>
            <Button u={u} label={b.label} onPress={b.on} ghost small preferred={i === 2} />
          </View>
        ))}
      </View>
    </View>
  );
};
