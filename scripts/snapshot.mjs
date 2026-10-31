// Schnappschuss der 910 echten Angebote neu schreiben: nur nach geprüfter, bewusster Änderung (HELF-104).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { snapshotOf } = require('./snapshot-core.js');
const fixtures = JSON.parse(readFileSync(new URL('../test/fixtures/amazon-titles.json', import.meta.url), 'utf8'));
const target = new URL('../test/fixtures/amazon-ergebnisse.json', import.meta.url);

let previous = [];
try {
  previous = JSON.parse(readFileSync(target, 'utf8'));
} catch {
  // erster Schnappschuss
}
const next = snapshotOf(fixtures);
const changed = next.filter((r, i) => JSON.stringify(r) !== JSON.stringify(previous[i]));
writeFileSync(target, JSON.stringify(next, null, 1) + '\n');
console.log(`${next.length} Angebote, ${changed.length} geändert`);
for (const r of changed.slice(0, 40)) console.log(JSON.stringify(r));
