// Vorführseite "Kaufzon": neutraler Nachbau einer Shopseite ohne Marken, auf dem die echte Erweiterung läuft.
// Über einen lokalen Server mit dem Erweiterungsordner als Wurzel öffnen, etwa /test/ansicht/kaufzon-suche.html
// ?liste=offen öffnet die Vergleichsliste.
(async function () {
  'use strict';

  const [messages, manifest, pageCss] = await Promise.all([
    fetch('/_locales/de/messages.json').then((r) => r.json()),
    fetch('/manifest.json').then((r) => r.json()),
    fetch('/content/page.css').then((r) => r.text())
  ]);
  window.__EP_MESSAGES__ = messages;
  window.__EP_MANIFEST__ = manifest;

  const style = document.createElement('style');
  style.textContent = pageCss.replaceAll('chrome-extension://__MSG_@@extension_id__/', '/');
  document.head.append(style);

  const scripts = ['test/chrome-shim.js'].concat(manifest.content_scripts[0].js);
  for (const src of scripts) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/' + src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.append(script);
    });
  }
  if (new URLSearchParams(location.search).get('liste') === 'offen') {
    await new Promise((r) => setTimeout(r, 100));
    window.Einheitspreis.settings.update({ panelOpen: true });
  }
})();
