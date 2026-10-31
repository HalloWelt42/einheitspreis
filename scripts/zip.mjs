// Paket für den Upload bauen: store/einheitspreis-<version>.zip
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
mkdirSync(join(root, 'store'), { recursive: true });
const target = `store/einheitspreis-${version}.zip`;
execFileSync('zip', ['-r', '-q', target, 'manifest.json', 'core', 'content', 'vendor', 'icons', '_locales', '-x', '*.DS_Store'], { cwd: root });
console.log(target);
