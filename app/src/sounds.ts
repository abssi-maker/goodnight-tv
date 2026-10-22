// Tonight's sound is a mix of layers: real nature recordings (rain, ocean, campfire…) and two pieces
// of music composed by Lyria 3, looped by the hub (server/tools/loops.js); white, pink and brown noise
// are generated on the TV, so they work without the hub. A grown-up picks a preset, moves the levels,
// or asks in their own words: Nova mixes the nature layers, and a musical wish is composed by Lyria
// on the spot (it arrives as an `ai_…` layer).

export type LayerId = string;
export type Mix = Record<LayerId, number>;

type Layer = {label: string; icon: string; recorded: boolean; words: string[]};

export const LAYERS: Record<string, Layer> = {
  rain: {label: 'Rain on the window', icon: 'rain', recorded: true, words: ['rain', 'window', 'storm', 'tent', 'roof', 'shower']},
  rain_soft: {label: 'Gentle rain', icon: 'rain', recorded: true, words: ['gentle rain', 'light rain', 'soft rain', 'drizzle', 'spring']},
  rain_trees: {label: 'Rain in the trees', icon: 'trees', recorded: true, words: ['forest rain', 'rainforest', 'jungle', 'leaves', 'garden']},
  ocean: {label: 'Ocean waves', icon: 'waves', recorded: true, words: ['ocean', 'sea', 'beach', 'waves', 'shore', 'boat', 'island', 'seaside']},
  river: {label: 'River', icon: 'stream', recorded: true, words: ['river', 'waterfall', 'flowing', 'rapids']},
  brook: {label: 'Little stream', icon: 'stream', recorded: true, words: ['stream', 'brook', 'creek', 'trickle', 'water']},
  campfire: {label: 'Campfire', icon: 'fire', recorded: true, words: ['campfire', 'fire', 'bonfire', 'camping', 'crackle', 'marshmallow']},
  fireplace: {label: 'Fireplace and purring cat', icon: 'fire', recorded: true, words: ['fireplace', 'hearth', 'cabin', 'cozy', 'grandma', 'living room']},
  wind: {label: 'Wind in the pines', icon: 'wind', recorded: true, words: ['wind', 'breeze', 'pines', 'forest', 'trees', 'woods', 'mountain']},
  crickets: {label: 'Crickets', icon: 'cricket', recorded: true, words: ['crickets', 'night', 'summer', 'meadow', 'countryside', 'camping']},
  purr: {label: 'Purring cat', icon: 'cat', recorded: true, words: ['cat', 'purr', 'kitten', 'purring', 'pet']},
  lullaby: {label: 'Music box', icon: 'note', recorded: true, words: ['lullaby', 'music box', 'song', 'melody', 'brahms', 'sing']},
  dreams: {label: 'Dreamy piano', icon: 'sparkle', recorded: true, words: ['piano', 'dream', 'clouds', 'music', 'float', 'space', 'stars']},
  white: {label: 'White noise', icon: 'wind', recorded: false, words: ['white noise', 'fan', 'static', 'shush', 'airplane']},
  pink: {label: 'Pink noise', icon: 'wind', recorded: false, words: ['pink noise', 'steady']},
  brown: {label: 'Brown noise', icon: 'wind', recorded: false, words: ['brown noise', 'deep', 'rumble', 'train', 'car', 'womb', 'hum']},
};

export const LAYER_IDS = Object.keys(LAYERS);
const isCustom = (id: string) => /^ai_[a-f0-9]{6,16}$/.test(id);
export const isRecorded = (id: string) => LAYERS[id]?.recorded ?? isCustom(id);

export type Preset = {id: string; label: string; icon: string; mix: Mix};
export const PRESETS: Preset[] = [
  {id: 'rain', label: 'Rain', icon: 'rain', mix: {rain: 0.75, rain_soft: 0.3}},
  {id: 'ocean', label: 'Ocean', icon: 'waves', mix: {ocean: 0.8}},
  {id: 'forest', label: 'Forest', icon: 'trees', mix: {wind: 0.45, brook: 0.35, crickets: 0.3}},
  {id: 'campfire', label: 'Campfire', icon: 'fire', mix: {campfire: 0.75, crickets: 0.25}},
  {id: 'cozy', label: 'Cozy', icon: 'cat', mix: {fireplace: 0.7, rain_soft: 0.3}},
  {id: 'lullaby', label: 'Lullaby', icon: 'note', mix: {lullaby: 0.6, rain_soft: 0.25}},
  {id: 'soft', label: 'Soft noise', icon: 'wind', mix: {brown: 0.6, pink: 0.25}},
  {id: 'quiet', label: 'Quiet', icon: 'quiet', mix: {}},
];

export const isQuiet = (m: Mix) => !Object.values(m).some(v => (v ?? 0) > 0.01);

/** Keep known (or Lyria-made) layers with levels in 0–1; at most five at once, loudest first. */
export function cleanMix(raw: any): Mix {
  const out: Mix = {};
  if (!raw || typeof raw !== 'object') {
    return out;
  }
  for (const [id, val] of Object.entries(raw)) {
    const v = Number(val);
    if ((LAYERS[id] || isCustom(id)) && v > 0.01) {
      out[id] = Math.round(Math.min(1, v) * 100) / 100;
    }
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 5));
}

/** Offline "ask": match the grown-up's words to the layers (the hub uses Lyria and Nova when it is there). */
export function mixFromWords(text: string): {name: string; mix: Mix} {
  const t = ` ${text.toLowerCase()} `;
  const no = (w: string) => new RegExp(`\\b(no|without|not)\\s+(\\w+\\s+)?${w}`).test(t);
  const mix: Mix = {};
  for (const id of LAYER_IDS) {
    const hit = LAYERS[id].words.filter(w => t.includes(w) && !no(w.split(' ')[0])).length;
    if (hit) {
      mix[id] = Math.min(0.8, 0.35 + 0.15 * hit);
    }
  }
  // "a little stream", "a bit of fire": that layer stays in the background
  for (const m of t.matchAll(/\b(?:little|tiny|bit of|touch of|hint of|soft)\s+(\w+)/g)) {
    for (const id of Object.keys(mix)) {
      if (LAYERS[id].words.some(w => w.split(' ').includes(m[1]))) {
        mix[id] = Math.min(mix[id] ?? 0, 0.3);
      }
    }
  }
  const name = text.trim().replace(/^./, c => c.toUpperCase()).slice(0, 40);
  return {name, mix: cleanMix(mix)};
}
