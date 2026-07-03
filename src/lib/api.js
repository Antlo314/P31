import { supabase } from './supabase';

// Small helper for calling the Vercel serverless API (/api/*).
// Pass { auth: true } to attach the current Supabase session token.
export async function apiPost(path, body = {}, { auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  if (auth && supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  }

  const res = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    // Non-JSON response (e.g. 404 HTML in local vite dev where /api isn't served)
  }

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status}). If running locally, use "vercel dev" so /api routes are available.`);
  }
  return data;
}
