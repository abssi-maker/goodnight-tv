import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AppState, BackHandler, StyleSheet, useWindowDimensions, View} from 'react-native';
import {useTVEventHandler} from '@amazon-devices/react-native-kepler';
import {audio} from './audio/engine';
import {FADE_OUT_MIN, GOODNIGHT_FADE_S, LAB, TIME_SCALE} from './config';
import {lightAt, screenLight} from './light';
import {Lab, LAB_START, LabState} from './screens/Lab';
import {link, ServerMsg} from './net/link';
import {aboutMinutes, DEFAULT_SETTINGS, isShortTonight, LINES, RoutineStep, SceneKey, Settings, STEP, tonight} from './routine';
import {isQuiet, LAYER_IDS, LAYERS, mixFromWords, Mix} from './sounds';
import {CHAPTER_RATE, taleMinutes, TALES, wordsOf} from './stories';
import {loadSettings, saveSettings} from './store';
import {Goodnight} from './screens/Goodnight';
import {Setup} from './screens/Setup';
import {Sounds} from './screens/Sounds';
import {Step} from './screens/Step';
import {StoryMode, StoryTime} from './screens/StoryTime';
import {Tonight} from './screens/Tonight';
import {ART_LUMA, Dimmed, Fade, Scene, TrailItem} from './ui/kit';
import {Breath, Flight, Stars} from './ui/motion';
import {Candle, flameAt, spotFor} from './ui/candle';

// Goodnight TV: the TV that ends TV time and puts the child to bed. Bear lights a candle at the
// start; it burns for exactly tonight's routine and is the light of the whole evening. The screen
// warms and dims with it, every finished step sends a spark up from the flame to become a star, the
// real big light goes off and the candle is the last light in the room, and at the end the child
// blows it out with three slow candle breaths. Then black, and only tonight's sound.

type Screen = 'tonight' | 'step' | 'story' | 'goodnight' | 'setup' | 'sounds' | 'lab';
type Pt = {x: number; y: number};
class Aborted extends Error {}

/** Background level → master gain of the sound bed. */
const bedGain = (s: Settings) => 0.25 + s.background * 0.75;

/** Where the sparks go: up, out of the picture, to be stars (design units). */
const SKY: Pt = {x: 760, y: -30};
/** The fireflies that went home, as stars in each room's window. */
const STARS: Partial<Record<SceneKey, Pt[]>> = {
  story: [{x: 615, y: 46}, {x: 700, y: 128}, {x: 655, y: 168}, {x: 868, y: 70}, {x: 760, y: 40}, {x: 890, y: 150}],
};

export const App = () => {
  const {width} = useWindowDimensions();
  const u = width / 960;
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<Settings>(DEFAULT_SETTINGS);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [screen, setScreen] = useState<Screen>(LAB ? 'lab' : 'tonight');
  const [lab, setLab] = useState<LabState>(LAB_START);
  const setLabPart = useCallback((p: Partial<LabState>) => setLab(x => ({...x, ...p})), []);
  const [steps, setSteps] = useState<RoutineStep[]>([]);
  const [index, setIndex] = useState(0);
  const [stepLive, setStepLive] = useState(false);
  const stepToken = useRef(0);
  const [short, setShort] = useState(false);
  const [candleLit, setCandleLit] = useState(false);
  const [burned, setBurned] = useState(0); // 0 fresh … 0.9 (the finale burns it to a stub)
  const [flame, setFlame] = useState(0); // flame size: 0 unlit/out, 1 full, smaller after each breath
  const [bend, setBend] = useState(0); // +1 per candle breath
  const [finale, setFinale] = useState<'none' | 'blow' | 'press' | 'dark'>('none');
  const [blackout, setBlackout] = useState(false);
  const [lampOff, setLampOff] = useState(false);
  const [sleepy, setSleepy] = useState(0); // the story room falling asleep, 0 → 1
  const [taleIdx, setTaleIdx] = useState(0);
  const [storyMode, setStoryMode] = useState<StoryMode>('intro');
  const [breathing, setBreathing] = useState(false);
  const [released, setReleased] = useState(0);
  const [flights, setFlights] = useState<Array<{id: number; from: Pt}>>([]);
  const [asking, setAsking] = useState(false);
  const [online, setOnline] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [fromSounds, setFromSounds] = useState(false);

  const run = useRef(0);
  const clipId = useRef(0);
  const clipsDone = useRef(new Map<number, number>()); // clip id → when it should have been heard by
  const waiters = useRef<{done?: () => void; play?: () => void; turn?: () => void; blow?: () => void; mix?: (m: {name: string; mix: Mix; line?: string} | null) => void}>({});
  const loopParts = useRef(new Map<string, Int16Array[]>());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const sceneRef = useRef<SceneKey>('tonight');
  const taleRef = useRef(taleIdx);
  taleRef.current = taleIdx;
  const telemetry = useRef({scene: 'tonight' as SceneKey, dim: 0, room: 0, dark: 0, cct: 6500, burned: 0, detail: ''});
  const playRef = useRef<((text: string, rate: number, paced: boolean, me: number) => Promise<void>) | null>(null);
  const burn = useRef({litAt: 0, totalMs: 1}); // the candle clock

  // the candle burns in real time, sized to tonight's routine
  useEffect(() => {
    if (!candleLit) {
      return;
    }
    const tick = () => setBurned(b => Math.max(b, Math.min(0.9, (Date.now() - burn.current.litAt) / burn.current.totalMs)));
    tick();
    // ~100 steps per burn, never more than once a second: every tick re-renders the whole evening
    const id = setInterval(tick, Math.max(1000, Math.min(2000, burn.current.totalMs / 100)));
    return () => clearInterval(id);
  }, [candleLit]);

  useEffect(() => {
    loadSettings().then(s => {
      setSettings(s);
      setDraft(s);
    });
    const id = setInterval(() => {
      setClock(Date.now());
      setOnline(link.connected);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // ---------------------------------------------------------------- the hub: Bear's voice, sound loops, Nova
  useEffect(() => {
    audio.onNeedLoop = id => link.send({type: 'loop', id});
    link.connect();
    return link.on((m: ServerMsg) => {
      switch (m.type) {
        case 'hello': {
          // record every line once, ahead of time, so bedtime never waits on the network
          const items: Array<[string, number]> = [[LINES.hello, 90], [LINES.moreTime, 88], [LINES.turnPage, 80], [LINES.voiceCheck, 88], [LINES.mixed, 86], [LINES.blow1, 76], [LINES.blow2, 76], [LINES.blow3, 76]];
          Object.values(STEP).forEach(m2 => Object.values(m2.say).forEach(t => t && items.push([t, 86])));
          items.push([STEP.goodnight.say.go, 72]); // the very last line is said slower (the finale)
          TALES.forEach(t => t.chapters.forEach((c, ci) => c.forEach(p => items.push([p, CHAPTER_RATE[ci] ?? 72]))));
          link.send({type: 'prewarm', items});
          setOnline(true);
          break;
        }
        case 'voice':
          audio.pushVoice(m.pcm);
          break;
        case 'clipEnd':
          clipsDone.current.set(m.id, Date.now() + m.seconds * 1000 + 2000);
          break;
        case 'loop': {
          const parts = loopParts.current.get(m.id) ?? [];
          parts[m.seq] = m.pcm;
          loopParts.current.set(m.id, parts);
          if (parts.filter(Boolean).length === m.total) {
            loopParts.current.delete(m.id);
            const chunks = parts;
            const pcm = new Int16Array(chunks.reduce((a, c) => a + c.length, 0));
            let o = 0;
            for (const c of chunks) {
              pcm.set(c, o);
              o += c.length;
            }
            audio.provideLoop(m.id, pcm);
          }
          break;
        }
        case 'debugLab':
          setScreen('lab');
          setLab(x => ({...x, ...(m.state as Partial<LabState>)}));
          break;
        case 'debugSay':
          audio.start().then(() => playRef.current?.(m.text, 86, false, run.current));
          break;
        case 'mix':
          waiters.current.mix?.(m.mix ? {name: m.name, mix: m.mix as Mix, line: m.line} : null);
          break;
      }
    });
  }, []);

  /** Bear says `text`. Resolves when it has been heard (or, offline, after reading time if `paced`). */
  const play = useCallback((text: string, rate: number, paced: boolean, me: number) => {
    if (!link.connected) {
      const ms = paced ? (wordsOf([text]) / 2.2) * 1000 + 800 : 0;
      return new Promise<void>(r => setTimeout(r, ms));
    }
    return new Promise<void>(resolve => {
      const id = ++clipId.current;
      link.send({type: 'speak', id, text, rate});
      const t0 = Date.now();
      const tick = setInterval(() => {
        const heardBy = clipsDone.current.get(id);
        // Heard: the clip arrived and played out. A slow or stalled audio stream never holds the
        // evening longer than the line itself (plus 2 s).
        if (run.current !== me || (heardBy !== undefined && (audio.voiceIdle || Date.now() > heardBy)) || Date.now() - t0 > 90000) {
          clearInterval(tick);
          clipsDone.current.delete(id);
          resolve();
        }
      }, 100);
    });
  }, []);

  playRef.current = play;

  // ---------------------------------------------------------------- the evening, as a script
  const start = useCallback(async () => {
    const me = ++run.current;
    const alive = () => {
      if (run.current !== me) {
        throw new Aborted();
      }
    };
    const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms)).then(alive);
    const say = (t: string, rate = 86) => play(t, rate, false, me).then(alive);
    const sayPaced = (t: string, rate: number) => play(t, rate, true, me).then(alive);
    const until = (k: 'done' | 'play' | 'turn' | 'blow') => new Promise<void>(r => (waiters.current[k] = r)).then(alive);
    const burnedNow = () => Math.min(0.9, (Date.now() - burn.current.litAt) / burn.current.totalMs);
    /** A spark leaps from the flame and flies up to be a star. */
    const spark = () => setFlights(f => [...f, {id: Date.now(), from: flameAt(burnedNow(), spotFor(sceneRef.current))}]);

    const s = settingsRef.current;
    const isShort = isShortTonight(s);
    const plan = tonight(s, isShort);
    setShort(isShort);
    setSteps(plan);
    setIndex(0);
    setStoryMode('intro');
    setTaleIdx(0);
    setLampOff(false);
    setSleepy(0);
    setBreathing(false);
    setReleased(0);
    setFlights([]);
    setCandleLit(false);
    setBurned(0);
    setFlame(0);
    setBend(0);
    setFinale('none');
    setBlackout(false);

    /** Bear's hello, lighting the candle as he says so. It burns for exactly tonight's plan. */
    const lightCandle = async () => {
      const hello = say(LINES.hello, 90);
      await wait(link.connected ? 6200 : 1500); // "…I'll light our bedtime candle"
      // the whole routine, or faster to watch the dimming (Setup → "Candle burns in")
      const totalMs = s.candleSeconds > 0 ? s.candleSeconds * 1000 : (plan.reduce((a, x) => a + x.minutes, 0) * 60000) / TIME_SCALE;
      burn.current = {litAt: Date.now(), totalMs};
      setCandleLit(true);
      setFlame(1);
      audio.chime();
      await hello;
    };

    try {
      await audio.start();
      audio.voiceGain = 0.3 + s.voice * 0.9;
      audio.setNoise(0, 0.5);
      audio.setMix(s.mix, 0.5);
      link.send({type: 'begin', steps: plan.map(x => x.kind), short: isShort});
      let first = true;
      let gone = 0;

      for (let i = 0; i < plan.length; i++) {
        const step = plan[i];
        const meta = STEP[step.kind];
        setIndex(i);
        link.send({type: 'phase', phase: step.kind});

        if (step.kind === 'story') {
          setScreen('story');
          setStoryMode('intro');
          setLampOff(true); // in bed, the candle is the only light (even if the big-light step was off)
          if (!isQuiet(s.mix)) {
            audio.setNoise(bedGain(s) * 0.6, 8); // tonight's sound comes in, softly
          }
          if (first) {
            await lightCandle();
            first = false;
          }
          say(meta.say.go).catch(() => {});
          await until('play');
          await audio.stopVoice();
          const tale = TALES[taleRef.current];
          link.send({type: 'story', id: tale.id, title: tale.title});
          audio.setNoise(bedGain(s), 10);
          const chapters = isShort ? tale.short : tale.chapters.map((_, ci) => ci);
          const paras = chapters.reduce((a, ci) => a + tale.chapters[ci].length, 0);
          let n = 0;
          for (let c = 0; c < chapters.length; c++) {
            if (c > 0) {
              setStoryMode('page');
              if (c === 1) {
                say(LINES.turnPage, 80).catch(() => {});
              }
              await until('turn');
              await audio.stopVoice();
            }
            setStoryMode('reading');
            const ci = chapters[c];
            for (const p of tale.chapters[ci]) {
              n++;
              setBreathing(/breath/i.test(p));
              setSleepy(Math.min(1, (n / paras) * 1.15)); // the jar empties, Bear falls asleep
              await sayPaced(p, CHAPTER_RATE[ci] ?? 72);
              await wait(900);
            }
          }
          setBreathing(false);
          continue;
        }

        if (step.kind === 'goodnight') {
          // the finale, in the candle-lit room: three candle breaths, then the child blows it out
          setScreen('goodnight');
          setSleepy(1);
          setFinale('blow');
          if (first) {
            await lightCandle();
            first = false;
          }
          setBurned(b => Math.max(b, 0.86)); // a small stub by now
          link.send({type: 'end', title: TALES[taleRef.current].title});
          if (!isQuiet(s.mix)) {
            audio.setNoise(bedGain(s), 6);
          }
          for (const [line, size] of [[LINES.blow1, 0.74], [LINES.blow2, 0.52]] as const) {
            const said = say(line, 76);
            await wait(link.connected ? 4200 : 1500); // "…and blow"
            setBend(x => x + 1);
            setFlame(size);
            await said;
            await wait(700);
          }
          await say(LINES.blow3, 76);
          setFinale('press');
          await Promise.race([until('blow'), wait(15000)]); // asleep already? it goes out by itself
          setFinale('dark');
          setBend(x => x + 1);
          setFlame(0);
          audio.blowOut();
          spark(); // the last spark: Pip, the last little firefly
          gone++;
          setReleased(gone);
          await wait(2200);
          await say(meta.say.go, 72);
          setBlackout(true);
          if (isQuiet(s.mix)) {
            await wait(4000);
            await audio.stopAll();
          } else if (s.fadeOut) {
            await wait(FADE_OUT_MIN * 60000);
            audio.setNoise(0, 60);
            await wait(62000);
            await audio.stopAll();
          }
          // otherwise tonight's sound plays until Fire TV turns the display (and the app) off
          return;
        }

        // a getting-ready step, in the real rooms; the candle burns on while it lasts
        setStepLive(false);
        setScreen('step');
        if (first) {
          await lightCandle();
        }
        first = false;
        const go = say(meta.say.go).catch(() => {});
        const token = ++stepToken.current;
        go.then(() => stepToken.current === token && setStepLive(true)); // the ring (and its halfway/end lines) start once he's said what to do
        await until('done');
        await audio.stopVoice();
        audio.chime();
        spark(); // a spark leaps from the flame and flies up to be a star
        gone++;
        setReleased(gone);
        if (step.kind === 'lights') {
          audio.click();
          setLampOff(true); // the lamp in the picture goes out with the real one: the candle is the only light
          if (!isQuiet(s.mix)) {
            audio.setNoise(bedGain(s) * 0.45, 6);
          }
        }
        await say(meta.say.done);
      }
    } catch (e) {
      if (!(e instanceof Aborted)) {
        console.warn('[routine]', e);
      }
    }
  }, [play]);

  const toTonight = useCallback(() => {
    run.current++;
    waiters.current = {};
    audio.stopAll();
    link.send({type: 'reset'});
    setScreen('tonight');
    setBreathing(false);
    setFlights([]);
    setCandleLit(false);
    setFlame(0);
    setBurned(0);
    setFinale('none');
    setBlackout(false);
  }, []);

  // ---------------------------------------------------------------- grown-ups
  const openSetup = () => {
    setDraft(settingsRef.current);
    setFromSounds(false);
    setScreen('setup');
  };
  const patch = (p: Partial<Settings>) => setDraft(d => ({...d, ...p}));
  const commit = (draftNow: Settings) => {
    // layers turned down to 0 kept their row while editing; they are not part of the saved mix
    const next = {...draftNow, mix: Object.fromEntries(Object.entries(draftNow.mix).filter(([, v]) => v > 0.01))};
    setDraft(next);
    setSettings(next);
    saveSettings(next);
    link.send({type: 'settings', settings: next});
  };

  /** "Rain on a tent with a little stream": Nova (via the hub) mixes it; offline, the words do. */
  const askMix = async (words: string) => {
    setAsking(true);
    let res: {name: string; mix: Mix; line?: string} | null = null;
    if (link.connected) {
      res = await new Promise(resolve => {
        const t = setTimeout(() => resolve(null), 45000); // Lyria composes in ~10–20 s
        waiters.current.mix = r => {
          clearTimeout(t);
          resolve(r);
        };
        link.send({type: 'askMix', text: words, layers: LAYER_IDS.map(id => ({id, label: LAYERS[id].label}))});
      });
    }
    if (!res || isQuiet(res.mix)) {
      const local = mixFromWords(words);
      res = isQuiet(local.mix) ? res : local;
    }
    setAsking(false);
    if (res && !isQuiet(res.mix)) {
      patch({mix: res.mix, mixName: res.name, preset: 'custom'});
      await audio.stopVoice();
      play(res.line || LINES.mixed, 86, false, run.current);
    }
  };

  // Sounds: what you pick is what you hear
  const previewMix = JSON.stringify(draft.mix);
  const previewGain = bedGain(draft);
  useEffect(() => {
    if (screen !== 'sounds') {
      return;
    }
    (async () => {
      await audio.start();
      audio.setMix(JSON.parse(previewMix), 1.2);
      audio.setNoise(previewGain, 1);
    })();
  }, [screen, previewMix, previewGain]);
  const voiceLevel = draft.voice;
  useEffect(() => {
    if (screen !== 'sounds') {
      return;
    }
    audio.voiceGain = 0.3 + voiceLevel * 0.9;
  }, [screen, voiceLevel]);
  const leaveSounds = () => {
    audio.setNoise(0, 0.8);
    const r = run.current;
    // stop the preview once it has faded, unless the grown-up came back, or bedtime already started
    setTimeout(() => run.current === r && screenRef.current !== 'sounds' && audio.stopAll(), 1000);
    setFromSounds(true);
    setScreen('setup');
  };

  // ---------------------------------------------------------------- lifecycle, Back, telemetry
  useEffect(() => {
    const sub = AppState.addEventListener('change', st2 => {
      if (st2 !== 'active' && screenRef.current !== 'tonight') {
        toTonight(); // Home button or Alexa: stop sound at once and release the streams
      }
    });
    return () => sub.remove();
  }, [toTonight]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const sc = screenRef.current;
      if (sc === 'sounds') {
        leaveSounds();
        return true;
      }
      if (sc === 'setup') {
        // Back keeps what the grown-up changed, as TV settings do (Save routine does the same)
        commit(draftRef.current);
        setScreen('tonight');
        return true;
      }
      if (sc !== 'tonight') {
        toTonight();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  });

  useEffect(() => {
    const id = setInterval(async () => {
      const {scene, dim: d, room, dark, cct, burned: bt, detail} = telemetry.current;
      link.send({
        type: 'telemetry',
        phase: screenRef.current,
        detail, // what the child can do now (scripted demo takes wait on it)
        dim: +d.toFixed(3),
        lightPct: screenLight(ART_LUMA[scene], {veil: d, warm: 0, room, dark, cct}, room > 0),
        candle: {burned: +bt.toFixed(3), cct},
        noise: {gain: +audio.noiseLevel.toFixed(3)},
        audio: audio.started ? await audio.stats() : null,
        audioError: audio.failed,
        voice: {in: audio.voiceIn, out: audio.voiceOut, queued: audio.voiceQueued, idle: audio.voiceIdle, gain: +audio.voiceGain.toFixed(2)},
        link: {errors: link.errors, last: link.lastError, frames: link.frames},
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // Remote keys: logged only (which name OK arrives as); focus is Pressable + TV focus.
  useTVEventHandler((evt: {eventType: string; eventKeyAction?: number}) => {
    if (evt.eventKeyAction === 0) {
      link.send({type: 'key', eventType: evt.eventType});
    }
  });

  // ---------------------------------------------------------------- what's on screen
  const now = new Date(clock);
  const shortNow = isShortTonight(settings, now);
  const preview = useMemo(() => tonight(settings, shortNow), [settings, shortNow]);
  const trail = (list: RoutineStep[], at: number): TrailItem[] =>
    list.map((x, i) => ({icon: STEP[x.kind].icon, label: STEP[x.kind].trail, state: at < 0 ? 'next' : i < at ? 'done' : i === at ? 'now' : 'next'}));
  const step = steps[index];
  const stepScene = step ? STEP[step.kind].scene : 'tonight';
  const scene: SceneKey =
    screen === 'tonight' || screen === 'setup' || screen === 'lab' ? 'tonight' : screen === 'sounds' ? 'sounds' : screen === 'goodnight' || screen === 'story' ? 'story' : stepScene;
  // the same picture later in the night: the lamp out, or the story room asleep
  const alt: SceneKey | undefined = scene === 'pajamas' ? 'pajamasDark' : scene === 'story' ? 'storyDark' : undefined;
  const altAmount = scene === 'pajamas' ? (lampOff ? 1 : 0) : scene === 'story' ? sleepy : 0;
  const lit = alt && altAmount > 0.5 ? alt : scene;
  sceneRef.current = scene;

  // The light of the evening, all from the candle: how far it has burned, and whether the big light
  // is off (then the candle is the only light: the room darkens, its glow takes over).
  const inRoutine = screen === 'step' || screen === 'story' || screen === 'goodnight';
  const b = burned;
  const light = lightAt(b, lampOff);
  const dim = !inRoutine ? 0 : blackout ? 1 : candleLit ? light.veil : 0;
  const warm = inRoutine && candleLit ? light.warm : 0;
  const room = light.room;
  const dark = candleLit ? light.dark : 0;
  const fast = settings.candleSeconds > 0 && settings.candleSeconds <= 60;
  const fadeMs = blackout ? GOODNIGHT_FADE_S * 1000 : fast ? 700 : 3000;
  const cct = candleLit ? light.cct : 6500;
  const detail = screen === 'step' ? (stepLive ? 'live' : 'wait') : screen === 'story' ? storyMode : screen === 'goodnight' ? finale : '';
  telemetry.current = {scene: lit, dim: screen === 'setup' ? 1 : dim, room: inRoutine && flame > 0 ? room : 0, dark, cct, burned: b, detail};
  const tale = TALES[taleIdx];
  const storyLabel = taleIdx === 0 ? "Tonight's story" : 'Our favorite';
  const sky = STARS[scene];

  return (
    <View style={st.root}>
      {screen !== 'setup' && screen !== 'lab' && (
        <Scene
          scene={scene}
          u={u}
          dim={dim}
          dimMs={fadeMs}
          warm={warm}
          glow={screen === 'story' || screen === 'goodnight' ? Math.max(0, 1 - sleepy * 1.2) : 1}
          alt={alt}
          altAmount={altAmount}
          altMs={scene === 'pajamas' ? 1800 : 9000}
        />
      )}

      {sky && released > 0 && (screen === 'story' || screen === 'goodnight') && (
        <Fade to={blackout ? 0 : 1} ms={fadeMs}>
          <Stars u={u} points={sky} count={released} />
        </Fade>
      )}

      {inRoutine && (
        <Fade to={blackout ? 0 : 1} ms={fadeMs}>
          <Candle u={u} burned={b} room={room} dark={dark} size={flame} bend={bend} at={spotFor(scene)} glideMs={fast ? 700 : 3000} />
        </Fade>
      )}

      {screen === 'lab' && <Lab u={u} s={lab} set={setLabPart} onExit={() => setScreen('tonight')} />}

      {screen === 'tonight' && <Tonight u={u} minutes={aboutMinutes(preview)} short={shortNow} trail={trail(preview, -1)} onStart={() => start()} onGrownUps={openSetup} />}

      {screen === 'step' && step && (
        <Dimmed dim={dim} ms={fadeMs}>
          <Step
            key={`${index}-${step.kind}`}
            u={u}
            title={STEP[step.kind].title}
            sub={STEP[step.kind].sub}
            icon={STEP[step.kind].icon}
            minutes={step.minutes}
            trail={trail(steps, index)}
            live={stepLive}
            onHalf={STEP[step.kind].say.mid ? () => play(STEP[step.kind].say.mid!, 86, false, run.current) : undefined}
            onEnd={() => play(STEP[step.kind].say.end, 86, false, run.current)}
            onMore={() => play(LINES.moreTime, 88, false, run.current)}
            onDone={() => waiters.current.done?.()}
          />
        </Dimmed>
      )}

      {flights.map(f => (
        <Flight key={f.id} u={u} from={f.from} to={SKY} onArrive={() => setFlights(x => x.filter(y => y.id !== f.id))} />
      ))}

      {screen === 'story' && (
        <Dimmed dim={storyMode === 'intro' ? 0 : dim} ms={fadeMs}>
          {breathing && <Breath u={u} x={270} y={262} />}
          <StoryTime
            u={u}
            mode={storyMode}
            eyebrow={`${storyLabel} · ${taleMinutes(tale, short)} min`}
            title={tale.title}
            swapLabel={taleIdx === 0 ? 'Our favorite instead' : "Tonight's story instead"}
            onPlay={() => waiters.current.play?.()}
            onSwap={() => setTaleIdx(i => (i + 1) % TALES.length)}
            onTurn={() => waiters.current.turn?.()}
          />
        </Dimmed>
      )}

      {screen === 'goodnight' && (
        // the button dims with the night too: at the darkest moment it must not be the brightest thing
        <Dimmed dim={dim} ms={fadeMs}>
        <Goodnight
          u={u}
          mode={finale === 'press' ? 'press' : finale === 'dark' ? 'dark' : 'blow'}
          label={`${STEP.goodnight.title} ${STEP.goodnight.sub} ${isQuiet(settings.mix) ? '' : settings.fadeOut ? `The sound fades out in ${FADE_OUT_MIN} minutes.` : 'The sound stays on until the TV sleeps.'} Press OK to wake.`}
          onBlow={() => waiters.current.blow?.()}
          onWake={toTonight}
        />
        </Dimmed>
      )}

      {screen === 'setup' && (
        <Setup
          u={u}
          settings={draft}
          fromSounds={fromSounds}
          onChange={patch}
          onSounds={() => setScreen('sounds')}
          onSave={() => {
            commit(draft);
            setScreen('tonight');
          }}
        />
      )}

      {screen === 'sounds' && (
        <Sounds
          u={u}
          settings={draft}
          hubOnline={online}
          asking={asking}
          onChange={patch}
          onAsk={askMix}
          onSave={() => {
            commit(draft);
            leaveSounds();
          }}
        />
      )}
    </View>
  );
};

const st = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000'},
});
