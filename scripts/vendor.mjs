// Schrift und Icons aus node_modules in vendor/ übernehmen (nach npm install).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modules = join(root, 'node_modules');

const FONT_WEIGHTS = [500, 700];
const ICONS = { scale: 'solid/scale-balanced.svg', xmark: 'solid/xmark.svg' };

mkdirSync(join(root, 'vendor/fonts'), { recursive: true });
for (const weight of FONT_WEIGHTS) {
  const file = `chakra-petch-latin-${weight}-normal.woff2`;
  copyFileSync(join(modules, '@fontsource/chakra-petch/files', file), join(root, 'vendor/fonts', file));
}

const icons = Object.fromEntries(
  Object.entries(ICONS).map(([name, file]) => {
    const svg = readFileSync(join(modules, '@fortawesome/fontawesome-free/svgs', file), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();
    return [name, svg];
  })
);

writeFileSync(
  join(root, 'vendor/icons.js'),
  '// Erzeugt von scripts/vendor.mjs aus @fortawesome/fontawesome-free (Icons: CC BY 4.0).\n' +
    "(function (root) {\n  'use strict';\n  root.Einheitspreis.icons = " +
    JSON.stringify(icons, null, 2).replace(/\n/g, '\n  ') +
    ';\n})(globalThis);\n'
);
console.log('vendor/ aktualisiert');
