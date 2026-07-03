# Charakterisierungstests — Vorschlag (Artefakt B des Audits)

**Zweck:** Bevor die in [`OPTIMIZATION_PLAN.md`](./OPTIMIZATION_PLAN.md) beschriebenen Berechnungsfehler korrigiert werden, sollen Tests das **Ist-Verhalten** der zentralen Berechnungen festhalten — inklusive der bekannten Fehler. Jede Korrektur wird dann als bewusste, dokumentierte Änderung einer Testerwartung sichtbar und ist damit nachweisbar.

**Vorgehen:**
1. Tests schreiben, die das heutige Verhalten pinnen. Wo das gepinnte Verhalten bekannt falsch ist, wird die Erwartung mit einem Kommentar markiert: `// ISTZUSTAND — bekannt falsch, siehe OPTIMIZATION_PLAN.md R-xx`.
2. Suite grün machen (setzt T-01 voraus: stale Tests fixen, Resend lazy, env-Tests skippen).
3. Fix umsetzen → genau die markierten Erwartungen ändern sich → im Diff ist Alt- und Neuwert dokumentiert.
4. Nach Abschluss der Fixes werden die Charakterisierungstests zu regulären Regressionstests (Marker-Kommentare entfernen).

**Wichtig:** Die fünf bestehenden «Scheintest»-Dateien (`__tests__/portfolioPerformance.test.ts`, `currencyConversion.test.ts`, `portfolioWeightDistribution.test.ts`, `realizedGainsAndCosts.test.ts`, `editPosition.test.ts`) testen Kopien/Mocks statt Produktionscode und bieten **keinen** Schutz — sie werden durch die folgenden Tests ersetzt. `server/irrCalculator.ts` ist toter Code (0 Importer) und wird **nicht** getestet, sondern gelöscht (D-04).

---

## Zu pinnende Funktionen

| # | Funktion | Datei | Was sie rechnet | Deckt Plan-IDs |
|---|----------|-------|-----------------|----------------|
| CT-1 | `calculatePerformanceMetrics` + `buildValuePoints` | `server/performanceCalculations.ts:262 / :341` | Legacy-TWR/MWR, investiertes Kapital, Fees | R-01, R-02, R-04, R-05, R-15, R-16 |
| CT-2 | `calculateTTWROR` | `server/lib/performanceEngine.ts:107` | Tägliche TTWROR inkl. Flow-Klassifikation und ±50-%-Cap | R-01, R-08 |
| CT-3 | `calculateIRR` (+ `bisectionIRR`) | `server/lib/performanceEngine.ts:227 / :348` | Newton-Raphson-IRR mit Bisektion-Fallback | R-16, R-25 |
| CT-4 | `calculatePortfolioPerformance` + `buildDailyValuations` + `buildCashTimeline` + `buildHoldingsTimeline` | `server/lib/performanceService.ts` / `performanceEngine.ts:488/600` | End-to-End-Pipeline: Preise → CHF → Tagesbewertungen → TTWROR/IRR | R-01, R-02, R-11, R-20 |
| CT-5 | Verkaufs-Zweig von `createPortfolioTransaction` (Realized-Gains-Berechnung) | `server/db.ts:880–986` | Realisierter Gewinn, FX-Split, Kostenbasis — **höchster Geld-Impact** | R-03, R-19, R-24 |
| CT-6 | `calculateHoldingsPerformance` | `server/performanceCalculations.ts:189` | Kostenbasis / unrealisierte Gewinne inkl. Oversell-Randfall | R-02, R-20, R-27 |
| CT-7 | `getFxRate` / `getFxRateSync` / `convertToCHF` | `server/fxHelper.ts:46/163/179/199` | FX-Lookup inkl. Rückwärtssuche und 1.0-Fallback | R-10 |
| CT-8 | `getRealTwrSeriesFromTransactions` + `stitchSeries` | `server/performanceHypothetical.ts:286 / :525` | Chart-TWR inkl. Smoothing/Forward-Fill (erst pinnen, dann Smoothing entfernen) | R-08 |
| CT-9 | `calculateYTDPerformance` (+ `generateFallbackPerformance`) | `server/ytd-performance.ts:183 / :283` | YTD-Serie (hartkodiertes Jahr, statische Gewichte, Fake-Fallback) | R-09, R-18, R-08 |
| CT-10 | Inline-Berechnung in `annualPerformanceRouter.getSummary` | `server/routers/annualPerformanceRouter.ts:11–241` | Jahresreport (Einlagen/Cash/Dividenden/ROI) — **vorher als pure Function extrahieren**, sonst nicht testbar | R-01, R-15, R-17 |
| CT-11 | `parseSwissquotePDF` (bzw. Hauptexport) | `server/lib/swissquoteParser.ts` | Bank-PDF-Parsing (Fixture-basiert: echte anonymisierte Swissquote-Auszüge) | R-13, A-05 |
| CT-12 | Holdings-Aufbau des Dashboard-Charts | `server/routers/dashboardPerformanceRouter.ts:150–250` (als Function extrahieren) | Tageswertserie des Dashboards (DESC/`break`-Bug, fehlende Flows) | R-06, R-07 |
| CT-13 | Tagesveränderungs-Berechnung in `getAggregatedMetrics` | `server/routers/dashboardRouter.ts:39–82, 137–250, 363–364` (als Function extrahieren) | «Heute vs. Gestern»-Wert inkl. asymmetrischem Skipping und FX-Mix | R-29 |
| CT-14 | YTD-Berechnung des Preis-Updaters | `server/priceUpdater.ts:90–93` + `server/cron/ytdUpdater.ts:40–75` | `ytdPerformance` aus `ytdStartPrice` (roher Dez-31-Close) | R-30, R-09 |
| CT-15 | `calcDCF` | `server/analytics/engine.ts:883–997` | Fair Value / Über-/Unterbewertung (WACC-Floor, Spread-Floor, Caps) | R-32 |
| CT-16 | `optimizeWeights` + `buildEfficientFrontier` | `server/analytics/engine.ts:334–466` | Gewichts-Bounds inkl. Infeasibility bei < 10 Titeln; Frontier ohne Constraints | R-34 |

Ergänzend (kein Geld, aber angrenzend): `calculateStockScore` (`server/scoring.ts`) hat erst 3 Tests — auf Schwellen-Randfälle erweitern (R-26).

---

## Pflicht-Szenarien pro Test

Diese Szenarien decken gezielt die im Audit gefundenen Fehlerklassen ab. Jedes Szenario mit deterministischen Fixture-Daten (feste Kurse, feste FX-Raten, feste Daten — keine DB, keine Live-APIs; DB-Zugriffe der Funktionen über die vorhandenen Batch-Loader-Signaturen mit In-Memory-Fixtures bedienen).

1. **Nur-Kauf-Portfolio, eine Position, keine FX** — Basisfall; alle Engines müssen denselben Wert liefern (heute nicht der Fall → Diff dokumentieren).
2. **Auszahlung CHF 10'000** (negativ gespeichert, wie `TransactionModal` es tut) — pinnt den Vorzeichenfehler in allen vier Konsumenten (R-01): erwartete Ist-Werte je Engine festhalten.
3. **Kauf mit Fees, einmal «manuell» (Fees in `totalAmountCHF`), einmal «CSV» (ohne)** — pinnt die pfadabhängige Kostenbasis (R-02).
4. **Mehrfach-Verkauf:** Kauf 100@10 → Verkauf 100@20 → Kauf 100@30 → Verkauf 100@30 — pinnt den Phantomgewinn +1'000 (R-03); nach dem Fix muss hier 0 stehen.
5. **Dividende CHF 100** auf gehaltene Position — pinnt die TWR-/MWR-Bestrafung in `performanceCalculations` (R-05) und das korrekte Verhalten der `performanceEngine` (Kontrast beider Engines im selben Test).
6. **USD-Position ohne FX-Rate am Stichtag** — pinnt den 1.0-Fallback (R-10): Bewertung == Lokalwährungswert.
7. **USD-Position mit FX-Rate** — Konversion zum Transaktions- vs. Bewertungsdatum (R-12/R-15).
8. **Kurs bewegt sich zwischen zwei Stichtagen** — pinnt R-04: `buildValuePoints` liefert für den vergangenen Stichtag den heutigen Kurs (Ist), `performanceService` den historischen (Soll).
9. **Leeres Portfolio / Portfolio mit einer einzigen Position / Division-durch-null-Pfade** — NaN/Infinity dürfen nirgends entstehen.
10. **Oversell:** Verkauf 150 bei Bestand 100 — pinnt negative Kostenbasis (R-20).
11. **Split-Szenario:** Kurshalbierung über Nacht bei 2:1-Split (Fixture mit `close` ≠ `adjustedClose`) — pinnt R-11 (falsche Bewertung) und R-08 (Forward-Fill verwirft den Sprung).
12. **Zeitzonen-Grenze:** Transaktion 2026-01-01T00:30+01:00 — pinnt die UTC-Bucketierung auf den 31.12. (R-17); Jahresreport-Stichtag 1.1./31.12.
13. **Crash-Tag −20 %** — pinnt das ±15-%-Smoothing in `performanceHypothetical` (R-08): Ist-Serie zeigt −15 %.
14. **YTD über den Jahreswechsel** — pinnt das hartkodierte `2025-01-01` (R-09).
15. **Verkauf mit zwei früheren Käufen zu unterschiedlichen FX-Kursen** — pinnt den FX-Split mit Erstkauf-Datum (R-19) und `netProfit`-Fee-Doppelabzug.
16. **Transaktionsreihenfolge DESC vs. ASC** als Input — pinnt R-06 (`break`-Bug) und die Sortier-Abhängigkeit von `calculateHoldingsPerformance`.
17. **Tagesveränderung mit einem Titel ohne Preishistorie** (hat `currentPrice`, aber keine `historicalPrices`-Zeile) — pinnt R-29: der komplette Positionswert erscheint heute als Tagesgewinn.
18. **YTD über einen Spin-off** (Fixture: Kurs −50 % am Ex-Tag, `adjustedClose` korrekt, `ytdStartPrice` = roher Dez-31-Close) — pinnt R-30 (Holcim-Fall): `ytdPerformance` ≈ −50 % statt real positiv.
19. **DCF-Referenzfall** (stabiler CHF-Titel: FCF-Yield 5 %, Wachstum 4 %, Beta 0.8) — pinnt R-32: Fair Value unter Kurs trotz konservativer Inputs (WACC-Floor 8 % greift).

## Organisation

- Ablage als `server/__characterization__/*.char.test.ts`, eigenes Vitest-Projekt/Include, damit sie getrennt vom regulären `pnpm test` lauffähig und berichtbar sind (z. B. `pnpm test:char`).
- Ein gemeinsames Fixture-Modul (`__characterization__/fixtures.ts`) mit den Szenarien 1–16, damit **alle Engines gegen dieselben Daten** laufen — das macht die heutigen Diskrepanzen zwischen den drei Engines als Tabelle sichtbar (nützlich für den Konsolidierungsentscheid D-01).
- Snapshot-Assertions (`toMatchInlineSnapshot`) für Serien/Strukturen, exakte `toBeCloseTo`-Assertions (Toleranz max. 1e-9 — Float-Ist-Zustand) für Einzelwerte.
- CT-10 und CT-12 erfordern vorab eine minimale, verhaltensneutrale Extraktion der Inline-Logik in exportierte Funktionen (reines Verschieben, kein Fix) — das ist die einzige zulässige Codeänderung vor dem Pinnen.
