# ONON.US – KGV-, PEG- und Timing-Korrektur

**Stichtag:** 26. September 2026  
**Umfang:** ONON.US / On Holding Ltd, Anzeige der Standardkennzahlen, Timing nach manueller Historienladung sowie KI-Briefing.  
**Abgrenzung:** Research und Datenintegrität, **keine persönliche Anlageberatung**. Es wurden keine Portfolio-, Cash-, Ledger-, Transaktions- oder Handelsdaten geändert.

## Kurzfazit

1. **Das im Aktienkopf gezeigte KGV 25,2 war methodisch nicht belastbar.** Es entstand aus einer Selbstrechnung mit **USD-Marktkapitalisierung** und **CHF-Nettogewinn** – zwei Währungen wurden ohne zeitgerechte FX-Umrechnung dividiert.
2. **Die Standard-PEG ist nicht 2,45.** EODHD lieferte am Prüfzeitpunkt **0,4943**; Bloomberg zeigte **0,52**. Die 2,45 ist ein internes, absichtlich vorsichtiges **risiko-adjustiertes PEG für den Bewertungs-Score** und wird nun explizit als nicht mit Bloomberg vergleichbarer Faktor bezeichnet.
3. Nach der Korrektur zeigt die Aktienansicht **KGV 21,2** (EODHD Trailing P/E) und **PEG Ratio (Standard) 0,49**. Das Bloomberg-KGV von 18,94 weicht um rund 12 % ab; die vorgelegten Snapshots nutzen nicht dieselbe EPS-/Stichtagsbasis (Bloomberg EPS TTM 1,31 vs. EODHD EarningsShare 1,41). Daraus folgt **keine zulässige Übernahme** eines fremden Vendorwertes.
4. Die 5J-Historienladung war nicht mit der Watchlistaufnahme gekoppelt. Sie aktualisierte jedoch bislang nur Preise/Risiko; Timing und Signal warteten auf den stündlichen Cachelauf. Jetzt werden Timing und Signal direkt aus der soeben geladenen lokalen EODHD-Reihe berechnet.
5. Das KI-Briefing verwendet nun verbindlich die **Manus Standard-KI**. Perplexity und andere Drittanbieter werden in diesem Pfad nicht als Fallback aufgerufen.

## 1. Belegte Rohdaten

| Kennzahl | EODHD-Rohwert | Bloomberg-Referenz des Nutzers | Einordnung |
|---|---:|---:|---|
| Ticker / Börse | ONON.US / NYSE | ONON.US | Gleiche Handelslinie |
| Handelswährung | USD | USD | Gleich |
| Berichtswährung | CHF | – | EODHD-Earnings und Income Statement in CHF |
| Marktkapitalisierung | USD 10’013,1 Mio. | USD 10’013,1 Mio. | EODHD Rohantwort |
| P/E (Trailing) | **21,2482** | **18,94** | Abweichende Vendor-/EPS-Stichtagsbasis |
| P/E (Forward) | **15,8228** | **17,63** (FY 2026) | Unterschiedliche Forward-Definition/Horizont |
| PEG (Vendor) | **0,4943** | **0,52** | Nahe beieinander |
| EarningsShare | 1,41 | 1,31 | Erklärt einen Teil der KGV-Differenz |

**Rohdatenbeleg:** `docs/audit/workings/ONON_US_PEG_RAW_EVIDENCE_2026-09-26.json`, abgerufen am **2026-09-26T14:18:41.950Z**. Die Rohantwort enthält `General.CurrencyCode = USD`, während jüngste Quartalsabschlüsse `currency_symbol = CHF` ausweisen.

## 2. Warum zuvor KGV 25,2 erschien

Die alte Kontrollrechnung bildete:

> Marktkapitalisierung / TTM-Nettogewinn

Für ONON wurden dabei USD 10,013 Mrd. durch eine in CHF berichtete TTM-Gewinnreihe geteilt. Das Ergebnis 25,15 wirkte numerisch plausibel, war aber **nicht dimensionsgleich** und somit kein valides KGV.

### Korrekturregel

Die Selbstrechnung wird jetzt verworfen, sobald Marktkapitalisierung und Gewinnreihe unterschiedliche deklarierte Währungen tragen und keine zum Stichtag belegte Umrechnung vorliegt. Für ONON gilt damit:

| Wert nach Korrektur | Ergebnis |
|---|---|
| Selbst-KGV | `null` |
| Ausblendgrund | `abweichende Währungsbasis: Marktkapitalisierung USD, Gewinn CHF` |
| Führendes KGV | EODHD Trailing P/E **21,2482** |
| Sichtbar (1 Dezimalstelle) | **21,2** |

Es wird **keine** kurs-, FX- oder Ergebnisreihe geschätzt oder nachträglich überschrieben.

## 3. Warum 2,45 statt 0,49 angezeigt wurde

Die Werte hatten unterschiedliche Bedeutungen, wurden aber im UI zu ähnlich benannt:

| Kennzahl | Wert | Definition |
|---|---:|---|
| Standard-/Vendor-PEG | **0,4943** | `Highlights.PEGRatio` von EODHD; mit Bloomberg-PEG vergleichbar |
| Eigener TTM-PEG-Plausibilitätswert | **1,4383** | 21,2 Trailing P/E / 14,8 % TTM-EPS-Wachstum |
| Risiko-adjustiertes PEG | **2,4503** | Eigener TTM-PEG × 2,00 Volatilitätsaufschlag / 1,17 Qualitätsmultiplikator |

Der interne Faktor ist ein konservativer **Score-Eingang**, kein Datenvendor-PEG. Er bleibt für den Bewertungswächter bestehen, weil er Gewinnvolatilität und Qualität berücksichtigen soll. Eine Änderung seiner Gewichtung wäre eine **Modelländerung** und erfordert separat eine vorab definierte A/B-Backtest-Entscheidung; sie wurde hier bewusst nicht vorgenommen.

### UI-Korrektur

- Kennzahlenkarte: **„PEG Ratio (Standard)“**, Anzeige EODHD **0,49**.
- Tooltip: EODHD-/Forward-PEG und separater interner Risiko-Faktor.
- Bewertungsdialog: **„PEG (Risiko-adjustiert, nicht Standard-PEG)“** und explizite Bloomberg-/FactSet-Abgrenzung.

## 4. Historienladung, Timing und Watchlist

### Festgestellte Ursache

`Historische Daten laden (5J)` importierte additiv lokale EODHD-Preisreihen und aktualisierte Volatilität/Sharpe. Der Drei-Score-Cache wurde erst im regulären Stundenlauf berechnet. Deshalb blieb der Zustand vorübergehend bei „Noch kein Signal“ bzw. „Timing wird berechnet“, obwohl die Daten schon vorhanden waren.

### Korrektur

Nach einer erfolgreichen manuellen Historienladung wird nun rein lokal und ohne weitere Preis-Schreibung berechnet:

- 52-Wochen-Spanne,
- YTD-Trend,
- RSI(14),
- Momentum,
- Blasenfaktor (falls verfügbar),
- Regime,
- Timing und Drei-Score-Signal.

Bei weniger als 60 belastbaren Preiszeilen wird keine Ersatzzahl berechnet; die Datenlücke bleibt sichtbar.

### Dev-Livecheck

ONON.US wurde im Devserver über **„Historische Daten laden (5J)“** geladen:

| Prüfschritt | Ergebnis |
|---|---|
| Timing vorher | keine Zahl / kein Signal |
| Timing nachher | **52/100** |
| Signal nachher | **Stark · 71** |
| Datenbasis | lokale EODHD-Preisreihe |
| Watchliststatus nach dem Klick | `listType = NULL` |
| Portfolio-/Cash-/Ledger-/Handelsaktion | keine |

Die Buttons sind serverseitig getrennt. Der Watchlist-Button wurde deutlich als **„Zur Watchlist (mit 5J-Daten)“** gekennzeichnet; nur dieser löst explizit eine Watchlistaufnahme aus.

## 5. KI-Briefing ohne Perplexity

Die gespeicherte Modellkonfiguration wurde auf Manus Standard-KI vereinheitlicht:

```json
{
  "ensemble": false,
  "analysis": "gemini",
  "challengerB": "gemini",
  "synthesis": "gemini",
  "text": "gemini",
  "autoApply": true
}
```

Zusätzlich erzwingt der Vorschlags-/Briefingpfad den Manus-Forge-Aufruf direkt; ein Drittanbieteranbieter kann nicht mehr über den Fallback gewählt werden. Der Livecheck erzeugte erfolgreich ein neues ONON-Briefing mit den korrigierten sichtbaren Standardkennzahlen.

## 6. Tests und Qualitätsgates

| Gate | Ergebnis |
|---|---|
| Neuer KGV-Regressionsfall: USD-Marktkapitalisierung / CHF-Gewinn | bestanden; Ergebnis bewusst `null` |
| Neuer Timing-Regressionsfall: ausreichende Reihe | bestanden |
| Neuer Timing-Regressionsfall: unter 60 Zeilen | bestanden; explizite Datenlücke |
| Dividenden-Regressionsfälle inkl. Aker BP | bestanden |
| Fokussierte Vitest-Suite | **4 Dateien, 17 Tests bestanden** |
| Vollständige Vitest-Suite | **243 Dateien bestanden, 5 übersprungen; 1’688 Tests bestanden, 11 übersprungen** |
| TypeScript | `pnpm exec tsc --noEmit` bestanden |
| Dev-Livecheck | ONON Standard-PEG 0,49; KGV 21,2; Timing 52; Signal 71; KI-Briefing erfolgreich |

## Weiterer fachlicher Hinweis

Die Bloomberg-Referenz bleibt wertvoll als Gegenprobe. Bei Anzeigeabweichungen müssen jedoch immer **Stichtag, EPS-Definition (TTM/GAAP/adjusted), Währung und Growth-Horizont** nebeneinanderstehen. Ein einzelner PEG- oder P/E-Wert darf nicht automatisch zwischen Datenlieferanten übernommen werden.
