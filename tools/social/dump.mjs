// What Zernio knows right now: accounts, what is already scheduled, when followers are online,
// and the Google Business Profile photos. Writes JSON to the path given as the first argument.
//   node tools/social/dump.mjs out.json
import { writeFileSync } from 'node:fs';
import { api, ACCOUNTS } from './zernio.mjs';

const out = {};
const tryGet = async (key, path) => { try { out[key] = await api(path); } catch (e) { out[key] = { error: e.message }; } };

await tryGet('accounts', '/accounts');
await tryGet('scheduled', '/posts?status=scheduled&limit=100&sort=scheduled-asc');
await tryGet('recent', '/posts?status=published&limit=30&sort=scheduled-desc');
await tryGet('online', `/analytics/instagram/online-followers?accountId=${ACCOUNTS.instagram}`);
await tryGet('gmbMedia', `/accounts/${ACCOUNTS.googlebusiness}/gmb-media`);
await tryGet('gmbLocation', `/accounts/${ACCOUNTS.googlebusiness}/gmb-location-details`);

writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
const summary = {
  accounts: (out.accounts?.accounts || out.accounts?.data || []).map((a) => ({ id: a._id || a.id, platform: a.platform, username: a.username, active: a.isActive })),
  scheduled: (out.scheduled?.posts || []).length,
  recent: (out.recent?.posts || []).length,
  onlineDays: (out.online?.days || []).length,
  gmbMedia: (out.gmbMedia?.mediaItems || []).map((m) => ({ category: m.locationAssociation?.category, name: m.name, created: m.createTime })),
  errors: Object.fromEntries(Object.entries(out).filter(([, v]) => v?.error).map(([k, v]) => [k, v.error])),
};
console.log(JSON.stringify(summary, null, 2));
