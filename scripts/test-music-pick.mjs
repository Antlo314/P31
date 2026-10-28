// Offline test of the trending-music auto-pick (src/studio/musicPick.js), shared by Studio → Post
// plans, the composer and the autopilot review page. No network.
//   node scripts/test-music-pick.mjs
import assert from 'node:assert/strict';
import { autoPick, rankMusic, spreadPicks, trackName } from '../src/studio/musicPick.js';

let passed = 0;
const test = (name, fn) => { fn(); passed += 1; console.log(`ok - ${name}`); };

const t = (id, extra = {}) => ({ id, title: `Track ${id}`, artist: 'Someone', durationMs: 30000, previewUrl: null, explicit: false, platform: 'tiktok', genres: [], ...extra });

test('empty or missing list gives null', () => {
  assert.equal(autoPick([]), null);
  assert.equal(autoPick(undefined), null);
  assert.equal(autoPick([t('x', { explicit: true })]), null);
});

test('top trending non-explicit track wins when nothing else matters', () => {
  const list = [t('a', { explicit: true }), t('b'), t('c')];
  assert.equal(autoPick(list).id, 'b');
});

test('track must be at least as long as the video when its length is known', () => {
  const list = [t('short', { durationMs: 8000 }), t('long', { durationMs: 15000 })];
  assert.equal(autoPick(list, { seconds: 12 }).id, 'long');
  assert.equal(autoPick(list, { seconds: 8 }).id, 'short'); // exactly as long counts
  assert.equal(autoPick(list).id, 'short'); // video length unknown: trending order
});

test('unknown track lengths do not count as long enough, but are used when nothing is', () => {
  const list = [t('unknown', { durationMs: null }), t('ok', { durationMs: 20000 })];
  assert.equal(autoPick(list, { seconds: 10 }).id, 'ok');
  assert.equal(autoPick([t('u1', { durationMs: null }), t('u2', { durationMs: 5000 })], { seconds: 10 }).id, 'u1');
});

test('uplifting / gospel / worship / acoustic / R&B / soul titles or genres are preferred', () => {
  const list = [t('pop'), t('hype'), t('gospel', { genres: ['Gospel'] }), t('soul', { title: 'Neo Soul Morning' })];
  assert.equal(autoPick(list).id, 'gospel');
  assert.deepEqual(rankMusic(list).map((x) => x.id), ['gospel', 'soul', 'pop', 'hype']);
  assert.equal(autoPick([t('a'), t('b', { title: 'Acoustic Sunrise' })]).id, 'b');
  assert.equal(autoPick([t('a'), t('b', { genres: ['R&B'] })]).id, 'b');
  // "soul" must be a word start: "Seoul Nights" is not soul music.
  assert.equal(autoPick([t('a'), t('b', { title: 'Seoul Nights' })]).id, 'a');
});

test('a mood track that is too short loses to a long enough plain one', () => {
  const list = [t('plain', { durationMs: 30000 }), t('worship', { title: 'Worship Loop', durationMs: 5000 })];
  assert.equal(autoPick(list, { seconds: 12 }).id, 'plain');
});

test('explicit tracks are never picked, even when they are the only long ones', () => {
  const list = [t('x', { explicit: true, durationMs: 60000 }), t('s', { durationMs: 3000 })];
  assert.equal(autoPick(list, { seconds: 12 }).id, 's');
});

test('avoid steers away, and is ignored when every track is avoided', () => {
  const list = [t('a'), t('b')];
  assert.equal(autoPick(list, { avoid: ['a'] }).id, 'b');
  assert.equal(autoPick(list, { avoid: ['a', 'b'] }).id, 'a');
});

test('deterministic: same input, same answer', () => {
  const list = [t('a'), t('b', { genres: ['soul'] }), t('c')];
  assert.equal(autoPick(list, { seconds: 9 }).id, autoPick(list, { seconds: 9 }).id);
});

test('spreadPicks uses a different track for each post while there are enough', () => {
  const list = [t('a'), t('b'), t('c'), t('d')];
  const posts = ['p1', 'p2', 'p3'].map((id) => ({ id, seconds: 10 }));
  const out = spreadPicks(list, posts);
  assert.deepEqual(posts.map((p) => out[p.id].id), ['a', 'b', 'c']);
});

test('spreadPicks never repeats a track back to back when there is another', () => {
  const list = [t('a'), t('b')];
  const posts = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}` }));
  const out = spreadPicks(list, posts);
  const ids = posts.map((p) => out[p.id].id);
  for (let i = 1; i < ids.length; i += 1) assert.notEqual(ids[i], ids[i - 1], `post ${i} repeats ${ids[i]}`);
});

test('spreadPicks with one track gives it to every post (nothing else to use)', () => {
  const out = spreadPicks([t('only')], [{ id: 'p1' }, { id: 'p2' }]);
  assert.equal(out.p1.id, 'only');
  assert.equal(out.p2.id, 'only');
});

test('spreadPicks keeps the team’s own choices and counts them as used', () => {
  const list = [t('a'), t('b'), t('c')];
  const posts = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
  const out = spreadPicks(list, posts, { fixed: { p1: 'a', p2: null } });
  assert.equal(out.p1.id, 'a');
  assert.equal(out.p2, null); // our own music
  assert.equal(out.p3.id, 'b'); // a is taken
});

test('spreadPicks respects video length per post', () => {
  const list = [t('short', { durationMs: 8000 }), t('long', { durationMs: 20000 }), t('mid', { durationMs: 12000 })];
  const out = spreadPicks(list, [{ id: 'p1', seconds: 13 }, { id: 'p2', seconds: 8 }]);
  assert.equal(out.p1.id, 'long');
  assert.equal(out.p2.id, 'short');
});

test('spreadPicks with no music gives every post null', () => {
  assert.deepEqual(spreadPicks([], [{ id: 'p1' }]), { p1: null });
});

test('trackName reads "Title - Artist"', () => {
  assert.equal(trackName(t('a', { title: 'Rise', artist: 'Choir' })), 'Rise - Choir');
  assert.equal(trackName({ id: 'x', title: 'Solo' }), 'Solo');
  assert.equal(trackName(null), '');
});

console.log(`\n${passed} tests passed`);
