/*
 * Texte für Einheitspreise: Betrag, Einheit, erkannte Menge, Rang.
 * Alle sichtbaren Wörter kommen aus _locales.
 */
(function (root) {
  'use strict';

  const ns = root.Einheitspreis;
  const { formatMoney } = ns.money;

  function t(key, substitutions) {
    return chrome.i18n.getMessage(key, substitutions) || key;
  }

  const UNIT_MESSAGE = {
    TB: 'unitTB',
    GB: 'unitGB',
    load: 'unitLoad',
    portion: 'unitPortion',
    l: 'unitLiter',
    kg: 'unitKilogram',
    piece: 'unitPiece'
  };

  const DIMENSION_MESSAGE = {
    storage: 'dimensionStorage',
    load: 'dimensionLoad',
    portion: 'dimensionPortion',
    volume: 'dimensionVolume',
    mass: 'dimensionMass',
    count: 'dimensionCount'
  };

  function pageLocale() {
    return document.documentElement.lang || undefined;
  }

  function unitLabel(unitPrice) {
    return unitPrice.unitIsLabel ? unitPrice.unitKey : t(UNIT_MESSAGE[unitPrice.unitKey]);
  }

  function priceText(unitPrice) {
    return formatMoney(unitPrice.unitPrice, unitPrice.currency, pageLocale()) + '/' + unitLabel(unitPrice);
  }

  // Was erkannt wurde, damit jede Zahl nachprüfbar ist: "5 x 32 GB".
  function quantityText(unitPrice) {
    const quantity = unitPrice.quantity;
    if (!quantity) return t('sourceAmazon');
    const single = quantity.text.replace(/\s+/g, ' ');
    return quantity.items > 1 ? quantity.items + ' x ' + single : single;
  }

  function groupLabel(unitPrice) {
    const message = DIMENSION_MESSAGE[unitPrice.dimension];
    const name = message ? t(message) : unitPrice.unitKey;
    return name + ' (' + unitLabel(unitPrice) + ')';
  }

  function rankText(rank) {
    return t('rankOf', [String(rank.rank), String(rank.total)]);
  }

  function rankShortText(rank) {
    return t('rankShort', [String(rank.rank), String(rank.total)]);
  }

  ns.labels = { t, priceText, quantityText, groupLabel, rankText, rankShortText, pageLocale };
})(globalThis);
