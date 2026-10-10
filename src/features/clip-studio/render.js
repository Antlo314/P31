// Clip Studio renderer. One frame painter (compositor) draws every output frame:
// shots + transitions → colour grade (GPU) → letterbox, logo, title, captions, end card.
// Two exporters drive it:
//   renderFast()  — WebCodecs (via mediabunny): reads every source frame exactly, mixes the
//                   audio offline and encodes a real MP4, faster than real time.
//   renderClip()  — the original real-time path: plays the edit onto a canvas and records it
//                   with MediaRecorder. Used when the browser can't do the fast path.

import { drawCaption, loadCaptionFont } from './captions';
import { createGrader, lookParams, isIdentity, cssFallback } from './filters';

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.640028,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export const pickMime = () =>
  MIME_CANDIDATES.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';

export const canFastRender = () => typeof window.VideoEncoder === 'function' && typeof window.VideoDecoder === 'function';

export const canRender = () =>
  canFastRender() || (typeof window.MediaRecorder === 'function' && !!HTMLCanvasElement.prototype.captureStream && !!pickMime());

const FPS = 30;
const END_CARD = 2.6;
const TITLE_CARD = 2.2;
const PLUM = '42, 21, 68';

const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const dims = (img) => [img.videoWidth || img.width, img.videoHeight || img.height];

async function loadFonts(base, pages, captionStyle) {
  if (pages?.length) await loadCaptionFont(captionStyle);
  await Promise.all([
    document.fonts.load(`800 ${Math.round(base * 0.06)}px Manrope`),
    document.fonts.load(`700 ${Math.round(base * 0.06)}px "Noto Serif"`),
    document.fonts.load(`italic 400 ${Math.round(base * 0.06)}px "Noto Serif"`),
  ]).catch(() => {});
}

/** Draws output frames onto `canvas`. frame(T, imageForShot) → imageForShot(i) returns a video/canvas or null. */
function createCompositor({ canvas, aspect, style, timeline, pages, captionStyle, title, brand, look }) {
  const W = aspect.w;
  const H = aspect.h;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  const base = Math.min(W, H);
  const comp = document.createElement('canvas');
  comp.width = W;
  comp.height = H;
  const cctx = comp.getContext('2d', { alpha: false });
  const held = document.createElement('canvas'); // last good picture, shown while a player is still seeking
  held.width = W;
  held.height = H;
  const heldCtx = held.getContext('2d');

  const params = lookParams(look);
  let grader = null;
  if (!isIdentity(params)) { try { grader = createGrader(); } catch { grader = null; } }
  const cssLook = !grader && !isIdentity(params) ? cssFallback(params) : 'none';

  const editEnd = timeline[timeline.length - 1].outEnd;
  const endCard = style.endCard ? END_CARD : 0;

  const drawShot = (img, i, T, { alpha = 1, dx = 0, zoomMul = 1 } = {}) => {
    if (!img) return false;
    const [vw, vh] = dims(img);
    if (!vw || !vh) return false;
    const shot = timeline[i];
    const local = Math.max(0, T - shot.outStart);
    const len = shot.end - shot.start;
    let zoom = 1;
    if (style.motion === 'punch') zoom = (i % 2 ? 1.12 : 1) + 0.07 * clamp01(1 - local / 0.22);
    if (style.motion === 'drift') zoom = 1 + 0.07 * clamp01(local / len);
    zoom *= zoomMul;
    const scale = Math.max(W / vw, H / vh) * zoom;
    const dw = vw * scale;
    const dh = vh * scale;
    cctx.save();
    cctx.globalAlpha = alpha;
    cctx.filter = cssLook;
    cctx.drawImage(img, (W - dw) / 2 + dx, (H - dh) / 2, dw, dh);
    cctx.restore();
    return true;
  };

  const drawTransition = (imageFor, i, T) => {
    const shot = timeline[i];
    const p = clamp01((T - shot.outStart) / shot.overlapIn);
    const e = ease(p);
    const prev = imageFor(i - 1);
    const cur = imageFor(i);
    switch (style.transition) {
      case 'crossfade':
        drawShot(prev, i - 1, T);
        return drawShot(cur, i, T, { alpha: e }) || !!prev;
      case 'dip':
      case 'flash': {
        const ok = p < 0.5 ? drawShot(prev, i - 1, T) : drawShot(cur, i, T);
        cctx.fillStyle = style.transition === 'dip' ? `rgba(${PLUM}, ${1 - Math.abs(p - 0.5) * 2})` : `rgba(255,255,255,${0.9 * (1 - Math.abs(p - 0.5) * 2)})`;
        cctx.fillRect(0, 0, W, H);
        return ok;
      }
      case 'slide':
        drawShot(prev, i - 1, T, { dx: -e * W * 0.35 });
        return drawShot(cur, i, T, { dx: (1 - e) * W }) || !!prev;
      case 'zoom':
        return p < 0.5 ? drawShot(prev, i - 1, T, { zoomMul: 1 + e * 0.35 }) : drawShot(cur, i, T, { zoomMul: 1.35 - e * 0.35, alpha: clamp01((p - 0.5) * 2 + 0.3) });
      default:
        return drawShot(cur, i, T);
    }
  };

  const letterboxBar = () => (style.letterbox ? (W > H ? (H - W / 2.39) / 2 : H * 0.07) : 0);
  const drawLetterbox = () => {
    const bar = letterboxBar();
    if (!bar) return;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
  };

  const drawBrand = () => {
    const img = brand?.image;
    if (!img?.width) return;
    const k = Math.min((base * 0.16) / img.width, (base * 0.11) / img.height);
    const w = img.width * k;
    const h = img.height * k;
    const bar = letterboxBar();
    const m = base * 0.045;
    const x = brand.corner.includes('l') ? m : W - m - w;
    const y = brand.corner.includes('t') ? bar + m : H - bar - m - h;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = base * 0.012;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  };

  const drawTitle = (T) => {
    if (!style.titleCard || !title || T > TITLE_CARD) return;
    const a = clamp01(T / 0.35) * clamp01((TITLE_CARD - T) / 0.4);
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, H * 0.35, 0, H);
    g.addColorStop(0, `rgba(${PLUM},0)`);
    g.addColorStop(1, `rgba(${PLUM},0.85)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.round(base * 0.085)}px "Noto Serif"`;
    ctx.fillText(title, W / 2, H * 0.5, W * 0.88);
    ctx.fillStyle = '#F2CE4D';
    ctx.fillRect(W / 2 - base * 0.06, H * 0.5 + base * 0.06, base * 0.12, Math.max(3, base * 0.006));
    ctx.restore();
  };

  const drawEndCard = (T) => {
    if (!endCard || T < editEnd) return;
    const a = clamp01((T - editEnd) / 0.45);
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#4a1f78');
    g.addColorStop(1, '#1d0f2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const rg = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, base * 0.9);
    rg.addColorStop(0, 'rgba(242,206,77,0.35)');
    rg.addColorStop(1, 'rgba(242,206,77,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F2CE4D';
    ctx.font = `800 ${Math.round(base * 0.03)}px Manrope`;
    ctx.fillText('PROVERBS 31 MARKETPLACE', W / 2, H * 0.42);
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(base * 0.075)}px "Noto Serif"`;
    ctx.fillText(title || 'Where her gifts make room.', W / 2, H * 0.5, W * 0.88);
    ctx.font = `600 ${Math.round(base * 0.04)}px Manrope`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('p31market.com', W / 2, H * 0.58);
    ctx.restore();
  };

  return {
    W, H, base, editEnd, total: editEnd + endCard,
    /** Paint output time T. */
    frame(T, imageFor) {
      const t = Math.max(0, T);
      if (t < editEnd || !endCard) {
        const i = Math.max(0, timeline.findLastIndex((s) => t >= s.outStart));
        const shot = timeline[i];
        const inTransition = i > 0 && shot.overlapIn > 0 && t < shot.outStart + shot.overlapIn;
        const ready = inTransition ? drawTransition(imageFor, i, t) : drawShot(imageFor(i), i, t);
        if (ready) {
          if (grader && grader.grade(comp, params, t)) ctx.drawImage(grader.canvas, 0, 0, W, H);
          else ctx.drawImage(comp, 0, 0);
          heldCtx.drawImage(canvas, 0, 0);
        } else {
          ctx.drawImage(held, 0, 0);
        }
        drawLetterbox();
        drawBrand();
        drawTitle(t);
        if (pages?.length && t <= editEnd) drawCaption(ctx, pages, t, captionStyle, W, H);
      }
      drawEndCard(t);
    },
    dispose() { grader?.dispose(); },
  };
}

// Schedules the voice and music mix on any audio context (real-time or offline).
function scheduleAudio(audioCtx, destination, { timeline, clipBuffers, music, levels, total, t0 }) {
  const master = audioCtx.createGain();
  master.connect(destination);
  const voiceBus = audioCtx.createGain();
  voiceBus.gain.value = levels.voice;
  voiceBus.connect(master);
  const sources = [];
  const hasVoice = levels.voice > 0 && clipBuffers.some(Boolean);

  timeline.forEach((shot, i) => {
    const buf = clipBuffers[shot.clipIndex];
    if (!buf) return;
    const len = shot.end - shot.start;
    const when = t0 + shot.outStart;
    const fadeIn = Math.max(0.012, shot.overlapIn);
    const fadeOut = Math.max(0.012, timeline[i + 1]?.overlapIn || 0);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(1, when + fadeIn);
    g.gain.setValueAtTime(1, when + Math.max(fadeIn, len - fadeOut));
    g.gain.linearRampToValueAtTime(0, when + len);
    src.connect(g).connect(voiceBus);
    src.start(when, shot.start, len);
    sources.push(src);
  });

  if (music?.buffer) {
    const src = audioCtx.createBufferSource();
    src.buffer = music.buffer;
    src.loop = true;
    const g = audioCtx.createGain();
    const level = levels.music * (hasVoice ? 0.35 : 1); // sit under speech
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(level, t0 + 0.6);
    g.gain.setValueAtTime(level, t0 + Math.max(0.6, total - 1.6));
    g.gain.linearRampToValueAtTime(0, t0 + total);
    src.connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + total + 0.1);
    sources.push(src);
  }
  return { master, sources, hasAudio: hasVoice || !!music?.buffer };
}

/** Marks failures where the real-time renderer should take over. */
export class FastRenderUnavailable extends Error {}

// ── Fast path: WebCodecs ──────────────────────────────────────
export async function renderFast({
  clips, timeline, style, aspect, pages, captionStyle, clipBuffers, music, levels, title, brand, look, canvas, onProgress, signal,
}) {
  if (!canFastRender()) throw new FastRenderUnavailable('WebCodecs not available');
  const mb = await import('mediabunny');
  const comp = createCompositor({ canvas, aspect, style, timeline, pages, captionStyle, title, brand, look });
  const { W, H, total } = comp;
  await loadFonts(comp.base, pages, captionStyle);

  const videoCodec = await mb.getFirstEncodableVideoCodec(['avc', 'hevc', 'vp9', 'av1'], { width: W, height: H });
  if (!videoCodec) { comp.dispose(); throw new FastRenderUnavailable('No video encoder'); }

  // Open each source clip once, frame-accurate.
  const used = [...new Set(timeline.map((s) => s.clipIndex))];
  const inputs = [];
  const sinks = new Map();
  const cleanup = () => { inputs.forEach((x) => { try { x.dispose(); } catch { /* already closed */ } }); comp.dispose(); };
  try {
    for (const ci of used) {
      const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(clips[ci].file) });
      inputs.push(input);
      const track = await input.getPrimaryVideoTrack();
      if (!track || !(await track.canDecode())) throw new FastRenderUnavailable(`Can't decode ${clips[ci].name} here`);
      const first = await track.getFirstTimestamp();
      // Decode at about the size we draw (with room for zoom moves), not the full camera size.
      const k = Math.min(1, Math.max(W / track.displayWidth, H / track.displayHeight) * 1.3);
      sinks.set(ci, { track, first, size: { width: Math.round(track.displayWidth * k), height: Math.round(track.displayHeight * k) } });
    }
  } catch (e) {
    cleanup();
    throw e instanceof FastRenderUnavailable ? e : new FastRenderUnavailable(e.message);
  }

  // Audio: the same mix as the real-time path, rendered offline in one go.
  let audioBuffer = null;
  if (clipBuffers.some(Boolean) || music?.buffer) {
    const rate = 48000;
    const off = new OfflineAudioContext(2, Math.ceil((total + 0.05) * rate), rate);
    const { hasAudio } = scheduleAudio(off, off.destination, { timeline, clipBuffers, music, levels, total, t0: 0 });
    if (hasAudio) audioBuffer = await off.startRendering();
  }
  const audioCodec = audioBuffer
    ? await mb.getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: 48000 })
    : null;
  if (audioBuffer && !audioCodec) { cleanup(); throw new FastRenderUnavailable('No audio encoder'); }

  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const videoSource = new mb.CanvasSource(canvas, { codec: videoCodec, quality: mb.QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(videoSource, { frameRate: FPS });
  let audioSource = null;
  if (audioBuffer) {
    audioSource = new mb.AudioBufferSource({ codec: audioCodec, quality: mb.QUALITY_HIGH });
    output.addAudioTrack(audioSource);
  }

  try {
    await output.start();
    if (audioSource) await audioSource.add(audioBuffer);

    // Every shot gets its own sequential frame reader for exactly the frames it's on screen.
    const frames = Math.ceil(total * FPS);
    const readers = new Map(); // shot index → { it, last }
    const readerFor = (i) => {
      if (readers.has(i)) return readers.get(i);
      const shot = timeline[i];
      const { track, first, size } = sinks.get(shot.clipIndex);
      // One sink per shot, so two shots from the same clip (mid-transition) never share canvases.
      const sink = new mb.CanvasSink(track, { ...size, fit: 'fill', poolSize: 4 });
      const times = [];
      for (let f = Math.ceil(shot.outStart * FPS); f / FPS < shot.outEnd && f < frames; f += 1) {
        times.push(Math.max(first, shot.start + (f / FPS - shot.outStart)));
      }
      const r = { it: sink.canvasesAtTimestamps(times), last: null };
      readers.set(i, r);
      return r;
    };

    for (let f = 0; f < frames; f += 1) {
      if (signal?.aborted) throw new DOMException('Render cancelled', 'AbortError');
      const T = f / FPS;
      const images = new Map();
      if (T < comp.editEnd) {
        for (let i = 0; i < timeline.length; i += 1) {
          const s = timeline[i];
          if (T >= s.outStart && T < s.outEnd) {
            const r = readerFor(i);
            const { value, done } = await r.it.next();
            if (!done && value) r.last = value.canvas;
            images.set(i, r.last);
          } else if (T >= s.outEnd && readers.has(i)) {
            readers.get(i).it.return?.();
            readers.delete(i);
          }
        }
      }
      comp.frame(T, (i) => images.get(i) || null);
      await videoSource.add(T, 1 / FPS);
      if (f % 6 === 0) onProgress?.(f / frames);
    }
    readers.forEach((r) => r.it.return?.());
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    cleanup();
    if (e.name === 'AbortError') throw e;
    throw new FastRenderUnavailable(e.message || String(e));
  }
  cleanup();
  onProgress?.(1);
  const type = 'video/mp4';
  return { blob: new Blob([target.buffer], { type }), type, duration: total, engine: `${videoCodec.toUpperCase()}${audioCodec ? ` + ${audioCodec.toUpperCase()}` : ''}` };
}

// ── Real-time path: MediaRecorder ─────────────────────────────
const makeVideo = (host) => {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.crossOrigin = 'anonymous';
  host.appendChild(v);
  return v;
};

const waitFor = (el, event, ms = 4000) =>
  new Promise((resolve) => {
    const done = () => { el.removeEventListener(event, done); clearTimeout(t); resolve(); };
    const t = setTimeout(done, ms);
    el.addEventListener(event, done);
  });

export async function renderClip({
  clips, timeline, style, aspect, pages, captionStyle, audioCtx, clipBuffers, music, levels,
  title, brand, look, canvas, onProgress, signal,
}) {
  // Browsers stop drawing hidden pages, which would freeze the render.
  if (document.hidden) throw new Error('Keep Clip Studio on screen while it renders.');

  const comp = createCompositor({ canvas, aspect, style, timeline, pages, captionStyle, title, brand, look });
  const { total } = comp;
  await loadFonts(comp.base, pages, captionStyle);

  // Hidden-but-decoding players (iOS won't decode display:none video).
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;overflow:hidden;';
  document.body.appendChild(host);
  const players = [makeVideo(host), makeVideo(host)];

  const dest = audioCtx.createMediaStreamDestination();
  const t0 = audioCtx.currentTime + 0.35;
  const { master, sources } = scheduleAudio(audioCtx, dest, { timeline, clipBuffers, music, levels, total, t0 });

  const mimeType = pickMime();
  const stream = canvas.captureStream(FPS);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 160_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });

  const cue = async (i, wait = false) => {
    const shot = timeline[i];
    if (!shot) return;
    const el = players[i % 2];
    if (el._shot === i) return;
    el._shot = i;
    const url = clips[shot.clipIndex].url;
    if (el._url !== url) {
      el._url = url;
      el.src = url;
      if (wait) await waitFor(el, 'loadeddata');
    }
    el.pause();
    el.playbackRate = 1;
    el.currentTime = shot.start;
    if (wait) await waitFor(el, 'seeked');
  };

  await cue(0, true);
  await cue(1, true);

  let wakeLock = null;
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* not supported */ }

  let hiddenAbort = false;
  const onHide = () => { if (document.hidden) hiddenAbort = true; };
  document.addEventListener('visibilitychange', onHide);

  // Keep each active player at the right spot, cue the next one early.
  const syncPlayers = (T) => {
    timeline.forEach((shot, i) => {
      const el = players[i % 2];
      const active = T >= shot.outStart && T < shot.outEnd;
      if (active) {
        if (el._shot !== i) cue(i);
        const want = shot.start + (T - shot.outStart);
        const drift = el.currentTime - want;
        if (!el.seeking) {
          if (Math.abs(drift) > 0.35) el.currentTime = want;
          else el.playbackRate = Math.abs(drift) > 0.05 ? 1 - Math.max(-0.12, Math.min(0.12, drift * 0.6)) : 1;
        }
        if (el.paused) el.play().catch(() => {});
      } else if (el._shot === i && T >= shot.outEnd) {
        el.pause();
      }
    });
    const next = timeline.findIndex((s) => s.outStart > T);
    if (next >= 0 && timeline[next].outStart - T < 1.5) {
      const busy = timeline.some((s, i) => i % 2 === next % 2 && i !== next && T >= s.outStart && T < s.outEnd);
      if (!busy) cue(next);
    }
  };
  const playerFor = (i) => {
    const el = players[i % 2];
    return el._shot === i && el.readyState >= 2 && el.videoWidth ? el : null;
  };

  recorder.start(1000);
  let lastProgress = -1;
  await new Promise((resolve) => {
    const frame = () => {
      if (signal?.aborted || hiddenAbort) return resolve();
      const T = audioCtx.currentTime - t0;
      if (T >= total) return resolve();
      if (T >= 0) syncPlayers(Math.max(0, T));
      comp.frame(T, playerFor);
      const pct = Math.floor((Math.max(0, T) / total) * 100);
      if (pct !== lastProgress) { lastProgress = pct; onProgress?.(Math.max(0, T) / total); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  recorder.stop();
  sources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
  await stopped;

  document.removeEventListener('visibilitychange', onHide);
  wakeLock?.release?.().catch(() => {});
  players.forEach((p) => { p.pause(); p.removeAttribute('src'); p.load(); });
  host.remove();
  master.disconnect();
  comp.dispose();

  if (hiddenAbort) throw new Error('Clip Studio was put in the background, so the render stopped. Keep this screen open while it renders.');
  if (signal?.aborted) throw new DOMException('Render cancelled', 'AbortError');

  const type = (mimeType || 'video/webm').split(';')[0];
  return { blob: new Blob(chunks, { type }), type, duration: total, engine: 'Live recording' };
}
