// Who gets which team email, as chosen in Systems > Email recipients.
// app_settings 'notify' = { [flowKey]: { to: ['a@x.org', ...] }, ceo_copy?: boolean }
// A flow with no saved list (or a list with no valid address) keeps today's recipients: the secret
// the function already reads, then the address written in its code. So an empty setting changes nothing.
// Read with the service role and kept for 30 seconds; a failed read never stops an email going out.
import { createClient } from 'npm:@supabase/supabase-js@2';

// deno-lint-ignore no-explicit-any
type Settings = Record<string, any>;

const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[a-z]{2,}$/i;
/** The signed coaching forms (date of birth, home address, emergency contact) only go to team mailboxes. */
export const PRIVATE_DOMAINS = ['@thep31collective.org', '@p31market.com'];

let cache: { at: number; value: Settings } | null = null;

/** The saved 'notify' setting (or {} when there is none or it cannot be read). */
export async function notifySettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  let value: Settings = {};
  try {
    const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      const db = createClient(url, key, { auth: { persistSession: false } });
      const { data, error } = await db.from('app_settings').select('value').eq('key', 'notify').maybeSingle();
      if (error) console.warn('notify: could not read the recipients setting, using the defaults —', error.message);
      else if (data?.value && typeof data.value === 'object' && !Array.isArray(data.value)) value = data.value as Settings;
    }
  } catch (e) {
    console.warn('notify: could not read the recipients setting, using the defaults —', (e as Error).message);
  }
  cache = { at: Date.now(), value };
  return value;
}

/**
 * The inboxes for one team email: the saved list when it has at least one valid address, else `fallback`
 * (today's behaviour, returned as given). `onlyDomains` keeps a saved list to those endings (the coaching forms).
 */
export async function recipients(flowKey: string, fallback: string[], onlyDomains?: string[]): Promise<string[]> {
  try {
    const saved = (await notifySettings())?.[flowKey]?.to;
    if (!Array.isArray(saved)) return fallback;
    const ok = [...new Set(saved
      .map((e: unknown) => String(e ?? '').trim().toLowerCase())
      .filter((e: string) => EMAIL.test(e) && (!onlyDomains || onlyDomains.some((d) => e.endsWith(d)))))];
    return ok.length ? ok : fallback;
  } catch {
    return fallback;
  }
}

/** Whether ceo@ gets a copy of the team emails that carry one today (default: yes). */
export async function ceoCopy(fallback = true): Promise<boolean> {
  try {
    const v = (await notifySettings())?.ceo_copy;
    return typeof v === 'boolean' ? v : fallback;
  } catch {
    return fallback;
  }
}
