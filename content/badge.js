/*
 * Abzeichen am Preis eines Angebots: Einheitspreis, erkannte Menge, Rang.
 */
(function (root) {
  'use strict';

  const ns = root.Einheitspreis;
  const { priceText, quantityText, rankText, rankShortText } = ns.labels;

  const BADGE_CLASS = 'ep-badge';

  function findBadge(anchor) {
    return anchor.querySelector(':scope > .' + BADGE_CLASS);
  }

  function createBadge(anchor) {
    const badge = document.createElement('span');
    badge.className = BADGE_CLASS;
    const price = document.createElement('span');
    price.className = 'ep-badge-price';
    const detail = document.createElement('span');
    detail.className = 'ep-badge-detail';
    badge.append(price, detail);
    anchor.append(badge);
    return badge;
  }

  // Nur bei Änderung schreiben, damit der Seitenbeobachter nicht unnötig anspringt.
  function setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }

  function renderBadge(offer, unitPrice, rank) {
    const badge = findBadge(offer.anchor) || createBadge(offer.anchor);
    const className = BADGE_CLASS + ' ep-tier-' + (rank.total > 1 ? rank.tier : 'single');
    if (badge.className !== className) badge.className = className;
    setText(badge.querySelector('.ep-badge-price'), priceText(unitPrice));
    const detail = offer.compact
      ? (rank.total > 1 ? rankShortText(rank) : '')
      : quantityText(unitPrice) + (rank.total > 1 ? ' · ' + rankText(rank) : '');
    setText(badge.querySelector('.ep-badge-detail'), detail);
  }

  function removeBadge(anchor) {
    const badge = findBadge(anchor);
    if (badge) badge.remove();
  }

  function flash(element) {
    element.classList.remove('ep-flash');
    void element.offsetWidth;
    element.classList.add('ep-flash');
  }

  ns.badge = { renderBadge, removeBadge, flash };
})(globalThis);
