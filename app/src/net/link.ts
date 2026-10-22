// WebSocket link to the Goodnight TV hub on the home network. The TV owns every word; the hub voices
// them (recorded once, cached) and keeps the log of each night. The TV draws, plays sound, and reports.
import {SERVERS} from '../config';

export type ServerMsg =
  | {type: 'hello'; companionUrl?: string}
  | {type: 'voice'; pcm: Int16Array} // Bear's recorded voice, 24 kHz PCM16 (binary frame)
  | {type: 'caption'; text: string}
  | {type: 'clipEnd'; id: number; seconds: number}
  | {type: 'debugSay'; text: string} // development only: the hub makes Bear speak (no remote needed)
  | {type: 'debugLab'; state: Record<string, any>} // development only: set the Light lab (tuning the light curve)
  | {type: 'loop'; id: string; seq: number; total: number; pcm: Int16Array} // a sound layer, 24 kHz PCM16, in parts (binary)
  | {type: 'mix'; name: string; mix: Record<string, number> | null; line?: string}; // Nova's answer to "ask for a sound"

type Listener = (m: ServerMsg) => void;

// Binary frames from the hub: ['GNTV'][u32 total length][u16 header length][header JSON][PCM16 LE].
// Vega's WebSocket delivers a large message as several ~10 KB message events (friction #15), so
// the pieces are joined as a byte stream and cut back into frames by their length.
const MAGIC = [71, 78, 84, 86]; // 'GNTV'

function decodeFrame(f: Uint8Array): ServerMsg {
  const view = new DataView(f.buffer, f.byteOffset, f.byteLength);
  const hl = view.getUint16(8, true);
  let header = '';
  for (let i = 0; i < hl; i++) {
    header += String.fromCharCode(f[10 + i]); // the header is ASCII JSON
  }
  const h = JSON.parse(header);
  const start = 10 + hl;
  const pcm = new Int16Array(f.buffer.slice(f.byteOffset + start, f.byteOffset + f.byteLength)); // copy: may start at an odd offset
  return {...h, pcm} as ServerMsg;
}

class Link {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  connected = false;
  errors = 0; // messages that threw in a listener (reported in telemetry)
  frames = 0; // binary audio frames reassembled
  lastError = '';

  private attempt = 0;

  connect() {
    const ws = new WebSocket(`${SERVERS[this.attempt % SERVERS.length]}/tv`);
    (ws as any).binaryType = 'arraybuffer'; // in React Native, missing from Vega's WebSocket types
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      this.pending = new Uint8Array(0);
    };
    ws.onmessage = e => {
      const d: any = e.data;
      if (d && typeof d !== 'string' && !(d instanceof ArrayBuffer)) {
        // a Blob (binaryType not honoured): read it, then handle it like an ArrayBuffer
        const r = new FileReader();
        r.onload = () => this.handle(r.result as ArrayBuffer);
        r.onerror = () => this.fail(new Error('could not read a binary frame'), d);
        r.readAsArrayBuffer(d);
        return;
      }
      this.handle(d);
    };
    ws.onclose = () => {
      if (!this.connected) {
        this.attempt++; // never connected: try the next address
      }
      this.connected = false;
      setTimeout(() => this.connect(), 1500);
    };
    ws.onerror = () => {};
  }

  private pending = new Uint8Array(0);

  private handle(data: string | ArrayBuffer) {
    if (typeof data !== 'string') {
      this.stream(new Uint8Array(data));
      return;
    }
    try {
      const m = JSON.parse(data) as ServerMsg;
      this.listeners.forEach(l => l(m));
    } catch (err: any) {
      this.fail(err, data);
    }
  }

  /** Join binary pieces and emit every complete frame (by its length). */
  private stream(piece: Uint8Array) {
    const buf = new Uint8Array(this.pending.length + piece.length);
    buf.set(this.pending, 0);
    buf.set(piece, this.pending.length);
    let at = 0;
    while (buf.length - at >= 10) {
      if (MAGIC.some((b, i) => buf[at + i] !== b)) {
        this.fail(new Error('lost frame sync'), piece.buffer);
        at = buf.length; // drop what we have; the next frame starts a new message
        break;
      }
      const total = new DataView(buf.buffer, at + 4, 4).getUint32(0, true);
      if (buf.length - at < total) {
        break; // the rest of this frame is still on its way
      }
      try {
        const m = decodeFrame(buf.subarray(at, at + total));
        this.listeners.forEach(l => l(m));
      } catch (err: any) {
        this.fail(err, piece.buffer);
      }
      at += total;
      this.frames++;
    }
    this.pending = buf.slice(at);
  }

  private fail(err: any, d: any) {
    this.errors++;
    this.lastError = `${String(err?.message ?? err).slice(0, 100)} · data: ${typeof d} ${Object.prototype.toString.call(d)} ${typeof d === 'string' ? d.length : d?.byteLength ?? d?.size ?? ''}`;
  }

  send(m: object) {
    const s = JSON.stringify(m);
    // Offline messages are dropped, not queued: a voice line replayed minutes later would be wrong.
    if (this.ws && this.connected) {
      this.ws.send(s);
    }
  }

  on(l: Listener) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }
}

export const link = new Link();
