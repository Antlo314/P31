// Speech-to-text with word timings, on-device (Whisper tiny.en, MIT).
// The model (~41 MB) downloads once and is cached by the browser.
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

const MODEL = 'onnx-community/whisper-tiny.en_timestamped';
let transcriber = null;

const load = async () => {
  if (!transcriber) {
    transcriber = await pipeline('automatic-speech-recognition', MODEL, {
      dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
      device: 'wasm',
      progress_callback: (p) => {
        if (p.status === 'progress' && p.total) {
          self.postMessage({ type: 'download', file: p.file, loaded: p.loaded, total: p.total });
        }
      },
    });
  }
  return transcriber;
};

self.onmessage = async ({ data }) => {
  try {
    const asr = await load();
    self.postMessage({ type: 'status', text: 'Listening…' });
    const out = await asr(data.pcm, {
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const words = (out.chunks || [])
      .map((c) => ({ text: c.text.trim(), start: c.timestamp[0], end: c.timestamp[1] ?? c.timestamp[0] + 0.3 }))
      .filter((w) => w.text);
    self.postMessage({ type: 'done', words });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
};
