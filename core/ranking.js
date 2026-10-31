/*
 * Angebote derselben Einheit vergleichen: Rang und Stufe je Angebot.
 * Reiner Rechenkern ohne DOM.
 */
(function (root) {
  'use strict';

  const ns = (root.Einheitspreis = root.Einheitspreis || {});

  // Abstand zum günstigsten Einheitspreis -> Stufe.
  const TIERS = [
    { name: 'best', maxRatio: 1.005 },
    { name: 'good', maxRatio: 1.15 },
    { name: 'mid', maxRatio: 1.4 },
    { name: 'high', maxRatio: Infinity }
  ];

  /** Vergleichsgruppe: gleiche Dimension und gleiche Anzeigeeinheit. */
  function groupKey(unitPrice) {
    return unitPrice.dimension + '|' + unitPrice.unitKey + '|' + unitPrice.currency;
  }

  /**
   * entries: [{ id, unitPrice }] -> Map(id -> { rank, total, tier, ratio, group })
   * Gleiche Einheitspreise teilen sich den Rang.
   */
  function rankEntries(entries) {
    const groups = new Map();
    for (const entry of entries) {
      const key = groupKey(entry.unitPrice);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    const ranking = new Map();
    for (const [key, members] of groups) {
      const sorted = members.slice().sort((a, b) => a.unitPrice.unitPrice - b.unitPrice.unitPrice);
      const best = sorted[0].unitPrice.unitPrice;
      let rank = 0;
      let previous = null;
      sorted.forEach((entry, index) => {
        const value = entry.unitPrice.unitPrice;
        if (value !== previous) rank = index + 1;
        previous = value;
        const ratio = value / best;
        const tier = TIERS.find((t) => ratio <= t.maxRatio).name;
        ranking.set(entry.id, { rank, total: sorted.length, tier, ratio, group: key });
      });
    }
    return ranking;
  }

  ns.ranking = { rankEntries, groupKey };
})(typeof globalThis !== 'undefined' ? globalThis : this);

if (typeof module !== 'undefined') module.exports = globalThis.Einheitspreis.ranking;
