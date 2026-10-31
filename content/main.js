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

  // Nach dem Neuladen oder Entfernen der Erweiterung läuft dieses Skript im offenen Tab weiter,
  // erreicht den Browser aber nicht mehr ("Extension context invalidated"): dann still aufhören.
  function extensionAlive() {
    return Boolean(root.chrome && chrome.runtime && chrome.runtime.id);
  }

  function stop() {
    clearTimeout(timer);
    if (observer) observer.disconnect();
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

  // Das Hauptangebot einer Produktseite ist zugleich eine ihrer Varianten:
  // es zählt nicht doppelt, sondern übernimmt den Rang seiner Variante.
  function splitDuplicates(entries) {
    const variantAsins = new Set(entries.filter((e) => e.offer.key.startsWith('swatch:')).map((e) => e.offer.asin));
    const compared = [];
    const duplicates = [];
    for (const entry of entries) {
      const isDuplicate = entry.offer.key === 'product:main' && variantAsins.has(entry.offer.asin);
      (isDuplicate ? duplicates : compared).push(entry);
    }
    return { compared, duplicates };
  }

  function scan() {
    if (!extensionAlive()) return stop();
    const settings = ns.settings.get();
    const entries = computeEntries(ns.amazonDom.readOffers(), settings);
    const { compared, duplicates } = splitDuplicates(entries);
    const ranking = ns.ranking.rankEntries(compared);
    for (const entry of compared) entry.rank = ranking.get(entry.id);
    for (const entry of duplicates) {
      const twin = compared.find((e) => e.offer.asin === entry.offer.asin && e.rank.group === ns.ranking.groupKey(entry.unitPrice));
      entry.rank = twin ? twin.rank : { rank: 1, total: 1, tier: 'single', group: ns.ranking.groupKey(entry.unitPrice) };
    }
    for (const entry of compared.concat(duplicates)) ns.badge.renderBadge(entry.offer, entry.unitPrice, entry.rank);
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
      if (!extensionAlive()) return stop();
      if (mutations.every(isOwnMutation)) return;
      schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  start().catch((e) => console.warn('[Einheitspreis] Start fehlgeschlagen:', e.message));
})(globalThis);
