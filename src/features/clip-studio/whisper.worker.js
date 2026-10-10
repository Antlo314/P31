// Speech-to-text with word timings, on-device (Whisper tiny.en, MIT).
// Runs on the GPU (WebGPU) when the device has it, which is several times faster;
// otherwise on the CPU (WebAssembly). The model downloads once and the browser caches it.
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

const MODEL = 'onnx-community/whisper-tiny.en_timestamped';
let transcriber = null;
let engine = null;

const progress = (p) => {
  if (p.status === 'progress' && p.total) {
    self.postMessage({ type: 'download', file: p.file, loaded: p.loaded, total: p.total });
  }
};

const hasWebGPU = async () => {
  try { return !!(await navigator.gpu?.requestAdapter()); } catch { return false; }
};

const load = async (forceCpu = false) => {
  if (transcriber && !(forceCpu && engine === 'webgpu')) return transcriber;
  if (!forceCpu && await hasWebGPU()) {
    try {
      transcriber = await pipeline('automatic-speech-recognition', MODEL, {
        device: 'webgpu',
        dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
        progress_callback: progress,
      });
      engine = 'webgpu';
      return transcriber;
    } catch {
      transcriber = null; // fall through to the CPU
    }
  }
  transcriber = await pipeline('automatic-speech-recognition', MODEL, {
    device: 'wasm',
    dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
    progress_callback: progress,
  });
  engine = 'wasm';
  return transcriber;
};

const run = (asr, pcm) => asr(pcm, { return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 });

self.onmessage = async ({ data }) => {
  try {
    let asr = await load();
    self.postMessage({ type: 'status', text: 'Listening…', engine });
    let out;
    try {
      out = await run(asr, data.pcm);
    } catch (err) {
      if (engine !== 'webgpu') throw err;
      // Some GPUs load the model but fail mid-run: redo it on the CPU.
      asr = await load(true);
      self.postMessage({ type: 'status', text: 'Listening…', engine });
      out = await run(asr, data.pcm);
    }
    const words = (out.chunks || [])
      .map((c) => ({ text: c.text.trim(), start: c.timestamp[0], end: c.timestamp[1] ?? c.timestamp[0] + 0.3 }))
      .filter((w) => w.text);
    self.postMessage({ type: 'done', words, engine });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
};
