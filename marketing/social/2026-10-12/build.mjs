// Draws every card in plan.mjs (1080×1350) into out/, writes src/posts.html (one section per
// post, open posts.html#<id> to see one) and review.html (every card with its caption and time).
//   node build.mjs
import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { POSTS } from './plan.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '../../..');
const puppeteer = createRequire(join(ROOT, 'package.json'))('puppeteer-core');
mkdirSync(join(here, 'src'), { recursive: true });
mkdirSync(join(here, 'out'), { recursive: true });
copyFileSync(join(ROOT, 'marketing/brand/icon-1024.png'), join(here, 'src/mark.png'));

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fonts = pathToFileURL(join(ROOT, 'public/fonts')).href;

const card = (p) => {
  const inner = {
    fill: () => `
    <div class="inner center">
      <p class="eyebrow">Bible fill-in-the-blank</p>
      <p class="verse">“${esc(p.verse)}<span class="blank"></span>.”</p>
      <p class="ref">${esc(p.ref)} · KJV</p>
      <span class="ask">No peeking — answer in the comments 👇</span>
    </div>`,
    prompt: () => `
    <div class="inner center">
      <p class="eyebrow">${esc(p.eyebrow)}</p>
      <p class="verse big">${esc(p.text)}<span class="blank"></span></p>
      <span class="ask">${esc(p.ask)}</span>
    </div>`,
    choice: () => `
    <div class="inner center">
      <p class="eyebrow">This or that</p>
      <h1 class="q">${esc(p.question)}</h1>
      <div class="opts">
        <div class="opt"><b>A</b><span>${esc(p.a)}</span></div>
        <div class="opt"><b>B</b><span>${esc(p.b)}</span></div>
      </div>
      <span class="ask">Comment A or B 👇</span>
    </div>`,
    quiz: () => `
    <div class="inner center">
      <p class="eyebrow">P31 pop quiz</p>
      <h1 class="q">${esc(p.question)}</h1>
      <div class="opts">
        ${p.options.map((o, i) => `<div class="opt"><b>${'ABCD'[i]}</b><span>${esc(o)}</span></div>`).join('')}
      </div>
      <span class="ask">Answer below, no peeking 👇</span>
    </div>`,
    amen: () => `
    <div class="inner center">
      <p class="eyebrow">Sunday word</p>
      <p class="verse small">“${esc(p.verse)}”</p>
      <p class="ref">${esc(p.ref)} · KJV</p>
      <span class="ask">If this is your prayer this week, comment Amen 🙏🏾</span>
    </div>`,
    cta: () => `
    <div class="inner">
      <img class="logo" src="mark.png" alt="" />
      <p class="eyebrow">${esc(p.eyebrow)}</p>
      <h1>${p.title}</h1>
      <ul class="list">${p.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <span class="pill">${esc(p.pill)}</span>
    </div>`,
  }[p.kind]();
  // Invitation cards carry the link pill at the bottom instead of the handle.
  return `<section class="post grain" id="${p.id}">
  <div class="frame"></div><span class="gate"></span>${inner}
  ${p.kind === 'cta' ? '' : '<p class="handle">@proverbs31market</p>'}
</section>`;
};

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>P31 social graphics · Oct 12 – Nov 10</title>
<style>
  @font-face { font-family: 'Noto Serif'; font-weight: 400; src: url(${fonts}/NotoSerif-400.woff2) format('woff2'); }
  @font-face { font-family: 'Noto Serif'; font-weight: 400; font-style: italic; src: url(${fonts}/NotoSerif-400-italic.woff2) format('woff2'); }
  @font-face { font-family: 'Manrope'; font-weight: 600; src: url(${fonts}/Manrope-600.woff2) format('woff2'); }
  @font-face { font-family: 'Manrope'; font-weight: 800; src: url(${fonts}/Manrope-800.woff2) format('woff2'); }
  :root { --night: #140a22; --night2: #1e1031; --gold: #D9A93A; --goldhi: #F2CE4D; --ink: #fff; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { font-family: 'Manrope', sans-serif; color: var(--ink); -webkit-font-smoothing: antialiased; }
  .post { display: none; position: relative; width: 1080px; height: 1350px; overflow: hidden; isolation: isolate;
    background:
      radial-gradient(62% 48% at 90% 0%, rgba(168, 85, 232, 0.4), transparent 62%),
      radial-gradient(55% 42% at 0% 100%, rgba(217, 169, 58, 0.2), transparent 62%),
      linear-gradient(180deg, var(--night2) 0%, var(--night) 100%); }
  .post:target, .post.show { display: block; }
  .grain::before { content: ''; position: absolute; inset: 0; z-index: -1; opacity: 0.9; mix-blend-mode: overlay;
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .09 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>"); }
  .frame { position: absolute; inset: 34px; border: 1.5px solid rgba(242, 206, 77, 0.42); border-radius: 30px; pointer-events: none; }
  .gate { position: absolute; z-index: -1; right: -90px; bottom: -2px; width: 640px; height: 860px;
    border: 1.5px solid rgba(242, 206, 77, 0.2); border-bottom: 0; border-radius: 999px 999px 0 0; }
  .gate::after { content: ''; position: absolute; inset: 34px 34px 0; border: 1.5px solid rgba(242, 206, 77, 0.12); border-bottom: 0; border-radius: inherit; }
  .inner { position: absolute; inset: 0; padding: 120px 110px; display: flex; flex-direction: column; }
  .center { align-items: center; text-align: center; justify-content: center; }
  .eyebrow { display: inline-flex; align-items: center; gap: 18px; margin: 0 0 34px;
    font-weight: 800; font-size: 23px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--goldhi); }
  .eyebrow::before, .center .eyebrow::after { content: ''; width: 54px; height: 2px; background: linear-gradient(90deg, var(--gold), var(--goldhi)); }
  h1 { margin: 0; font-family: 'Noto Serif', serif; font-weight: 400; font-size: 112px; line-height: 0.98; letter-spacing: -0.03em; }
  h1.q { font-size: 84px; line-height: 1.08; text-wrap: balance; max-width: 860px; }
  h1 em { font-style: italic; padding-right: 0.06em;
    background: linear-gradient(100deg, #F7E3A1 0%, var(--goldhi) 35%, var(--gold) 80%); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .list { list-style: none; margin: 46px 0 0; padding: 0; display: grid; gap: 26px; }
  .list li { display: flex; align-items: center; gap: 22px; font-size: 36px; font-weight: 700; color: rgba(255, 255, 255, 0.92); }
  .list li::before { content: ''; flex: none; width: 16px; height: 16px; transform: rotate(45deg); background: var(--goldhi); }
  .pill { display: inline-flex; align-items: center; gap: 14px; margin-top: auto; align-self: flex-start; height: 92px; padding: 0 44px; border-radius: 999px;
    background: linear-gradient(135deg, var(--goldhi), var(--gold)); color: #2a1a00; font-weight: 800; font-size: 28px; letter-spacing: 0.06em; white-space: nowrap; }
  .handle { position: absolute; left: 0; right: 0; bottom: 74px; text-align: center; font-weight: 800; font-size: 22px; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(255, 255, 255, 0.7); }
  .logo { width: 112px; height: 112px; border-radius: 28px; object-fit: cover; box-shadow: 0 0 0 1.5px rgba(242, 206, 77, 0.5); margin-bottom: 44px; }
  .verse { margin: 0; font-family: 'Noto Serif', serif; font-style: italic; font-size: 74px; line-height: 1.24; letter-spacing: -0.01em; text-wrap: balance; }
  .verse.big { font-size: 92px; line-height: 1.12; }
  .verse.small { font-size: 58px; line-height: 1.3; }
  .blank { display: inline-block; width: 300px; height: 6px; vertical-align: baseline; background: var(--goldhi); border-radius: 3px; margin-left: 10px; }
  .verse.big .blank { width: 360px; height: 7px; }
  .ref { margin-top: 48px; font-weight: 800; font-size: 24px; letter-spacing: 0.3em; color: var(--goldhi); }
  .ask { margin-top: 70px; display: inline-flex; align-items: center; gap: 16px; padding: 22px 38px; border-radius: 999px;
    border: 1.5px solid rgba(255, 255, 255, 0.35); background: rgba(255, 255, 255, 0.08); font-size: 30px; font-weight: 800; }
  .opts { margin-top: 56px; display: grid; gap: 22px; width: 100%; max-width: 820px; }
  .opt { display: flex; align-items: center; gap: 26px; padding: 26px 34px; border-radius: 26px; text-align: left;
    border: 1.5px solid rgba(242, 206, 77, 0.45); background: rgba(255, 255, 255, 0.06); }
  .opt b { flex: none; display: grid; place-items: center; width: 72px; height: 72px; border-radius: 50%;
    background: linear-gradient(135deg, var(--goldhi), var(--gold)); color: #2a1a00; font-size: 34px; }
  .opt span { font-family: 'Noto Serif', serif; font-size: 40px; line-height: 1.2; }
</style>
</head>
<body>
${POSTS.map(card).join('\n\n')}
</body>
</html>
`;
writeFileSync(join(here, 'src/posts.html'), html);

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
for (const p of POSTS) {
  await page.goto(`${pathToFileURL(join(here, 'src/posts.html')).href}#${p.id}`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await (await page.$(`#${p.id}`)).screenshot({ path: join(here, `out/${p.id}.jpg`), type: 'jpeg', quality: 90 });
  console.log('drew', p.id);
}
await browser.close();

// Review sheet: every card, its time and caption.
writeFileSync(join(here, 'review.html'), `<!doctype html><html><head><meta charset="utf-8"><title>P31 posts · Oct 12 – Nov 10</title>
<style>body{font-family:Manrope,system-ui,sans-serif;background:#f5f1fb;color:#201431;margin:0;padding:24px}h1{font-family:Georgia,serif;font-weight:400}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px}.c{background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e7dcf4}
.c img{width:100%;display:block}.c div{padding:12px 14px;font-size:13px;line-height:1.5}.c b{display:block;color:#5E2A8C}.c pre{white-space:pre-wrap;font:inherit;margin:8px 0 0;color:#4a3b5c}</style></head>
<body><h1>24 posts · Oct 12 – Nov 10 · Instagram + Facebook</h1><div class="g">
${POSTS.map((p) => `<div class="c"><img src="out/${p.id}.jpg" alt=""><div><b>${esc(p.label)} · ${p.kind}</b><pre>${esc(p.instagram)}</pre></div></div>`).join('\n')}
</div></body></html>`);
console.log(`built ${POSTS.length} cards → out/, review.html`);
