// Supabase Edge Function: content-autopilot
// Keeps the posting calendar full, with a person approving every post.
//   Daily (v46 schedules it at 14:30 UTC): when the next stretch has fewer posts a day than the
//   settings ask for and it starts within `lead_days`, draft `days_per_batch` days of posts in the
//   CEO's quote-card look (quotes, prayers, KJV scripture, fill in the blank, curator and mentorship
//   invitations), each with Instagram and Facebook captions and a good time, and email the
//   approvers a review link. Remind once after a day; a batch expires after a week.
//   The review page (/approve/:id) draws each card in the browser and calls this function to
//   upload it and schedule it through Zernio. Nothing posts until someone approves.
// Body: { source: 'cron' } | { action: 'draft' } (Studio team) |
//       { action: 'get' | 'update' | 'presign' | 'schedule' | 'finish' | 'decline', batch, token?, ... }
//       (the review link's token, or a signed-in Studio team member)
// Secrets: SUPABASE_SERVICE_ROLE_KEY, ZERNIO_API_KEY, GEMINI_API_KEY (optional: captions and lines
//          are written by Gemini when set, from the built-in library when not), RESEND_API_KEY, EMAIL_FROM
// Deploy: supabase functions deploy content-autopilot --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, layout, esc, emailConfigured } from '../_shared/email.ts';

const env = (k: string) => Deno.env.get(k) || '';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
class UserError extends Error {}

const TZ = 'America/New_York';
const DAY = 864e5;
const ZERNIO = 'https://zernio.com/api/v1';
const SITE = 'https://www.p31market.com';
const LINKS = { storefront: `${SITE}/storefront`, apply: `${SITE}/apply`, mentorship: 'https://www.thep31collective.org/join' };
const TAGS: Record<string, string> = {
  quote: '#P31Marketplace #Proverbs31Woman #FaithAndBusiness #KingdomEntrepreneur #ChristianWomenInBusiness #WomenWhoBuild',
  prayer: '#P31Marketplace #Proverbs31Woman #FaithAndBusiness #KingdomEntrepreneur #PrayerWorks #WomenWhoBuild',
  scripture: '#P31Marketplace #Proverbs31 #ScriptureForToday #KJV #Proverbs31Woman #FaithOverFear',
  blank: '#P31Marketplace #WomenWhoBuild #FaithAndBusiness #KingdomEntrepreneur #WomenInBusiness',
  curator: '#P31Marketplace #WomenOwnedBusiness #AtlantaMakers #ShopSmall #WomenWhoBuild #KingdomEntrepreneur',
  mentorship: '#P31Collective #KingdomEntrepreneur #WomenInBusiness #FaithAndBusiness #MentorshipMatters #P31Marketplace',
};
const LOOKS = ['lilac', 'plum', 'olive', 'thistle', 'lilac', 'gold', 'green', 'amethyst', 'lilac', 'ivory', 'royal', 'sage', 'lilac', 'blush', 'dusk'];
const PATTERNS = ['topo', 'topo', 'topo', 'waves', 'topo', 'topo', 'rings', 'topo', 'topo', 'arches', 'topo', 'topo', 'blobs', 'topo', 'dots'];
// The CEO's own card and the October collection, so the autopilot never repeats them.
const USED = ['Push me God. I want the promises we talked about.', 'Lord, stretch me. I’m ready for the room You promised.', 'She was never too much. She was built for more.', 'Delayed is not denied. Keep building.', 'My business is my ministry. My gift is my assignment.', 'Order my steps, God. I’ll do the work.', 'Pray like it depends on God. Work like it depends on you.', 'I’m not chasing a seat at the table. I’m building one.', 'Faith over fear. Purpose over pressure.', 'Quiet seasons grow deep roots.', 'Rejected? No. Redirected.', 'I will not shrink to fit rooms I’ve outgrown.', 'Your obedience is someone else’s breakthrough.', 'Build it with prayer. Brand it with purpose.', 'God, help me trust the pace of Your plan.', 'Kingdom woman. Business mind. Unshakable heart.', 'I’m not behind. I’m being prepared.', 'Stop waiting to feel ready. Start because you’re called.', 'Lord, give me the strength to stay consistent.', 'Grace for today. Vision for tomorrow.', 'Heal the woman. Then build the business.', 'It’s not too late. You’re right on God’s time.', 'Small steps still count when God is ordering them.', 'Not every closed door is a no. Some are a not yet.', 'She’s clothed in strength and still leads with love.', 'Rest is not quitting. Rest is holy.', 'What God started in you, He will finish.', 'Your gift will make room for you. Keep showing up.', 'Push past the doubt. The promise is on the other side.'];

// ── A library to fall back on when the writing helper is unavailable (and to mix in) ──
const LIB = {
  quote: ['Lord, make my yes as bold as Your promise.', 'She prayed about it, then she built it.', 'I am not waiting for permission to be who God called.', 'Faithful in small things. Ready for big rooms.', 'Open the doors only You can open, Lord.', 'Same God, new level. Keep going.', 'The anointing on your hands is not for hiding.', 'God gave me the vision. I will give it my whole heart.', 'Bloom where He planted you. Build where He sends you.', 'She did it afraid, and God did the rest.', 'My gift is not too small for God to use.', 'Strong in faith. Soft in heart. Serious about business.', 'I am building something my grandchildren will thank God for.', 'Lord, keep me humble when the doors start opening.', 'Discipline today. Testimony tomorrow.', 'Your purpose is bigger than your fear.', 'God is not finished with your story or your storefront.', 'Rise early, pray first, then go get it.', 'Excellence is how I say thank You, God.', 'I will not apologize for the room God made for me.', 'Plant the seed. Water it with faith. Watch Him grow it.', 'Called, equipped and on assignment.', 'Your hands were made to build what your heart believes.', 'Peace over pressure. Purpose over popularity.', 'Lord, let my business glorify You first.', 'Keep showing up. Heaven is keeping count.', 'I trust the God who gave me the idea.', 'Pray. Plan. Build. Repeat.', 'Do not shrink the vision. Grow your faith.', 'The table God prepares has your name on it.', 'Women who pray build differently.', 'Quiet faith. Loud results.', 'Build boldly. Serve humbly.', 'Lord, stretch my faith before You stretch my territory.', 'You were not made to blend in. You were made to build.'],
  prayer: [['Dear God,', 'Teach my hands to build what pleases You.'], ['Lord,', 'Give me wisdom for every decision this week.'], ['Father,', 'Make my business a blessing to everyone it touches.'], ['Dear God,', 'Help me rest without guilt and work without fear.'], ['Lord,', 'Open the right doors and close the ones I should not walk through.'], ['Note to self:', 'God already went ahead of you.'], ['Reminder:', 'You are called on purpose, not by accident.'], ['Dear God,', 'Let my yes to You be louder than my doubts.']],
  blank: ['The gift God gave me that I almost ignored is', 'This year, my business will', 'The verse that carries me on hard days is', 'One thing I am believing God for this month is', 'If I could tell my younger self one thing about business, it would be', 'The best advice a woman in business ever gave me was', 'I knew God was in my business when', 'The one word I want over my business this season is', 'What I am building is really about', 'My customers come back because'],
  questions: ['What is God stretching you in this season?', 'Which line do you need to hear most today?', 'What is one step you are taking this week?', 'What would you build if fear had no vote?', 'How is God growing you through your business right now?', 'What does this stir in you today?', 'Where do you need to trust God with the next step?', 'What are you believing God for this month?'],
};
const INVITES: Record<string, Row[]> = {
  curator: [
    { eyebrow: 'Open a virtual storefront', headline: 'Your shop deserves a beautiful home.', body: 'A storefront on p31market.com with up to 10 products or services, P31 marketing and support. Free for your first 3 months.', button: 'Start at p31market.com/storefront', link: 'storefront' },
    { eyebrow: 'Vend at a P31 Market', headline: 'Bring your gift to the market floor.', body: 'Booths at our seasonal Atlanta markets for women-led brands and artisans who build with purpose.', button: 'Apply at p31market.com/apply', link: 'apply' },
    { eyebrow: 'Now accepting curators', headline: 'Sell with purpose. Grow with sisters.', body: 'A storefront on p31market.com, seasonal markets, coaching and a community of women who build.', button: 'p31market.com/storefront', link: 'storefront' },
    { eyebrow: 'For makers and creatives', headline: 'Your craft. Your story. Your storefront.', body: 'Handmade goods, wellness, treats, books, decor and services from women-led brands.', button: 'Start at p31market.com/storefront', link: 'storefront' },
  ],
  mentorship: [
    { eyebrow: 'The P31 Collective', headline: 'Build your business with a mentor beside you.', body: 'Business and faith-based mentorship for women who build, with live sessions and a private classroom.', button: 'Book your free intro call', link: 'mentorship' },
    { eyebrow: 'Faith-based mentorship', headline: 'Grow in faith while you grow your brand.', body: 'The P31 Collective by NEBA walks with you in both, with live sessions and a private classroom.', button: 'Start with a free intro call', link: 'mentorship' },
    { eyebrow: 'Business mentorship', headline: 'Stop guessing. Start building with a plan.', body: 'Live sessions, a private classroom and accountability for women who build.', button: 'Free intro call: thep31collective.org/join', link: 'mentorship' },
    { eyebrow: 'Your next season', headline: 'You were not meant to figure it out alone.', body: 'Private mentorship for faith-driven women entrepreneurs. It starts with a free intro call.', button: 'thep31collective.org/join', link: 'mentorship' },
  ],
};
const INVITE_CAPTION: Record<string, string> = {
  storefront: 'Your gift deserves a home online. ✨\n\nA P31 storefront on p31market.com: up to 10 products or services, P31 marketing and support, free for your first 3 months.\n\nStart your storefront: {link}',
  apply: 'Bring your gift to the market floor. 🛍️\n\nWe are accepting women-led brands and artisans for booths at our seasonal Atlanta markets.\n\nApply to vend: {link}',
  mentorship: 'You were never meant to build alone. 💜\n\nThe P31 Collective by NEBA offers business and faith-based mentorship for women who build, with live sessions and a private classroom.\n\nIt starts with a free intro call: {link}',
};

// ── Small helpers ──
const sha256 = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, '0')).join('');
const etParts = (d: Date) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(d).map((p) => [p.type, p.value]));
const etDate = (d: Date) => { const p = etParts(d); return `${p.year}-${p.month}-${p.day}`; };
const etLocal = (d: Date) => { const p = etParts(d); return `${p.year}-${p.month}-${p.day}T${String(Number(p.hour) % 24).padStart(2, '0')}:${p.minute}:00`; };
const minutesOf = (d: Date) => { const p = etParts(d); return (Number(p.hour) % 24) * 60 + Number(p.minute); };
/** The instant for an Eastern wall-clock date and time. */
function etToUtc(day: string, hm: string) {
  const guess = new Date(`${day}T${hm}:00Z`);
  const p = etParts(guess);
  const asEt = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
  return new Date(guess.getTime() + (guess.getTime() - asEt));
}
const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
const nice = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
const rand = (seed: number) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

async function zernio(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ZERNIO}${path}`, { ...init, headers: { Authorization: `Bearer ${env('ZERNIO_API_KEY')}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const text = await res.text();
  let body: Row = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 200) }; }
  if (!res.ok) throw new UserError(body?.error || `Zernio could not complete that (${res.status}).`);
  return body;
}
async function scheduledPosts(): Promise<Row[]> {
  const all: Row[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const r = await zernio(`/posts?status=scheduled&limit=100&page=${page}`);
    all.push(...(r.posts || []));
    if (page >= (r.pagination?.pages || 1)) break;
  }
  return all.filter((p) => p.scheduledFor);
}

// ── Planning: which days need posts, and at what times ──
const SLOTS: Record<string, string[]> = { wk: ['12:30', '19:30', '15:00', '21:00', '09:00'], sat: ['13:00', '20:00', '16:00', '10:30'], sun: ['13:00', '19:30', '16:00', '09:30'] };
function planSlots(posts: Row[], s: Row, force: boolean) {
  const byDay = new Map<string, number[]>();
  for (const p of posts) { const d = new Date(p.scheduledFor); const k = etDate(d); byDay.set(k, [...(byDay.get(k) || []), minutesOf(d)]); }
  const today = etDate(new Date());
  let first: string | null = null;
  for (let i = 1; i <= 60; i += 1) { const d = addDays(today, i); if ((byDay.get(d) || []).length < s.posts_per_day) { first = d; break; } }
  if (!first) return { first: null, slots: [] as { day: string; hm: string }[], reason: 'The next two months are full.' };
  const lead = Math.round((new Date(`${first}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / DAY);
  if (!force && lead > s.lead_days) return { first, slots: [], reason: `The calendar is full until ${nice(first)} (more than ${s.lead_days} days away).` };
  const slots: { day: string; hm: string }[] = [];
  for (let i = 0; i < s.days_per_batch; i += 1) {
    const day = addDays(first, i);
    const taken = [...(byDay.get(day) || [])];
    const wd = weekday(day);
    const opts = wd === 6 ? SLOTS.sat : wd === 0 ? SLOTS.sun : SLOTS.wk;
    for (let n = taken.length; n < s.posts_per_day; n += 1) {
      const hm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
      const pick = opts.find((t) => taken.every((x) => Math.abs(x - hm(t)) >= 150))
        || [...opts].sort((a, b) => Math.min(...taken.map((x) => Math.abs(x - hm(b))), 1e9) - Math.min(...taken.map((x) => Math.abs(x - hm(a))), 1e9))[0];
      taken.push(hm(pick));
      slots.push({ day, hm: pick });
    }
  }
  slots.sort((a, b) => (a.day + a.hm).localeCompare(b.day + b.hm));
  return { first, slots, reason: '' };
}

/** Kinds for N posts from the mix, spread evenly, scripture on Sundays where it fits. */
function planKinds(slots: { day: string }[], mix: Row) {
  const kinds = ['quote', 'prayer', 'scripture', 'blank', 'curator', 'mentorship'].filter((k) => Number(mix[k]) > 0);
  const total = kinds.reduce((a, k) => a + Number(mix[k]), 0) || 1;
  const n = slots.length;
  const raw = kinds.map((k) => ({ k, x: (Number(mix[k]) / total) * n }));
  const counts = Object.fromEntries(raw.map((r) => [r.k, Math.floor(r.x)]));
  let left = n - Object.values(counts).reduce((a: number, b) => a + (b as number), 0);
  for (const r of [...raw].sort((a, b) => (b.x % 1) - (a.x % 1))) { if (left <= 0) break; counts[r.k] += 1; left -= 1; }
  const tokens: { k: string; at: number }[] = [];
  for (const k of kinds) for (let i = 0; i < counts[k]; i += 1) tokens.push({ k, at: (i + 0.5) / counts[k] + (k === 'quote' ? 0.001 : 0) });
  tokens.sort((a, b) => a.at - b.at);
  const out = tokens.map((t) => t.k);
  // No two of the same kind back to back where it can be helped.
  for (let i = 1; i < out.length; i += 1) {
    if (out[i] !== out[i - 1]) continue;
    const j = out.findIndex((k, x) => x > i && k !== out[i] && k !== out[i - 1]);
    if (j > 0) [out[i], out[j]] = [out[j], out[i]];
  }
  // At most one invitation a day: move a second one to a day that has none, in place of a quote.
  const invite = (k: string) => k === 'curator' || k === 'mentorship';
  const invitesOn = (day: string) => out.filter((k, x) => slots[x].day === day && invite(k)).length;
  slots.forEach((s, i) => {
    if (!invite(out[i]) || invitesOn(s.day) < 2) return;
    // The quote slot farthest from every other invitation.
    const others = out.map((k, x) => (invite(k) && x !== i ? x : -1)).filter((x) => x >= 0);
    let j = -1; let best = -1;
    out.forEach((k, x) => {
      if (k !== 'quote' || invitesOn(slots[x].day) > 0) return;
      const gap = Math.min(...others.map((y) => Math.abs(x - y)), 1e9);
      if (gap > best) { best = gap; j = x; }
    });
    if (j >= 0) [out[i], out[j]] = [out[j], out[i]];
  });
  // Scripture on Sunday when a Sunday slot is free.
  slots.forEach((s, i) => {
    if (weekday(s.day) !== 0 || out.some((k, x) => k === 'scripture' && slots[x].day === s.day)) return;
    const j = out.findIndex((k, x) => k === 'scripture' && weekday(slots[x].day) !== 0);
    if (j >= 0) [out[i], out[j]] = [out[j], out[i]];
  });
  return out;
}

// ── Writing: Gemini in the CEO's voice, the library as a fallback ──
const STYLE = `You write Instagram and Facebook posts for Proverbs 31 Marketplace and The P31 Collective (CEO: Melanie JC):
faith-driven women entrepreneurs in Atlanta. The look is a bold all-caps statement on a quote card, like the CEO's own:
"Push me God. I want the promises we talked about." Voice: bold, warm, faith-forward and business-minded; first person
("I", "Lord, ...") or speaking to her ("you"). Short and declarative. Never preachy or corny.`;
const RULES = `Rules: card lines at most 60 characters, no emojis, no hashtags, no quotation marks, no scripture quotes in them.
Captions: two to four short lines, may use one or two emojis, end with one genuine question that invites a comment.
Never "tag a friend", "share if", "comment below if you agree", giveaways, prices, dates, statistics or promises of results.
Do not write hashtags (they are added later). Invitation captions must keep the given facts and put {link} where the link goes.`;

async function gemini(prompt: string) {
  if (!env('GEMINI_API_KEY')) return null;
  const models = [...new Set([env('GEMINI_MODEL') || 'gemini-3.8-flash', 'gemini-3.8-flash'])];
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'x-goog-api-key': env('GEMINI_API_KEY'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 8000, temperature: 0.95, responseMimeType: 'application/json' } }),
      });
      const j = await res.json();
      if (!res.ok) { console.error('Gemini', model, res.status, JSON.stringify(j.error || j).slice(0, 200)); continue; }
      const text = (j.candidates?.[0]?.content?.parts || []).map((p: Row) => (p.thought ? '' : p.text || '')).join('').trim();
      const clean = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      return JSON.parse(clean.slice(clean.search(/[[{]/)));
    } catch (e) { console.error('Gemini parse', (e as Error).message); }
  }
  return null;
}
const okLine = (s: unknown, max = 70) => typeof s === 'string' && s.trim().length >= 8 && s.trim().length <= max && !/[#@]|https?:|\p{Extended_Pictographic}/u.test(s);
const okCaption = (s: unknown) => typeof s === 'string' && s.trim().length >= 30 && s.length <= 1800 && !/tag a friend|share if/i.test(s);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// deno-lint-ignore no-explicit-any
async function writeBatch(db: any, kinds: string[]) {
  const need = (k: string) => kinds.filter((x) => x === k).length;
  // What has been used recently, so nothing repeats.
  const { data: recent } = await db.from('autopilot_items').select('kind, line, words').order('created_at', { ascending: false }).limit(400);
  const used = new Set([...USED, ...(recent || []).map((r: Row) => r.line || '')].map(norm));
  const usedRefs = new Set((recent || []).filter((r: Row) => r.kind === 'scripture').map((r: Row) => r.words?.reference));
  const usedInvites = new Set((recent || []).filter((r: Row) => ['curator', 'mentorship'].includes(r.kind)).slice(0, 6).map((r: Row) => r.words?.headline));
  const { data: verses } = await db.from('chat_scriptures').select('ref, text');
  const pool = (verses || []).filter((v: Row) => !usedRefs.has(v.ref) && v.text.length <= 240);
  const r = rand(Date.now() % 1e9);
  const pickVerses = [...pool].sort(() => r() - 0.5).slice(0, need('scripture'));
  const inviteFor = (k: string) => { const list = INVITES[k]; const fresh = list.filter((x) => !usedInvites.has(x.headline)); return (fresh.length ? fresh : list); };
  const curators = Array.from({ length: need('curator') }, (_, i) => inviteFor('curator')[i % inviteFor('curator').length]);
  const mentors = Array.from({ length: need('mentorship') }, (_, i) => inviteFor('mentorship')[i % inviteFor('mentorship').length]);

  const ask = `${STYLE}\n\n${RULES}\n\nWrite JSON with these keys:\n` +
    `"quotes": ${need('quote') + 6} objects {"headline", "caption"} (bold statements in the CEO's style),\n` +
    `"prayers": ${need('prayer') + 3} objects {"intro" (a short opener like "Dear God," or "Note to self:"), "headline", "caption"},\n` +
    `"blanks": ${need('blank') + 3} objects {"headline" (the start of a sentence for followers to finish, no ending punctuation), "caption"},\n` +
    `"scriptures": one object per verse below, in the same order, {"caption"} (do not change the verse),\n` +
    `"invites": one object per invitation below, in the same order, {"caption"} (keep the facts, include {link}).\n\n` +
    `Verses: ${JSON.stringify(pickVerses.map((v: Row) => `${v.text} (${v.ref})`))}\n` +
    `Invitations: ${JSON.stringify([...curators, ...mentors].map((x) => `${x.eyebrow}. ${x.headline} ${x.body}`))}\n` +
    `Never reuse or closely echo these lines: ${JSON.stringify([...USED, ...(recent || []).slice(0, 60).map((x: Row) => x.line).filter(Boolean)])}`;
  const ai = (await gemini(ask)) || {};
  const writer = ai.quotes ? 'gemini' : 'library';

  const take = <T,>(list: T[], fallback: T[], key: (t: T) => string) => {
    const out: T[] = [];
    for (const t of [...list, ...fallback.sort(() => r() - 0.5)]) { const k = norm(key(t)); if (!k || used.has(k)) continue; used.add(k); out.push(t); }
    return out;
  };
  const q = (i: number) => LIB.questions[i % LIB.questions.length];
  const quotes = take((ai.quotes || []).filter((x: Row) => okLine(x?.headline) && okCaption(x?.caption)),
    LIB.quote.map((h, i) => ({ headline: h, caption: `${h}\n\n${q(i)}` })), (x: Row) => x.headline);
  const prayers = take((ai.prayers || []).filter((x: Row) => okLine(x?.headline, 80) && okLine(x?.intro, 24) && okCaption(x?.caption)),
    LIB.prayer.map(([intro, h]) => ({ intro, headline: h, caption: `${intro} ${h}\n\nIf this is your prayer today, comment Amen. 🙏🏾` })), (x: Row) => x.headline);
  const blanks = take((ai.blanks || []).filter((x: Row) => okLine(x?.headline, 80) && okCaption(x?.caption)),
    LIB.blank.map((h) => ({ headline: h, caption: `Finish the sentence: ${h} ______.\n\nTell us in the comments. We read every one. 💜` })), (x: Row) => x.headline);
  const sCaps = Array.isArray(ai.scriptures) ? ai.scriptures : [];
  const iCaps = Array.isArray(ai.invites) ? ai.invites : [];

  let qi = 0; let pi = 0; let bi = 0; let si = 0; let ci = 0; let mi = 0;
  const items = kinds.map((k) => {
    if (k === 'prayer' && prayers[pi]) { const p = prayers[pi++]; return { kind: k, template: 'prayer', words: { intro: p.intro.trim(), headline: p.headline.trim() }, line: p.headline.trim(), caption: p.caption.trim() }; }
    if (k === 'blank' && blanks[bi]) { const b = blanks[bi++]; const h = b.headline.trim().replace(/[\s_.:…-]+$/, ''); return { kind: k, template: 'blank', words: { eyebrow: 'Finish the sentence', headline: h, ask: 'Answer in the comments' }, line: h, caption: b.caption.trim() }; }
    if (k === 'scripture' && pickVerses[si]) {
      const v = pickVerses[si]; const c = sCaps[si++]?.caption;
      return { kind: k, template: 'scripture', words: { verse: v.text, reference: v.ref }, line: v.ref, caption: okCaption(c) ? c.trim() : `${v.text} (${v.ref}, KJV)\n\nWhat is this verse speaking to you today?` };
    }
    if (k === 'curator' && curators[ci]) {
      const x = curators[ci]; const c = iCaps[ci++]?.caption;
      return { kind: k, template: 'invite', words: { eyebrow: x.eyebrow, headline: x.headline, body: x.body, button: x.button, brand: 'market' }, line: x.headline, link: x.link, caption: okCaption(c) && c.includes('{link}') ? c.trim() : INVITE_CAPTION[x.link] };
    }
    if (k === 'mentorship' && mentors[mi]) {
      const x = mentors[mi]; const c = iCaps[curators.length + mi++]?.caption;
      return { kind: k, template: 'invite', words: { eyebrow: x.eyebrow, headline: x.headline, body: x.body, button: x.button, brand: 'collective' }, line: x.headline, link: x.link, caption: okCaption(c) && c.includes('{link}') ? c.trim() : INVITE_CAPTION.mentorship };
    }
    const qq = quotes[qi++] || { headline: LIB.quote[qi % LIB.quote.length], caption: `${LIB.quote[qi % LIB.quote.length]}\n\n${q(qi)}` };
    return { kind: 'quote', template: 'quote', words: { headline: qq.headline.trim() }, line: qq.headline.trim(), caption: qq.caption.trim() };
  });
  return { items, writer };
}

const captionsFor = (it: Row) => {
  const tags = TAGS[it.kind] || TAGS.quote;
  const url = it.link ? LINKS[it.link as keyof typeof LINKS] : '';
  const base = String(it.caption).replace(/#\w+/g, '').trim();
  return {
    caption_ig: `${base.replace('{link}', 'link in bio')}\n\n${tags}`,
    caption_fb: `${base.replace('{link}', url)}\n\n${tags.split(' ').slice(0, 4).join(' ')}`,
  };
};

// ── Drafting a batch ──
// deno-lint-ignore no-explicit-any
async function draft(db: any, source: string, force = false) {
  const { data: s } = await db.from('autopilot_settings').select('*').eq('id', 1).maybeSingle();
  if (!s) throw new UserError('Run storefront_v46_autopilot.sql first.');
  if (!s.enabled && !force) return { skipped: 'The autopilot is switched off.' };
  const { data: open } = await db.from('autopilot_batches').select('id, created_at').eq('status', 'awaiting').gt('expires_at', new Date().toISOString()).limit(1);
  if (open?.[0]) return { skipped: 'A batch is already waiting for approval.', batch: open[0].id };
  const plan = planSlots(await scheduledPosts(), s, force);
  if (!plan.slots.length) return { skipped: plan.reason };
  const kinds = planKinds(plan.slots, s.mix || {});
  const { items, writer } = await writeBatch(db, kinds);
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
  const { data: batch, error } = await db.from('autopilot_batches').insert({
    token_hash: await sha256(token), source, first_day: plan.slots[0].day, last_day: plan.slots[plan.slots.length - 1].day,
  }).select().single();
  if (error) throw new Error(error.message);
  const seed0 = Math.floor(Math.random() * 1000);
  const rows = items.map((it, i) => ({
    batch_id: batch.id, position: i, post_at: etToUtc(plan.slots[i].day, plan.slots[i].hm).toISOString(),
    kind: it.kind, template: it.template, words: it.words, line: it.line,
    style: LOOKS[(seed0 + i) % LOOKS.length], pattern: PATTERNS[(seed0 + i * 7) % PATTERNS.length], seed: 101 + seed0 + i * 37,
    ...captionsFor(it),
  }));
  const { error: e2 } = await db.from('autopilot_items').insert(rows);
  if (e2) { await db.from('autopilot_batches').delete().eq('id', batch.id); throw new Error(e2.message); }
  await emailBatch(db, batch, rows, token, s.approvers, false);
  return { batch: batch.id, posts: rows.length, writer, first: batch.first_day, last: batch.last_day };
}

// deno-lint-ignore no-explicit-any
async function emailBatch(db: any, batch: Row, rows: Row[], token: string | null, approvers: string[], reminder: boolean) {
  if (!emailConfigured() || !approvers?.length) return;
  // The review page lives on the Collective side, where Studio sign-ins are.
  const link = token ? `https://www.thep31collective.org/approve/${batch.id}?t=${token}` : `https://www.thep31collective.org/approve/${batch.id}`;
  const counts = rows.reduce((m: Row, r: Row) => ({ ...m, [r.kind]: (m[r.kind] || 0) + 1 }), {});
  const NAMES: Row = { quote: 'quotes', prayer: 'prayers', scripture: 'scriptures', blank: 'fill in the blanks', curator: 'curator invitations', mentorship: 'mentorship invitations' };
  const body = `<p style="margin:0 0 12px;color:#4E3A4B;font-size:15px">${reminder ? 'A reminder: these' : 'The calendar has room, so I drafted'} <b>${rows.length} posts</b> for ${esc(nice(batch.first_day))} to ${esc(nice(batch.last_day))}, in your quote-card look: ${Object.entries(counts).map(([k, n]) => `${n} ${NAMES[k] || k}`).join(', ')}.</p>
    <ul style="margin:0 0 14px;padding-left:18px;color:#2A1526;font-size:14px;line-height:1.6">${rows.slice(0, 8).map((r: Row) => `<li>${esc(r.line || '')}</li>`).join('')}${rows.length > 8 ? `<li>and ${rows.length - 8} more</li>` : ''}</ul>
    <p style="margin:0 0 18px"><a href="${link}" style="display:inline-block;background:#3A1C36;color:#F2CE4D;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Review and approve</a></p>
    <p style="margin:0;color:#74657A;font-size:13px">Nothing posts until you approve. On the page you can remove any post or change its caption first. This link works until ${new Date(batch.expires_at || Date.now() + 7 * DAY).toLocaleDateString('en-US', { timeZone: TZ, month: 'long', day: 'numeric' })}.</p>`;
  try {
    await sendEmail(approvers, reminder ? `Reminder: ${rows.length} posts are waiting for your yes` : `${rows.length} posts are ready for your yes (${nice(batch.first_day)} to ${nice(batch.last_day)})`, layout(reminder ? 'Still waiting for your yes' : 'Your next two weeks of posts', body, 'Sent by the P31 content autopilot. Nothing posts without approval.'));
    await db.from('autopilot_batches').update(reminder ? { reminded_at: new Date().toISOString() } : { emailed_at: new Date().toISOString() }).eq('id', batch.id);
  } catch (e) { console.error('autopilot email failed', (e as Error).message); }
}

// ── The daily run: expire, remind, draft ──
// deno-lint-ignore no-explicit-any
async function daily(db: any) {
  const now = new Date().toISOString();
  await db.from('autopilot_batches').update({ status: 'expired' }).eq('status', 'awaiting').lt('expires_at', now);
  const { data: waiting } = await db.from('autopilot_batches').select('*').eq('status', 'awaiting').is('reminded_at', null).lt('emailed_at', new Date(Date.now() - DAY).toISOString());
  const { data: s } = await db.from('autopilot_settings').select('approvers').eq('id', 1).maybeSingle();
  for (const b of waiting || []) {
    // The original link's token is not kept, so the reminder sends a new one in its place.
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
    await db.from('autopilot_batches').update({ token_hash: await sha256(token) }).eq('id', b.id);
    const { data: rows } = await db.from('autopilot_items').select('kind, line').eq('batch_id', b.id).neq('status', 'removed').order('position');
    await emailBatch(db, b, rows || [], token, s?.approvers || [], true);
  }
  return draft(db, 'cron');
}

// ── Review actions (the link's token, or a Studio team member) ──
// deno-lint-ignore no-explicit-any
async function authorize(db: any, req: Request, b: Row) {
  if (!b.batch) throw new UserError('Which batch?');
  const { data: batch } = await db.from('autopilot_batches').select('*').eq('id', b.batch).maybeSingle();
  if (!batch) throw new UserError('That batch was not found.');
  if (b.token && await sha256(String(b.token)) === batch.token_hash) return { batch, who: 'review link' };
  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
  const [{ data: member }, { data: user }] = await Promise.all([asUser.rpc('is_studio_member'), asUser.auth.getUser()]);
  if (member) return { batch, who: user?.user?.email || 'Studio team' };
  throw new UserError(b.token ? 'This review link has expired or been replaced; use the newest email, or sign in to the Studio.' : 'Sign in to the Studio, or open the link from the email.');
}

// deno-lint-ignore no-explicit-any
async function review(db: any, req: Request, b: Row) {
  const { batch, who } = await authorize(db, req, b);
  const open = batch.status === 'awaiting' && new Date(batch.expires_at) > new Date();
  const item = async () => {
    const { data } = await db.from('autopilot_items').select('*').eq('id', b.item).eq('batch_id', batch.id).maybeSingle();
    if (!data) throw new UserError('That post is not in this batch.');
    return data;
  };
  switch (b.action) {
    case 'get': {
      const { data: items } = await db.from('autopilot_items').select('*').eq('batch_id', batch.id).order('position');
      const { token_hash: _t, ...safe } = batch;
      return { batch: { ...safe, open }, items: items || [], who };
    }
    case 'update': {
      if (!open) throw new UserError('This batch is no longer open.');
      const it = await item();
      if (it.status === 'scheduled') throw new UserError('That post is already scheduled.');
      const patch: Row = {};
      if (typeof b.remove === 'boolean') patch.status = b.remove ? 'removed' : 'pending';
      if (typeof b.caption_ig === 'string') patch.caption_ig = b.caption_ig.slice(0, 2200);
      if (typeof b.caption_fb === 'string') patch.caption_fb = b.caption_fb.slice(0, 2200);
      const { data } = await db.from('autopilot_items').update(patch).eq('id', it.id).select().single();
      return { item: data };
    }
    case 'presign': {
      if (!open) throw new UserError('This batch is no longer open.');
      const it = await item();
      const size = Math.max(1, Math.min(15_000_000, Number(b.size) || 0));
      const { uploadUrl, publicUrl } = await zernio('/media/presign', { method: 'POST', body: JSON.stringify({ filename: `p31-autopilot-${it.id.slice(0, 8)}.jpg`, contentType: 'image/jpeg', size }) });
      await db.from('autopilot_items').update({ media_url: publicUrl }).eq('id', it.id);
      return { uploadUrl };
    }
    case 'schedule': {
      if (!open) throw new UserError('This batch is no longer open.');
      const it = await item();
      if (it.status === 'scheduled') return { item: it };
      if (it.status === 'removed') throw new UserError('That post was removed from the batch.');
      if (!it.media_url) throw new UserError('Upload the card first.');
      if (new Date(it.post_at).getTime() < Date.now() + 10 * 60e3) {
        const { data } = await db.from('autopilot_items').update({ status: 'skipped', error: 'Its time had already passed.' }).eq('id', it.id).select().single();
        return { item: data };
      }
      const { accounts = [] } = await zernio('/accounts');
      const ig = accounts.find((a: Row) => a.platform === 'instagram');
      const fb = accounts.find((a: Row) => a.platform === 'facebook');
      const platforms = [
        ...(ig ? [{ platform: 'instagram', accountId: ig._id, customContent: it.caption_ig }] : []),
        ...(fb ? [{ platform: 'facebook', accountId: fb._id, customContent: it.caption_fb }] : []),
      ];
      if (!platforms.length) throw new UserError('Instagram and Facebook are not connected in Zernio.');
      const w = it.words || {};
      const alt = [w.intro, w.eyebrow, w.headline, w.verse, w.reference, w.body].filter(Boolean).join(' ').slice(0, 900);
      try {
        const out = await zernio('/posts', {
          method: 'POST', headers: { 'Idempotency-Key': `autopilot-${it.id}` },
          body: JSON.stringify({ title: `P31 autopilot · ${it.kind} · ${String(it.line || '').slice(0, 60)}`, content: it.caption_ig, mediaItems: [{ type: 'image', url: it.media_url, altText: alt }], platforms, scheduledFor: etLocal(new Date(it.post_at)), timezone: TZ }),
        });
        const id = out.post?._id || out.post?.id || out._id || out.id || null;
        const { data } = await db.from('autopilot_items').update({ status: 'scheduled', zernio_post_id: id, error: null }).eq('id', it.id).select().single();
        return { item: data };
      } catch (e) {
        const { data } = await db.from('autopilot_items').update({ status: 'failed', error: (e as Error).message.slice(0, 300) }).eq('id', it.id).select().single();
        return { item: data };
      }
    }
    case 'finish': {
      const { data: items } = await db.from('autopilot_items').select('status').eq('batch_id', batch.id);
      const n = (items || []).filter((x: Row) => x.status === 'scheduled').length;
      await db.from('autopilot_batches').update({ status: n ? 'scheduled' : batch.status, scheduled_count: n, decided_at: new Date().toISOString(), decided_by: who }).eq('id', batch.id);
      return { scheduled: n };
    }
    case 'decline': {
      if (!open) throw new UserError('This batch is no longer open.');
      await db.from('autopilot_batches').update({ status: 'declined', decided_at: new Date().toISOString(), decided_by: who, note: String(b.note || '').slice(0, 500) || null }).eq('id', batch.id);
      return { declined: true };
    }
    default: throw new UserError('Unknown action.');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  let b: Row = {};
  try { b = await req.json(); } catch { /* empty */ }
  try {
    if (!env('ZERNIO_API_KEY')) throw new UserError('Zernio is not connected (ZERNIO_API_KEY).');
    if (b.action === 'draft') {
      // "Draft a batch now" from the Studio: Studio team only.
      const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
      const { data: member } = await asUser.rpc('is_studio_member');
      if (!member) return json({ error: 'Only the Studio team can draft a batch.' }, 403);
      return json(await draft(db, 'studio', true));
    }
    if (b.action) return json(await review(db, req, b));
    // The schedule (or anyone): at most one drafting run every 12 hours.
    const { data: last } = await db.from('autopilot_batches').select('created_at').order('created_at', { ascending: false }).limit(1);
    if (last?.[0] && Date.now() - new Date(last[0].created_at).getTime() < 12 * 3600e3) return json({ skipped: 'drafted in the last 12 hours' });
    return json(await daily(db));
  } catch (e) {
    const msg = (e as Error).message || 'Something went wrong.';
    if (!(e instanceof UserError)) console.error('content-autopilot', e);
    return json({ error: msg }, e instanceof UserError ? 400 : 500);
  }
});
