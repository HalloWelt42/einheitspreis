// Ersatz für die chrome.*-Schnittstellen, damit die Inhaltsskripte im Prüfstand laufen.
(function () {
  'use strict';
  const messages = window.__EP_MESSAGES__;
  const store = {};
  const changeListeners = [];
  window.chrome = {
    i18n: {
      getMessage(key, subs) {
        const entry = messages[key];
        if (!entry) return '';
        let text = entry.message;
        (subs || []).forEach((value, i) => { text = text.replace('$' + (i + 1), value); });
        return text;
      }
    },
    runtime: {
      getURL: (path) => '/' + path,
      getManifest: () => window.__EP_MANIFEST__
    },
    storage: {
      local: {
        async get(key) { return { [key]: store[key] }; },
        async set(items) {
          for (const [key, value] of Object.entries(items)) {
            const oldValue = store[key];
            store[key] = value;
            changeListeners.forEach((l) => l({ [key]: { oldValue, newValue: value } }, 'local'));
          }
        }
      },
      onChanged: { addListener: (l) => changeListeners.push(l) }
    }
  };
})();
