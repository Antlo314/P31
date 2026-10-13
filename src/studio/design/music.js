// Original background music for the Design studio, composed in the browser (Web Audio,
// rendered offline) so every track is P31's own: no licences, no copyright claims, any length.
// Eight moods in the brand's voice — gospel keys, worship pads, neo-soul, a confident bounce.
// renderTrack(key, seconds) → AudioBuffer; the same key and seed always sound the same.
import { rand } from './patterns';

export const TRACKS = [
  { key: 'sunday-keys', name: 'Sunday Keys', mood: 'Warm gospel piano, a soft groove', bpm: 72 },
  { key: 'worship-rise', name: 'Worship Rise', mood: 'Pads that swell, piano on top', bpm: 64 },
  { key: 'golden-hour', name: 'Golden Hour', mood: 'Smooth neo-soul keys', bpm: 88 },
  { key: 'lofi-grind', name: 'Lo-fi Grind', mood: 'Laid-back beat to build to', bpm: 82 },
  { key: 'boss-moves', name: 'Boss Moves', mood: 'Confident trap bounce', bpm: 140 },
  { key: 'bright-open', name: 'Bright & Open', mood: 'Feel-good, upbeat', bpm: 116 },
  { key: 'still-waters', name: 'Still Waters', mood: 'Gentle, reflective piano', bpm: 66 },
  { key: 'sunday-best', name: 'Sunday Best', mood: 'Organ and hand claps, celebration', bpm: 104 },
];
export const trackOf = (key) => TRACKS.find((t) => t.key === key) || null;

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const CH = {
  maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dom7: [0, 4, 7, 10], maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14], add9: [0, 4, 7, 14], sus2: [0, 2, 7], sus4: [0, 5, 7], dom9: [0, 4, 7, 10, 14], dom13sus: [0, 5, 10, 14, 21],
};
/** Chord tones folded into a comfortable range (a close, warm voicing). */
function voice(root, type, low = 55, high = 76) {
  const out = CH[type].map((i) => { let m = root + i; while (m < low) m += 12; while (m > high) m -= 12; return m; });
  return [...new Set(out)].sort((a, b) => a - b);
}

// ── The mixer: a bus with reverb, compression and a master fade ─────────────
class Mix {
  constructor(ctx, seconds, seed) {
    this.ctx = ctx; this.r = rand(seed); this.len = seconds;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.008; comp.release.value = 0.22; comp.knee.value = 8;
    this.tone = ctx.createBiquadFilter(); this.tone.type = 'lowpass'; this.tone.frequency.value = 16000;
    this.bus = ctx.createGain(); this.bus.gain.value = 0.8;
    this.bus.connect(this.tone); this.tone.connect(comp); comp.connect(this.master); this.master.connect(ctx.destination);
    // Reverb: a generated hall (stereo noise with an exponential tail).
    const sr = ctx.sampleRate; const n = Math.floor(sr * 2.6);
    const ir = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c += 1) { const d = ir.getChannelData(c); const rr = rand(seed + 17 + c); for (let i = 0; i < n; i += 1) d[i] = (rr() * 2 - 1) * (1 - i / n) ** 3.2; }
    this.verb = ctx.createConvolver(); this.verb.buffer = ir;
    this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.9;
    const dark = ctx.createBiquadFilter(); dark.type = 'lowpass'; dark.frequency.value = 5200; // a warm room, not a hissy one
    this.verbIn.connect(this.verb); this.verb.connect(dark); dark.connect(this.bus);
    // White noise for drums and texture.
    const nb = ctx.createBuffer(1, sr * 2, sr); const nd = nb.getChannelData(0); const nr = rand(seed + 5);
    for (let i = 0; i < nd.length; i += 1) nd[i] = nr() * 2 - 1;
    this.noiseBuf = nb;
    // Fade in, fade out.
    const g = this.master.gain;
    g.setValueAtTime(0, 0); g.linearRampToValueAtTime(1, 0.25);
    const out = Math.max(0.5, seconds - 1.6);
    g.setValueAtTime(1, out); g.linearRampToValueAtTime(0, Math.max(out + 0.1, seconds - 0.04));
  }
  /** Route a voice to the bus (level, pan, reverb send); returns its input node. */
  out({ level = 1, pan = 0, verb = 0.2 } = {}) {
    const g = this.ctx.createGain(); g.gain.value = level;
    const p = this.ctx.createStereoPanner(); p.pan.value = pan;
    g.connect(p); p.connect(this.bus);
    if (verb) { const s = this.ctx.createGain(); s.gain.value = verb; p.connect(s); s.connect(this.verbIn); }
    return g;
  }
  noise(t, dur, dest) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.connect(dest); src.start(t, this.r() * 1.5, dur + 0.05);
    return src;
  }
  jitter(ms = 8) { return (this.r() - 0.5) * (ms / 1000); }
  vel(v, spread = 0.12) { return Math.max(0.05, v * (1 - spread / 2 + this.r() * spread)); }
}

// ── Instruments ──────────────────────────────────────────────────────────────
const env = (param, t, peak, attack, decayTo, decayTime, end, release) => {
  param.setValueAtTime(0.0001, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.setTargetAtTime(decayTo, t + attack, decayTime);
  param.setTargetAtTime(0.0001, end, release);
};
const waves = new WeakMap();
function pianoWave(ctx) {
  if (!waves.has(ctx)) {
    const amps = [0, 1, 0.45, 0.26, 0.15, 0.09, 0.06, 0.04, 0.025, 0.015];
    const real = new Float32Array(amps.length); const imag = Float32Array.from(amps);
    const organ = [0, 1, 0.75, 0.42, 0.55, 0, 0.22, 0, 0.18];
    waves.set(ctx, { piano: ctx.createPeriodicWave(real, imag), organ: ctx.createPeriodicWave(new Float32Array(organ.length), Float32Array.from(organ)) });
  }
  return waves.get(ctx);
}

function piano(mx, dest, m, t, dur, v = 0.5) {
  const { ctx } = mx; const f = mtof(m);
  const o = ctx.createOscillator(); o.setPeriodicWave(pianoWave(ctx).piano); o.frequency.value = f;
  const o2 = ctx.createOscillator(); o2.setPeriodicWave(pianoWave(ctx).piano); o2.frequency.value = f; o2.detune.value = 4;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4;
  lp.frequency.setValueAtTime(Math.min(14000, f * 9), t); lp.frequency.setTargetAtTime(Math.max(700, f * 2.2), t + 0.01, 0.5);
  const g = ctx.createGain();
  const decay = 1.4 - Math.min(0.8, (m - 48) / 60);
  env(g.gain, t, v * 0.32, 0.004, v * 0.06, decay, t + dur, 0.18);
  o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(dest);
  o.start(t); o2.start(t); o.stop(t + dur + 1); o2.stop(t + dur + 1);
}

function keys(mx, dest, m, t, dur, v = 0.5) { // electric piano (two-operator FM)
  const { ctx } = mx; const f = mtof(m);
  const car = ctx.createOscillator(); car.frequency.value = f;
  const mod = ctx.createOscillator(); mod.frequency.value = f;
  const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 1.6 * v + 40, t); mg.gain.setTargetAtTime(f * 0.18, t, 0.35);
  const tine = ctx.createOscillator(); tine.frequency.value = f * 14;
  const tg = ctx.createGain(); tg.gain.setValueAtTime(f * 0.9 * v, t); tg.gain.setTargetAtTime(0, t, 0.025);
  mod.connect(mg); mg.connect(car.frequency); tine.connect(tg); tg.connect(car.frequency);
  const g = ctx.createGain();
  env(g.gain, t, v * 0.3, 0.006, v * 0.12, 1.1, t + dur, 0.2);
  car.connect(g); g.connect(dest);
  [car, mod, tine].forEach((o) => { o.start(t); o.stop(t + dur + 1.2); });
}

function organ(mx, dest, m, t, dur, v = 0.5) {
  const { ctx } = mx; const f = mtof(m);
  const o = ctx.createOscillator(); o.setPeriodicWave(pianoWave(ctx).organ); o.frequency.value = f;
  const sub = ctx.createOscillator(); sub.frequency.value = f / 2;
  const vib = ctx.createOscillator(); vib.frequency.value = 6.1; const vg = ctx.createGain(); vg.gain.value = 7;
  vib.connect(vg); vg.connect(o.detune);
  const sg = ctx.createGain(); sg.gain.value = 0.35;
  const g = ctx.createGain();
  env(g.gain, t, v * 0.16, 0.012, v * 0.14, 2, t + dur, 0.06);
  o.connect(g); sub.connect(sg); sg.connect(g); g.connect(dest);
  [o, sub, vib].forEach((x) => { x.start(t); x.stop(t + dur + 0.5); });
}

function pad(mx, dest, m, t, dur, v = 0.5, attack = 1.1) {
  const { ctx } = mx; const f = mtof(m);
  const g = ctx.createGain();
  env(g.gain, t, v * 0.07, attack, v * 0.06, 3, t + dur, 0.9);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(2400, f * 4.5); lp.Q.value = 0.3;
  [-9, 0, 8].forEach((d) => {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d + mx.jitter(4) * 1000;
    o.connect(lp); o.start(t); o.stop(t + dur + 4);
  });
  lp.connect(g); g.connect(dest);
}

function bell(mx, dest, m, t, dur, v = 0.5) { // a soft pluck/bell for melodies
  const { ctx } = mx; const f = mtof(m);
  const car = ctx.createOscillator(); car.frequency.value = f;
  const mod = ctx.createOscillator(); mod.frequency.value = f * 3.5;
  const mg = ctx.createGain(); mg.gain.setValueAtTime(f * 2.2, t); mg.gain.setTargetAtTime(f * 0.1, t, 0.12);
  mod.connect(mg); mg.connect(car.frequency);
  const g = ctx.createGain(); env(g.gain, t, v * 0.22, 0.003, 0.0001, 0.28, t + Math.min(dur, 1.2), 0.1);
  car.connect(g); g.connect(dest);
  [car, mod].forEach((o) => { o.start(t); o.stop(t + 1.8); });
}

function bass(mx, dest, m, t, dur, v = 0.6) {
  const { ctx } = mx; const f = mtof(m);
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
  const s = ctx.createOscillator(); s.frequency.value = f;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
  const g = ctx.createGain(); env(g.gain, t, v * 0.42, 0.01, v * 0.3, 0.6, t + dur, 0.07);
  o.connect(lp); s.connect(lp); lp.connect(g); g.connect(dest);
  [o, s].forEach((x) => { x.start(t); x.stop(t + dur + 0.4); });
}

let shaperCurve = null;
function eight08(mx, dest, m, t, dur, v = 0.7) {
  const { ctx } = mx; const f = mtof(m);
  const o = ctx.createOscillator(); o.frequency.setValueAtTime(f * 1.9, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.045);
  if (!shaperCurve) { shaperCurve = new Float32Array(1024); for (let i = 0; i < 1024; i += 1) { const x = (i / 1023) * 2 - 1; shaperCurve[i] = Math.tanh(x * 2.4); } }
  const ws = ctx.createWaveShaper(); ws.curve = shaperCurve;
  const g = ctx.createGain(); env(g.gain, t, v * 0.5, 0.004, 0.0001, Math.max(0.25, dur * 0.55), t + dur, 0.08);
  o.connect(ws); ws.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.4);
}

function kick(mx, dest, t, v = 0.9) {
  const { ctx } = mx;
  const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.11);
  const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.45);
}
function snare(mx, dest, t, v = 0.6) {
  const { ctx } = mx;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7;
  const g = ctx.createGain(); g.gain.setValueAtTime(v * 0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  mx.noise(t, 0.22, bp); bp.connect(g); g.connect(dest);
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 185;
  const og = ctx.createGain(); og.gain.setValueAtTime(v * 0.5, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(og); og.connect(dest); o.start(t); o.stop(t + 0.12);
}
function clap(mx, dest, t, v = 0.6) {
  const { ctx } = mx;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1250; bp.Q.value = 1.1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  [0, 0.011, 0.023].forEach((d) => { g.gain.setValueAtTime(v, t + d); g.gain.exponentialRampToValueAtTime(v * 0.15, t + d + 0.009); });
  g.gain.setValueAtTime(v * 0.8, t + 0.033); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  mx.noise(t, 0.25, bp); bp.connect(g); g.connect(dest);
}
function hat(mx, dest, t, v = 0.3, open = false) {
  const { ctx } = mx;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7200;
  const g = ctx.createGain(); g.gain.setValueAtTime(v * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.32 : 0.05));
  mx.noise(t, open ? 0.35 : 0.07, hp); hp.connect(g); g.connect(dest);
}
function rim(mx, dest, t, v = 0.4) {
  const { ctx } = mx;
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 1650;
  const g = ctx.createGain(); g.gain.setValueAtTime(v * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.05);
  hat(mx, dest, t, v * 0.5);
}
function shaker(mx, dest, t, v = 0.2) {
  const { ctx } = mx;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5200;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.24, t + 0.018); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  mx.noise(t, 0.1, hp); hp.connect(g); g.connect(dest);
}
function crackle(mx, dest, seconds) { // vinyl texture
  const { ctx } = mx; const sr = ctx.sampleRate;
  const b = ctx.createBuffer(1, Math.ceil(sr * seconds), sr); const d = b.getChannelData(0); const r = rand(99);
  for (let i = 0; i < d.length; i += 1) d[i] = (r() * 2 - 1) * 0.012 + (r() < 0.00045 ? (r() * 2 - 1) * 0.5 : 0);
  const src = ctx.createBufferSource(); src.buffer = b;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
  src.connect(hp); hp.connect(dest); src.start(0);
}

// ── A melody that moves mostly by step through the scale, on chord tones when it lands ──
function melody(mx, scale, chordNotes, { from = 67, to = 81, slots = 8, density = 0.45 }) {
  const pool = []; for (let m = from; m <= to; m += 1) if (scale.includes(((m % 12) + 12) % 12)) pool.push(m);
  let idx = Math.floor(pool.length / 2);
  const out = [];
  for (let s = 0; s < slots; s += 1) {
    if (mx.r() > density && s !== 0) continue;
    idx = Math.max(0, Math.min(pool.length - 1, idx + Math.round((mx.r() - 0.5) * 3.2)));
    let m = pool[idx];
    if (s % 4 === 0) { const near = chordNotes.map((c) => { let x = c; while (x < from) x += 12; while (x > to) x -= 12; return x; }); m = near.reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a), m); }
    out.push({ s, m });
  }
  return out;
}
const MAJOR = (root) => [0, 2, 4, 5, 7, 9, 11].map((i) => (root + i) % 12);
const MINOR_PENT = (root) => [0, 3, 5, 7, 10].map((i) => (root + i) % 12);
const MAJOR_PENT = (root) => [0, 2, 4, 7, 9].map((i) => (root + i) % 12);

// ── The tracks ───────────────────────────────────────────────────────────────
// Each schedules `bars` bars of 4 beats; `at(bar, beat)` gives the time of a beat (with swing).
const SONGS = {
  'sunday-keys': {
    prog: [[56, 'maj9'], [53, 'm9'], [49, 'maj9'], [51, 'dom13sus']],
    swing: 0.5,
    play(mx, { bars, at, spb }) {
      const keysOut = mx.out({ level: 1, verb: 0.35 }); const padOut = mx.out({ level: 0.7, verb: 0.5 });
      const low = mx.out({ level: 1, verb: 0.05 }); const drums = mx.out({ level: 0.75, verb: 0.12 });
      for (let b = 0; b < bars; b += 1) {
        const [root, type] = this.prog[b % 4];
        const ch = voice(root, type, 56, 75);
        ch.forEach((m) => { piano(mx, keysOut, m, at(b, 0) + mx.jitter(), spb * 1.7, mx.vel(0.5)); piano(mx, keysOut, m, at(b, 1.5) + mx.jitter(), spb * 0.9, mx.vel(0.3)); piano(mx, keysOut, m, at(b, 2.5) + mx.jitter(), spb * 1.4, mx.vel(0.38)); });
        voice(root, type, 48, 67).forEach((m) => pad(mx, padOut, m, at(b, 0), spb * 4, 0.55));
        bass(mx, low, root - 24, at(b, 0), spb * 1.6, 0.8); bass(mx, low, root - 24 + 7, at(b, 2), spb * 0.9, 0.6); bass(mx, low, root - 24 + (b % 2 ? 10 : 12), at(b, 3.5), spb * 0.45, 0.55);
        melody(mx, MAJOR_PENT(8), CH[type].map((i) => root + i), { from: 70, to: 84, slots: 8, density: 0.42 })
          .forEach(({ s, m }) => piano(mx, keysOut, m, at(b, s / 2) + mx.jitter(), spb * 0.8, mx.vel(0.42)));
        if (b >= 1) { kick(mx, drums, at(b, 0), 0.6); kick(mx, drums, at(b, 2.5), 0.4); rim(mx, drums, at(b, 1), 0.45); rim(mx, drums, at(b, 3), 0.5); for (let e = 0; e < 8; e += 1) shaker(mx, drums, at(b, e / 2), e % 2 ? 0.25 : 0.4); }
      }
    },
  },
  'worship-rise': {
    prog: [[50, 'add9'], [57, 'sus2'], [59, 'm7'], [55, 'maj9']],
    play(mx, { bars, at, spb, seconds }) {
      const padOut = mx.out({ level: 1, verb: 0.6 }); const keysOut = mx.out({ level: 0.9, verb: 0.55 }); const low = mx.out({ level: 0.9, verb: 0.1 });
      const swell = mx.ctx.createBiquadFilter(); swell.type = 'lowpass'; swell.frequency.setValueAtTime(500, 0); swell.frequency.exponentialRampToValueAtTime(3200, Math.max(1, seconds * 0.85));
      swell.connect(padOut);
      for (let b = 0; b < bars; b += 1) {
        const [root, type] = this.prog[b % 4];
        voice(root, type, 50, 72).forEach((m) => pad(mx, swell, m, at(b, 0), spb * 4.2, 0.9, 1.4));
        bass(mx, low, root - 24, at(b, 0), spb * 3.8, 0.55);
        const arp = voice(root, type, 62, 79);
        for (let s = 0; s < 8; s += 1) if (s % 2 === 0 || mx.r() < 0.35) piano(mx, keysOut, arp[(s * (b % 2 ? 1 : 2)) % arp.length] + (s >= 6 ? 12 : 0), at(b, s / 2) + mx.jitter(6), spb * 1.2, mx.vel(0.32));
      }
    },
  },
  'golden-hour': {
    prog: [[51, 'maj9'], [48, 'm9'], [53, 'm9'], [58, 'dom9']],
    swing: 0.56,
    play(mx, { bars, at, spb }) {
      const trem = mx.ctx.createGain(); trem.gain.value = 0.8;
      const lfo = mx.ctx.createOscillator(); lfo.frequency.value = 4.6; const lg = mx.ctx.createGain(); lg.gain.value = 0.18; lfo.connect(lg); lg.connect(trem.gain); lfo.start(0);
      trem.connect(mx.out({ level: 1.1, verb: 0.3, pan: -0.1 }));
      const low = mx.out({ level: 1, verb: 0.04 }); const drums = mx.out({ level: 0.8, verb: 0.1 }); const lead = mx.out({ level: 0.6, verb: 0.4, pan: 0.2 });
      for (let b = 0; b < bars; b += 1) {
        const [root, type] = this.prog[b % 4];
        const ch = voice(root, type, 55, 74);
        ch.forEach((m, i) => { keys(mx, trem, m, at(b, 0) + i * 0.012, spb * 1.8, mx.vel(0.55)); keys(mx, trem, m, at(b, 2.5) + i * 0.01, spb * 1.2, mx.vel(0.4)); });
        bass(mx, low, root - 24, at(b, 0), spb * 1.2, 0.85); bass(mx, low, root - 24, at(b, 1.5), spb * 0.4, 0.6); bass(mx, low, root - 24 + 7, at(b, 2.5), spb * 0.9, 0.7); bass(mx, low, root - 24 + 11, at(b, 3.5), spb * 0.4, 0.5);
        kick(mx, drums, at(b, 0), 0.75); kick(mx, drums, at(b, 1.5), 0.45); kick(mx, drums, at(b, 2.75), 0.5);
        rim(mx, drums, at(b, 1), 0.55); rim(mx, drums, at(b, 3), 0.6);
        for (let s = 0; s < 8; s += 1) hat(mx, drums, at(b, s / 2), s % 2 ? 0.18 : 0.3);
        if (b % 2 === 1) melody(mx, MAJOR_PENT(3), CH[type].map((i) => root + i), { from: 72, to: 86, slots: 8, density: 0.4 }).forEach(({ s, m }) => keys(mx, lead, m, at(b, s / 2), spb * 0.7, 0.45));
      }
    },
  },
  'lofi-grind': {
    prog: [[53, 'maj7'], [52, 'm7'], [50, 'm7'], [48, 'maj7']],
    swing: 0.6,
    play(mx, { bars, at, spb, seconds }) {
      mx.tone.frequency.value = 4800;
      const ep = mx.out({ level: 1.1, verb: 0.25 }); const low = mx.out({ level: 1, verb: 0 }); const drums = mx.out({ level: 0.9, verb: 0.06 });
      crackle(mx, mx.out({ level: 0.9, verb: 0 }), seconds);
      for (let b = 0; b < bars; b += 1) {
        const [root, type] = this.prog[b % 4];
        voice(root, type, 55, 72).forEach((m, i) => { keys(mx, ep, m, at(b, 0) + i * 0.018, spb * 1.9, mx.vel(0.5)); keys(mx, ep, m, at(b, 2.5) + i * 0.015, spb * 1.2, mx.vel(0.36)); });
        bass(mx, low, root - 24, at(b, 0), spb * 1.3, 0.8); bass(mx, low, root - 24, at(b, 2.5), spb * 1, 0.65);
        kick(mx, drums, at(b, 0), 0.85); kick(mx, drums, at(b, 2.5), 0.7); if (mx.r() < 0.5) kick(mx, drums, at(b, 1.75), 0.4);
        snare(mx, drums, at(b, 1), 0.55); snare(mx, drums, at(b, 3), 0.6);
        for (let s = 0; s < 8; s += 1) hat(mx, drums, at(b, s / 2), mx.vel(s % 2 ? 0.2 : 0.32, 0.3));
        melody(mx, MAJOR_PENT(0), CH[type].map((i) => root + i), { from: 67, to: 81, slots: 8, density: 0.3 }).forEach(({ s, m }) => keys(mx, ep, m, at(b, s / 2), spb * 0.6, 0.38));
      }
    },
  },
  'boss-moves': {
    prog: [[48, 'min'], [44, 'maj'], [51, 'maj'], [46, 'maj']],
    play(mx, { bars, at, spb }) {
      const lead = mx.out({ level: 0.8, verb: 0.3 }); const padOut = mx.out({ level: 0.6, verb: 0.5 }); const low = mx.out({ level: 1, verb: 0 }); const drums = mx.out({ level: 0.85, verb: 0.05 });
      const motif = melody(mx, MINOR_PENT(0), [60, 63, 67], { from: 72, to: 84, slots: 8, density: 0.65 });
      for (let b = 0; b < bars; b += 1) {
        const [root, type] = this.prog[b % 4];
        voice(root, type, 55, 72).forEach((m) => pad(mx, padOut, m, at(b, 0), spb * 4, 0.6, 0.4));
        motif.forEach(({ s, m }) => bell(mx, lead, m + (b % 4 === 3 && s > 4 ? 2 : 0), at(b, s / 2), spb * 0.5, 0.5));
        eight08(mx, low, root - 24, at(b, 0), spb * 1.4, 0.9); eight08(mx, low, root - 24, at(b, 1.75), spb * 0.6, 0.7); eight08(mx, low, root - 24 + (b % 2 ? 3 : 0), at(b, 2.5), spb * 1.2, 0.8);
        kick(mx, drums, at(b, 0), 0.8); kick(mx, drums, at(b, 1.75), 0.6);
        clap(mx, drums, at(b, 2), 0.75);
        for (let s = 0; s < 8; s += 1) {
          if (b % 2 === 1 && s === 7) { for (let k = 0; k < 4; k += 1) hat(mx, drums, at(b, 3.5 + k / 8), 0.22 + k * 0.03); }
          else hat(mx, drums, at(b, s / 2), s % 2 ? 0.22 : 0.3);
        }
      }
    },
  },
  'bright-open': {
    prog: [[55, 'add9'], [50, 'maj'], [52, 'm7'], [48, 'maj9']],
    play(mx, { bars, at, spb }) {
      const keysOut = mx.out({ level: 0.95, verb: 0.25 }); const padOut = mx.out({ level: 0.55, verb: 0.4 }); const low = mx.out({ level: 0.9, verb: 0 }); const drums = mx.out({ level: 0.85, verb: 0.06 });
      for (let b = 0; b < bars; b += 1) {
        const [root, type] = this.prog[b % 4];
        const ch = voice(root, type, 60, 79);
        for (let q = 0; q < 4; q += 1) ch.forEach((m) => piano(mx, keysOut, m, at(b, q + 0.5) + mx.jitter(4), spb * 0.4, mx.vel(0.45)));
        voice(root, type, 52, 71).forEach((m) => pad(mx, padOut, m, at(b, 0), spb * 4, 0.6, 0.3));
        for (let q = 0; q < 4; q += 1) { bass(mx, low, root - 24, at(b, q + 0.5), spb * 0.35, 0.75); kick(mx, drums, at(b, q), 0.85); hat(mx, drums, at(b, q + 0.5), 0.35, true); }
        clap(mx, drums, at(b, 1), 0.6); clap(mx, drums, at(b, 3), 0.6);
      }
    },
  },
  'still-waters': {
    prog: [[53, 'maj7'], [57, 'm7'], [58, 'maj7'], [48, 'sus4']],
    play(mx, { bars, at, spb }) {
      const keysOut = mx.out({ level: 1.1, verb: 0.5 }); const padOut = mx.out({ level: 0.45, verb: 0.6 });
      for (let b = 0; b < bars; b += 1) {
        const [root, type] = this.prog[b % 4];
        const lowNotes = [root - 12, ...voice(root, type, 48, 64)];
        for (let s = 0; s < 8; s += 1) piano(mx, keysOut, lowNotes[[0, 2, 3, 1, 2, 3, 2, 1][s] % lowNotes.length], at(b, s / 2) + mx.jitter(10), spb * 1.4, mx.vel(s === 0 ? 0.45 : 0.28));
        melody(mx, MAJOR(5), CH[type].map((i) => root + i), { from: 69, to: 84, slots: 4, density: 0.7 }).forEach(({ s, m }) => piano(mx, keysOut, m, at(b, s) + mx.jitter(12), spb * 1.8, mx.vel(0.42)));
        voice(root, type, 53, 69).forEach((m) => pad(mx, padOut, m, at(b, 0), spb * 4, 0.5, 1.5));
      }
    },
  },
  'sunday-best': {
    prog: [[58, 'maj'], [51, 'dom9'], [55, 'min'], [53, 'dom7']],
    swing: 0.64,
    play(mx, { bars, at, spb }) {
      const org = mx.out({ level: 1, verb: 0.3 }); const low = mx.out({ level: 1, verb: 0.03 }); const drums = mx.out({ level: 0.85, verb: 0.18 });
      for (let b = 0; b < bars; b += 1) {
        const [root, type] = this.prog[b % 4];
        const ch = voice(root, type, 58, 77);
        ch.forEach((m) => { organ(mx, org, m, at(b, 0), spb * 0.9, 0.7); organ(mx, org, m, at(b, 1.5), spb * 0.4, 0.55); organ(mx, org, m, at(b, 2), spb * 1.4, 0.65); organ(mx, org, m, at(b, 3.5), spb * 0.4, 0.5); });
        const walk = [0, 4, 7, 10].map((i) => root - 24 + i);
        walk.forEach((m, q) => bass(mx, low, m, at(b, q), spb * 0.8, 0.8));
        kick(mx, drums, at(b, 0), 0.75); kick(mx, drums, at(b, 2), 0.7);
        clap(mx, drums, at(b, 1), 0.75); clap(mx, drums, at(b, 3), 0.8);
        for (let s = 0; s < 8; s += 1) shaker(mx, drums, at(b, s / 2), s % 2 ? 0.45 : 0.6);
      }
    },
  },
};

/**
 * Render a track to an AudioBuffer of `seconds` length (stereo). `seed` varies the melody and
 * the feel between designs while keeping the mood.
 */
export async function renderTrack(key, seconds = 15, { sampleRate = 44100, seed = 1 } = {}) {
  const song = SONGS[key]; const meta = trackOf(key);
  if (!song || !meta) throw new Error('Unknown track');
  const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  const len = Math.max(2, Math.min(90, seconds));
  const ctx = new Offline(2, Math.ceil(len * sampleRate), sampleRate);
  const mx = new Mix(ctx, len, seed * 7919 + key.length);
  const spb = 60 / meta.bpm;
  const swing = song.swing || 0.5;
  const at = (bar, beat) => {
    const whole = Math.floor(beat); const frac = beat - whole;
    const f = Math.abs(frac - 0.5) < 1e-6 ? swing : frac; // the off-beat eighth leans late when swung
    return 0.04 + (bar * 4 + whole + f) * spb;
  };
  const bars = Math.ceil(len / (spb * 4)) + 1;
  song.play(mx, { bars, at, spb, seconds: len });
  return normalize(await ctx.startRendering());
}

/** Every track at the same loudness (about -18 dBFS RMS), peaks kept under full scale. */
function normalize(buffer, target = 0.125) {
  const chans = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  let sum = 0; let peak = 0; let n = 0;
  chans.forEach((d) => { for (let i = 0; i < d.length; i += 1) { const v = d[i]; sum += v * v; n += 1; if (Math.abs(v) > peak) peak = Math.abs(v); } });
  const rms = Math.sqrt(sum / Math.max(1, n));
  if (!rms || !peak) return buffer;
  const k = Math.min(target / rms, 0.97 / peak);
  chans.forEach((d) => { for (let i = 0; i < d.length; i += 1) d[i] *= k; });
  return buffer;
}

/** Loudness and peak of a buffer (for checks). */
export function levels(buffer) {
  let sum = 0; let peak = 0; let n = 0;
  for (let c = 0; c < buffer.numberOfChannels; c += 1) { const d = buffer.getChannelData(c); for (let i = 0; i < d.length; i += 1) { sum += d[i] * d[i]; n += 1; peak = Math.max(peak, Math.abs(d[i])); } }
  return { rms: Math.sqrt(sum / Math.max(1, n)), peak };
}

/** Mix an uploaded track (decoded AudioBuffer) to `seconds`, starting at `offset`, with fades. */
export async function trimBuffer(buffer, seconds, offset = 0, sampleRate = 44100) {
  const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  const ctx = new Offline(2, Math.ceil(seconds * sampleRate), sampleRate);
  const src = ctx.createBufferSource(); src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(1, 0.2);
  g.gain.setValueAtTime(1, Math.max(0.3, seconds - 1.4)); g.gain.linearRampToValueAtTime(0, seconds - 0.03);
  src.connect(g); g.connect(ctx.destination);
  src.start(0, Math.max(0, Math.min(offset, buffer.duration - 1)), seconds);
  return ctx.startRendering();
}

/** Encode an AudioBuffer as a 16-bit WAV blob (for downloading a track). */
export function toWav(buffer) {
  const ch = buffer.numberOfChannels; const len = buffer.length; const sr = buffer.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true);
  out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, len * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i += 1) for (let c = 0; c < ch; c += 1) { out.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 0x7fff, true); o += 2; }
  return new Blob([out], { type: 'audio/wav' });
}
