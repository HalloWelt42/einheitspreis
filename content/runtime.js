/*
 * Verbindung zur Erweiterung: Nach dem Neuladen oder Entfernen der Erweiterung läuft ein Inhaltsskript im offenen Tab
 * weiter, erreicht den Browser aber nicht mehr ("Extension context invalidated"). Einziger Ort dieser Prüfung.
 */
(function (root) {
  'use strict';

  const ns = (root.Einheitspreis = root.Einheitspreis || {});

  function alive() {
    return Boolean(root.chrome && chrome.runtime && chrome.runtime.id);
  }

  ns.runtime = { alive };
})(globalThis);
