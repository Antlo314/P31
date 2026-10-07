// On-device background removal (ormbg, Apache-2.0, ~44 MB once, then cached).
import { pipeline, env, RawImage } from '@huggingface/transformers';

env.allowLocalModels = false;

const MODEL = 'onnx-community/ormbg-ONNX';
let segmenter = null;

self.onmessage = async ({ data }) => {
  try {
    if (!segmenter) {
      segmenter = await pipeline('background-removal', MODEL, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (p) => {
          if (p.status === 'progress' && p.total) {
            self.postMessage({ type: 'download', file: p.file, loaded: p.loaded, total: p.total });
          }
        },
      });
    }
    self.postMessage({ type: 'status', text: 'Removing background…' });
    const image = await RawImage.fromBlob(data.blob);
    // One image in → one RawImage out (a list only for batches).
    const res = await segmenter(image);
    const out = Array.isArray(res) ? res[0] : res;
    const rgba = out.channels === 4 ? out : out.rgba();
    const pixels = new Uint8ClampedArray(rgba.data);
    self.postMessage({ type: 'done', width: rgba.width, height: rgba.height, pixels }, [pixels.buffer]);
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
};
