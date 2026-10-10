// Clip Studio colour grading on the GPU (WebGL2). One shader does the whole look:
// exposure, white balance, contrast, highlights/shadows, saturation + vibrance,
// split toning, black-and-white, fade, vignette, film grain, glow, sharpening and a
// touch of lens fringing. Captions, logos and cards are drawn after grading, so
// they stay crisp and true to colour.

export const ADJUSTMENTS = [
  ['exposure', 'Exposure'], ['contrast', 'Contrast'], ['saturation', 'Saturation'], ['warmth', 'Warmth'], ['tint', 'Tint'],
  ['highlights', 'Highlights'], ['shadows', 'Shadows'], ['fade', 'Fade'], ['vignette', 'Vignette'], ['grain', 'Grain'],
  ['glow', 'Glow'], ['sharpen', 'Sharpen'],
];
// Sliders that only go one way (0…1); the rest are −1…1.
export const ONE_WAY = new Set(['fade', 'vignette', 'grain', 'glow', 'sharpen']);
export const NO_ADJUST = Object.fromEntries(ADJUSTMENTS.map(([k]) => [k, 0]));

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const P = (o) => ({ exposure: 0, contrast: 0, saturation: 0, vibrance: 0, warmth: 0, tint: 0, highlights: 0, shadows: 0, fade: 0,
  vignette: 0, grain: 0, glow: 0, sharpen: 0, mono: 0, fringe: 0, split: 0, shadowTint: '#808080', highTint: '#808080', ...o });

// The looks. Names are what people see; ids are saved with each render.
export const FILTERS = [
  { id: 'original', name: 'Original', p: P({}) },
  { id: 'natural', name: 'Natural', p: P({ contrast: 0.06, saturation: 0.06, sharpen: 0.15 }) },
  { id: 'gold', name: 'Golden Hour', p: P({ warmth: 0.5, contrast: 0.1, saturation: 0.08, highlights: 0.12, glow: 0.18, vignette: 0.22, split: 0.35, shadowTint: '#5e2a8c', highTint: '#f2ce4d' }) },
  { id: 'plum', name: 'Plum Night', p: P({ warmth: -0.1, tint: 0.15, contrast: 0.22, shadows: -0.12, saturation: -0.04, split: 0.55, shadowTint: '#4a1f78', highTint: '#f2ce4d', vignette: 0.42 }) },
  { id: 'vivid', name: 'Vivid', p: P({ contrast: 0.18, saturation: 0.25, vibrance: 0.35, sharpen: 0.35, highlights: -0.05 }) },
  { id: 'film', name: 'Film', p: P({ contrast: 0.12, saturation: -0.12, warmth: 0.2, fade: 0.35, grain: 0.45, vignette: 0.3 }) },
  { id: 'cinema', name: 'Teal & Orange', p: P({ contrast: 0.16, saturation: -0.04, split: 0.6, shadowTint: '#1f5f6b', highTint: '#e9a35a', vignette: 0.32, sharpen: 0.15 }) },
  { id: 'dreamy', name: 'Dreamy', p: P({ glow: 0.65, fade: 0.22, contrast: -0.08, highlights: 0.15, warmth: 0.15, saturation: -0.05 }) },
  { id: 'cool', name: 'Clean Cool', p: P({ warmth: -0.35, contrast: 0.08, saturation: 0.05, highlights: 0.06, sharpen: 0.2 }) },
  { id: 'vintage', name: 'Vintage', p: P({ warmth: 0.35, tint: -0.05, fade: 0.42, saturation: -0.25, grain: 0.35, vignette: 0.36, split: 0.25, shadowTint: '#2f4a5a', highTint: '#f0c27b' }) },
  { id: 'mono', name: 'Classic B&W', p: P({ mono: 1, contrast: 0.25, grain: 0.25, vignette: 0.3 }) },
  { id: 'noir', name: 'Noir', p: P({ mono: 1, contrast: 0.48, shadows: -0.22, vignette: 0.6, grain: 0.2 }) },
  { id: 'retro', name: 'Retro Tape', p: P({ fringe: 0.85, grain: 0.5, saturation: 0.15, fade: 0.2, contrast: 0.06, warmth: 0.1 }) },
];

// Each edit style starts on a matching look.
export const STYLE_FILTER = { clean: 'natural', hype: 'vivid', cinematic: 'film', luxe: 'gold', promo: 'vivid', vlog: 'natural' };

export const defaultLook = (styleId) => ({ filter: STYLE_FILTER[styleId] || 'natural', intensity: 1, adjust: { ...NO_ADJUST } });

/** The final shader values for a look: the filter scaled by intensity, plus the sliders. */
export function lookParams(look) {
  const f = FILTERS.find((x) => x.id === look?.filter) || FILTERS[0];
  const k = look?.intensity ?? 1;
  const out = {};
  for (const [key, v] of Object.entries(f.p)) out[key] = typeof v === 'number' ? v * k : v;
  for (const [key, v] of Object.entries(look?.adjust || {})) out[key] = (out[key] || 0) + v;
  return out;
}

export const isIdentity = (params) => Object.values(params).every((v) => typeof v !== 'number' || Math.abs(v) < 1e-3);

/** A rough CSS-filter version, for browsers without WebGL2. */
export function cssFallback(p) {
  const parts = [
    `brightness(${(2 ** (p.exposure || 0)) * (1 + (p.highlights || 0) * 0.1)})`,
    `contrast(${1 + (p.contrast || 0)})`,
    `saturate(${Math.max(0, (1 + (p.saturation || 0) + (p.vibrance || 0) * 0.4) * (1 - (p.mono || 0)))})`,
  ];
  if ((p.warmth || 0) > 0) parts.push(`sepia(${Math.min(0.6, p.warmth * 0.35)})`);
  if ((p.warmth || 0) < 0) parts.push(`hue-rotate(${Math.round(p.warmth * 12)}deg)`);
  if (p.tint) parts.push(`hue-rotate(${Math.round(p.tint * -10)}deg)`);
  return parts.join(' ');
}

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5); gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_time, u_exposure, u_contrast, u_saturation, u_vibrance, u_warmth, u_tint, u_highlights, u_shadows,
  u_fade, u_vignette, u_grain, u_glow, u_sharpen, u_mono, u_fringe, u_split;
uniform vec3 u_shadowTint, u_highTint;
in vec2 v_uv;
out vec4 o;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 px = 1.0 / u_res;
  vec3 c;
  if (u_fringe > 0.001) {
    vec2 d = (v_uv - 0.5) * u_fringe * 0.012;
    c = vec3(texture(u_tex, v_uv + d).r, texture(u_tex, v_uv).g, texture(u_tex, v_uv - d).b);
  } else {
    c = texture(u_tex, v_uv).rgb;
  }
  if (u_sharpen > 0.001) {
    vec3 b = (texture(u_tex, v_uv + vec2(px.x, 0.0)).rgb + texture(u_tex, v_uv - vec2(px.x, 0.0)).rgb
            + texture(u_tex, v_uv + vec2(0.0, px.y)).rgb + texture(u_tex, v_uv - vec2(0.0, px.y)).rgb) * 0.25;
    c += (c - b) * u_sharpen * 1.6;
  }
  if (u_glow > 0.001) {
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 0.5236;
      float r = (i % 2 == 0) ? 10.0 : 22.0;
      vec3 s = texture(u_tex, v_uv + vec2(cos(a), sin(a)) * px * r).rgb;
      acc += max(s - 0.55, 0.0);
    }
    c += acc / 12.0 * u_glow * 2.2;
  }
  c *= exp2(u_exposure);
  c += vec3(u_warmth * 0.07, u_tint * 0.05, -u_warmth * 0.07);
  float l = luma(c);
  c += u_shadows * 0.22 * (1.0 - smoothstep(0.0, 0.55, l));
  c += u_highlights * 0.22 * smoothstep(0.45, 1.0, l);
  c = (c - 0.5) * (1.0 + u_contrast) + 0.5;
  l = luma(c);
  c = mix(vec3(l), c, 1.0 + u_saturation);
  float spread = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
  c = mix(vec3(l), c, 1.0 + u_vibrance * (1.0 - clamp(spread, 0.0, 1.0)));
  l = clamp(luma(c), 0.0, 1.0);
  c += (u_shadowTint - 0.5) * u_split * (1.0 - l) * 0.5 + (u_highTint - 0.5) * u_split * l * 0.5;
  c = mix(c, vec3(luma(c)), clamp(u_mono, 0.0, 1.0));
  c = c * (1.0 - u_fade * 0.28) + u_fade * 0.13;
  float dist = distance(v_uv, vec2(0.5));
  c *= 1.0 - u_vignette * smoothstep(0.32, 0.86, dist);
  c += (hash(v_uv * u_res + fract(u_time) * 911.0) - 0.5) * u_grain * 0.14;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const UNIFORMS = ['exposure', 'contrast', 'saturation', 'vibrance', 'warmth', 'tint', 'highlights', 'shadows', 'fade', 'vignette',
  'grain', 'glow', 'sharpen', 'mono', 'fringe', 'split'];

/**
 * A reusable GPU grader. grade(source, params, time) draws `source` (video, image or
 * canvas, any size, already framed by the caller) graded into `grader.canvas`.
 * Returns null when WebGL2 isn't available.
 */
export function createGrader() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
  if (!gl) return null;
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader failed');
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link failed');
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const u = Object.fromEntries([...UNIFORMS, 'res', 'time', 'shadowTint', 'highTint'].map((n) => [n, gl.getUniformLocation(prog, `u_${n}`)]));

  return {
    canvas,
    grade(source, params, time = 0) {
      const w = source.videoWidth || source.width;
      const h = source.videoHeight || source.height;
      if (!w || !h) return false;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.uniform2f(u.res, w, h);
      gl.uniform1f(u.time, time);
      for (const n of UNIFORMS) gl.uniform1f(u[n], params[n] || 0);
      gl.uniform3fv(u.shadowTint, hex(params.shadowTint || '#808080'));
      gl.uniform3fv(u.highTint, hex(params.highTint || '#808080'));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return true;
    },
    dispose() {
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
