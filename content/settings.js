/*
 * Einstellungen: ein einziger Speicherschlüssel, Vorgaben aus dem Rechenkern.
 */
(function (root) {
  'use strict';

  const ns = root.Einheitspreis;
  const STORAGE_KEY = 'einheitspreis';
  const DEFAULTS = Object.assign({ panelOpen: false }, ns.unitPrice.DEFAULT_SETTINGS);

  let current = Object.assign({}, DEFAULTS);
  const listeners = [];

  async function load() {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      current = Object.assign({}, DEFAULTS, stored[STORAGE_KEY]);
    } catch (e) {
      console.warn('[Einheitspreis] Einstellungen nicht lesbar:', e.message);
    }
    return current;
  }

  async function update(changes) {
    current = Object.assign({}, current, changes, { updatedAt: Date.now() });
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: current });
    } catch (e) {
      console.warn('[Einheitspreis] Einstellungen nicht speicherbar:', e.message);
    }
  }

  // Jede Änderung, auch die eigene und die aus anderen Tabs, kommt hier an.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    current = Object.assign({}, DEFAULTS, changes[STORAGE_KEY].newValue);
    listeners.forEach((listener) => listener(current));
  });

  ns.settings = {
    load,
    update,
    get: () => current,
    onChange: (listener) => listeners.push(listener)
  };
})(globalThis);
