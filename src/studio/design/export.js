// Turns a Design studio document into files: a still (JPEG or PNG) or a video with music (MP4).
// Video is encoded in the browser with WebCodecs (mediabunny, MIT), faster than real time;
// browsers without it fall back to recording the canvas as it plays.
import { drawDesign, sizeOf, preloadImages, motionLength } from './draw';
import { loadFonts, familiesIn } from './fonts';

export const FPS = 30;

/** Fonts and pictures the design needs, loaded before the first draw. */
export async function prepare(doc) {
  await Promise.all([loadFonts(familiesIn(doc)), preloadImages(doc)]);
  if (document.fonts?.ready) await document.fonts.ready;
}

function canvasFor(doc) {
  const { w, h } = sizeOf(doc);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** The finished design as an image Blob. */
export async function renderStill(doc, { type = 'image/jpeg', quality = 0.93 } = {}) {
  await prepare(doc);
  const c = canvasFor(doc);
  drawDesign(c.getContext('2d'), doc, null);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the image.'))), type, quality));
}

/** A sensible video length: the entrances, then time to read, within 5–30 seconds. */
export function videoLength(doc) {
  const words = (doc.layers || []).filter((l) => l.type === 'text').map((l) => String(l.text || '')).join(' ').split(/\s+/).length;
  const want = doc.motion?.duration || Math.round(motionLength(doc) + 2.5 + words * 0.18);
  return Math.max(5, Math.min(30, want));
}

const MIMES = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];

/**
 * The design as a video: every entrance animated, the pattern drifting, and `audio` (an
 * AudioBuffer, already the right length) underneath. Returns { blob, type, seconds }.
 */
export async function renderVideo(doc, { seconds = videoLength(doc), audio = null, onProgress, signal } = {}) {
  await prepare(doc);
  const canvas = canvasFor(doc);
  const ctx = canvas.getContext('2d');
  const frames = Math.round(seconds * FPS);
  if (typeof VideoEncoder !== 'undefined') {
    try {
      return await encodeFast({ doc, canvas, ctx, frames, seconds, audio, onProgress, signal });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      // fall through to the recorder
    }
  }
  return recordRealtime({ doc, canvas, ctx, seconds, audio, onProgress, signal });
}

async function encodeFast({ doc, canvas, ctx, frames, seconds, audio, onProgress, signal }) {
  const mb = await import('mediabunny');
  const videoCodec = await mb.getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: canvas.width, height: canvas.height });
  if (!videoCodec) throw new Error('No video encoder');
  const audioCodec = audio ? await mb.getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate }) : null;
  if (audio && !audioCodec) throw new Error('No audio encoder');
  const mp4 = videoCodec === 'avc' && (!audioCodec || audioCodec === 'aac');
  const target = new mb.BufferTarget();
  const output = new mb.Output({ format: mp4 ? new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) : new mb.WebMOutputFormat(), target });
  const video = new mb.CanvasSource(canvas, { codec: videoCodec, quality: mb.QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: FPS });
  let sound = null;
  if (audio) { sound = new mb.AudioBufferSource({ codec: audioCodec, quality: mb.QUALITY_HIGH }); output.addAudioTrack(sound); }
  try {
    await output.start();
    if (sound) await sound.add(audio);
    for (let f = 0; f < frames; f += 1) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      drawDesign(ctx, doc, f / FPS, { length: seconds });
      await video.add(f / FPS, 1 / FPS);
      if (f % 10 === 0) onProgress?.(f / frames);
    }
    await output.finalize();
  } catch (e) {
    await output.cancel().catch(() => {});
    throw e;
  }
  onProgress?.(1);
  const type = mp4 ? 'video/mp4' : 'video/webm';
  return { blob: new Blob([target.buffer], { type }), type, seconds };
}

async function recordRealtime({ doc, canvas, ctx, seconds, audio, onProgress, signal }) {
  const mimeType = MIMES.find((m) => window.MediaRecorder?.isTypeSupported?.(m));
  if (!mimeType) throw new Error('This browser can’t make videos. Try Chrome or Edge on a computer.');
  const stream = canvas.captureStream(FPS);
  let ac = null;
  if (audio) {
    ac = new AudioContext({ sampleRate: audio.sampleRate });
    const dest = ac.createMediaStreamDestination();
    const src = ac.createBufferSource(); src.buffer = audio; src.connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    src.start(ac.currentTime + 0.05);
  }
  const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 160_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise((resolve) => { rec.onstop = resolve; });
  rec.start(250);
  const t0 = performance.now();
  await new Promise((resolve, reject) => {
    const tick = () => {
      if (signal?.aborted) { reject(new DOMException('Cancelled', 'AbortError')); return; }
      const t = (performance.now() - t0) / 1000;
      drawDesign(ctx, doc, Math.min(t, seconds), { length: seconds });
      onProgress?.(Math.min(1, t / seconds));
      if (t >= seconds) resolve(); else requestAnimationFrame(tick);
    };
    tick();
  }).finally(() => { if (rec.state !== 'inactive') rec.stop(); });
  await done;
  ac?.close();
  stream.getTracks().forEach((t) => t.stop());
  const type = mimeType.split(';')[0];
  return { blob: new Blob(chunks, { type }), type, seconds };
}

/** Save a Blob to the computer. */
export function download(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export const fileName = (doc, ext) => {
  const head = (doc.layers || []).find((l) => l.type === 'text' && l.name !== 'Handle');
  const slug = String(head?.text || 'design').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'design';
  return `p31-${slug}.${ext}`;
};
