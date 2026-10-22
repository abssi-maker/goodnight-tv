// Flat icons in the style of the v11 design, 100×100, drawn with fills and strokes only
// (Vega's SvgXml ignores the `opacity` attribute; fill-opacity works). INK is the icon's main colour,
// swapped per use (cream on night, navy on honey).
import React, {memo} from 'react';
import {SvgXml} from '@amazon-devices/react-native-svg';

const P: Record<string, string> = {
  tooth: `<path d="M28 28 C 28 14, 45 13, 50 20 C 55 13, 72 14, 72 28 C 72 46, 65 54, 63 78 C 62 88, 54 88, 53 78 L50 60 L47 78 C 46 88, 38 88, 37 78 C 35 54, 28 46, 28 28 Z" fill="INK"/><path d="M36 28 Q40 23 45 27" stroke="#CFE3F5" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  pajamas: `<path d="M30 20 L42 15 Q50 23 58 15 L70 20 L86 36 L74 46 L68 40 L68 84 L32 84 L32 40 L26 46 L14 36 Z" fill="#B9A6F0"/><path d="M42 15 Q50 23 58 15" stroke="#8D78D6" stroke-width="3" fill="none"/><circle cx="50" cy="40" r="3.2" fill="#FFFFFF"/><circle cx="50" cy="54" r="3.2" fill="#FFFFFF"/><circle cx="50" cy="68" r="3.2" fill="#FFFFFF"/>`,
  book: `<path d="M12 26 Q30 18 50 28 Q70 18 88 26 L88 78 Q70 70 50 80 Q30 70 12 78 Z" fill="INK"/><path d="M50 28 L50 80" stroke="#8FA2D8" stroke-width="3"/><path d="M21 38 Q32 34 42 39 M21 49 Q32 45 42 50 M21 60 Q32 56 42 61 M58 39 Q68 34 79 38 M58 50 Q68 45 79 49 M58 61 Q68 56 79 60" stroke="#8FA2D8" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  moon: `<path d="M62 14 A 36 36 0 1 0 86 66 A 30 30 0 1 1 62 14 Z" fill="INK"/>`,
  lamp: `<path d="M32 18 L68 18 L78 46 L22 46 Z" fill="#FBD878"/><rect x="47" y="46" width="6" height="28" fill="INK"/><rect x="34" y="74" width="32" height="8" rx="4" fill="INK"/>`,
  soap: `<rect x="24" y="42" width="52" height="38" rx="13" fill="#9FD8F0"/><circle cx="38" cy="30" r="8" fill="INK"/><circle cx="56" cy="22" r="6" fill="INK"/><circle cx="68" cy="34" r="5" fill="INK"/>`,
  cup: `<path d="M28 26 L72 26 L66 84 L34 84 Z" fill="INK"/><path d="M31 44 L69 44 L66 84 L34 84 Z" fill="#8FC8F0"/>`,
  bunny: `<ellipse cx="38" cy="26" rx="8" ry="20" fill="INK"/><ellipse cx="62" cy="26" rx="8" ry="20" fill="INK"/><ellipse cx="38" cy="28" rx="3.5" ry="12" fill="#F2B3B8"/><ellipse cx="62" cy="28" rx="3.5" ry="12" fill="#F2B3B8"/><circle cx="50" cy="60" r="24" fill="INK"/><circle cx="42" cy="56" r="3" fill="#1A1E3A"/><circle cx="58" cy="56" r="3" fill="#1A1E3A"/><ellipse cx="50" cy="64" rx="3.5" ry="2.6" fill="#F29BA6"/>`,
  rain: `<path d="M26 56 C 12 56, 12 36, 28 36 C 30 20, 54 16, 60 30 C 74 24, 88 36, 80 50 C 86 56, 80 60, 74 58 Z" fill="#7FA6F0"/><path d="M30 68 L26 80 M44 68 L40 80 M58 68 L54 80 M72 68 L68 80" stroke="#7FA6F0" stroke-width="5" stroke-linecap="round"/>`,
  wind: `<path d="M14 36 L62 36 C 76 36, 76 18, 64 18 C 58 18, 56 22, 56 26 M14 52 L78 52 C 92 52, 92 72, 78 72 C 72 72, 70 68, 70 64 M14 68 L48 68" stroke="INK" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  trees: `<path d="M34 12 L54 46 L44 46 L58 70 L10 70 L24 46 L14 46 Z" fill="#6CC28A"/><rect x="31" y="70" width="6" height="14" fill="#8A5A3A"/><path d="M68 24 L84 52 L76 52 L88 74 L48 74 L60 52 L52 52 Z" fill="#4FA472"/><rect x="65" y="74" width="6" height="10" fill="#8A5A3A"/>`,
  quiet: `<path d="M56 22 A 30 30 0 1 0 82 66 A 25 25 0 1 1 56 22 Z" fill="#FBD878"/><path d="M22 20 L24 26 L30 28 L24 30 L22 36 L20 30 L14 28 L20 26 Z M78 14 L79.5 18 L84 19.5 L79.5 21 L78 25 L76.5 21 L72 19.5 L76.5 18 Z" fill="INK"/>`,
  clock: `<circle cx="50" cy="50" r="34" stroke="INK" stroke-width="7" fill="none"/><path d="M50 30 L50 52 L64 60" stroke="INK" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  sun: `<circle cx="50" cy="50" r="17" fill="INK"/><path d="M50 12 L50 22 M50 78 L50 88 M12 50 L22 50 M78 50 L88 50 M23 23 L30 30 M70 70 L77 77 M77 23 L70 30 M30 70 L23 77" stroke="INK" stroke-width="6" stroke-linecap="round"/>`,
  people: `<circle cx="36" cy="34" r="13" fill="INK"/><path d="M12 80 C 12 58, 60 58, 60 80 Z" fill="INK"/><circle cx="68" cy="40" r="11" fill="INK"/><path d="M58 62 C 70 58, 90 62, 90 80 L64 80 C 64 72, 62 66, 58 62 Z" fill="INK"/>`,
  check: `<path d="M18 52 L40 74 L84 28" stroke="INK" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  play: `<path d="M28 16 L84 50 L28 84 Z" fill="INK" stroke="INK" stroke-width="6" stroke-linejoin="round"/>`,
  plus: `<path d="M50 18 L50 82 M18 50 L82 50" stroke="INK" stroke-width="10" stroke-linecap="round"/>`,
  minus: `<path d="M18 50 L82 50" stroke="INK" stroke-width="10" stroke-linecap="round"/>`,
  speaker: `<path d="M14 38 L32 38 L54 18 L54 82 L32 62 L14 62 Z" fill="INK"/><path d="M66 34 Q76 50 66 66 M76 24 Q92 50 76 76" stroke="INK" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  leaf: `<path d="M18 82 C 18 40, 46 18, 86 16 C 84 56, 62 82, 18 82 Z" fill="INK"/><path d="M22 78 L66 34" stroke="#18213F" stroke-width="5" stroke-linecap="round"/>`,
  waves: `<path d="M8 40 Q20 28 32 40 T56 40 T80 40 T96 40" stroke="#7FA6F0" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M8 60 Q20 48 32 60 T56 60 T80 60 T96 60" stroke="INK" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M8 80 Q20 68 32 80 T56 80 T80 80 T96 80" stroke="#7FA6F0" stroke-width="7" fill="none" stroke-linecap="round"/>`,
  stream: `<path d="M30 10 C 10 34, 60 44, 40 64 C 30 76, 50 86, 46 94" stroke="#7FA6F0" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M60 10 C 44 30, 86 42, 70 62 C 62 74, 78 84, 74 94" stroke="INK" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  fire: `<path d="M50 10 C 66 30, 82 44, 78 64 C 74 82, 62 90, 50 90 C 36 90, 22 80, 22 62 C 22 46, 34 40, 36 26 C 44 36, 46 42, 50 44 C 54 32, 52 20, 50 10 Z" fill="#F4A64A"/><path d="M50 50 C 60 60, 66 68, 62 78 C 58 86, 42 86, 38 78 C 34 70, 42 62, 50 50 Z" fill="#FBD878"/>`,
  cricket: `<ellipse cx="54" cy="58" rx="26" ry="14" fill="#6CC28A"/><circle cx="28" cy="52" r="10" fill="#6CC28A"/><path d="M22 44 Q12 22 4 18 M28 42 Q24 20 30 10" stroke="INK" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M60 70 L72 88 M44 70 L38 86 M70 50 L90 40 L84 70" stroke="#4FA472" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  cat: `<path d="M22 34 L28 12 L42 28 Q50 26 58 28 L72 12 L78 34 Q84 46 80 60 Q74 80 50 82 Q26 80 20 60 Q16 46 22 34 Z" fill="INK"/><path d="M36 52 Q40 48 44 52 M56 52 Q60 48 64 52" stroke="#1A1E3A" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M46 62 L54 62 L50 67 Z" fill="#F29BA6"/>`,
  note: `<path d="M40 74 L40 22 L80 12 L80 62" stroke="INK" stroke-width="7" fill="none" stroke-linejoin="round"/><ellipse cx="31" cy="74" rx="12" ry="9" fill="#FBD878"/><ellipse cx="71" cy="64" rx="12" ry="9" fill="#FBD878"/>`,
  sparkle: `<path d="M50 6 L59 41 L94 50 L59 59 L50 94 L41 59 L6 50 L41 41 Z" fill="INK"/>`,
  page: `<path d="M20 18 L64 18 L82 36 L82 84 L20 84 Z" fill="INK"/><path d="M64 18 L64 36 L82 36" fill="#C9D2F0"/><path d="M32 50 L70 50 M32 62 L70 62 M32 74 L56 74" stroke="#8FA2D8" stroke-width="5" stroke-linecap="round"/>`,
};

export const Icon = memo(({name, size, ink = '#FFFFFF'}: {name: string; size: number; ink?: string}) => (
  <SvgXml xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${(P[name] ?? '').replace(/INK/g, ink)}</svg>`} width={size} height={size} />
));
