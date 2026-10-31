/*
 * Ablauf: Seite lesen, Einheitspreise rechnen, vergleichen, anzeigen.
 * Läuft erneut, sobald Amazon Inhalte nachlädt (Seitenwechsel, Variantenwahl).
 */
(function (root) {
  'use strict';

  if (root.__einheitspreisStarted) return;
  root.__einheitspreisStarted = true;

  const ns = root.Einheitspreis;
  const SCAN_DELAY_MS = 500;
  const OWN_ELEMENTS = '.ep-badge, #einheitspreis-panel-host';

  let timer = null;
  let observer = null;

  // Ohne Verbindung zur Erweiterung still aufhören (siehe runtime.js).
  function stop() {
    clearTimeout(timer);
    if (observer) observer.disconnect();
    ns.panel.remove();
  }

  function computeEntries(offers, settings) {
    const entries = [];
    for (const offer of offers) {
      const unitPrice = ns.unitPrice.computeUnitPrice(offer, settings);
      if (unitPrice) entries.push({ id: offer.key, offer, unitPrice });
      else ns.badge.removeBadge(offer.anchor);
    }
    return entries;
  }

  // Derselbe Artikel steht oft mehrfach auf einer Seite (Hauptangebot und Variante, Suchtreffer und Karussell):
  // er zählt einmal, jede weitere Stelle übernimmt seinen Rang. Das Hauptangebot weicht seiner Variante.
  function splitDuplicates(entries) {
    const isMain = (entry) => entry.offer.key === 'product:main';
    const ordered = entries.filter((e) => !isMain(e)).concat(entries.filter(isMain));
    const firstOf = new Map();
    const compared = [];
    const duplicates = [];
    for (const entry of ordered) {
      const id = entry.offer.asin ? entry.offer.asin + '|' + ns.ranking.groupKey(entry.unitPrice) : null;
      if (id && firstOf.has(id)) {
        duplicates.push({ entry, twin: firstOf.get(id) });
      } else {
        if (id) firstOf.set(id, entry);
        compared.push(entry);
      }
    }
    return { compared, duplicates };
  }

  function scan() {
    if (!ns.runtime.alive()) return stop();
    const settings = ns.settings.get();
    const entries = computeEntries(ns.amazonDom.readOffers(), settings);
    const { compared, duplicates } = splitDuplicates(entries);
    const ranking = ns.ranking.rankEntries(compared);
    for (const entry of compared) entry.rank = ranking.get(entry.id);
    for (const { entry, twin } of duplicates) entry.rank = twin.rank;
    for (const entry of compared.concat(duplicates.map((d) => d.entry))) ns.badge.renderBadge(entry.offer, entry.unitPrice, entry.rank);
    ns.panel.render({ entries: compared, settings });
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(scan, SCAN_DELAY_MS);
  }

  function isOwnMutation(mutation) {
    const target = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
    return Boolean(target && target.closest(OWN_ELEMENTS));
  }

  async function start() {
    await ns.settings.load();
    ns.settings.onChange(scan);
    scan();
    observer = new MutationObserver((mutations) => {
      if (!ns.runtime.alive()) return stop();
      if (mutations.every(isOwnMutation)) return;
      schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  start().catch((e) => console.warn('[Einheitspreis] Start fehlgeschlagen:', e.message));
})(globalThis);
