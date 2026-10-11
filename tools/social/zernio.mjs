// Zernio API client for one-off team scripts. Reads ZERNIO_API_KEY from .env.local and never
// prints it. Base: https://zernio.com/api/v1 (bearer key).
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '').trim()]),
);
if (!env.ZERNIO_API_KEY) { console.error('ZERNIO_API_KEY is missing from .env.local'); process.exit(1); }

export const ENV = env;
export const BASE = 'https://zernio.com/api/v1';

// P31's connected accounts (ids from Zernio → Accounts).
export const ACCOUNTS = {
  instagram: '6ac6716d90b16e751447d7fe', // @proverbs31market
  facebook: '6ac67950507b603704a87454',  // Proverbs 31 Marketplace page
  googlebusiness: '6ac676a6d2784530f27069cd',
};

export async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.ZERNIO_API_KEY}`, ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
  if (!res.ok) { const e = new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 400)}`); e.status = res.status; e.body = json; throw e; }
  return json;
}

/** Upload a local file to Zernio media storage; returns its public URL. */
export async function uploadFile(path, filename, contentType) {
  const { readFile } = await import('node:fs/promises');
  const data = await readFile(path);
  const pre = await api('/media/presign', { method: 'POST', body: { filename, contentType, size: data.length } });
  const put = await fetch(pre.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: data });
  if (!put.ok) throw new Error(`upload ${filename} → ${put.status}`);
  return pre.publicUrl;
}
