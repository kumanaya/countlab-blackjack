/* Sound effects synthesized with WebAudio — no audio files. */

const STORE_KEY = 'countlab.sound.v1';

type ToneOpts = { freq?: number; dur?: number; type?: OscillatorType; gain?: number; at?: number; glide?: number };
type NoiseOpts = { dur?: number; freq?: number; q?: number; gain?: number; at?: number; sweep?: number; type?: BiquadFilterType };

export class Sfx {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(STORE_KEY) === 'off';
    } catch {
      this.muted = false;
    }
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      localStorage.setItem(STORE_KEY, muted ? 'off' : 'on');
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
    }
  }

  toggle() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.2, at = 0, glide = 0 }: ToneOpts) {
    const ctx = this.ensure();
    if (!ctx || this.muted || !this.master) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + glide), t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env);
    env.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.16, freq = 2200, q = 0.9, gain = 0.18, at = 0, sweep = 0, type = 'bandpass' }: NoiseOpts) {
    const ctx = this.ensure();
    if (!ctx || this.muted || !this.master) return;
    const t0 = ctx.currentTime + at;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const k = 1 - i / len;
      data[i] = (Math.random() * 2 - 1) * k * k;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t0);
    filter.Q.value = q;
    if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(120, freq + sweep), t0 + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(env);
    env.connect(this.master);
    src.start(t0);
    src.stop(t0 + dur);
  }

  deal() {
    this.noise({ dur: 0.13, freq: 2600, q: 1.1, gain: 0.16, sweep: -1500 });
    this.tone({ freq: 320, dur: 0.05, type: 'triangle', gain: 0.05 });
  }

  flip() {
    this.noise({ dur: 0.09, freq: 3400, q: 1.6, gain: 0.13, sweep: -2200 });
    this.tone({ freq: 620, dur: 0.06, type: 'triangle', gain: 0.07, at: 0.03 });
  }

  /** Ceramic chips: two short, high clicks. */
  chip(at = 0) {
    this.tone({ freq: 2350, dur: 0.045, type: 'sine', gain: 0.09, at });
    this.tone({ freq: 3100, dur: 0.035, type: 'sine', gain: 0.06, at: at + 0.012 });
    this.noise({ dur: 0.05, freq: 5200, q: 2.4, gain: 0.07, at: at + 0.04 });
    this.tone({ freq: 2650, dur: 0.04, type: 'sine', gain: 0.05, at: at + 0.05 });
  }

  click() {
    this.tone({ freq: 1400, dur: 0.035, type: 'square', gain: 0.03 });
  }

  shuffle() {
    for (let i = 0; i < 8; i++) {
      this.noise({ dur: 0.11, freq: 2400 + Math.random() * 1600, q: 1.2, gain: 0.1, at: i * 0.06 });
    }
  }

  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.3, type: 'sine', gain: 0.14, at: i * 0.075 })
    );
    for (let i = 0; i < 4; i++) this.chip(0.35 + i * 0.07);
  }

  blackjack() {
    [659.25, 830.61, 987.77, 1318.5, 1661.2].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.38, type: 'triangle', gain: 0.14, at: i * 0.07 })
    );
  }

  loss() {
    this.tone({ freq: 240, dur: 0.34, type: 'sine', gain: 0.16, glide: -110 });
    this.tone({ freq: 132, dur: 0.4, type: 'triangle', gain: 0.1, at: 0.03, glide: -50 });
  }

  push() {
    this.tone({ freq: 440, dur: 0.2, type: 'sine', gain: 0.11 });
    this.tone({ freq: 440, dur: 0.2, type: 'sine', gain: 0.07, at: 0.11 });
  }

  correct() {
    this.tone({ freq: 784, dur: 0.12, type: 'sine', gain: 0.13 });
    this.tone({ freq: 1175, dur: 0.16, type: 'sine', gain: 0.11, at: 0.09 });
  }

  wrong() {
    this.tone({ freq: 300, dur: 0.14, type: 'square', gain: 0.08 });
    this.tone({ freq: 200, dur: 0.2, type: 'square', gain: 0.07, at: 0.1 });
  }
}
