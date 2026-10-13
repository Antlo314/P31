// Music for designs as audio: the chosen track (or upload) at the video's length, and previews.
import { renderTrack, trimBuffer } from './music';
import { trackBlob } from './store';

// Decoded uploads, by id, for the session.
export const decoded = new Map();
export async function decode(blob) {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  try { return await ac.decodeAudioData(await blob.arrayBuffer()); } finally { ac.close(); }
}
async function bufferFor(music) {
  if (music.kind === 'upload' && decoded.has(music.id)) return decoded.get(music.id);
  if (music.kind === 'team' && music.path) {
    if (!decoded.has(music.path)) decoded.set(music.path, await decode(await trackBlob(music.path)));
    return decoded.get(music.path);
  }
  return null;
}

/** The design's music as an AudioBuffer of `seconds` (null for silence). */
export async function getMusicBuffer(music, seconds) {
  if (!music || music.kind === 'none') return null;
  let buf;
  if (music.kind === 'track' || (!music.kind && music.track)) buf = await renderTrack(music.track, seconds, { seed: music.seed || 1 });
  else {
    const src = await bufferFor(music);
    if (!src) return null;
    buf = await trimBuffer(src, seconds, music.offset || 0, src.sampleRate);
  }
  const v = music.volume ?? 0.85;
  if (v !== 1) for (let c = 0; c < buf.numberOfChannels; c += 1) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i += 1) d[i] *= v; }
  return buf;
}

let previewCtx = null;
let previewSrc = null;
export function stopPreview() { try { previewSrc?.stop(); } catch { /* already stopped */ } previewSrc = null; }
export function playBuffer(buf, onEnd) {
  stopPreview();
  previewCtx = previewCtx || new (window.AudioContext || window.webkitAudioContext)();
  previewCtx.resume?.();
  const src = previewCtx.createBufferSource(); src.buffer = buf; src.connect(previewCtx.destination);
  src.onended = () => { if (previewSrc === src) { previewSrc = null; onEnd?.(); } };
  src.start(); previewSrc = src;
}
