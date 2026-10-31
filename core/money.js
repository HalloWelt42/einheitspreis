/*
 * Geldbeträge lesen und schreiben. Reiner Rechenkern ohne DOM.
 */
(function (root) {
  'use strict';

  const ns = (root.Einheitspreis = root.Einheitspreis || {});

  const CURRENCY_SYMBOLS = { '€': 'EUR', '$': 'USD', '£': 'GBP', 'CHF': 'CHF', 'zł': 'PLN', 'kr': 'SEK' };

  const MONEY_RE = /(\d{1,3}(?:[.,\s  ]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(€|\$|£|CHF|zł|kr)|(€|\$|£)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/;

  /** "1.234,56 €", "$1,234.56", "278,99€" -> { amount, currency } oder null. */
  function parseMoney(text) {
    if (!text) return null;
    const match = String(text).replace(/ /g, ' ').match(MONEY_RE);
    if (!match) return null;
    const digits = match[1] || match[4];
    const symbol = match[2] || match[3];
    const amount = parseAmount(digits);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return { amount, currency: CURRENCY_SYMBOLS[symbol] || 'EUR' };
  }

  // Das letzte Trennzeichen mit 1-2 Ziffern dahinter ist das Dezimalzeichen.
  function parseAmount(digits) {
    const compact = digits.replace(/[\s ]/g, '');
    const decimal = compact.match(/[.,](\d{1,2})$/);
    if (!decimal) return Number(compact.replace(/[.,]/g, ''));
    const whole = compact.slice(0, -decimal[0].length).replace(/[.,]/g, '');
    return Number(whole + '.' + decimal[1]);
  }

  // Kleine Einheitspreise (0,0265 €/GB) brauchen mehr Nachkommastellen.
  function formatMoney(amount, currency, locale) {
    const digits = amount >= 1 ? 2 : amount >= 0.1 ? 3 : 4;
    return new Intl.NumberFormat(locale || undefined, {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(amount);
  }

  ns.money = { parseMoney, formatMoney };
})(typeof globalThis !== 'undefined' ? globalThis : this);

if (typeof module !== 'undefined') module.exports = globalThis.Einheitspreis.money;
