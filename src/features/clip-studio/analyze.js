// Footage analysis for Clip Studio: decode audio, find where people are
// talking (or where something is happening), and build the edit timeline.

const ANALYSIS_RATE = 16000; // also what Whisper wants
const FRAME = 0.02;          // 20 ms energy frames
export const MAX_FILE_BYTES = 700 * 1024 * 1024;

export const probeVideo = (url) =>
  new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.onloadedmetadata = () => {
      // Grab a thumbnail from a little way in.
      v.currentTime = Math.min(0.5, (v.duration || 1) / 3);
    };
    v.onseeked = () => {
      const c = document.createElement('canvas');
      const scale = 160 / Math.max(v.videoWidth, v.videoHeight, 1);
      c.width = Math.round(v.videoWidth * scale) || 90;
      c.height = Math.round(v.videoHeight * scale) || 160;
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight, thumb: c.toDataURL('image/jpeg', 0.7) });
      v.removeAttribute('src');
      v.load();
    };
    v.onerror = () => reject(new Error('This file can’t be played in the browser.'));
    v.src = url;
  });

// Full-quality audio for the final mix. Returns null for silent footage
// or formats the browser can't decode — those clips are cut visually.
export const decodeForMix = async (file, ctx) => {
  try {
    const buf = await file.arrayBuffer();
    return await ctx.decodeAudioData(buf);
  } catch {
    return null;
  }
};

// 16 kHz mono copy for speech detection and captions.
export const toAnalysisPcm = async (audioBuffer) => {
  const length = Math.ceil(audioBuffer.duration * ANALYSIS_RATE);
  const off = new OfflineAudioContext(1, length, ANALYSIS_RATE);
  const src = off.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  return rendered.getChannelData(0);
};

const percentile = (arr, p) => {
  const s = Float32Array.from(arr).sort();
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

// Per-frame loudness in dB.
const energyDb = (pcm) => {
  const n = Math.floor(FRAME * ANALYSIS_RATE);
  const frames = new Float32Array(Math.floor(pcm.length / n));
  for (let f = 0; f < frames.length; f++) {
    let sum = 0;
    for (let i = f * n; i < (f + 1) * n; i++) sum += pcm[i] * pcm[i];
    frames[f] = 10 * Math.log10(sum / n + 1e-10);
  }
  return frames;
};

// Find the parts worth keeping: speech / sound above an adaptive threshold,
// with short pauses bridged and a little padding so words aren't clipped.
export const findActiveRanges = (pcm, duration, { minGap, pad }) => {
  if (!pcm || pcm.length < ANALYSIS_RATE * 0.5) return { ranges: [{ start: 0, end: duration, energy: 0 }], db: null };

  const db = energyDb(pcm);
  const floor = percentile(db, 0.1);
  const loud = percentile(db, 0.9);
  // Mostly-constant audio (music, ambience): nothing to remove.
  if (loud - floor < 8) return { ranges: [{ start: 0, end: duration, energy: loud }], db };

  const threshold = Math.max(floor + (loud - floor) * 0.35, -55);
  const raw = [];
  let open = null;
  db.forEach((v, i) => {
    const t = i * FRAME;
    if (v >= threshold) {
      if (open === null) open = t;
    } else if (open !== null) {
      raw.push([open, t]);
      open = null;
    }
  });
  if (open !== null) raw.push([open, db.length * FRAME]);

  // Bridge pauses shorter than minGap, drop blips, pad edges.
  const merged = [];
  for (const [s, e] of raw) {
    const last = merged[merged.length - 1];
    if (last && s - last[1] < minGap) last[1] = e;
    else merged.push([s, e]);
  }
  const ranges = merged
    .filter(([s, e]) => e - s >= 0.25)
    .map(([s, e]) => ({ start: Math.max(0, s - pad), end: Math.min(duration, e + pad) }));

  // Average loudness per range — used to pick the best moments.
  for (const r of ranges) {
    const a = Math.floor(r.start / FRAME);
    const b = Math.max(a + 1, Math.floor(r.end / FRAME));
    let sum = 0;
    for (let i = a; i < b && i < db.length; i++) sum += db[i];
    r.energy = sum / (b - a);
  }
  return { ranges: ranges.length ? ranges : [{ start: 0, end: duration, energy: loud }], db };
};

// Turn every clip's kept ranges into one ordered list of shots that fits the
// target length.
export const buildTimeline = (clips, style, targetSeconds, removeSilence) => {
  let shots = [];
  clips.forEach((clip, clipIndex) => {
    const ranges = removeSilence ? clip.ranges : [{ start: 0, end: clip.duration, energy: 0 }];
    for (const r of ranges) {
      // Split long stretches into style-sized shots.
      const len = r.end - r.start;
      const pieces = Math.max(1, Math.ceil(len / style.maxShot));
      const step = len / pieces;
      for (let k = 0; k < pieces; k++) {
        shots.push({
          clipIndex,
          start: r.start + k * step,
          end: r.start + (k + 1) * step,
          energy: r.energy ?? 0,
          first: k === 0 && r === ranges[0],
        });
      }
    }
  });

  const total = shots.reduce((s, x) => s + (x.end - x.start), 0);
  if (targetSeconds && total > targetSeconds) {
    // Keep the opening shot of every clip, then the liveliest shots, until full.
    const ranked = shots
      .map((s, order) => ({ ...s, order, score: (s.first ? 1000 : 0) + s.energy }))
      .sort((a, b) => b.score - a.score);
    const picked = [];
    let used = 0;
    for (const s of ranked) {
      const len = s.end - s.start;
      if (used + len <= targetSeconds + 0.5) {
        picked.push(s);
        used += len;
      } else if (targetSeconds - used > 1) {
        picked.push({ ...s, end: s.start + (targetSeconds - used) });
        used = targetSeconds;
      }
      if (used >= targetSeconds) break;
    }
    shots = picked.sort((a, b) => a.order - b.order);
  }

  // Lay shots on the output clock. Transitions overlap neighbouring shots.
  const overlap = style.transition === 'cut' ? 0 : style.transitionDur;
  let t = 0;
  return shots.map((s, i) => {
    const len = s.end - s.start;
    const ov = i === 0 ? 0 : Math.min(overlap, len / 3);
    const outStart = Math.max(0, t - ov);
    const shot = { clipIndex: s.clipIndex, start: s.start, end: s.end, outStart, outEnd: outStart + len, overlapIn: ov };
    t = shot.outEnd;
    return shot;
  });
};

// One 16 kHz track of just the kept speech, plus a map from its time back
// to the output clock — this is what gets transcribed.
export const timelinePcm = (timeline, clipPcm) => {
  const parts = [];
  const map = [];
  let cursor = 0;
  for (const shot of timeline) {
    const pcm = clipPcm[shot.clipIndex];
    const len = shot.end - shot.start;
    if (pcm) {
      parts.push(pcm.subarray(Math.floor(shot.start * ANALYSIS_RATE), Math.floor(shot.end * ANALYSIS_RATE)));
    } else {
      parts.push(new Float32Array(Math.floor(len * ANALYSIS_RATE)));
    }
    map.push({ from: cursor, to: cursor + len, outStart: shot.outStart });
    cursor += len;
  }
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return { pcm: out, map };
};

export const mapToOutput = (t, map) => {
  const seg = map.find((m) => t >= m.from && t < m.to) || map[map.length - 1];
  return seg ? seg.outStart + (t - seg.from) : t;
};

// Group words into short caption "pages" that read well on a phone.
export const pageCaptions = (words, perPage) => {
  const pages = [];
  let cur = [];
  for (const w of words) {
    const prev = cur[cur.length - 1];
    if (cur.length >= perPage || (prev && w.start - prev.end > 0.6)) {
      pages.push(cur);
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) pages.push(cur);
  return pages.map((ws) => ({ words: ws, start: ws[0].start, end: ws[ws.length - 1].end }));
};
