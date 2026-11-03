/*
 * Amazon-Seiten lesen: der einzige Ort, der Amazons Seitenaufbau kennt.
 * Liefert Angebote als { key, asin, element, anchor, text, price, amazonUnitPriceText, title, url, compact }.
 * compact: enge Kachel, deren Bezeichnung die Menge schon zeigt.
 */
(function (root) {
  'use strict';

  const ns = root.Einheitspreis;
  const { parseMoney } = ns.money;

  const SEARCH_RESULT = '[data-component-type="s-search-result"][data-asin]:not([data-asin=""])';
  // Alle übrigen Angebote (Karussells, Werbeleisten, Empfehlungen) haben keinen gemeinsamen Aufbau; erkannt werden sie
  // über ihren Preis und den kleinsten umschließenden Bereich mit genau einem Artikel. Amazons Klassennamen sind dort
  // teils verschlüsselt, lesbar bleibt nur ihr Mittelteil, daher [class*=...].
  const CARD_PRICE = '.a-price:not(.a-text-price), .p13n-sc-price';
  const CARD_TITLES = ['h2', '.a-truncate-full', '[class*="_title"]', '[class*="truncate"]:not(.a-truncate-cut)'];
  const CARD_MAX_DEPTH = 15;
  const CARD_MIN_TITLE = 12;
  const ASIN_IN_URL = /\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?![A-Z0-9])/;
  const ASIN_IN_ITEM_ID = /^amzn1\.asin\.(?:\d+\.)?([A-Z0-9]{10})$/;
  const ASIN_SOURCES = '[data-asin]:not([data-asin=""]), [data-csa-c-item-id^="amzn1.asin."], a[href]';
  // Bereiche, die eigene Leser haben: Suchtreffer, Kopf der Produktseite mit Varianten.
  const OWN_READER_AREAS = SEARCH_RESULT + ', #ppd, #twister_feature_div, .ep-badge, #einheitspreis-panel-host';
  const STRIKE = '.a-text-strike, [data-a-strike="true"], s, del';

  // Preisbereich des Hauptangebots, in dieser Reihenfolge: Mitte der Seite vor Kaufbox.
  const MAIN_PRICE_BOXES = [
    '#corePriceDisplay_desktop_feature_div',
    '#corePrice_desktop',
    '#apex_desktop',
    '#corePrice_feature_div'
  ];

  function firstMatch(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  // Preis zum Bezahlen eines Bereichs, nie ein durchgestrichener UVP.
  function readPrice(scope) {
    if (!scope) return null;
    const label = scope.querySelector('.apex-pricetopay-accessibility-label');
    if (label && parseMoney(label.textContent)) return parseMoney(label.textContent);
    for (const priceEl of scope.querySelectorAll('.a-price')) {
      if (priceEl.matches(STRIKE) || priceEl.closest(STRIKE) || priceEl.matches('.a-text-price')) continue;
      const offscreen = priceEl.querySelector('.a-offscreen');
      const money = parseMoney(offscreen && offscreen.textContent) || parseMoney(priceEl.textContent);
      if (money) return money;
    }
    const plain = scope.querySelector('.p13n-sc-price');
    return plain ? parseMoney(plain.textContent) : null;
  }

  // Amazons Grundpreis, etwa "(12,60 € / l)": ein Textpreis, dem "/Einheit)" folgt.
  function readAmazonUnitPrice(scope) {
    if (!scope) return null;
    for (const priceEl of scope.querySelectorAll('.a-price.a-text-price')) {
      if (priceEl.dataset.aStrike === 'true') continue;
      const hostText = priceEl.parentElement.textContent.replace(/\s+/g, ' ');
      const unit = hostText.match(/\/\s*([^)]+)\)/);
      if (!unit) continue;
      const offscreen = priceEl.querySelector('.a-offscreen');
      const amount = (offscreen && offscreen.textContent.trim()) || priceEl.textContent.trim();
      return amount + ' / ' + unit[1].trim();
    }
    return readPlainUnitPrice(scope);
  }

  // Manche Kacheln (Empfehlungskarussells) schreiben den Grundpreis als reinen Text: "13,12 € (10,93 €/kg)".
  const PLAIN_UNIT_PRICE_RE = /\(\s*((?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}\s*€|€\s*\d+(?:[.,]\d{2}))\s*\/\s*([^()]{1,20}?)\s*\)/;

  function readPlainUnitPrice(scope) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement.closest('.ep-badge, #einheitspreis-panel-host') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    let text = '';
    for (let node = walker.nextNode(); node; node = walker.nextNode()) text += node.textContent + ' ';
    const match = text.replace(/\s+/g, ' ').match(PLAIN_UNIT_PRICE_RE);
    return match ? match[1] + ' / ' + match[2].trim() : null;
  }

  function absoluteUrl(href) {
    try {
      return new URL(href, location.origin).href;
    } catch (e) {
      return null;
    }
  }

  function readSearchResults() {
    const offers = [];
    for (const item of document.querySelectorAll(SEARCH_RESULT)) {
      const heading = item.querySelector('h2');
      const priceRecipe = item.querySelector('[data-cy="price-recipe"]') || item;
      if (!heading) continue;
      const title = heading.textContent.replace(/\s+/g, ' ').trim();
      const link = heading.closest('a') || item.querySelector('a.a-link-normal[href*="/dp/"]');
      offers.push({
        key: 'search:' + item.dataset.asin + ':' + (item.dataset.index || ''),
        asin: item.dataset.asin,
        element: item,
        anchor: priceRecipe,
        title,
        text: title,
        price: readPrice(priceRecipe),
        amazonUnitPriceText: readAmazonUnitPrice(priceRecipe),
        url: link ? absoluteUrl(link.getAttribute('href')) : null
      });
    }
    return offers;
  }

  function asinOfLink(link) {
    let href = link.getAttribute('href') || '';
    try {
      href = decodeURIComponent(href);
    } catch (e) {
      // unvollständig kodiert: so lesen, wie es dasteht
    }
    const match = href.match(ASIN_IN_URL);
    return match ? match[1] : null;
  }

  function asinOf(element) {
    if (element.tagName === 'A') return asinOfLink(element);
    if (element.dataset.asin) return element.dataset.asin;
    const itemId = (element.dataset.csaCItemId || '').match(ASIN_IN_ITEM_ID);
    return itemId ? itemId[1] : null;
  }

  // Alle Artikel eines Bereichs: data-asin, Kennung der Amazon-Messung, Produktlinks (auch in Werbelinks kodiert).
  function asinsIn(element) {
    const asins = new Set();
    for (const el of [element, ...element.querySelectorAll(ASIN_SOURCES)]) {
      const asin = asinOf(el);
      if (asin) asins.add(asin);
    }
    return asins;
  }

  // Kleinster Bereich um den Preis mit genau einem Artikel und dessen Titel: die Karte dieses Angebots.
  // Kleinster, weil größere Bereiche oft schon die Überschrift ihres Abschnitts enthalten.
  function cardOf(priceEl) {
    let el = priceEl.parentElement;
    for (let depth = 0; el && el !== document.body && depth < CARD_MAX_DEPTH; depth++, el = el.parentElement) {
      const asins = asinsIn(el);
      if (asins.size > 1) return null;
      if (asins.size === 1) {
        const title = readCardTitle(el);
        if (title) return { element: el, asin: asins.values().next().value, title };
      }
    }
    return null;
  }

  // Teile eines Titels ("Marke" + "Rest") zusammen, aber derselbe Titel in Lang- und Kurzfassung nur einmal.
  function joinDistinct(texts) {
    const parts = texts.map((text) => text.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return parts.filter((part, i) => !parts.some((other, j) => j !== i && other.includes(part) && (other !== part || j < i))).join(' ');
  }

  function readCardTitle(card) {
    const candidates = CARD_TITLES.map((selector) => joinDistinct(Array.from(card.querySelectorAll(selector), (el) => el.textContent)));
    const image = card.querySelector('img[alt]');
    if (image) candidates.push(image.getAttribute('alt'));
    const title = candidates.map((text) => text.replace(/\s+/g, ' ').trim()).find((text) => text.length >= CARD_MIN_TITLE);
    return title || '';
  }

  // Das Abzeichen gehört unter den Preis, nie in einen Link hinein.
  function cardAnchor(card, priceEl) {
    const recipe = card.querySelector('[data-cy="price-recipe"]');
    if (recipe) return recipe;
    const priceLink = priceEl.closest('a');
    if (priceLink && priceLink !== card && card.contains(priceLink)) return priceLink.parentElement;
    return priceEl.parentElement;
  }

  function readOfferCards() {
    const offers = [];
    const seen = new Set();
    for (const priceEl of document.querySelectorAll(CARD_PRICE)) {
      if (priceEl.closest(OWN_READER_AREAS) || priceEl.closest(STRIKE)) continue;
      const card = cardOf(priceEl);
      if (!card || seen.has(card.element)) continue;
      seen.add(card.element);
      const title = card.title;
      const price = readPrice(card.element);
      if (!price) continue;
      const link = Array.from(card.element.querySelectorAll('a[href]')).find((a) => asinOfLink(a) === card.asin);
      offers.push({
        key: 'card:' + card.asin + ':' + offers.length,
        asin: card.asin,
        element: card.element,
        anchor: cardAnchor(card.element, priceEl),
        title,
        text: title,
        price,
        amazonUnitPriceText: readAmazonUnitPrice(card.element),
        url: absoluteUrl(link ? link.getAttribute('href') : '/dp/' + card.asin)
      });
    }
    return offers;
  }

  function readProductTitle() {
    const title = document.querySelector('#productTitle');
    return title ? title.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function readMainOffer() {
    const title = readProductTitle();
    const priceBox = firstMatch(MAIN_PRICE_BOXES);
    if (!title || !priceBox) return [];
    const asinInput = document.querySelector('#ASIN, input[name="ASIN"]');
    return [{
      key: 'product:main',
      asin: asinInput ? asinInput.value : null,
      element: priceBox,
      anchor: priceBox,
      title,
      text: title,
      price: readPrice(priceBox),
      amazonUnitPriceText: readAmazonUnitPrice(priceBox),
      url: location.href
    }];
  }

  // Variantenkacheln (Größe, Kapazität): Bezeichnung trägt die Menge.
  function readVariantSwatches() {
    const title = readProductTitle();
    const offers = [];
    const swatches = document.querySelectorAll(
      '#twister_feature_div li[data-asin], #twister li[data-asin], #twister li[data-defaultasin]'
    );
    for (const swatch of swatches) {
      const labelEl = swatch.querySelector('.swatch-title-text-display, .swatch-title-text, .twisterTextDiv, .a-button-text');
      const label = labelEl ? labelEl.textContent.replace(/\s+/g, ' ').trim() : '';
      const asin = swatch.dataset.asin || swatch.dataset.defaultasin;
      if (!label || !asin) continue;
      offers.push({
        key: 'swatch:' + asin + ':' + label,
        asin,
        element: swatch,
        anchor: swatch.querySelector('.text-swatch-container, .a-button-inner') || swatch,
        title: label + ' - ' + title,
        text: label,
        context: title,
        price: readPrice(swatch) || parseMoney(swatch.textContent),
        amazonUnitPriceText: null,
        url: absoluteUrl('/dp/' + asin),
        compact: true
      });
    }
    return offers;
  }

  function isProductPage() {
    return Boolean(document.querySelector('#productTitle'));
  }

  /** Alle Angebote der Seite: Produkt mit Varianten oder Suchtreffer, dazu jede weitere Angebotskarte. */
  function readOffers() {
    const page = isProductPage() ? readMainOffer().concat(readVariantSwatches()) : readSearchResults();
    return page.concat(readOfferCards());
  }

  ns.amazonDom = { readOffers };
})(globalThis);
