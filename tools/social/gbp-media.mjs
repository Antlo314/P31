// Puts the current logo and cover on the Google Business Profile through Zernio: uploads
// marketing/gbp/01-logo.jpg and 02-cover.jpg, replaces the LOGO and COVER photos, leaves the
// rest. Needs the Google Business account connected in Zernio (Accounts → Connect → Google
// Business Profile); pass its account id if it changed since October.
//   node tools/social/gbp-media.mjs [accountId]
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, uploadFile, ACCOUNTS } from './zernio.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const gbp = join(here, '../../marketing/gbp');
let id = process.argv[2] || ACCOUNTS.googlebusiness;

// Find the Google account if the stored id is stale.
try { await api(`/accounts/${id}/gmb-location-details`); } catch {
  const { accounts = [] } = await api('/accounts');
  const g = accounts.find((a) => a.platform === 'googlebusiness');
  if (!g) { console.error('No Google Business Profile account is connected in Zernio. Connect it first (Zernio → Accounts → Connect → Google Business Profile).'); process.exit(1); }
  id = g._id || g.id;
  console.log('using Google account', id);
}

const { mediaItems = [] } = await api(`/accounts/${id}/gmb-media?pageSize=100`);
for (const [file, category, description] of [['01-logo.jpg', 'LOGO', 'Proverbs 31 Marketplace'], ['02-cover.jpg', 'COVER', 'Proverbs 31 Marketplace: where her gifts make room']]) {
  const url = await uploadFile(join(gbp, file), `p31-gbp-${file}`, 'image/jpeg');
  const created = await api(`/accounts/${id}/gmb-media`, { method: 'POST', body: { sourceUrl: url, mediaFormat: 'PHOTO', category, description } });
  console.log(`${category}: uploaded →`, created.name || created.googleUrl || 'ok');
  for (const old of mediaItems.filter((m) => m.locationAssociation?.category === category)) {
    const mediaId = (old.name || '').split('/').pop();
    if (!mediaId) continue;
    try { await api(`/accounts/${id}/gmb-media?mediaId=${encodeURIComponent(mediaId)}`, { method: 'DELETE' }); console.log(`${category}: removed old ${mediaId}`); }
    catch (e) { console.log(`${category}: could not remove old ${mediaId} (${e.message.slice(0, 120)})`); }
  }
}
console.log('done');
