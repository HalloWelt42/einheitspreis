/*
 * Vergleichsliste: schwebender Knopf und Liste aller Angebote einer Einheit,
 * günstigster Einheitspreis zuerst. Eigenes Shadow DOM, unberührt von Amazons CSS.
 */
(function (root) {
  'use strict';

  const ns = root.Einheitspreis;
  const { t, priceText, quantityText, groupLabel } = ns.labels;
  const { formatMoney } = ns.money;

  let host = null;
  let shadow = null;
  let selectedGroup = null;
  let lastState = null;

  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function icon(name) {
    const span = el('span', 'ep-icon');
    span.innerHTML = ns.icons[name];
    return span;
  }

  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = 'einheitspreis-panel-host';
    shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = chrome.runtime.getURL('content/panel.css');
    shadow.append(style, el('div', 'ep-root'));
    document.body.append(host);
  }

  /** Gruppen nach Größe; die größte ist die Vorauswahl. */
  function groupsOf(entries) {
    const groups = new Map();
    for (const entry of entries) {
      const key = entry.rank.group;
      if (!groups.has(key)) groups.set(key, { key, label: groupLabel(entry.unitPrice), entries: [] });
      groups.get(key).entries.push(entry);
    }
    return Array.from(groups.values()).sort((a, b) => b.entries.length - a.entries.length);
  }

  function renderToggle(group, open) {
    const button = el('button', 'ep-toggle' + (open ? ' ep-toggle-open' : ''));
    button.type = 'button';
    button.setAttribute('aria-expanded', String(open));
    button.append(icon('scale'));
    if (group) {
      const best = group.entries.reduce((a, b) => (b.unitPrice.unitPrice < a.unitPrice.unitPrice ? b : a));
      button.append(el('span', 'ep-toggle-best', priceText(best.unitPrice)));
      button.append(el('span', 'ep-toggle-count', String(group.entries.length)));
    }
    button.addEventListener('click', () => ns.settings.update({ panelOpen: !open }));
    return button;
  }

  function renderGroupTabs(groups, current) {
    const tabs = el('div', 'ep-tabs');
    for (const group of groups) {
      const tab = el('button', 'ep-tab' + (group.key === current.key ? ' ep-tab-active' : ''), group.label);
      tab.type = 'button';
      tab.addEventListener('click', () => {
        selectedGroup = group.key;
        render(lastState);
      });
      tabs.append(tab);
    }
    return tabs;
  }

  function renderStorageSwitch(settings) {
    const wrap = el('div', 'ep-switch');
    wrap.append(el('span', 'ep-switch-label', t('labelStoragePer')));
    for (const unit of ['TB', 'GB']) {
      const button = el('button', 'ep-switch-option' + (settings.storageUnit === unit ? ' ep-switch-active' : ''), unit);
      button.type = 'button';
      button.addEventListener('click', () => ns.settings.update({ storageUnit: unit }));
      wrap.append(button);
    }
    return wrap;
  }

  function showOnPage(entry) {
    const target = entry.offer.element;
    if (target && target.isConnected) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ns.badge.flash(target);
    } else if (entry.offer.url) {
      location.href = entry.offer.url;
    }
  }

  function renderRow(entry) {
    const row = el('li', 'ep-row ep-tier-' + (entry.rank.total > 1 ? entry.rank.tier : 'single'));
    row.tabIndex = 0;
    row.append(el('span', 'ep-row-rank', String(entry.rank.rank)));
    const figures = el('div', 'ep-row-figures');
    figures.append(el('span', 'ep-row-unit', priceText(entry.unitPrice)));
    const price = entry.offer.price
      ? formatMoney(entry.offer.price.amount, entry.offer.price.currency, ns.labels.pageLocale())
      : '';
    figures.append(el('span', 'ep-row-meta', quantityText(entry.unitPrice) + (price ? ' · ' + price : '')));
    row.append(figures);
    const title = el('a', 'ep-row-title', entry.offer.title);
    if (entry.offer.url) title.href = entry.offer.url;
    title.addEventListener('click', (event) => event.stopPropagation());
    row.append(title);
    row.addEventListener('click', () => showOnPage(entry));
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') showOnPage(entry);
    });
    return row;
  }

  function renderPanel(groups, current, settings) {
    const panel = el('section', 'ep-panel');
    const header = el('header', 'ep-header');
    header.append(el('h2', 'ep-title', t('panelTitle')));
    const close = el('button', 'ep-close');
    close.type = 'button';
    close.setAttribute('aria-label', t('btnClose'));
    close.append(icon('xmark'));
    close.addEventListener('click', () => ns.settings.update({ panelOpen: false }));
    header.append(close);
    panel.append(header);

    if (!current) {
      panel.append(el('p', 'ep-empty', t('emptyList')));
      return panel;
    }
    if (groups.length > 1) panel.append(renderGroupTabs(groups, current));
    if (current.entries[0].unitPrice.dimension === 'storage') panel.append(renderStorageSwitch(settings));
    panel.append(el('p', 'ep-hint', t('listHint')));

    const list = el('ol', 'ep-list');
    current.entries
      .slice()
      .sort((a, b) => a.unitPrice.unitPrice - b.unitPrice.unitPrice)
      .forEach((entry) => list.append(renderRow(entry)));
    panel.append(list);

    panel.append(el('footer', 'ep-footer', t('appName') + ' ' + chrome.runtime.getManifest().version));
    return panel;
  }

  /** state: { entries: [{ offer, unitPrice, rank }], settings } */
  function render(state) {
    lastState = state;
    ensureHost();
    const groups = groupsOf(state.entries);
    const current = groups.find((g) => g.key === selectedGroup) || groups[0] || null;
    const container = shadow.querySelector('.ep-root');
    const scroller = container.querySelector('.ep-list');
    const scrollTop = scroller ? scroller.scrollTop : 0;
    container.replaceChildren(renderToggle(current, state.settings.panelOpen));
    if (state.settings.panelOpen) {
      container.append(renderPanel(groups, current, state.settings));
      const list = container.querySelector('.ep-list');
      if (list) list.scrollTop = scrollTop;
    }
    host.hidden = state.entries.length === 0 && !state.settings.panelOpen;
  }

  ns.panel = { render };
})(globalThis);
