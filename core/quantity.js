/*
 * Mengenerkennung aus Produkttexten (Titel, Variantenbezeichnung).
 * Reiner Rechenkern ohne DOM: liefert die Gesamtmenge eines Angebots in der
 * Basiseinheit seiner Dimension (Speicher in TB, Waschladungen, Portionen, Volumen in l,
 * Masse in kg, Anzahl in Stück).
 */
(function (root) {
  'use strict';

  const ns = (root.Einheitspreis = root.Einheitspreis || {});

  // Reihenfolge = Vorrang, wenn ein Text mehrere Dimensionen nennt. Gewicht vor Volumen: steht beides da, ist das
  // Volumen meist Ausbeute oder Gefäß ("CO2-Zylinder 425g/60l", "Butangas 500g, 899 ml", "14kg Gasflasche 24,4l").
  const DIMENSION_ORDER = ['storage', 'load', 'portion', 'mass', 'volume', 'count'];

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

  const COUNT_LABEL = 'Stück';

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

  // Menge: Zahl, Einheit (auch "256-GB-Karte"), danach kein Buchstabe und keine Rate.
  const QUANTITY_RE = new RegExp(
    QUANTITY_START + NUMBER + '(?:\\s|-)?(' + UNIT_ALTERNATION + ')(?![\\p{L}\\d])(?!' + RATE_SUFFIX + ')',
    'giu'
  );

  // Vor der Menge: Faktoren wie "2 x", "6x", "6 x 12 x".
  const MULTIPLIER_BEFORE_RE = /((?:\d{1,3}\s*[x×]\s*)+)$/i;

  // Mengen nach diesen Wörtern sind Grenzwerte, keine Inhalte ("bis zu 24 TB").
  const LIMIT_CONTEXT_RE = /(?:bis(?:\s+zu)?|max\.?|maximal|unterstützt|kompatibel(?:\s+mit)?|up\s+to|supports?)\s*$/i;

  // Gewicht und Volumen nach "für" sind Ausbeute oder Passform, kein Inhalt ("für 60 L Wasser",
  // "Regler für 5 kg und 11 kg Flaschen", "Für DE/AT 5- & 11kg-Flaschen"). Waschladungen ("für 40 Wäschen") sind
  // dagegen Inhalt, ebenso "für Katzen 4 kg": dazwischen stehen nur Zahlen, Bindewörter und Länderkürzel.
  const FOR_CONTEXT_RE = /(?<!\p{L})[Ff]ür(?:\s*(?:\d[\d.,]*\s*\p{L}{0,6}\.?|\p{Lu}{2,3}(?:\/\p{Lu}{2,3})*(?!\p{L})|und|oder|&|\/|,|-))*\s*$/u;
  const FOR_CONTEXT_DIMENSIONS = new Set(['mass', 'volume']);

  // Arbeitsspeicher eines Geräts ist kein Speicherplatz ("8GB DDR4", "16 GB RAM", "RAM: 8 GB").
  const MEMORY_AFTER_RE = /^\s*(?:(?:LP)?DDR\d|S?D?RAM\b|Arbeitsspeicher|Hauptspeicher)/i;
  const MEMORY_BEFORE_RE = /(?:\bRAM|Arbeitsspeicher|Hauptspeicher)\s*:?\s*$/i;

  // "8 Stück" als Packungsgröße: nur bei Speicher, Gewicht und Volumen, nicht als Schätzung ("ca. 500 Stück")
  // und nicht bei Portionsware, deren Stückzahl dieselbe Menge zählt ("10 kg Spülmaschinentabs, 500 Stück").
  const PIECE_PACK_RE = /(?<!ca\.?\s*)(?:^|[\s(,–-])(\d{1,3})\s*(?:Stück|Stk\.?)(?!\p{L})/iu;
  const PIECE_PACK_DIMENSIONS = new Set(['storage', 'mass', 'volume']);
  // Eine Spanne von Stückzahlen ("4 bis 28 Stück") nennt Varianten: welche der Preis meint, steht nicht da.
  const PIECE_RANGE_RE = /\b\d{1,3}\s*(?:bis|-|–)\s*\d{1,3}\s*(?:Stück|Stk\.?)(?!\p{L})/iu;
  const PORTION_WORD_RE = /tabs|tabletten|kapseln|caps\b|pods|pads/i;

  // Packungsgröße irgendwo im Text.
  const PACK_RES = [
    /\b(\d{1,3})\s*er[\s-]*(?:Pack|Set|Packung|Vorteilspack)/i,
    /\bPackung\s+mit\s+(\d{1,3})\b/i,
    /\b(\d{1,3})[\s-]*(?:Pack|Pck\.?)\b/i,
    /\bPack\s+of\s+(\d{1,3})\b/i,
    /\b(\d{1,3})\s+(?:Flaschen|Dosen|Packungen|Kanister|Beuteln?|Portionsbeuteln?|Gläser|Karten)\b/i,
    // "100 x Wattestäbchen", "28 x MaXimum", aber nicht Anschlüsse wie "2 × M.2" oder "4 x HDMI":
    // ein Wort aus mindestens drei Buchstaben mit einem Kleinbuchstaben.
    /(?:^|[\s(,])(\d{1,3})\s*[x×X]\s+(?=\p{L}{3})\p{L}*\p{Ll}/u,
    // Stückzahl in Klammern am Ende des Titels: "... Notfälle (28)", "... & mehr (28 x)"
    /\((\d{1,3})\s*[x×]?\)\s*$/,
    // "28 Premium Gaskartuschen", "6 Zylinder": Behälter im Plural, davor höchstens ein Wort;
    // nie eine Menge mit Einheit ("227 Gramm Gaskartuschen").
    new RegExp('\\b(\\d{1,3})(?!\\s?(?:' + UNIT_ALTERNATION + ')(?![\\p{L}\\d]))\\s*(?:[x×]\\s*)?\\s(?:[\\p{L}\\d-]+\\s+)?' +
      '(?:Gaskartuschen|Kartuschen|Zylinder|Patronen|Gasflaschen|Druckgasdosen)\\b', 'iu'),
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

  function findPiecePack(text, dimension) {
    if (!PIECE_PACK_DIMENSIONS.has(dimension) || PORTION_WORD_RE.test(text) || PIECE_RANGE_RE.test(text)) return 1;
    const match = text.match(PIECE_PACK_RE);
    return match ? Number(match[1]) : 1;
  }

  function isMemory(prefix, rest) {
    return MEMORY_BEFORE_RE.test(prefix) || MEMORY_AFTER_RE.test(rest.slice(0, 24));
  }

  /** Alle Mengenangaben im Text, je mit Gesamtmenge (Faktor "2 x" eingerechnet). */
  function findQuantities(text) {
    const found = [];
    for (const match of text.matchAll(QUANTITY_RE)) {
      const unit = lookupUnit(match[2]);
      if (!unit) continue;
      const prefix = text.slice(Math.max(0, match.index - 24), match.index);
      if (LIMIT_CONTEXT_RE.test(prefix)) continue;
      if (FOR_CONTEXT_DIMENSIONS.has(unit.dimension) && FOR_CONTEXT_RE.test(prefix)) continue;
      if (unit.dimension === 'storage' && isMemory(prefix, text.slice(match.index + match[0].length))) continue;
      const value = parseNumber(match[1], COUNTED_DIMENSIONS.has(unit.dimension) ? 0 : unit.factor);
      if (!Number.isFinite(value) || value <= 0) continue;
      const multiplierMatch = prefix.match(MULTIPLIER_BEFORE_RE);
      const multiplier = multiplierOf(multiplierMatch && multiplierMatch[1]);
      found.push({
        dimension: unit.dimension,
        amount: value * unit.factor,
        multiplier,
        text: match[0],
        start: match.index,
        end: match.index + match[0].length
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
    if (chosen.multiplier > 1 || chosen.dimension === 'count') return 1;
    const pack = Math.max(findPackSize(text), findPiecePack(text, chosen.dimension));
    if (pack === 1) return 1;
    const total = chosen.amount;
    const alreadySum = candidates.some((c) => c !== chosen && Math.abs(c.amount * c.multiplier * pack - total) < total * 0.01);
    return alreadySum ? 1 : pack;
  }

  // "12x 600ml (338g)": die Angabe in Klammern beschreibt dasselbe Einzelstück und erbt dessen Faktor.
  function withNeighbourMultiplier(text, chosen, all) {
    if (chosen.multiplier > 1) return chosen;
    const neighbour = all.find((q) => q.multiplier > 1 && q.end <= chosen.start && /^\s*\(\s*$/.test(text.slice(q.end, chosen.start)));
    return neighbour ? Object.assign({}, chosen, { multiplier: neighbour.multiplier }) : chosen;
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
      const best = candidates.reduce((a, b) => (b.amount * b.multiplier > a.amount * a.multiplier ? b : a));
      const chosen = withNeighbourMultiplier(normalized, best, all);
      const pack = packFactor(normalized, chosen, candidates);
      const items = chosen.multiplier * pack;
      return {
        dimension,
        amount: chosen.amount * items,
        perItem: chosen.amount,
        items,
        text: chosen.text,
        // Stückzahl offen: der Titel nennt eine Spanne von Varianten
        countUncertain: items === 1 && PIECE_RANGE_RE.test(normalized)
      };
    }
    const pack = findPackSize(normalized);
    if (pack > 1) {
      return { dimension: 'count', amount: pack, perItem: pack, items: 1, text: pack + ' ' + COUNT_LABEL };
    }
    return null;
  }

  ns.quantity = { parseQuantity, parseNumber, lookupUnit, DIMENSION_ORDER };
})(typeof globalThis !== 'undefined' ? globalThis : this);

if (typeof module !== 'undefined') module.exports = globalThis.Einheitspreis.quantity;
