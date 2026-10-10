// Clip finder: read long raw footage on this device (nothing is uploaded), score every
// half second by sound, speech rhythm and motion, and pick the strongest moments.
// Only the chosen moments are cut out (without re-encoding) and sent to DaVinci.

const STEP = 0.5; // seconds per analysis bin

const loadMb = () => import('mediabunny');

/** Duration, size and a cover frame for the picked file. */
export async function readFootage(file) {
  const { Input, BlobSource, ALL_FORMATS, CanvasSink } = await loadMb();
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const duration = await input.computeDuration();
  const video = await input.getPrimaryVideoTrack();
  if (!video) throw new Error('No video found in this file.');
  if (!(await video.canDecode())) throw new Error('This browser can’t read this video format. Try Chrome, or export it as MP4.');
  const audio = await input.getPrimaryAudioTrack();
  let cover = null;
  try {
    const sink = new CanvasSink(video, { width: 320 });
    const shot = await sink.getCanvas(Math.min(duration * 0.1, 10));
    if (shot) cover = toDataUrl(shot.canvas, 0.75);
  } catch { /* the cover is a nice-to-have */ }
  return {
    duration,
    width: video.displayWidth,
    height: video.displayHeight,
    hasAudio: !!audio && (await audio.canDecode()),
    cover,
  };
}

const toDataUrl = (canvas, q = 0.7) => {
  if (canvas.toDataURL) return canvas.toDataURL('image/jpeg', q);
  const c = document.createElement('canvas');
  c.width = canvas.width;
  c.height = canvas.height;
  c.getContext('2d').drawImage(canvas, 0, 0);
  return c.toDataURL('image/jpeg', q);
};

/** How many clips the footage comfortably holds, and a sensible default. */
export function clipPlan(duration, clipLength) {
  const max = Math.max(1, Math.min(20, Math.floor(duration / (clipLength * 1.25))));
  const suggested = Math.max(1, Math.min(max, 12, Math.round(duration / (clipLength * 4))));
  return { max, suggested };
}

const normalise = (arr, lo = 0.2, hi = 0.95) => {
  const sorted = Float32Array.from(arr).sort();
  const a = sorted[Math.floor(lo * (sorted.length - 1))] ?? 0;
  const b = sorted[Math.floor(hi * (sorted.length - 1))] ?? 1;
  const span = b - a || 1;
  return arr.map((v) => Math.max(0, Math.min(1, (v - a) / span)));
};

/**
 * Score the whole file. Returns per-bin arrays the picker works from.
 * onProgress(fraction, label) is called as each pass runs; signal can cancel.
 */
export async function analyzeFootage(file, { onProgress = () => {}, signal } = {}) {
  const { Input, BlobSource, ALL_FORMATS, AudioSampleSink, CanvasSink, EncodedPacketSink } = await loadMb();
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const duration = await input.computeDuration();
  const bins = Math.max(1, Math.ceil(duration / STEP));
  const stop = () => { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError'); };

  // 1. Sound: loudness per half second (streamed, so hour-long files stay light on memory).
  const power = new Float64Array(bins);
  const count = new Float64Array(bins);
  const audio = await input.getPrimaryAudioTrack();
  let hasAudio = false;
  if (audio && (await audio.canDecode())) {
    hasAudio = true;
    const sink = new AudioSampleSink(audio);
    let buf = new Float32Array(0);
    for await (const sample of sink.samples()) {
      stop();
      const n = sample.numberOfFrames;
      if (buf.length < n) buf = new Float32Array(n);
      sample.copyTo(buf, { planeIndex: 0, format: 'f32-planar', frameCount: n });
      const rate = sample.sampleRate;
      const t0 = sample.timestamp;
      for (let i = 0; i < n; i += 4) {
        const b = Math.min(bins - 1, Math.max(0, Math.floor((t0 + i / rate) / STEP)));
        power[b] += buf[i] * buf[i];
        count[b] += 1;
      }
      sample.close();
      onProgress(Math.min(1, (t0 + n / rate) / duration) * 0.6, 'Listening to the footage…');
    }
  }
  const db = new Float32Array(bins);
  for (let b = 0; b < bins; b++) db[b] = count[b] ? 10 * Math.log10(power[b] / count[b] + 1e-10) : -100;

  // 2. Motion: compare tiny frames taken at key frames (cheap to decode) every couple of seconds.
  const video = await input.getPrimaryVideoTrack();
  const motionAt = [];
  if (video) {
    const every = Math.max(2, duration / 900);
    const packets = new EncodedPacketSink(video);
    const times = [];
    for (let t = 0; t < duration; t += every) {
      stop();
      const key = await packets.getKeyPacket(t, { metadataOnly: true });
      const ts = key ? key.timestamp : t;
      if (!times.length || ts > times[times.length - 1] + 0.25) times.push(ts);
    }
    const sink = new CanvasSink(video, { width: 32, height: 18, fit: 'fill', poolSize: 2 });
    let prev = null;
    let k = 0;
    for await (const wrapped of sink.canvasesAtTimestamps(times)) {
      stop();
      k += 1;
      if (!wrapped) continue;
      const ctx = wrapped.canvas.getContext('2d', { willReadFrequently: true });
      const px = ctx.getImageData(0, 0, 32, 18).data;
      const luma = new Float32Array(32 * 18);
      for (let i = 0; i < luma.length; i++) luma[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
      if (prev) {
        let d = 0;
        for (let i = 0; i < luma.length; i++) d += Math.abs(luma[i] - prev[i]);
        motionAt.push([wrapped.timestamp, d / luma.length]);
      }
      prev = luma;
      onProgress(0.6 + 0.4 * (k / times.length), 'Watching for the big moments…');
    }
  }
  const motion = new Float32Array(bins);
  if (motionAt.length) {
    let j = 0;
    for (let b = 0; b < bins; b++) {
      const t = b * STEP;
      while (j < motionAt.length - 1 && motionAt[j + 1][0] <= t) j++;
      motion[b] = motionAt[j][1];
    }
  }

  // 3. Speech rhythm: talking rises and falls; steady noise doesn't.
  const rhythm = new Float32Array(bins);
  for (let b = 0; b < bins; b++) {
    let s = 0;
    let s2 = 0;
    let n = 0;
    for (let k = Math.max(0, b - 2); k <= Math.min(bins - 1, b + 2); k++) { s += db[k]; s2 += db[k] * db[k]; n++; }
    const mean = s / n;
    rhythm[b] = Math.sqrt(Math.max(0, s2 / n - mean * mean));
  }

  onProgress(1, 'Picking the best moments…');
  return { duration, step: STEP, hasAudio, hasMotion: motionAt.length > 2, db, loud: normalise(db), rhythm: normalise(rhythm), motion: normalise(motion) };
}

const REASONS = { loud: 'Big moment', rhythm: 'Lively talk', motion: 'Lots of action' };

/**
 * Choose `count` non-overlapping windows of `length` seconds with the best average score,
 * spread out across the footage, each nudged to start on a natural pause.
 * `exclude` holds [start, end] ranges already taken (for "find another").
 */
export function pickMoments(analysis, { count, length, exclude = [] }) {
  const { step, loud, rhythm, motion, db, hasAudio, hasMotion, duration } = analysis;
  const bins = loud.length;
  const L = Math.max(1, Math.round(length / step));
  if (L >= bins) return [{ start: 0, end: Math.min(duration, length), score: 1, reason: 'Whole video' }];
  const w = hasAudio && hasMotion ? [0.42, 0.33, 0.25] : hasAudio ? [0.55, 0.45, 0] : [0, 0, 1];
  const score = new Float32Array(bins);
  for (let b = 0; b < bins; b++) score[b] = w[0] * loud[b] + w[1] * rhythm[b] + w[2] * motion[b];
  const prefix = new Float64Array(bins + 1);
  for (let b = 0; b < bins; b++) prefix[b + 1] = prefix[b] + score[b];
  const avg = (s) => (prefix[s + L] - prefix[s]) / L;
  const mean = (arr) => arr.reduce((a, v) => a + v, 0) / (arr.length || 1);
  const means = { loud: mean(loud), rhythm: mean(rhythm), motion: mean(motion) };

  const gap = Math.round(L * 0.25);
  const blocked = new Uint8Array(bins);
  const block = (s, e) => { for (let b = Math.max(0, s - L - gap + 1); b < Math.min(bins, e + gap); b++) blocked[b] = 1; };
  exclude.forEach(([s, e]) => block(Math.floor(s / step), Math.ceil(e / step)));

  const picks = [];
  while (picks.length < count) {
    let best = -1;
    let bestScore = -Infinity;
    for (let s = 0; s + L <= bins; s++) {
      if (blocked[s]) continue;
      const v = avg(s);
      if (v > bestScore) { bestScore = v; best = s; }
    }
    if (best < 0) break;
    // Start on a natural pause: the quietest half second within 3 s before the pick.
    let start = best;
    if (hasAudio) {
      let quiet = Infinity;
      for (let s = Math.max(0, best - 6); s <= best; s++) {
        if (!blocked[s] && db[s] < quiet) { quiet = db[s]; start = s; }
      }
    }
    start = Math.min(start, bins - L);
    // Label it by whatever stands out most against the footage as a whole.
    const lift = {};
    [['loud', loud, w[0]], ['rhythm', rhythm, w[1]], ['motion', motion, w[2]]].forEach(([k, arr, weight]) => {
      if (!weight) return;
      let sum = 0;
      for (let b = start; b < start + L; b++) sum += arr[b];
      lift[k] = sum / L - means[k];
    });
    const reason = REASONS[Object.entries(lift).sort((a, b) => b[1] - a[1])[0][0]];
    picks.push({ start: start * step, end: Math.min(duration, (start + L) * step), score: Math.round(bestScore * 100), reason });
    block(start, start + L);
  }
  return picks.sort((a, b) => a.start - b.start);
}

/** A still from the middle of a moment, for its card. */
export async function momentThumbs(file, moments, width = 240) {
  const { Input, BlobSource, ALL_FORMATS, CanvasSink } = await loadMb();
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  const sink = new CanvasSink(video, { width, poolSize: 0 });
  const out = [];
  for await (const w of sink.canvasesAtTimestamps(moments.map((m) => (m.start + m.end) / 2))) {
    out.push(w ? toDataUrl(w.canvas) : null);
  }
  return out;
}

/**
 * Cut one moment out of the footage as an MP4. Copies the original video and sound
 * when it can (fast, full quality); `smaller` re-encodes at 1080p for upload limits.
 */
export async function cutMoment(file, { start, end }, { smaller = false, onProgress } = {}) {
  const { Input, BlobSource, ALL_FORMATS, Output, Mp4OutputFormat, BufferTarget, Conversion, QUALITY_HIGH } = await loadMb();
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const conversion = await Conversion.init({
    input,
    output,
    trim: { start, end },
    showWarnings: false,
    ...(smaller
      ? { copy: false, video: (track) => {
          const long = Math.max(track.displayWidth, track.displayHeight);
          const k = Math.min(1, 1920 / long);
          return { width: Math.round((track.displayWidth * k) / 2) * 2, height: Math.round((track.displayHeight * k) / 2) * 2, fit: 'contain', bitrate: QUALITY_HIGH, codec: 'avc' };
        }, audio: { bitrate: 160e3, codec: 'aac' } }
      : {}),
  });
  if (!conversion.isValid) throw new Error('This part of the video couldn’t be cut in the browser.');
  if (onProgress) conversion.onProgress = onProgress;
  await conversion.execute();
  return new Blob([output.target.buffer], { type: 'video/mp4' });
}

export const fmtTime = (s) => {
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};
