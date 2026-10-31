/*
 * Mengenerkennung aus Produkttexten (Titel, Variantenbezeichnung).
 * Reiner Rechenkern ohne DOM: liefert die Gesamtmenge eines Angebots in der
 * Basiseinheit seiner Dimension (Speicher in TB, Waschladungen, Portionen, Volumen in l,
 * Masse in kg, Anzahl in Stück).
 */
(function (root) {
  'use strict';

  const ns = (root.Einheitspreis = root.Einheitspreis || {});

  // Reihenfolge = Vorrang, wenn ein Text mehrere Dimensionen nennt.
  const DIMENSION_ORDER = ['storage', 'load', 'portion', 'volume', 'mass', 'count'];

  // Einheit -> Dimension und Faktor zur Basiseinheit.
  // anyCase: auch "4tb", "5KG"; einzelne Buchstaben wie "g" nur exakt ("5G" ist kein Gramm).
  const UNITS = [
    { pattern: 'PB|Petabyte', dimension: 'storage', factor: 1000, anyCase: true },
    { pattern: 'TB|Terabyte|TByte', dimension: 'storage', factor: 1, anyCase: true },
    { pattern: 'GB|Gigabyte|GByte', dimension: 'storage', factor: 1e-3, anyCase: true },
    { pattern: 'MB|Megabyte', dimension: 'storage', factor: 1e-6, anyCase: true },
    { pattern: 'To', dimension: 'storage', factor: 1, anyCase: false },
    { pattern: 'Go', dimension: 'storage', factor: 1e-3, anyCase: false },
    { pattern: 'WL|Waschladungen|Waschladung|Wäschen|Waschgänge', dimension: 'load', factor: 1, anyCase: true },
    { pattern: 'ml|Milliliter', dimension: 'volume', factor: 1e-3, anyCase: true },
    { pattern: 'cl|Zentiliter', dimension: 'volume', factor: 1e-2, anyCase: true },
    { pattern: 'dl', dimension: 'volume', factor: 1e-1, anyCase: false },
    { pattern: 'l|L', dimension: 'volume', factor: 1, anyCase: false },
    { pattern: 'Liter|Litre|Ltr\\.?|lt\\.?', dimension: 'volume', factor: 1, anyCase: true },
    { pattern: 'kg|Kilogramm|Kilo', dimension: 'mass', factor: 1, anyCase: true },
    { pattern: 'g|gr\\.?', dimension: 'mass', factor: 1e-3, anyCase: false },
    { pattern: 'Gramm', dimension: 'mass', factor: 1e-3, anyCase: true },
    { pattern: 'Tabs|Tabletten|Kapseln|Caps|Pods|Pads', dimension: 'portion', factor: 1, anyCase: true },
    { pattern: 'Stück|Stk\\.?|St\\.|pcs|pieces?', dimension: 'count', factor: 1, anyCase: true }
  ];

  // Gezählte Dimensionen kennen keine Dezimalzahlen: "1.000 Stück" sind tausend.
  const COUNTED_DIMENSIONS = new Set(['load', 'portion', 'count']);

  // Zahl im deutschen oder englischen Format: 1.000 | 1,5 | 1.5 | 16000
  const NUMBER = '(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)';

  const UNIT_ALTERNATION = UNITS.map((u) => u.pattern).join('|');

  // Nach "/" folgt bei Raten eine Zeit oder Einheit (TB/Jahr, MB/s, mg/kg);
  // "5L/100 Waschladungen" ist dagegen eine Aufzählung und bleibt gültig.
  const RATE_SUFFIX = '\\s*\\/\\s*(?:s|sek|sec|jahr|year|yr|tag|day|h|std|min|kg|g|l|ml|m|qm|m2|m²)(?![\\p{L}\\d])';

  // Davor keine Ziffer und kein Buchstabe, außer dem "x" eines Faktors ("12x0,5l").
  const QUANTITY_START = '(?<!\\d|\\d[.,])(?:(?<=\\d\\s?[x×])|(?<!\\p{L}))';

  // Menge: Zahl, Einheit, danach kein Buchstabe und keine Rate.
  const QUANTITY_RE = new RegExp(
    QUANTITY_START + NUMBER + '\\s?(' + UNIT_ALTERNATION + ')(?![\\p{L}\\d])(?!' + RATE_SUFFIX + ')',
    'giu'
  );

  // Vor der Menge: Faktoren wie "2 x", "6x", "6 x 12 x".
  const MULTIPLIER_BEFORE_RE = /((?:\d{1,3}\s*[x×]\s*)+)$/i;

  // Mengen nach diesen Wörtern sind Grenzwerte, keine Inhalte ("bis zu 24 TB").
  const LIMIT_CONTEXT_RE = /(?:bis(?:\s+zu)?|max\.?|maximal|unterstützt|kompatibel(?:\s+mit)?|up\s+to|supports?)\s*$/i;

  // Packungsgröße irgendwo im Text.
  const PACK_RES = [
    /\b(\d{1,3})\s*er[\s-]*(?:Pack|Set|Packung|Vorteilspack)/i,
    /\bPackung\s+mit\s+(\d{1,3})\b/i,
    /\b(\d{1,3})[\s-]*(?:Pack|Pck\.?)\b/i,
    /\bPack\s+of\s+(\d{1,3})\b/i,
    /\b(\d{1,3})\s+(?:Flaschen|Dosen|Packungen|Kanister|Beuteln?|Portionsbeuteln?|Gläser|Karten)\b/i,
    /(?:^|[\s(,])(\d{1,3})\s*[x×]\s+\p{L}/iu,
    /\b(\d{1,3})er(?![\s-]*Jahre)\b/i
  ];

  const UNIT_LOOKUP = UNITS.map((u) => ({
    re: new RegExp('^(?:' + u.pattern + ')$', 'u'),
    reInsensitive: u.anyCase ? new RegExp('^(?:' + u.pattern + ')$', 'iu') : null,
    dimension: u.dimension,
    factor: u.factor
  }));

  // "1.000 g" hat einen Tausenderpunkt, "1.595 l" einen Dezimalpunkt: bei großen
  // Einheiten (l, kg, TB) ist eine Tausenderzahl unwahrscheinlich.
  function parseNumber(text, unitFactor) {
    if (text.includes(',')) {
      return Number(text.replace(/\./g, '').replace(',', '.'));
    }
    if (/^\d{1,3}(?:\.\d{3})+$/.test(text) && !(unitFactor >= 1 && /^\d{1,3}\.\d{3}$/.test(text))) {
      return Number(text.replace(/\./g, ''));
    }
    return Number(text);
  }

  function multiplierOf(chain) {
    if (!chain) return 1;
    return chain.match(/\d+/g).reduce((product, n) => product * Number(n), 1);
  }

  function lookupUnit(token) {
    const exact = UNIT_LOOKUP.find((u) => u.re.test(token));
    return exact || UNIT_LOOKUP.find((u) => u.reInsensitive && u.reInsensitive.test(token)) || null;
  }

  function findPackSize(text) {
    for (const re of PACK_RES) {
      const match = text.match(re);
      if (match) {
        const size = Number(match[1]);
        if (size > 1) return size;
      }
    }
    return 1;
  }

  /** Alle Mengenangaben im Text, je mit Gesamtmenge (Faktor "2 x" eingerechnet). */
  function findQuantities(text) {
    const found = [];
    for (const match of text.matchAll(QUANTITY_RE)) {
      const unit = lookupUnit(match[2]);
      if (!unit) continue;
      const prefix = text.slice(Math.max(0, match.index - 24), match.index);
      if (LIMIT_CONTEXT_RE.test(prefix)) continue;
      const value = parseNumber(match[1], COUNTED_DIMENSIONS.has(unit.dimension) ? 0 : unit.factor);
      if (!Number.isFinite(value) || value <= 0) continue;
      const multiplierMatch = prefix.match(MULTIPLIER_BEFORE_RE);
      const multiplier = multiplierOf(multiplierMatch && multiplierMatch[1]);
      found.push({
        dimension: unit.dimension,
        amount: value * unit.factor,
        multiplier,
        text: match[0]
      });
    }
    return found;
  }

  /**
   * Packungsgröße, die noch auf die gewählte Menge wirkt. Keine, wenn die Menge
   * schon einen Faktor trägt ("6 x 1,5 l") oder schon die Summe ist
   * ("2 kg (2 Packungen mit 1 kg)").
   */
  function packFactor(text, chosen, candidates) {
    if (chosen.multiplier > 1) return 1;
    const pack = findPackSize(text);
    if (pack === 1) return 1;
    const total = chosen.amount;
    const alreadySum = candidates.some((c) => c !== chosen && Math.abs(c.amount * c.multiplier * pack - total) < total * 0.01);
    return alreadySum ? 1 : pack;
  }

  /**
   * Gesamtmenge eines Angebots oder null.
   * Je Dimension gilt die größte Angabe: Kapazität schlägt Cache,
   * "1000 ml (3 x 1,0 l)" ergibt 3 l.
   * Eine Packungsgröße ("3er Pack") wirkt nur, wenn kein "N x" dasteht.
   */
  function parseQuantity(text) {
    if (!text) return null;
    const normalized = text.replace(/ /g, ' ');
    const all = findQuantities(normalized);
    for (const dimension of DIMENSION_ORDER) {
      const candidates = all.filter((q) => q.dimension === dimension);
      if (candidates.length === 0) continue;
      const chosen = candidates.reduce((a, b) => (b.amount * b.multiplier > a.amount * a.multiplier ? b : a));
      const pack = packFactor(normalized, chosen, candidates);
      return {
        dimension,
        amount: chosen.amount * chosen.multiplier * pack,
        perItem: chosen.amount,
        items: chosen.multiplier * pack,
        text: chosen.text
      };
    }
    const pack = findPackSize(normalized);
    if (pack > 1) {
      return { dimension: 'count', amount: pack, perItem: 1, items: pack, text: pack + 'er' };
    }
    return null;
  }

  ns.quantity = { parseQuantity, parseNumber, lookupUnit, DIMENSION_ORDER };
})(typeof globalThis !== 'undefined' ? globalThis : this);

if (typeof module !== 'undefined') module.exports = globalThis.Einheitspreis.quantity;
