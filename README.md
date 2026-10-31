# Einheitspreis

Browser-Erweiterung für Amazon: zeigt an jedem Angebot den Preis pro Einheit und sortiert die Angebote einer Seite danach.

- **Speicher**: Preis pro TB oder GB (umschaltbar), auch für Größenkacheln auf der Produktseite
- **Waschmittel**: Preis pro Waschladung
- **Tabs, Kapseln, Pods**: Preis pro Stück
- **Lebensmittel und Flüssiges**: Preis pro Liter oder Kilogramm, bevorzugt Amazons eigener Grundpreis
- **Vergleichsliste**: schwebender Knopf unten rechts, günstigster Einheitspreis zuerst, Klick springt zum Angebot

Jedes Abzeichen nennt die erkannte Menge (etwa "5 x 32 GB"), damit jede Zahl nachprüfbar ist. Farben: grün = günstigster, hellgrün bis 15 % teurer, gelb bis 40 %, rot darüber, blau = einziges Angebot dieser Einheit.

## In Brave einbinden

1. `brave://extensions` öffnen
2. Oben rechts **Entwicklermodus** einschalten
3. **Entpackte Erweiterung laden** und diesen Ordner wählen (der mit `manifest.json`)
4. Amazon-Seite neu laden

Nach Änderungen am Code auf der Erweiterungsseite das Neuladen-Symbol der Erweiterung drücken und die Amazon-Seite neu laden.

## Erkennung

Der Rechenkern (`core/`) ist frei von Browser-Schnittstellen und liest die Menge aus Titel oder Variantenbezeichnung:

| Quelle | Vorrang |
|---|---|
| Speicher (TB/GB), Waschladungen, Tabs/Kapseln aus dem Text | 1 |
| Amazons Grundpreis ("12,60 €/l"), außer er lautet nur "€/Stück" | 2 |
| Liter, Kilogramm, Stück aus dem Text | 3 |

Berücksichtigt werden Faktoren ("6 x 1,5 l", "12x0,5l", "6 x 12 x 85g"), Packungen ("3er Pack", "2 Packungen mit 1 kg" ohne Doppelzählung), deutsche und englische Zahlen ("1.000 g", "1,5 l", "1.595 lt."). Verworfen werden Raten und Grenzwerte ("180 TB/Jahr", "7.400 MB/s", "bis zu 24 TB", "256 MB Cache" verliert gegen die Kapazität).

## Aufbau

| Ort | Aufgabe |
|---|---|
| `core/quantity.js` | Menge und Dimension aus Text |
| `core/money.js` | Geldbeträge lesen und schreiben |
| `core/unit-price.js` | Einheitspreis und Quellenvorrang |
| `core/ranking.js` | Rang und Farbstufe je Vergleichsgruppe |
| `content/amazon-dom.js` | einziger Ort, der Amazons Seitenaufbau kennt |
| `content/badge.js`, `content/panel.js` | Abzeichen und Vergleichsliste |
| `content/main.js` | Ablauf, beobachtet nachgeladene Inhalte |
| `content/settings.js` | Einstellungen, ein Speicherschlüssel |

## Entwicklung

```bash
npm install
npm run vendor   # Schrift und Icons nach vendor/ übernehmen
npm test         # Rechenkern gegen echte Amazon-Titel (test/fixtures)
npm run zip      # Paket nach store/
```

Prüfstand ohne Erweiterungsinstallation: eine gespeicherte Amazon-Seite als `test/live/live-<name>.html` ablegen, `node test/build-live.mjs` ausführen und `test/live/live-<name>.ep.html` über einen lokalen Server öffnen.
