// Prüfstand: gespeicherte Amazon-Seiten ohne Amazons Skripte, dafür mit der Erweiterung.
// Aufruf: node test/build-live.mjs; dann test/live/*.ep.html über einen lokalen Server öffnen.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const messages = readFileSync(join(root, '_locales/de/messages.json'), 'utf8');
const pageCss = readFileSync(join(root, 'content/page.css'), 'utf8').replaceAll('chrome-extension://__MSG_@@extension_id__/', '/');
const scripts = manifest.content_scripts[0].js;

const injection =
  `<style>${pageCss}</style>\n` +
  `<script>window.__EP_MESSAGES__=${messages};window.__EP_MANIFEST__=${JSON.stringify(manifest)};</script>\n` +
  `<script src="/test/chrome-shim.js"></script>\n` +
  scripts.map((s) => `<script src="/${s}"></script>`).join('\n');

for (const file of readdirSync(join(root, 'test/live')).filter((f) => /^live-[^.]*\.html$/.test(f))) {
  let html = readFileSync(join(root, 'test/live', file), 'utf8');
  if (html.startsWith('x=')) html = html.slice(2);
  html = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy[^>]*>/gi, '')
    .replace('</body>', () => injection + '\n</body>');
  writeFileSync(join(root, 'test/live', file.replace(/\.html$/, '.ep.html')), html);
  console.log('test/live/' + file.replace(/\.html$/, '.ep.html'));
}
