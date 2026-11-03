// Rechenkern gegen echte Amazon-Titel prüfen: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');

require('../core/quantity.js');
const { parseMoney, formatMoney } = require('../core/money.js');
const { computeUnitPrice } = require('../core/unit-price.js');
const { parseQuantity } = globalThis.Einheitspreis.quantity;

const MUSTER = require('./fixtures/muster.json');
const close = (actual, expected) => Math.abs(actual - expected) <= Math.max(1e-9, Math.abs(expected) * 1e-3) + 0.005;

// Musterkatalog: jeder Fall, der einmal funktioniert hat oder einmal falsch war (HELF-104)
for (const muster of MUSTER.mengen) {
  test('Menge [' + muster.quelle + ']: ' + muster.titel, () => {
    const q = parseQuantity(muster.titel, muster.kontext);
    if (muster.erwartet.keineMenge) {
      assert.equal(q, null);
      return;
    }
    assert.equal(q && q.dimension, muster.erwartet.dimension);
    assert.ok(close(q.amount, muster.erwartet.menge), 'erwartet ' + muster.erwartet.menge + ', erkannt ' + q.amount);
  });
}

for (const muster of MUSTER.preise) {
  test('Preis [' + muster.quelle + ']: ' + muster.titel + (muster.grundpreis ? ' | Shop ' + muster.grundpreis : ''), () => {
    const r = computeUnitPrice({ text: muster.titel, context: muster.kontext, price: parseMoney(muster.preis), amazonUnitPriceText: muster.grundpreis || null }, {});
    if (muster.erwartet.auslassen) {
      assert.equal(r, null, muster.hinweis);
      return;
    }
    assert.ok(r, muster.hinweis);
    assert.equal(r.dimension, muster.erwartet.dimension);
    assert.equal(r.source, muster.erwartet.quelle);
    assert.ok(close(r.unitPrice, muster.erwartet.einheitspreis), 'erwartet ' + muster.erwartet.einheitspreis + ', gerechnet ' + r.unitPrice);
    if (muster.erwartet.stueck) assert.equal(r.quantity.items, muster.erwartet.stueck);
  });
}

for (const muster of MUSTER.ausreisser) {
  test('Ausreißer [' + muster.quelle + ']: ' + muster.gruppe, () => {
    const { dropOutliers } = require('../core/ranking.js');
    const entries = muster.werte.map((v, i) => ({ id: 'e' + i, unitPrice: { dimension: 'mass', unitKey: 'kg', currency: 'EUR', unitPrice: v } }));
    assert.deepEqual(dropOutliers(entries).dropped.map((e) => e.unitPrice.unitPrice), muster.erwartetRaus);
  });
}

test('Geld: deutsche und englische Schreibweise', () => {
  assert.deepEqual(parseMoney('1.234,56 €'), { amount: 1234.56, currency: 'EUR' });
  assert.deepEqual(parseMoney('278,99€'), { amount: 278.99, currency: 'EUR' });
  assert.deepEqual(parseMoney('$1,234.56'), { amount: 1234.56, currency: 'USD' });
  assert.equal(parseMoney('Derzeit nicht verfügbar.'), null);
});

test('Geld: kleine Einheitspreise mit mehr Stellen', () => {
  assert.equal(formatMoney(0.02649, 'EUR', 'de-DE'), '0,0265 €');
  assert.equal(formatMoney(26.49, 'EUR', 'de-DE'), '26,49 €');
});

test('Echte Suchtreffer: kein Speicherangebot mit absurdem TB-Preis', () => {
  const titles = require('./fixtures/amazon-titles.json');
  for (const item of titles) {
    const r = computeUnitPrice({ text: item.title, price: parseMoney(item.price), amazonUnitPriceText: item.amazonUnitPrice }, {});
    if (r && r.dimension === 'storage') {
      assert.ok(r.unitPrice > 5 && r.unitPrice < 20000, item.title + ' -> ' + r.unitPrice);
    }
  }
});

test('Rang: gleiche Einheit wird verglichen, Gleichstand teilt den Rang', () => {
  const { rankEntries } = require('../core/ranking.js');
  const up = (unitPrice, dimension = 'storage', unitKey = 'TB') => ({ unitPrice, dimension, unitKey, currency: 'EUR' });
  const ranking = rankEntries([
    { id: 'a', unitPrice: up(45) },
    { id: 'b', unitPrice: up(40) },
    { id: 'c', unitPrice: up(40) },
    { id: 'd', unitPrice: up(80) },
    { id: 'e', unitPrice: up(3, 'volume', 'l') }
  ]);
  assert.deepEqual(['a', 'b', 'c', 'd', 'e'].map((id) => ranking.get(id).rank), [3, 1, 1, 4, 1]);
  assert.deepEqual(['a', 'b', 'd', 'e'].map((id) => ranking.get(id).tier), ['good', 'best', 'high', 'best']);
  assert.equal(ranking.get('e').total, 1);
});

// Schnappschuss: Ergebnis jedes der 910 echten Angebote. Eine Abweichung ist entweder ein Fehler oder eine bewusste
// Verbesserung; dann mit "npm run snapshot" übernehmen und die Änderung im Commit begründen (HELF-104).
test('Schnappschuss: 910 echte Angebote unverändert', () => {
  const { snapshotOf } = require('../scripts/snapshot-core.js');
  const expected = require('./fixtures/amazon-ergebnisse.json');
  const actual = snapshotOf(require('./fixtures/amazon-titles.json'));
  const changed = actual.filter((r, i) => JSON.stringify(r) !== JSON.stringify(expected[i]));
  assert.equal(changed.length, 0, 'geändert:\n' + changed.slice(0, 10).map((r) => JSON.stringify(r)).join('\n'));
});
