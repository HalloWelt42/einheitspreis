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

  // Ausreißer: weit über dem Median der Gruppe fehlt fast immer die Stückzahl ("Gaskartuschen 227g" für eine
  // 28er-Packung). Gemessen auf echten Seiten: echte teure Angebote bis 11,7-fach (leere Kleinstflaschen),
  // fehlende Stückzahlen 20- bis 41-fach. Erst ab MIN_GROUP_FOR_OUTLIERS Angeboten ist der Median belastbar.
  const OUTLIER_FACTOR = 15;
  const MIN_GROUP_FOR_OUTLIERS = 5;

  /** Vergleichsgruppe: gleiche Dimension und gleiche Anzeigeeinheit. */
  function groupKey(unitPrice) {
    return unitPrice.dimension + '|' + unitPrice.unitKey + '|' + unitPrice.currency;
  }

  function groupsOf(entries) {
    const groups = new Map();
    for (const entry of entries) {
      const key = groupKey(entry.unitPrice);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    return groups;
  }

  function median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  /** entries -> { kept, dropped }: zu unsichere Einheitspreise fallen heraus, statt falsch zu ranken. */
  function dropOutliers(entries) {
    const dropped = new Set();
    for (const members of groupsOf(entries).values()) {
      if (members.length < MIN_GROUP_FOR_OUTLIERS) continue;
      const limit = median(members.map((e) => e.unitPrice.unitPrice)) * OUTLIER_FACTOR;
      for (const entry of members) if (entry.unitPrice.unitPrice > limit) dropped.add(entry);
    }
    return { kept: entries.filter((e) => !dropped.has(e)), dropped: Array.from(dropped) };
  }

  /**
   * entries: [{ id, unitPrice }] -> Map(id -> { rank, total, tier, ratio, group })
   * Gleiche Einheitspreise teilen sich den Rang.
   */
  function rankEntries(entries) {
    const ranking = new Map();
    for (const [key, members] of groupsOf(entries)) {
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

  ns.ranking = { rankEntries, dropOutliers, groupKey };
})(typeof globalThis !== 'undefined' ? globalThis : this);

if (typeof module !== 'undefined') module.exports = globalThis.Einheitspreis.ranking;
