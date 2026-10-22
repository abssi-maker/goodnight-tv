// Small PCM helpers (16-bit little-endian mono).

export function wav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Linear resample of 16-bit mono PCM. */
export function resample(pcm, from, to) {
  if (from === to) return pcm;
  const n = Math.floor(((pcm.length / 2) * to) / from);
  const out = Buffer.alloc(n * 2);
  const last = pcm.length / 2 - 1;
  for (let i = 0; i < n; i++) {
    const x = (i * from) / to;
    const a = Math.min(Math.floor(x), last);
    const b = Math.min(a + 1, last);
    const f = x - a;
    out.writeInt16LE(Math.round(pcm.readInt16LE(a * 2) * (1 - f) + pcm.readInt16LE(b * 2) * f), i * 2);
  }
  return out;
}
