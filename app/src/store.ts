// The family's settings, kept on the TV (Vega's legacy AsyncStorage), so bedtime works without the hub.
import {CANDLE_SPEEDS, DEFAULT_SETTINGS, Settings, STEP} from './routine';
import {cleanMix, PRESETS} from './sounds';

const KEY = 'goodnight.settings.v12';

type Storage = {getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void>};
let storage: Storage | null = null;
try {
  storage = require('@amazon-devices/react-native-kepler/Libraries/Storage/AsyncStorage');
  storage = (storage as any)?.default ?? storage;
} catch {
  storage = null;
}

/** Keep only well-formed values; anything else falls back to the defaults. */
export function sanitize(raw: any): Settings {
  const d = DEFAULT_SETTINGS;
  if (!raw || typeof raw !== 'object') {
    return d;
  }
  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .filter((x: any) => x && STEP[x.kind as keyof typeof STEP])
        .map((x: any) => {
          const m = STEP[x.kind as keyof typeof STEP];
          return {kind: x.kind, on: x.on !== false, minutes: Math.min(m.max, Math.max(m.min, Math.round(Number(x.minutes) || m.min)))};
        })
    : d.steps;
  const unit = (v: any, f: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : f);
  return {
    steps: steps.length ? steps : d.steps,
    start: typeof raw.start === 'number' ? ((Math.round(raw.start) % 1440) + 1440) % 1440 : d.start,
    short: typeof raw.short === 'boolean' ? raw.short : d.short,
    preset: typeof raw.preset === 'string' && (raw.preset === 'custom' || PRESETS.some(p => p.id === raw.preset)) ? raw.preset : d.preset,
    mix: raw.mix && typeof raw.mix === 'object' ? cleanMix(raw.mix) : d.mix,
    mixName: typeof raw.mixName === 'string' && raw.mixName.trim() ? raw.mixName.trim().slice(0, 40) : d.mixName,
    voice: unit(raw.voice, d.voice),
    background: unit(raw.background, d.background),
    fadeOut: typeof raw.fadeOut === 'boolean' ? raw.fadeOut : d.fadeOut,
    candleSeconds: CANDLE_SPEEDS.some(c => c.seconds === raw.candleSeconds) ? raw.candleSeconds : d.candleSeconds,
  };
}

export async function loadSettings(): Promise<Settings> {
  try {
    const s = await storage?.getItem(KEY);
    return s ? sanitize(JSON.parse(s)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings) {
  try {
    await storage?.setItem(KEY, JSON.stringify(s));
  } catch (e) {
    console.warn('[store] could not save', e);
  }
}
