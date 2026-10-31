// Ergebnis des Rechenkerns je echtem Angebot, knapp und stabil zum Vergleichen (HELF-104).
require('../core/quantity.js');
const { parseMoney } = require('../core/money.js');
const { computeUnitPrice } = require('../core/unit-price.js');

const round = (value) => Number(value.toPrecision(6));

function snapshotOf(fixtures) {
  return fixtures.map((item) => {
    const r = computeUnitPrice({ text: item.title, price: parseMoney(item.price), amazonUnitPriceText: item.amazonUnitPrice }, {});
    return {
      titel: item.title,
      ergebnis: r && {
        dimension: r.dimension,
        quelle: r.source,
        einheitspreis: round(r.unitPrice),
        einheit: r.unitKey,
        menge: r.quantity ? (r.quantity.items > 1 ? r.quantity.items + ' x ' : '') + r.quantity.text : null
      }
    };
  });
}

module.exports = { snapshotOf };
