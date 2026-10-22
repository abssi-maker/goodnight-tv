// The light of the evening, in one place (the routine and the Light lab both use it).
// Everything follows the candle: how far it has burned (0 fresh … 0.9 a stub), and whether the real
// big light is off (then the candle is the only light: the room sinks, its glow takes over).
//   veil  black over the picture (0 = as painted, 1 = black)
//   warm  amber laid over the picture (the blue goes first, like a sunset)
//   room  how strongly the candle's glow lights the room (0–1)
//   dark  darkness gathering on the far side of the room, away from the candle (0–1)
//   cct   rough colour temperature of the screen's light, for the parent's curve
export type Light = {veil: number; warm: number; room: number; dark: number; cct: number};

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
/** Slow at first, steady in the middle, gentle at the end: how people perceive a candle burning down. */
const curve = (k: number) => k * k * (3 - 2 * k) * 0.55 + k * 0.45;

export function lightAt(burned: number, lampOff: boolean): Light {
  const k = clamp(burned / 0.9); // 0 → 1 over the candle's life
  const c = curve(k);
  const warm = clamp(0.06 + 0.34 * Math.min(1, k * 1.5), 0, 0.4); // warmth comes first
  const veil = clamp(0.06 + 0.5 * c + (lampOff ? 0.14 : 0), 0, 0.74);
  const dark = clamp(0.06 + 0.58 * c + (lampOff ? 0.24 : 0), 0, 0.92);
  const room = lampOff ? 0.92 : 0.4 + 0.35 * c;
  const cct = Math.round(6500 - (6500 - 1900) * clamp((warm - 0.06) / 0.34));
  return {veil, warm, room, dark, cct};
}

/** Approximate screen light, % of a bright kids' cartoon frame (mean luma ≈ 160). */
export const screenLight = (luma: number, l: Light, flameOn: boolean) => +(((luma * (1 - l.veil) * (1 - 0.55 * l.dark) + (flameOn ? l.room * 6 : 0)) / 160) * 100).toFixed(1);
