/*
 * Einheitspreis eines Angebots bestimmen. Reiner Rechenkern ohne DOM.
 *
 * Quellen in dieser Reihenfolge:
 *   1. Speicher (TB/GB), Waschladungen und Portionen (Tabs, Kapseln) aus dem
 *      Text - dafür nennt Amazon keinen Grundpreis, und sie sind
 *      aussagekräftiger als €/l oder €/kg.
 *   2. Amazons eigener Grundpreis ("12,60 €/l") - die verlässlichste Angabe,
 *      außer er lautet nur "€/Stück" und der Text nennt eine echte Menge.
 *   3. Volumen, Masse, Anzahl aus dem Text.
 */
(function (root) {
  'use strict';

  const ns = (root.Einheitspreis = root.Einheitspreis || {});
  const { parseQuantity, parseNumber, lookupUnit } = ns.quantity;
  const { parseMoney } = ns.money;

  // Anzeigeeinheit je Dimension: Schlüssel und Faktor zur Basiseinheit.
  const DISPLAY_UNITS = {
    storage: { TB: 1, GB: 1e-3 },
    load: { load: 1 },
    portion: { portion: 1 },
    volume: { l: 1 },
    mass: { kg: 1 },
    count: { piece: 1 }
  };

  const DEFAULT_SETTINGS = { storageUnit: 'TB' };

  // Dimensionen, deren Rechnung aus dem Text Amazons Grundpreis schlägt.
  const PREFERRED_OVER_AMAZON = new Set(['storage', 'load', 'portion']);

  function displayUnitFor(dimension, settings) {
    if (dimension === 'storage') {
      const key = settings.storageUnit === 'GB' ? 'GB' : 'TB';
      return { key, factor: DISPLAY_UNITS.storage[key] };
    }
    const units = DISPLAY_UNITS[dimension];
    const key = Object.keys(units)[0];
    return { key, factor: units[key] };
  }

  /** "52,58 € / l", "1,23 €/100 g", "0,20 €/Waschladung" -> Preis je Basiseinheit. */
  function parseAmazonUnitPrice(text) {
    if (!text) return null;
    const money = parseMoney(text);
    const slash = text.lastIndexOf('/');
    if (!money || slash < 0) return null;
    const unitText = text.slice(slash + 1).replace(/[)\s]+$/, '').trim();
    const match = unitText.match(/^(\d+(?:[.,]\d+)?)?\s*(.+)$/);
    if (!match) return null;
    const count = match[1] ? parseNumber(match[1]) : 1;
    const unit = lookupUnit(match[2]);
    if (unit) {
      return {
        dimension: unit.dimension,
        pricePerBase: money.amount / (count * unit.factor),
        currency: money.currency
      };
    }
    // Unbekannte Einheit (Waschladung, Anwendung): nur untereinander vergleichbar.
    const label = match[2].trim();
    return {
      dimension: 'other:' + label.toLowerCase(),
      label,
      pricePerBase: money.amount / count,
      currency: money.currency
    };
  }

  function result(dimension, pricePerBase, currency, source, quantity, settings, label) {
    const display = label
      ? { key: label, factor: 1 }
      : displayUnitFor(dimension, settings);
    return {
      dimension,
      source,
      currency,
      quantity,
      unitKey: display.key,
      unitIsLabel: Boolean(label),
      unitPrice: pricePerBase * display.factor
    };
  }

  /**
   * offer: { text, price: { amount, currency }, amazonUnitPriceText? }
   * Liefert null, wenn sich kein Einheitspreis sicher bestimmen lässt.
   */
  function computeUnitPrice(offer, settings) {
    const config = Object.assign({}, DEFAULT_SETTINGS, settings);
    const quantity = parseQuantity(offer.text);
    const price = offer.price;

    const computed = price && quantity
      ? result(quantity.dimension, price.amount / quantity.amount, price.currency, 'computed', quantity, config)
      : null;
    if (computed && PREFERRED_OVER_AMAZON.has(computed.dimension)) return computed;

    const amazon = parseAmazonUnitPrice(offer.amazonUnitPriceText);
    const amazonOnlyPerPiece = amazon && amazon.dimension === 'count' && computed && computed.dimension !== 'count';
    if (amazon && !amazonOnlyPerPiece) {
      return result(amazon.dimension, amazon.pricePerBase, amazon.currency, 'amazon',
        quantity && quantity.dimension === amazon.dimension ? quantity : null, config, amazon.label);
    }

    return computed;
  }

  ns.unitPrice = { computeUnitPrice, parseAmazonUnitPrice, DEFAULT_SETTINGS };
})(typeof globalThis !== 'undefined' ? globalThis : this);

if (typeof module !== 'undefined') module.exports = globalThis.Einheitspreis.unitPrice;
