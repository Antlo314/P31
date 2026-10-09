// Fails when a .jsx file renders a <Component> it never imports or defines.
// ESLint here has no React plugin, so a missing import (like an icon) only shows up
// as a blank page in the browser. Runs as part of `npm run lint`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.jsx')) files.push(p);
  }
};
walk('src');

const problems = [];
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  // Drop comments that could mention components: JSX {/* … */}, block comments that start a line, and // lines.
  // (Not every /* — strings like accept="image/*" contain it.)
  const code = src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\*[\s\S]*?\*\//gm, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const used = new Set([...code.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g)].map((m) => m[1]));
  for (const name of used) {
    const defined = new RegExp(
      `import[^;]*\\b${name}\\b|\\b(const|let|var|function|class)\\s+${name}\\b|[{,]\\s*${name}\\s*[,}:=]|\\b${name}\\s*:`,
    ).test(code);
    if (!defined) problems.push(`${file}: <${name}> is used but never imported or defined`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`check-jsx: ${files.length} files, every component is imported or defined`);
