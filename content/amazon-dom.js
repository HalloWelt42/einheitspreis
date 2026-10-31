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
  // Empfehlungskacheln (etwa "Weiter einkaufen", Bestseller) und die Karte des zuletzt angesehenen Artikels.
  // Amazons Klassennamen sind dort verschlüsselt, lesbar bleibt nur ihr Mittelteil, daher [class*=...].
  const RECOMMENDATION_CARDS = [
    '.p13n-intuition-product-faceout__top-container[data-asin]:not([data-asin=""])',
    '[class*="singleProductDetails"]'
  ].join(', ');
  const CARD_TITLE = '[class*="_title"]';
  const ASIN_IN_URL = /\/dp\/([A-Z0-9]{10})/;
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
    return null;
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
    return null;
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

  function readCardTitle(card) {
    const parts = Array.from(card.querySelectorAll(CARD_TITLE)).map((el) => el.textContent.trim()).filter(Boolean);
    const image = card.querySelector('img[alt]');
    const title = parts.length ? parts.join(' ') : (image ? image.getAttribute('alt') : '');
    return title.replace(/\s+/g, ' ').trim();
  }

  function readRecommendationCards() {
    const offers = [];
    document.querySelectorAll(RECOMMENDATION_CARDS).forEach((card, index) => {
      const priceEl = card.querySelector('.a-price:not(.a-text-price)');
      const link = card.querySelector('a[href*="/dp/"]');
      const href = link ? link.getAttribute('href') : '';
      const asin = card.dataset.asin || (href.match(ASIN_IN_URL) || [])[1];
      const title = readCardTitle(card);
      if (!priceEl || !asin || !title) return;
      // Der Preis steht in einem Link; das Abzeichen kommt daneben, nicht in den Link.
      const priceLink = priceEl.closest('a');
      offers.push({
        key: 'card:' + asin + ':' + index,
        asin,
        element: card,
        anchor: priceLink && card.contains(priceLink.parentElement) ? priceLink.parentElement : card,
        title,
        text: title,
        price: readPrice(card),
        amazonUnitPriceText: readAmazonUnitPrice(card),
        url: href ? absoluteUrl(href) : absoluteUrl('/dp/' + asin)
      });
    });
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

  /** Alle Angebote der aktuellen Seite: Produkt mit Varianten, sonst Suchtreffer und Empfehlungskacheln. */
  function readOffers() {
    if (isProductPage()) return readMainOffer().concat(readVariantSwatches());
    return readSearchResults().concat(readRecommendationCards());
  }

  ns.amazonDom = { readOffers };
})(globalThis);
