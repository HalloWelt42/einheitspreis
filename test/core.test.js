// Rechenkern gegen echte Amazon-Titel prüfen: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');

require('../core/quantity.js');
const { parseMoney, formatMoney } = require('../core/money.js');
const { computeUnitPrice } = require('../core/unit-price.js');
const { parseQuantity } = globalThis.Einheitspreis.quantity;

const QUANTITY_CASES = [
  // [Titel, Dimension, Gesamtmenge in Basiseinheit]
  ['WD Red Plus 6 TB NAS Interne Festplatte 3,5 Zoll - 5400 U/Min, SATA 6Gb/s', 'storage', 6],
  ['Seagate IronWolf Pro 8TB, NAS Interne Festplatte HDD, 3.5 Zoll, 7200 U/Min, CMR, 256 MB Cache, SATA 6 GB/S', 'storage', 8],
  ['Seagate 4TB IronWolf, 180TB/Jahr, 3 Jahre Garantie', 'storage', 4],
  ['16000 GB', 'storage', 16],
  ['24 TB', 'storage', 24],
  ['Externe Festplatte,2TB 2,5Zoll USB 3.0 Backups HDD', 'storage', 2],
  ['Acer Predator GM7 4TB M.2 NVMe SSD - Lesegeschwindigkeit bis zu 7400 MB/s', 'storage', 4],
  ['Gehäuse für 3,5 Zoll Festplatten bis zu 24 TB', null, null],
  ['USB Stick 64GB 5er Pack, Speicherstick Slide Einziehbare 5 Stück)', 'storage', 0.32],
  ['Intenso Basic Line 5x 32 GB USB-Sticks USB 2.0 Speichersticks, 5er Pack', 'storage', 0.16],
  ['Gigastone M.2 SSD 2TB (2er-Pack) NVMe SSD Bis zu 7,300MB/s', 'storage', 4],
  ['Disque Dur Externe Portable de 2,5 pouces 500Go', 'storage', 0.5],
  ['Olio Extra Vergine Grezzo 1000 ml (3 x 1,0 l)', 'volume', 3],
  ['Selters Mineralwasser, Classic 12 x 0.75 l (MEHRWEG)', 'volume', 9],
  ['ACQUA MORELLI Mineralwasser mit Kohlensäure - Sparkling, 12x0,5l PET', 'volume', 6],
  ['FELCE AZZURRA Flüssigwaschmittel 1.595 lt.', 'volume', 1.595],
  ['Ecover Waschmittel Universal (5L/100 Waschladungen)', 'load', 100],
  ['SPEE Gel Universal (2x100 Waschladungen), Flüssigwaschmittel', 'load', 200],
  ['Ariel Flüssigwaschmittel Color+, 80 Wäschen', 'load', 80],
  ['Universal Waschpulver Pulverform 3x10 kg', 'mass', 30],
  ['Dallmayr Espresso d\'Oro Dark Roast 1.000g Ganze Bohne', 'mass', 1],
  ['by Amazon Kaffeebohnen, 2kg (2 Packungen mit 1kg)', 'mass', 2],
  ['FELIX Sensations Saucen, Sorten-Mix, 72er Pack (6 x 12 x 85g)', 'mass', 6.12],
  ['Premium Olivenöl - extra hoher Polyphenol-Gehalt 950 mg/kg - 500 ml', 'volume', 0.5],
  ['Somat Classic Power kompakte Spülmaschinentabs (172 Tabs)', 'portion', 172],
  ['POWREOWL AA Alkaline-Batterien (LR6), Ultra Power, 60 Stück', 'count', 60],
  ['Varta 100 x Varta 04006 Batterien Alkaline, Mignon, AA', 'count', 100],
  ['Router mit 5G Modem', null, null]
];

for (const [title, dimension, amount] of QUANTITY_CASES) {
  test('Menge: ' + title, () => {
    const q = parseQuantity(title);
    if (dimension === null) {
      assert.equal(q, null);
      return;
    }
    assert.equal(q.dimension, dimension);
    assert.ok(Math.abs(q.amount - amount) < 1e-9, 'erwartet ' + amount + ', erkannt ' + q.amount);
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

test('Einheitspreis: Festplatte in TB und GB', () => {
  const offer = { text: '24 TB', price: parseMoney('635,86€') };
  assert.equal(computeUnitPrice(offer, { storageUnit: 'TB' }).unitPrice.toFixed(2), '26.49');
  assert.equal(computeUnitPrice(offer, { storageUnit: 'GB' }).unitPrice.toFixed(4), '0.0265');
});

test('Einheitspreis: Amazons Grundpreis hat Vorrang vor Volumen', () => {
  const r = computeUnitPrice({ text: 'Olivenöl 1L', price: parseMoney('21,95 €'), amazonUnitPriceText: '20,00 € / l' }, {});
  assert.equal(r.source, 'amazon');
  assert.equal(r.unitPrice, 20);
});

test('Einheitspreis: Amazons "100 g" wird auf kg umgerechnet', () => {
  const r = computeUnitPrice({ text: 'Kaffee', price: parseMoney('5 €'), amazonUnitPriceText: '1,23 € / 100 g' }, {});
  assert.equal(r.dimension, 'mass');
  assert.equal(r.unitPrice.toFixed(2), '12.30');
});

test('Einheitspreis: Amazons "€/Stück" weicht einer echten Menge', () => {
  const r = computeUnitPrice({ text: 'Olivenöl 3 l', price: parseMoney('59,49 €'), amazonUnitPriceText: '59,49 € / Stück' }, {});
  assert.equal(r.source, 'computed');
  assert.equal(r.unitPrice.toFixed(2), '19.83');
});

test('Einheitspreis: Speicher schlägt Amazons Stückpreis', () => {
  const r = computeUnitPrice({ text: 'Micro SD Karte 16GB 5er Pack', price: parseMoney('25,49 €'), amazonUnitPriceText: '5,10 € / Stück' }, {});
  assert.equal(r.dimension, 'storage');
  assert.equal(r.unitPrice.toFixed(2), '318.63');
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
