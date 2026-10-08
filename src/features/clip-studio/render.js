// Clip Studio renderer: plays the edit timeline onto a canvas and records it.
//
// The audio clock is the master. Every shot's sound is scheduled
// sample-accurately with Web Audio; two muted <video> elements take turns
// (so the next shot is cued while the current one plays) and are nudged to
// stay in sync with the audio. The canvas + mixed audio are captured with
// MediaRecorder — MP4 where the browser supports it, WebM otherwise.

import { drawCaption, loadCaptionFont } from './captions';

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

export const canRender = () =>
  typeof window.MediaRecorder === 'function' && !!HTMLCanvasElement.prototype.captureStream && !!pickMime();

const END_CARD = 2.6;
const TITLE_CARD = 2.2;
const PLUM = '42, 21, 68';

const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

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
  title, brand, canvas, onProgress, signal,
}) {
  // Browsers stop drawing hidden pages, which would freeze the render.
  if (document.hidden) throw new Error('Keep Clip Studio on screen while it renders.');

  if (pages?.length) await loadCaptionFont(captionStyle);
  const W = aspect.w;
  const H = aspect.h;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  const base = Math.min(W, H);
  // Last fully-drawn picture, reused while a player is still seeking so the
  // output never flashes or ghosts.
  const held = document.createElement('canvas');
  held.width = W;
  held.height = H;
  const heldCtx = held.getContext('2d');

  await Promise.all([
    document.fonts.load(`800 ${Math.round(base * 0.06)}px Manrope`),
    document.fonts.load(`700 ${Math.round(base * 0.06)}px "Noto Serif"`),
    document.fonts.load(`italic 400 ${Math.round(base * 0.06)}px "Noto Serif"`),
  ]).catch(() => {});

  // Hidden-but-decoding players (iOS won't decode display:none video).
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;overflow:hidden;';
  document.body.appendChild(host);
  const players = [makeVideo(host), makeVideo(host)];

  const lastShot = timeline[timeline.length - 1];
  const editEnd = lastShot.outEnd;
  const endCard = style.endCard ? END_CARD : 0;
  const total = editEnd + endCard;

  // ── Audio graph ───────────────────────────────────────────
  const dest = audioCtx.createMediaStreamDestination();
  const master = audioCtx.createGain();
  master.connect(dest);
  const voiceBus = audioCtx.createGain();
  voiceBus.gain.value = levels.voice;
  voiceBus.connect(master);

  const t0 = audioCtx.currentTime + 0.35;
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

  // ── Recorder ──────────────────────────────────────────────
  const mimeType = pickMime();
  const stream = canvas.captureStream(30);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 160_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });

  // ── Players ───────────────────────────────────────────────
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

  // ── Drawing ───────────────────────────────────────────────
  const drawShot = (i, T, { alpha = 1, dx = 0, zoomMul = 1 } = {}) => {
    const shot = timeline[i];
    const el = players[i % 2];
    if (el._shot !== i || el.readyState < 2 || !el.videoWidth) return false;
    const local = Math.max(0, T - shot.outStart);
    const len = shot.end - shot.start;

    let zoom = 1;
    if (style.motion === 'punch') zoom = (i % 2 ? 1.12 : 1) + 0.07 * clamp01(1 - local / 0.22);
    if (style.motion === 'drift') zoom = 1 + 0.07 * clamp01(local / len);
    zoom *= zoomMul;

    const scale = Math.max(W / el.videoWidth, H / el.videoHeight) * zoom;
    const dw = el.videoWidth * scale;
    const dh = el.videoHeight * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = style.grade || 'none';
    ctx.drawImage(el, (W - dw) / 2 + dx, (H - dh) / 2, dw, dh);
    ctx.restore();
    return true;
  };

  const drawTransition = (i, T) => {
    const shot = timeline[i];
    const p = clamp01((T - shot.outStart) / shot.overlapIn);
    const e = ease(p);
    switch (style.transition) {
      case 'crossfade':
        drawShot(i - 1, T);
        drawShot(i, T, { alpha: e });
        break;
      case 'dip':
        if (p < 0.5) drawShot(i - 1, T); else drawShot(i, T);
        ctx.fillStyle = `rgba(${PLUM}, ${1 - Math.abs(p - 0.5) * 2})`;
        ctx.fillRect(0, 0, W, H);
        break;
      case 'flash':
        if (p < 0.5) drawShot(i - 1, T); else drawShot(i, T);
        ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - Math.abs(p - 0.5) * 2)})`;
        ctx.fillRect(0, 0, W, H);
        break;
      case 'slide':
        drawShot(i - 1, T, { dx: -e * W * 0.35 });
        drawShot(i, T, { dx: (1 - e) * W });
        break;
      case 'zoom':
        if (p < 0.5) drawShot(i - 1, T, { zoomMul: 1 + e * 0.35 });
        else drawShot(i, T, { zoomMul: 1.35 - e * 0.35, alpha: clamp01((p - 0.5) * 2 + 0.3) });
        break;
      default:
        drawShot(i, T);
    }
  };

  const drawLetterbox = () => {
    if (!style.letterbox) return;
    const bar = W > H ? (H - W / 2.39) / 2 : H * 0.07;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, bar);
    ctx.fillRect(0, H - bar, W, bar);
  };

  // Brand mark (curator logo) in a corner, clear of any letterbox bars.
  const drawBrand = () => {
    const img = brand?.image;
    if (!img?.width) return;
    const maxW = base * 0.16;
    const maxH = base * 0.11;
    const k = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * k;
    const h = img.height * k;
    const bar = style.letterbox ? (W > H ? (H - W / 2.39) / 2 : H * 0.07) : 0;
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

  // Captions: one page at a time, measured with the loaded font (see captions.js).
  const drawCaptions = (T) => {
    if (!pages?.length || T > editEnd) return;
    drawCaption(ctx, pages, T, captionStyle, W, H);
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
    // Cue upcoming shots onto whichever player is free.
    const next = timeline.findIndex((s) => s.outStart > T);
    if (next >= 0 && timeline[next].outStart - T < 1.5) {
      const busy = timeline.some((s, i) => i % 2 === next % 2 && i !== next && T >= s.outStart && T < s.outEnd);
      if (!busy) cue(next);
    }
  };

  // ── Run ───────────────────────────────────────────────────
  recorder.start(1000);
  let lastProgress = -1;

  await new Promise((resolve) => {
    const frame = () => {
      if (signal?.aborted || hiddenAbort) return resolve();
      const T = audioCtx.currentTime - t0;
      if (T >= total) return resolve();

      const t = Math.max(0, T);
      if (T >= 0) syncPlayers(t);

      if (t < editEnd || !endCard) {
        const i = Math.max(0, timeline.findLastIndex((s) => t >= s.outStart));
        const shot = timeline[i];
        const inTransition = i > 0 && shot.overlapIn > 0 && t < shot.outStart + shot.overlapIn;
        const ready = inTransition ? (drawTransition(i, t), true) : drawShot(i, t);
        if (ready) heldCtx.drawImage(canvas, 0, 0);
        else ctx.drawImage(held, 0, 0);
        drawLetterbox();
        drawBrand();
        drawTitle(t);
        drawCaptions(t);
      }
      drawEndCard(t);

      const pct = Math.floor((t / total) * 100);
      if (pct !== lastProgress) { lastProgress = pct; onProgress?.(t / total); }
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

  if (hiddenAbort) throw new Error('Clip Studio was put in the background, so the render stopped. Keep this screen open while it renders.');
  if (signal?.aborted) throw new DOMException('Render cancelled', 'AbortError');

  const type = (mimeType || 'video/webm').split(';')[0];
  return { blob: new Blob(chunks, { type }), type, duration: total };
}
