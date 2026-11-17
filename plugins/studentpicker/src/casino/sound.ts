// Sound effects of the casino skin, synthesised with the Web Audio API (no files, works offline).
// Ported from ClassroomCasino's js/audio.js.

interface ToneOptions {
  freq: number;
  to?: number;
  at?: number;
  dur?: number;
  gain?: number;
  attack?: number;
  type?: OscillatorType;
  lowpass?: number;
}

interface NoiseOptions {
  freq?: number;
  to?: number;
  at?: number;
  dur?: number;
  gain?: number;
  attack?: number;
  q?: number;
  filter?: BiquadFilterType;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let enabled = true;

function ensure(): { c: AudioContext; out: GainNode } | null {
  if (!enabled || typeof AudioContext === 'undefined') return null;
  if (!ctx || !master) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.8;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 4;
    master.connect(compressor);
    compressor.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { c: ctx, out: master };
}

function envelope(c: AudioContext, gain: GainNode, t: number, peak: number, attack: number, dur: number): void {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone(o: ToneOptions): void {
  const audio = ensure();
  if (!audio) return;
  const { c, out } = audio;
  const t = c.currentTime + (o.at ?? 0);
  const dur = o.dur ?? 0.2;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  envelope(c, gain, t, o.gain ?? 0.2, o.attack ?? 0.004, dur);
  let node: AudioNode = osc;
  if (o.lowpass) {
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = o.lowpass;
    osc.connect(filter);
    node = filter;
  }
  node.connect(gain);
  gain.connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(o: NoiseOptions): void {
  const audio = ensure();
  if (!audio || !noiseBuffer) return;
  const { c, out } = audio;
  const t = c.currentTime + (o.at ?? 0);
  const dur = o.dur ?? 0.1;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = o.filter ?? 'bandpass';
  filter.frequency.setValueAtTime(o.freq ?? 3000, t);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  filter.Q.value = o.q ?? 1;
  const gain = c.createGain();
  envelope(c, gain, t, o.gain ?? 0.2, o.attack ?? 0.004, dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

const note = (n: number): number => 440 * 2 ** ((n - 69) / 12);

function arpeggio(notes: number[], step: number, o: Omit<ToneOptions, 'freq'>): void {
  notes.forEach((n, i) => tone({ ...o, freq: note(n), at: (o.at ?? 0) + i * step }));
}

export const sound = {
  setEnabled(on: boolean): void {
    enabled = on;
    if (!on) void ctx?.suspend();
  },
  click(): void {
    tone({ freq: 900, type: 'triangle', dur: 0.06, gain: 0.08 });
  },
  deal(): void {
    noise({ freq: 1800, to: 6500, q: 0.7, dur: 0.16, gain: 0.22, attack: 0.02 });
    noise({ at: 0.15, freq: 2500, q: 1.5, dur: 0.04, gain: 0.16 });
  },
  flip(): void {
    noise({ freq: 3200, to: 1600, q: 1.2, dur: 0.09, gain: 0.2 });
  },
  chip(): void {
    const base = 2600 + Math.random() * 300;
    [1, 1.47, 2.09].forEach((m, i) => tone({ freq: base * m, dur: 0.16 - i * 0.03, gain: 0.07 / (i + 1) }));
    [1, 1.52].forEach((m) => tone({ at: 0.06, freq: base * 1.08 * m, dur: 0.12, gain: 0.05 }));
  },
  shuffle(): void {
    for (let i = 0; i < 18; i++) {
      noise({ at: i * 0.035 + Math.random() * 0.01, freq: 2500 + Math.random() * 2500, q: 2, dur: 0.03, gain: 0.12 });
    }
    noise({ at: 0.7, freq: 1500, q: 0.8, dur: 0.18, gain: 0.18 });
  },
  /** The ball rolling round the wooden track, fading as it slows. */
  roll(seconds: number): void {
    const d = Math.max(0.5, seconds);
    noise({ freq: 1500, to: 520, q: 0.7, dur: d, gain: 0.11, attack: 0.12 });
    noise({ freq: 260, to: 140, q: 0.9, dur: d * 0.9, gain: 0.07, attack: 0.2 });
  },
  /** The ball hitting a diamond or a fret. */
  clack(intensity: number): void {
    noise({ freq: 3800 + Math.random() * 1200, q: 2.5, dur: 0.035, gain: 0.26 * intensity });
    tone({ freq: 2300 + Math.random() * 700, type: 'triangle', dur: 0.05, gain: 0.07 * intensity });
  },
  /** The croupier's bell when the number is called. */
  ding(): void {
    for (const [freq, at] of [
      [1568, 0],
      [2093, 0.14],
    ] as const) {
      tone({ at, freq, dur: 1.1, gain: 0.12 });
      tone({ at, freq: freq * 2.76, dur: 0.5, gain: 0.025 });
    }
  },
  peek(): void {
    noise({ freq: 2000, to: 3000, q: 1, dur: 0.12, gain: 0.1 });
  },
  win(): void {
    arpeggio([72, 76, 79, 84], 0.09, { type: 'triangle', dur: 0.35, gain: 0.16 });
    arpeggio([60, 64, 67], 0, { at: 0.36, dur: 0.9, gain: 0.08 });
    tone({ at: 0.36, freq: note(84), type: 'triangle', dur: 0.9, gain: 0.1 });
  },
  blackjack(): void {
    arpeggio([72, 76, 79, 84, 88, 91, 96], 0.06, { type: 'triangle', dur: 0.3, gain: 0.14 });
    arpeggio([60, 64, 67, 72], 0, { at: 0.45, type: 'sawtooth', lowpass: 2400, dur: 1.4, gain: 0.05 });
    for (let i = 0; i < 10; i++) tone({ at: 0.5 + i * 0.07, freq: note(96 + (i % 3) * 4), dur: 0.12, gain: 0.04 });
  },
  lose(): void {
    tone({ freq: note(62), to: note(61), type: 'sawtooth', lowpass: 1200, dur: 0.38, gain: 0.12 });
    tone({ at: 0.36, freq: note(61), to: note(60), type: 'sawtooth', lowpass: 1100, dur: 0.38, gain: 0.12 });
    tone({ at: 0.72, freq: note(60), to: note(55), type: 'sawtooth', lowpass: 900, dur: 0.9, gain: 0.12 });
  },
  push(): void {
    tone({ freq: note(67), type: 'triangle', dur: 0.25, gain: 0.12 });
    tone({ at: 0.18, freq: note(67), type: 'triangle', dur: 0.35, gain: 0.1 });
  },
  bust(): void {
    tone({ freq: 160, to: 55, dur: 0.4, gain: 0.35 });
    noise({ freq: 300, filter: 'lowpass', dur: 0.25, gain: 0.25 });
  },
};
