# Optimierungsplan Portfoliomanager

**Stand:** 2026-07-03 (Rev. 2 — inkl. Kundenbefunde aus der Fachprüfung, siehe Abschnitt 8) · **Basis:** Vollständiges Read-only-Audit des Repos (Branch `main`, Commit `ed96859`)
**Methodik:** Sechs parallele Tiefenanalysen (Berechnungen, Doppelspurigkeiten, Design/UI, User Flows, Architektur/Fehlerbehandlung, Compliance/Tests); alle als KRITISCH eingestuften Befunde wurden zusätzlich direkt im Code verifiziert. Die vom Auftraggeber gemeldeten Punkte (Dokumente «Überarbeitung Portfoliomanager» Teil 1–4) wurden gegen den Code verifiziert und sind in Abschnitt 8 gemappt. In dieser Phase wurde **kein Produktivcode geändert**.

**Aufwandsskala:** S = < 2 h · M = 0.5–2 Tage · L = > 2 Tage

**Begleitartefakt:** [`CHARACTERIZATION_TESTS.md`](./CHARACTERIZATION_TESTS.md) — Vorschlag für Charakterisierungstests, die **vor** jeder Berechnungskorrektur das Ist-Verhalten festhalten (Artefakt B des Audits).

---

## Gesamtbild (Executive Summary)

Die Anwendung ist funktional breit, aber in vier Dimensionen strukturell gefährdet:

1. **Die Zahlen stimmen nicht zuverlässig.** Es gibt keine Decimal-Arithmetik im ganzen Repo (Verstoss gegen die verbindliche CLAUDE.md-Vorgabe), Geldspalten sind `varchar(50)`, und es existieren **drei parallele, sich widersprechende Performance-Engines**. Dazu kommen ein systemischer Vorzeichenfehler bei Auszahlungen, eine Kostenbasis-Berechnung, die frühere Verkäufe ignoriert (Phantomgewinne), eine historische Bewertung mit *heutigen* Kursen und ein stiller FX-Fallback auf 1.0.
2. **Sicherheit/Compliance:** `admin.importData` kann von **jedem eingeloggten Nutzer** aufgerufen werden und **löscht die globalen Tabellen** `stocks`/`research`/`transactions`; zwei Debug-Endpoints sind unauthentifiziert produktiv erreichbar; ein FMP-API-Key ist im Repo committet; Portfolio- und Chatdaten fliessen an ein LLM-Gateway, ohne dass die (ohnehin nur als Platzhalter existierende) Datenschutzerklärung dies erwähnt (revDSG Art. 16/19).
3. **Massive Doppelspurigkeit:** ~22'000 Zeilen toter Frontend-Code (39 tote Seiten, 30 tote Komponenten), 2 TWR-Engines, 3 IRR-Implementierungen, 4+ FX-Konvertierungspfade mit 3 unabhängigen Caches und ~7 hartkodierten `×0.88`-Stellen, doppelt laufende Cron-Jobs, ~80 Debug-Skripte plus ein 17-MB-PDF im Repo-Root.
4. **Die Zielgruppe (50+, nicht-technisch) wird nicht abgeholt:** Der zentrale Einstiegs-Flow «Depot importieren» ist kaputt bzw. gefährlich (überschreibt globale Kursdaten), der gute Swissquote-PDF-Import ist unerreichbar, Fehler werden als stumme «CHF 0» oder als englische Stacktraces angezeigt, Kernzahlen stehen in 8–11-px-Schrift.

Positiv: Das Token-Designsystem, die shadcn-Basis, `de-CH`-Locale bei `Intl`, die neuere `performanceEngine.ts` (TTWROR/IRR fachlich solide), der PDF-Import-Flow (Validierung, Review-Schritt) und die Cookie-/JWT-Grundlagen sind gute Fundamente — sie werden nur nicht konsequent genutzt.

> **Wichtiger Kontextbefund:** Ghostfolio soll das kanonische interne Datenmodell sein und OpenWealth extern gemappt werden — **im Code existiert zu beidem keine einzige Referenz** (0 Treffer für `ghostfolio` und `openwealth`). Es gibt also keine doppelte Mapping-Logik zu konsolidieren, sondern eine fehlende Schicht aufzubauen (→ A-01).

---

## 1. Berechnungsfehler (höchste Priorität)

### 1.1 KRITISCH

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| R-01 | **Vorzeichenkonvention für Auszahlungen inkonsistent** — Client speichert Withdrawals negativ (`TransactionModal.tsx:179–181`); Konsumenten interpretieren das Vorzeichen unterschiedlich: `performanceCalculations.ts:288/297` addiert den Betrag zu «investiert», `:388–389` zählt die Entnahme als Zufluss, `performanceEngine.ts:569` macht aus dem negativen DB-Wert einen positiven Inflow (TTWROR falsch), `performanceService.ts:408–411` erhöht die Cash-Timeline. Korrekt nur `annualPerformanceRouter.ts:82`. | `client/src/components/TransactionModal.tsx:179`, `server/performanceCalculations.ts:288,388`, `server/lib/performanceEngine.ts:569`, `server/lib/performanceService.ts:408` | Einen Normalisierungs-Helper `getSignedFlow(tx)` an der Lesegrenze einführen; alle Engines darauf umstellen. Vorher Charakterisierungstests (CT-1, CT-2, CT-4). | M |
| R-02 | **Gebühren-Doppelzählung** — `totalAmountCHF` enthält je Erfassungspfad die Fees (manuell: `TransactionModal.tsx:175`) oder nicht (CSV: `portfolioTransactionsRouter.ts:524–535`; Edit: `:384–394`); Konsumenten addieren Fees erneut (`performanceCalculations.ts:212,399`, `performanceService.ts:414`, `performanceHypothetical.ts:421,426`). Kostenbasis pro Trade um die Fee-Höhe falsch, je nach Erfassungsweg unterschiedlich. | s. links | Kanonische Semantik festlegen (`totalAmountCHF` = Bruttowert **exkl.** Fees; Fees immer separat), Schreibpfade angleichen, Bestandsdaten migrieren. | M |
| R-03 | **Kostenbasis ignoriert frühere Verkäufe → Phantomgewinne.** Bei jedem Verkauf wird der Durchschnittskurs über *alle jemals getätigten Käufe* gebildet, nie um Verkäufe reduziert. Szenario: Kauf 100@10 → Verkauf 100@20 → Kauf 100@30 → Verkauf 100@30 ergibt +1'000 CHF Phantomgewinn, dauerhaft in `realizedGains` persistiert. | `server/db.ts:885–907` | Laufende Moving-Average- (oder FIFO-)Positionsführung; bestehende `realizedGains`-Zeilen neu berechnen (Backfill). Vorher CT-5. | M |
| R-04 | **Historische Bewertung mit heutigen Kursen** — `buildValuePoints` bewertet jeden vergangenen Stichtag mit `currentPrices` (`const price = currentPrices.get(ticker) \|\| 0`). TWR/MWR/Charts aus `portfolioPerformanceRouter` (`getMetrics`, `getValueHistory`, `comparePortfolios`) sind damit bedeutungslos, sobald Kurse sich bewegt haben. | `server/performanceCalculations.ts:415–417`; Konsumenten `server/routers/portfolioPerformanceRouter.ts:73–78,197,260` | Modul zugunsten `performanceService.calculatePortfolioPerformance` (nutzt historische Preise korrekt) stilllegen. Vorher CT-1/CT-4 (Pinnen beider Engines, Diff dokumentieren). | M |
| R-05 | **Dividenden als externer Cashflow mit falschem Vorzeichen** — TWR zieht die Dividende vom Periodenertrag ab, MWR zählt sie als Einzahlung des Anlegers; Dividendentitel werden doppelt bestraft. (Die neuere Engine behandelt Dividenden korrekt intern: `performanceEngine.ts:100–102`.) | `server/performanceCalculations.ts:390–391` | Dividenden aus den externen Flows dieses Moduls entfernen (bzw. Modul gem. R-04 stilllegen). | S |
| R-06 | **Dashboard-Chart kollabiert auf 0** — Schleife nimmt ASC-Sortierung an (`break` bei `txDate > date`), `batchGetPortfolioTransactions` liefert aber DESC (`db-optimized.ts:42`) → Holdings leer für die meisten Datumspunkte, `startingValue = 0`. | `server/routers/dashboardPerformanceRouter.ts:186–189` | Lokal ASC sortieren (oder `continue` statt `break`). | S |
| R-07 | **Dashboard-«Performance» ignoriert Cashflows** — `(value − startingValue)/startingValue`; ein Mittelzufluss erscheint als Gewinn, eine Entnahme als Verlust. | `server/routers/dashboardPerformanceRouter.ts:238–246` | Auf `calculateTTWROR` mit (gem. R-01 normalisierten) externen Flows umstellen. | M |
| R-08 | **Renditen werden stillschweigend «geglättet» oder erfunden**: Tagesbewegungen > 15 % werden gekappt (`performanceHypothetical.ts:208,244–249,482–490`), Preissprünge > 50 % verworfen und forward-gefüllt (`:226–231,451–456` — ein 2:1-Split wird damit für immer falsch bewertet), TTWROR bei ±50 % gekappt (`performanceEngine.ts:171`), und bei fehlenden Daten liefert `generateFallbackPerformance()` eine **hartkodierte, erfundene +13.32-%-Rampe** (`ytd-performance.ts:283–304`). | s. links | Renditen nie mutieren; Datenqualitätsprobleme flaggen und im UI ausweisen (→ U-13); Fake-Fallback ersatzlos löschen. Vorher CT-8/CT-9. | M |
| R-09 | **YTD-Start hartkodiert auf `2025-01-01`** — «YTD» umfasst 2026 tatsächlich 18 Monate. Gleiches Muster: hartkodiertes Baseline-Fenster `2024-12-27…2024-12-31` in `stocksRouter.ts:303` und «YTD Start-Preise (31.12.2024)» im Import-UI (`Import.tsx:129`). | `server/ytd-performance.ts:187`, `server/routers/stocksRouter.ts:303` | Jahr dynamisch ableiten (`new Date().getFullYear()` bzw. letzter Handelstag des Vorjahres). | S |
| R-10 | **Stiller FX-Fallback 1.0** — fehlt ein Kurs (oder ist die DB nicht erreichbar), liefert `getFxRate`/`getFxRateSync` `1.0`; USD-Positionen werden 1:1 als CHF bewertet (~12 % Fehler), ohne jede Warnung. Dazu hartkodierte Fallback-Tabellen (`fxRates.ts:90–109`: USD/CHF 0.888 …). | `server/fxHelper.ts:64–68,108–113,179–193`; `server/fxRates.ts:90–109` | `null` zurückgeben bzw. werfen; Aufrufer müssen den Zustand behandeln und im UI ausweisen (→ U-13). Kein 1.0-Default für Nicht-CHF-Paare. Vorher CT-7. | M |
| R-11 | **`close` statt `adjustedClose`, keine Split-/Corporate-Action-Behandlung** — Schema hat `adjustedClose` (`schema.ts:406`), aber fast alle Konsumenten lesen `close` (`performanceService.ts:120,278`, `dashboardPerformanceRouter.ts:125`, `performanceHypothetical.ts:142,340`, `fxHelper.ts:245–265`, `annualPerformanceRouter.ts:121`, `ytd-performance.ts:49`; korrekt nur `performanceRouter.ts:94`). Splits existieren nirgends für Stückzahlen. | s. links | Für Renditeserien konsequent `adjustedClose ?? close`; für Bestandsbewertung Splits über eine Splits-Tabelle auf Stückzahlen anwenden. | M |
| R-12 | **Backdatierte Trades erhalten den heutigen FX-Kurs** — Client holt `getCurrentRate` und persistiert ihn als `fxRate`/`totalAmountCHF` auch bei Transaktionsdatum in der Vergangenheit (Serverpfade machen es richtig). *Hinweis: Das Modal ist aktuell nicht erreichbar (→ U-03), der Fehler ist latent und beim Wieder-Anschluss zu beheben.* | `client/src/components/TransactionModal.tsx:78,197–201` | Kurs zum gewählten Transaktionsdatum abfragen (Endpoint existiert). | S |
| R-13 | **PDF-Import persistiert unkonvertierte Beträge als CHF** — ist `fxRate` null und Währung ≠ CHF, wird `totalAmountCHF = totalAmount` gespeichert (korrupte Daten at rest). | `server/routers/pdfImportRouter.ts:112–133` | Import ablehnen oder Kurs zum Transaktionsdatum nachschlagen. | S |
| R-29 | **Tagesveränderung strukturell falsch** (Kundenbefund Teil 1, verifiziert) — «Heute» = `stocks.currentPrice` (nur 1× täglich um 18:00 per Cron aktualisiert, für US-Titel ein Intraday-Schnappschuss; `priceUpdater.ts:60`), «Gestern» = Schlusskurs aus `historicalPrices` mit Nearest-≤-Fallback. **Asymmetrische Skip-Logik:** ein Titel mit `currentPrice`, aber ohne Historie zählt heute voll und gestern gar nicht → sein **kompletter Positionswert erscheint als Tagesgewinn** (`dashboardRouter.ts:57–58` vs. `:209–210`, Guard `:263/:281` greift nur bei Total 0). Dazu FX heute vs. FX gestern inkonsistent gemischt (`:69` vs. `:221`) und `getLastTradingDay` ohne Feiertage (`:139–146`). Zusätzlich nutzt die Dashboard-Konstellation als `change1d` einen **Fake-Proxy** `ytd/Handelstage` (`dashboardRouter.ts:1226–1234`). | `server/routers/dashboardRouter.ts:39–82,137–148,209–210,363–364` | Beide Seiten aus derselben Quelle rechnen: pro Titel `close(letzter Handelstag)` vs. `close(vorletzter Handelstag)` aus `historicalPrices`, identische Ticker-Menge, symmetrisches Skipping; Fake-`change1d` entfernen. | M |
| R-30 | **`stocks.ytdPerformance` durch Corporate Actions korrupt** (Kundenbefund Teil 1 «Holcim-Ausreisser», verifiziert) — YTD = `(currentPrice − ytdStartPrice)/ytdStartPrice` (`priceUpdater.ts:90–93`), `ytdStartPrice` wird 1× jährlich als **roher** Dez-31-Close fixiert (`cron/ytdUpdater.ts:40–41,72–75`), `batchGetHistoricalPrices` liest nur `close` (`db-optimized.ts:136–137`). Holcim (Amrize-Spin-off Juni 2025, ~−50 % im Rohkurs) zeigt dadurch ≈ −45 % «YTD» statt real positiv; der Wert färbt Konstellation-Halo, Momentum und `qualityScore` (`portfoliosRouter.ts:388–396`). Konkretisiert R-11. | `server/priceUpdater.ts:90–93`, `server/cron/ytdUpdater.ts:40–75`, `server/db-optimized.ts:136–137` | `adjustedClose` in allen Return-Berechnungen; `ytdStartPrice` adjustiert setzen bzw. bei Corporate Actions neu berechnen. | M |
| R-33 | **Header-Score der Aktienseite ist bei fehlendem DB-Wert ein Zufallswert** — `const score = stock.score \|\| Math.floor(Math.random() * 20) + 75;` zeigt 75–94 als scheinbar echten Score; der Erklärungs-Dialog (`StockDetail.tsx:1086–1119`) beschreibt zudem eine **frei erfundene** Gewichtung, die mit der echten Berechnung (`scoring.ts:280`) nichts zu tun hat. Verstoss gegen die «keine Fake-Daten»-Regel. | `client/src/pages/StockDetail.tsx:441,1086–1119` | Zufalls-Fallback entfernen («Score nicht verfügbar»), Erklärdialog an `scoring.ts` angleichen. | S |
| R-14 | **Keine Decimal-Arithmetik, Geldspalten als `varchar(50)`** — Verstoss gegen die verbindliche CLAUDE.md-Vorgabe. Kein decimal.js/big.js im `package.json`; `shares`, `pricePerShare`, `totalAmount(CHF)`, `fees`, `realizedGain` etc. sind varchar (`schema.ts:216–222,236–242,260–270,534–535,78–100`); überall `parseFloat` + Float-Arithmetik; Magie-Strings `"NA"/"N/A"` in Geldfeldern. Nur `exchangeRates.rate` und `historicalPrices.*` sind `decimal`. | `drizzle/schema.ts`, alle Engines | Migration auf `decimal(18,2)`-Beträge / `decimal(20,6)`-Stückzahlen (oder Integer-Rappen) + decimal.js an der Rechen­grenze. **Bewusst als letzter Schritt hinter den Charakterisierungstests** (Phase 5), da alle Pfade betroffen sind. | L |

### 1.2 WICHTIG

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| R-15 | Fallback `totalAmountCHF \|\| totalAmount` mischt Währungen (Lokalbetrag als CHF). | `performanceCalculations.ts:207,283,379`, `performanceEngine.ts:559`, `performanceService.ts:398`, `annualPerformanceRouter.ts:48` | Im Fallback mit `fxRate`-Spalte bzw. `getFxRate(date)` konvertieren. | S |
| R-16 | Annualisierung/Day-Count inkonsistent (365 vs. 365.25, `Math.ceil`-Off-by-one, `Math.abs` maskiert unsortierte Inputs); `calculateSimpleReturn` rechnet Wochenrendite linear auf +104 % p.a. hoch. | `performanceCalculations.ts:81–87,452–457`, `irrCalculator.ts:105–113`, `performanceEngine.ts:187–191` | Eine Konvention festlegen (365.25, geometrisch; < 1 Jahr: Periodenrendite ausweisen). | S |
| R-17 | Zeitzonen-/Stichtagsfehler: `new Date()`-Anker für IRR unabhängig vom Bewertungsdatum; UTC-Slicing bucketed eine 00:30-CET-Transaktion auf den Vortag; `new Date(year,0,1)` (Server-TZ) vs. UTC-Strings im Jahresreport. | `irrCalculator.ts:24,33`, `annualPerformanceRouter.ts:27–28`, div. `toISOString().split('T')` | Einheitlich UTC-Datumslogik (Helper), Bewertungszeitpunkt an Preisstand koppeln. | M |
| R-18 | Gewichtete Rendite-Charts: statische *aktuelle* Gewichte, pro Titel eigene Startdaten, tägliche implizite Rebalancierung, Normalisierung nur bei `totalWeight < 100`, **keine FX-Umrechnung** (USD-Lokalrenditen in CHF-Linie gemischt). | `performanceRouter.ts:156–193`, `ytd-performance.ts:244–262` | Auf transaktionsbasierte Serie (performanceService) umstellen oder Methodik dokumentieren + FX ergänzen. | M |
| R-19 | Realisierte Gewinne: FX-Split nutzt das Datum des **ersten** Kaufs statt gewichtet (`db.ts:916–919`); `netProfit` zieht **alle** jemals gezahlten Buy-Fees von **jedem** Verkauf ab (`realizedGainsHistoryRouter.ts:45–89`); Edit/Delete von Transaktionen lässt `realizedGains` veralten (`portfolioTransactionsRouter.ts:246–403`). | s. links | Gewichteter FX-Split; Fees anteilig; Neuberechnung abhängiger Gewinne bei Edit/Delete. | M |
| R-20 | Randfälle: Oversell erzeugt negative Kostenbasis (`sellRatio > 1`, unsortierte Inputs, `performanceCalculations.ts:213–219`); Shorts werden überall als Wert 0 behandelt, obwohl der Verkaufserlös gutgeschrieben wurde; `getValueHistory` verwirft Käufe vor dem Fenster (`portfolioPerformanceRouter.ts:169–176`); `buildCashTimeline` startet Cash immer bei 0 und klemmt negatives Cash auf 0 (`performanceEngine.ts:439`) — verdeckt R-01/R-02. | s. links | Validierung (kein Verkauf > Bestand), Pre-Window-Seeding für Cash, Clamping entfernen. Vorher CT-6. | M |
| R-21 | CSV-Import parst Datumsangaben `MM/DD` vs. `DD/MM` ungeprüft via `new Date()` (03/04/2026 wird US-gedeutet). | `portfolioTransactionsRouter.ts:497–499` | Format explizit machen (Auswahl/Erkennung + Review-Anzeige). | S |
| R-22 | **Keine Schweizer Rappenrundung** (0.05) im ganzen Repo, obwohl fachlich für Cash-Beträge vorgesehen; Rundung generell inkonsistent (`toFixed(2/4/6)`, `Math.round`, teils gar nicht) — Summen angezeigter Zeilen ≠ angezeigte Totale. | überall; z. B. `db.ts:958–967`, `portfoliosRouter.ts:671` vs. `:934` | `roundRappen()`-Helper (Decimal-basiert) + Rundungskonvention pro Werttyp definieren. | S |
| R-31 | **Dividendenkalender rechnet falsch** (Kundenbefund Teil 3, verifiziert): hartkodierte FX-Kurse USD×0.88/EUR×0.95 an 4 Stellen (Teil von D-02); Holdings-Aggregation ignoriert `entry`-Transaktionen (`dividendCalendarRouter.ts:40–44,121–125,199–203,273–274`) → via `toggleLive` aktivierte Portfolios haben Stückzahl 0 → **leerer Kalender trotz echter Positionen**; Fallback erfindet `\|\| 1` Aktie (`:50`) → Phantom-Erträge. | `server/routers/dividendCalendarRouter.ts` | FX via `convertToCHF`; `entry` in die Aggregation aufnehmen; `\|\| 1`-Fallback entfernen. | S |
| R-32 | **DCF-Analyse mit systematischem Überbewertungs-Bias** (Kundenbefund Teil 2, verifiziert): WACC-Floor 8 % (`engine.ts:933`) + Mindest-Spread WACC−g 3.5 % (`:948–951`) + Wachstums-Cap 15 % mit 5-Jahres-Decay auf 2.5 % (`:888,910,938–944`) + FCF-Cap bei 5 % der MarketCap (`:917–921`) + asymmetrischer Anzeige-Cap (Upside max +100 %, Downside unbegrenzt, `:966–973`). Konservativer Zähler + aggressiver Nenner ⇒ Fair Value fast immer unter Kurs. | `server/analytics/engine.ts:883–997` | Währungs-/länderspezifischen risikofreien Zins statt 8-%-Floor, Horizont 10 J., Sensitivitätsband statt Punkt-Urteil «Überbewertet». | M |
| R-34 | **Optimizer-Constraints unvollständig** (Kundenbefund Teil 1, teilweise bestätigt): min 1 %/max 10 % existieren serverseitig bereits (`engine.ts:334–336`), aber bei < 10 Titeln unerfüllbar → `normalizeWithConstraints` konvergiert nicht, Client renormalisiert und schiebt Gewichte **wieder über 10 %** (`OptimierenTab.tsx:135–138`); min CHF 3'000 und min 15 Titel sind nur Anzeige-Checks, keine Constraints; die **Effizienzgrenze wird ohne die Bounds gerechnet** (`engine.ts:425–466`, nur 500 Zufallsportfolios) und ist inkonsistent zum beschränkten Optimum. | `server/analytics/engine.ts:334–378,425–466`, `client/src/components/portfolio/OptimierenTab.tsx:135–138` | Infeasibility behandeln (`maxW = max(0.10, 1.2/n)`); Frontier mit denselben Constraints; CHF-Mindestgrösse serverseitig. | M |
| R-35 | **Marktseite zeigt falsche Indexstände** (Kundenbefund Teil 3, verifiziert): «GOLD» = GLD-**ETF-Preis** (~1/10 des Unzenpreises, `marketRegimeRouter.ts:406`); für MSCI World existiert **gar kein Ticker mehr** in der Liste (`:401–408`), der `msci`-Fallback ist toter Code (`:435–438`) und die «MSCI World»-Chartlinie ist serverseitig immer leer/0 % (`:464,481–488`, `MarktHub.tsx:93`); SOX = SOXX-ETF, gleiches Muster. | `server/routers/marketRegimeRouter.ts:361–488` | Echte Index-/Spot-Ticker (`MIWO00000PUS.INDX`, `XAUUSD.FOREX`) oder ETF-Werte explizit als «ETF-Proxy» labeln; toten Code entfernen. | S |
| R-36 | **Rebalancing bucht Platzhalter-Transaktionen** (bei Analyse der Signal-Frage gefunden): `copilot.applyRebalancing` (`copilotRouter.ts:465–506`) erzeugt echte Transaktionen, aber der Client übergibt `shares: 1 // Placeholder` (`PortfolioCopilot.tsx:559`) — es gibt **nirgends** eine echte Stückzahl-Berechnung. *Latent: die Seite ist aktuell nicht geroutet; beim Wieder-Anschluss (F-02/F-14) zuerst fixen.* | `client/src/pages/PortfolioCopilot.tsx:559`, `server/routers/copilotRouter.ts:465–506` | Stückzahl = `targetWeight × totalValueCHF ÷ Kurs`, serverseitig berechnen und anzeigen («Kaufe N Stück ≈ CHF X»). | S |
| R-37 | **Einlage am ersten Handelstag doppelt gezählt** (beim Schreiben der Charakterisierungstests entdeckt): In der `performanceService`-Pipeline fliesst eine Einzahlung am ersten Handelstag sowohl in den Startmarktwert (MVB) als auch als IRR-Cashflow ein → IRR kollabiert auf −0.99 mit `converged=false`, `totalInvestedCHF` verdoppelt. Gepinnt in `server/__characterization__/ct4-performanceService.char.test.ts`. | `server/lib/performanceService.ts` (Zusammenspiel mit `performanceEngine.calculateIRR`) | Erst-Einlage entweder als Flow oder als MVB zählen, nicht beides; im Zuge von D-01/R-01 beheben. | S |
| R-23 | `analytics_service` (Python): Risiko-Statistiken mischen Lokalwährungs-Renditen ohne FX (`main.py:281–282`) — Sharpe/VaR/Beta für CHF-Anleger falsch; «currentPortfolio» nutzt Gleichgewichtung statt echter Gewichte (`main.py:517–526`). | `analytics_service/main.py` | FX-adjustierte Renditen; echte Gewichte übergeben. | M |

### 1.3 NICE-TO-HAVE

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| R-24 | `realizedGainPercent` in Lokalwährung neben `realizedGain` in CHF — die zwei angezeigten Zahlen widersprechen sich bei FX-Titeln. | `server/db.ts:937` | Prozent ebenfalls CHF-basiert. | S |
| R-25 | Newton-Raphson-Nichtkonvergenz liefert stillschweigend die letzte (unkonvergierte) Rate. | `performanceCalculations.ts:180` | `null` + Kennzeichnung (wie `irrCalculator` es tat). | S |
| R-26 | `scoring.ts`: Schwellen mit `greenMin === yellowMax` → Division durch 0 (nur durch `Math.min` gerettet). | `server/scoring.ts:80` | Guard ergänzen. | S |
| R-27 | Positionen mit Kostenbasis 0 (Spin-offs/Gratisaktien) zeigen «0 % Gewinn» statt «n/a». | `performanceCalculations.ts` | n/a-Zustand einführen. | S |
| R-28 | `debugPerformance` dereferenziert `livePerf.totalInvested` nach `livePerf = null` → garantierter TypeError; `totalInvestedCHF` vs. `totalInvested` (NaN). | `realizedGainsHistoryRouter.ts:128,194` | Beheben oder Endpoint entfernen. | S |

---

## 2. Doppelspurigkeiten

### 2.1 KRITISCH (weil aktiv falsche/doppelte Ergebnisse produzierend)

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| D-01 | **Drei parallele Performance-Engines** — 2 TWR-Engines (`performanceCalculations.ts:56` vs. `performanceEngine.ts:107`), 3 IRR-Solver (davon `irrCalculator.ts` komplett tot), Holdings-Rekonstruktions-Schleife **45× in 16 Dateien** unabhängig re-implementiert (allein `dashboardRouter.ts` 13×), CHF-Werteserien-Aufbau ~6× parallel. Verschiedene Seiten zeigen deshalb verschiedene Zahlen für dasselbe Portfolio. | `server/performanceCalculations.ts`, `server/lib/performanceEngine.ts`, `server/lib/performanceService.ts`, `server/performanceHypothetical.ts`, `server/routers/dashboard*/annual*/portfolioComparison*` | Konsolidierung auf `performanceEngine`/`performanceService` als Single Source of Truth; ein `buildHoldings(transactions, date)`-Helper für alle Router. Reihenfolge: erst Charakterisierungstests, dann Router für Router umziehen. | L |
| D-02 | **4+ FX-Konvertierungs-Implementierungen, 3 unabhängige Caches, ~7 hartkodierte Inline-Kurse** — `fxHelper.ts` (kanonisch), `fxRates.ts` (eigene API + Fallback-Tabelle), `lib/fxPriceConvert.ts`, Cache in `db-optimized.ts:204–221`; dazu ad-hoc `× 0.88` in `dividendCaptureJob.ts:102`, `dividendCalendar.ts:226`, `dividendCalendarRouter.ts:66,144,222,293`, `stocksRouter.ts:345,363`. Inkonsistente Kurse je Codepfad. | s. links | Alles über `fxHelper.convertToCHF` routen (nach R-10-Fix); hartkodierte Kurse löschen; `fxRates.ts` auf Rate-*Beschaffung* reduzieren oder entfernen. | M |
| D-03 | **Zwei parallele Scheduling-Systeme, beide aktiv** — `cron/*` (in-process) und `scheduled/*` (externe HTTP-Trigger) sind beide registriert (`_core/index.ts:224–230,277–291`); Preisimport läuft 2× täglich, Preisalarme doppelt (nahezu identische Bodies `cron/priceAlertsCron.ts` vs. `scheduled/priceAlertsScheduled.ts`). | s. links | Ein Mechanismus (empfohlen: `scheduled/*`-Endpoints), die `cron/*`-Zwillinge entfernen. | M |

### 2.2 WICHTIG

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| D-04 | **Tote Server-Dateien:** `routers/portfoliosRouter-optimized.ts` (Code bereits verbatim in `portfoliosRouter.ts` gemerged), `routers.ts.backup` (4'213 Zeilen Alt-Monolith), `irrCalculator.ts`, `portfolioTypeCalculator.ts` (je 0 Importer), `chartDataUpdater.ts` (Aufruf auskommentiert `_core/index.ts:263`), 2 tote Exports in `db-realizedGains.ts`. | s. links | Löschen (nach kurzem Grep-Gegencheck im Zuge des Umbaus). | S |
| D-05 | **~22'000 Zeilen toter Frontend-Code:** 39 nie importierte Seiten (~15'850 LOC, grösste: `OptimizerResults.tsx` 2'411 Z.), `OptimizerResults.tsx.backup` (992 Z.), `_archive/` (611 Z.), 30 tote Komponenten (~5'000 LOC, darunter die komplette alte `components/dashboard/`-Generation). Drei Generationen derselben Portfolio-Detailseite liegen nebeneinander. Router ist statisch (`App.tsx`), daher sicher feststellbar. | `client/src/pages/*`, `client/src/components/*` (Detailliste im Audit-Log) | Löschen. **Achtung:** Vorher U-03 klären — `SwissquotePDFImport`/`TransactionModal` sind «tot», sollen aber wieder angeschlossen werden. | M |
| D-06 | **Zahlenformatierung 14+-fach dupliziert:** `formatCurrency` 6×, `formatPercent` 5×, `formatNumber` 3× lokal definiert; `Intl.NumberFormat("de-CH")` 7× inline konstruiert; **623 rohe `toFixed(`-Aufrufe**. Der gute Formatter `components/dashboard/format.ts` wird nur vom Dashboard genutzt. | `client/src` (Zählungen s. links) | `client/src/lib/format.ts` als einzige Quelle (aus `dashboard/format.ts` heben); Konvention: CHF-Präfix, Tausendertrennzeichen `'`, definierte Dezimalstellen, `signDisplay`. | M |
| D-07 | **6 unabhängige Chart-Farbpaletten + 5 Sektor-Farblogiken**, Marken-Teal `#00CFC1` in 40+ Dateien wörtlich; CSS-Tokens `--chart-1..5` werden 0× genutzt, `ui/chart.tsx` hat 0 Importer. | u. a. `SectorAllocation.tsx:33`, `PortfolioComparison.tsx:64`, `PortfolioDetailsPage.tsx:560`, `dashboard/format.ts:37–62` | Eine zentrale Palette + `SECTOR_COLOR`/`REGION_COLOR` als einzige Quelle; an `--chart-*`-Tokens anbinden. | M |
| D-08 | **3 parallele Login/Registrierungs-Implementierungen** (Express `_core/index.ts:66–213`, tRPC `routers.ts:298–422`, `authRouter.ts`) mit driftender Logik (nur eine setzt `hasPaid`/`role`). | s. links | Auf eine tRPC-Implementierung konsolidieren. | M |
| D-09 | **Repo-Root-Clutter:** ~80 Debug-/Fix-/Testskripte (u. a. `manual_price_update.{js,mjs,ts}` in 3 Varianten, `fix-fx-rates.mjs` **und** `fix_fx_rates.mjs`), ~25 Analyse-Markdowns, `todo.md` (98 KB), `FCO_Report_29June26.pdf` (**17 MB**) — alles committet. | Repo-Root | Skripte nach `scripts/oneoff/` (oder löschen), Analyse-Dokus nach `docs/history/`, PDF aus dem Repo entfernen (Git-Historie ggf. via `git filter-repo`, da 17 MB jeden Clone belasten). | S |
| D-10 | `bcrypt` **und** `bcryptjs` parallel (nur `authRouter.ts:15` nutzt das native bcrypt; Hash-Formate kompatibel). | `package.json`, `server/routers/authRouter.ts:15` | Auf `bcryptjs` vereinheitlichen, native Dependency entfernen. | S |

### 2.3 NICE-TO-HAVE

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| D-11 | `trpc.portfolios.list.useQuery()` in 26 Dateien wiederholt (Cache dedupt, aber Boilerplate); `getCopilotInsights` doppelt in `CopilotHub.tsx:125,143`; roher `fetch('/api/trpc/dashboard.analyzeInsight?...')` umgeht den tRPC-Client (`Portfolios.tsx:929`). | s. links | Shared Hook `usePortfolios()`; Query liften; raw fetch durch tRPC-Hook ersetzen. | S |
| D-12 | Deutsch/englisches Komponenten-Duplikat `PositionsConstellation.tsx` vs. `portfolio/PositionsKonstellation.tsx` (beide referenziert). | `client/src/components/` | Zusammenführen. | S |
| D-13 | Zwei Chart-Bibliotheken (recharts 18 Dateien, chart.js 4 Dateien) mit driftenden Stilen. | s. links | Auf recharts standardisieren (4 Dateien migrieren, Bundle schrumpft). | M |
| D-14 | **FMP-API ablösen (Vorgabe Auftraggeber: umfassender EODHD-Plan vorhanden, FMP nur Gratis-Tier).** FMP wird an genau 4 Stellen genutzt: (1) `pegUpdater.ts` holt PEG-Ratios von FMP — **EODHD liefert `Highlights.PEGRatio` bereits** und `eodhdApi.ts:161` liest es schon aus; (2) `multiApiDataMerger.ts` nutzt FMP als 3. Fallback in der Kette EODHD→Yahoo→FMP→Finnhub (mit Vollplan-EODHD praktisch nie nötig, Yahoo bleibt als Gratis-Fallback); (3) Logo-Fallback im logoService (EODHD-Fundamentals enthält `LogoURL`); (4) `scripts/update-financial-highlights.ts` läuft mit `"demo"`-Key und ist faktisch tot. Ablösung eliminiert einen Drittanbieter (vereinfacht auch die revDSG-Empfängerliste, C-06) und entschärft die geleakten Keys (C-03). | `server/pegUpdater.ts`, `server/_core/multiApiDataMerger.ts`, `server/logoService.ts`, `scripts/update-financial-highlights.ts` | pegUpdater auf `fetchEODHDFundamentals` umstellen; FMP aus der Merger-Kette und dem Logo-Fallback entfernen; totes Script löschen; `FMP_API_KEY` aus env/Secrets entfernen. | S–M |

---

## 3. Design & UI-Konsistenz

### 3.1 KRITISCH

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| G-01 | **Verluste verlieren das Minuszeichen** — `sign = amount >= 0 ? '+' : ''` + `Math.abs()`: CHF −5'000 wird als «CHF 5'000» angezeigt; nur die rote Farbe unterscheidet Gewinn/Verlust (für ~8 % farbfehlsichtige Männer der Zielgruppe irreführend). Live betroffen: Tagesveränderung `Dashboard.tsx:140`; gleiches Muster in der (toten) `AnnualPerformanceSummary.tsx:39–42`. | `client/src/pages/Dashboard.tsx:140` | `signDisplay: 'always'` bzw. explizites `'−'`; im Zuge von D-06 zentral lösen. | S |
| G-02 | **Kernzahlen in Kleinstschrift + zu schwachem Kontrast** — 881× `text-xs`, 213× arbiträre 8–11-px-Grössen (Dashboard-KPIs, Badges `text-[8px]`), 239× `text-gray-500` (#6b7280) auf `#0d1220` ≈ 3.5:1 (unter WCAG AA), oft kombiniert mit 10-px-Schrift. Für die Zielgruppe 50+ die zentralen Lesbarkeitshürden. | u. a. `Dashboard.tsx:35,126,138,167,169,210,486,497`, `Portfolios.tsx:84` | Datentabellen auf `text-sm` (=15 px dank Override in `index.css:134`), Labels min. `text-xs`, `gray-500`→`gray-400` als Textminimum. | M |
| G-03 | **Token-System wird umgangen; Light-Mode wäre kaputt** — vollständiges oklch-Token-System in `index.css:6–125` vorhanden, aber 1'404 hartkodierte Hex-Werte + 826 arbiträre Farbklassen in `.tsx`; `--primary` (#00CFC1) wird überall wörtlich getippt; zwei konkurrierende Dark-Paletten (`#0d1220`-Welt vs. `slate-800/900`-Welt auf `Performance.tsx`/`Import.tsx`); Theme-Toggle existiert, Light-Theme unbenutzbar. | `client/src/index.css`, Top-Offender `PortfolioDetailsPage.tsx` (123 Hex), `StockDetail.tsx` (107), `Portfolios.tsx` (75) | Entscheid: Light-Theme offiziell entfernen **oder** Tokens konsequent nutzen; Hex→Token-Mapping seitenweise; eine Dark-Palette festlegen. | L |

### 3.2 WICHTIG

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| G-04 | Heatmap-Widerspruch bei exakt 0.0 %: Kachel rot, Text daneben grün «+0.0%». | `Dashboard.tsx:218,222` | Neutralfall (grau) ergänzen. | S |
| G-05 | Gewinn/Verlust-Farbtöne uneinheitlich (`red-400` 263× vs. `red-500` 130×; `emerald-400`/`green-400`/`green-500` gemischt) — Grün sieht je Seite anders aus. | client-weit | Semantische Tokens `--positive`/`--negative` + genau eine Klassen-Variante. | S |
| G-06 | 84 rohe `<button>` ohne Focus-Ring neben shadcn-`Button` (nur 1 `focus-visible`-Treffer ausserhalb `ui/`); globaler CSS-Hack `button:has(svg){color:white!important}` (`index.css:207–216`) bricht Icon-Buttons auf hellem Grund. | u. a. `Dashboard.tsx:323–334` | Auf `<Button>` umstellen; Hack durch scoped Klasse ersetzen. | M |
| G-07 | Klickflächen/Accessibility: 104× `h-6`/`h-7`-Controls (24–28 px statt ≥ 44 px), nur 8 `aria-label` bei 21+ Icon-only-Buttons, klickbare `<div>`s ohne `role`/`tabIndex` (`Dashboard.tsx:159–162`). | s. links | `size="sm"`+, `aria-label`-Pass, Divs zu `<button>`/`<Link>`. | M |
| G-08 | Responsive: `Dashboard.tsx` hat **0 Breakpoints** (u. a. `grid-cols-7`-Heatmap), Treemap/Konstellation mit fixem `width={1100}`, KPI-Leiste `grid-cols-4` auch auf 375-px-Geräten (`Portfolios.tsx:316`), Formular-Grids ohne `sm:`-Fallback (`Einstellungen.tsx:156,186,209`). | s. links | Breakpoints + `overflow-x-auto` + ResizeObserver-basierte Chartbreite. | M |
| G-09 | CHF-Darstellung inkonsistent: Präfix «CHF 1'234» (22×) vs. Suffix «123.45 CHF»; Dezimalstellen mal 0, mal 2; `toFixed(2)` ohne Tausendertrennzeichen bei Beträgen > 999. | u. a. `TechnicalAnalysis.tsx:156`, `Performance.tsx:72` | Mit D-06 zentral lösen (Schweizer Konvention `1'234.56`). | (in D-06) |

### 3.3 NICE-TO-HAVE

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| G-10 | Rest-Streuung `de-DE` statt `de-CH` (4× `toLocaleString`, ~10 Dateien Datum/Zeit). | u. a. `AlertManagement.tsx:268`, `Chat.tsx:174` | Suchen/Ersetzen. | S |
| G-11 | Denglisch-Titel («Top 10 YTD Performers», «Markt Dashboard») und unerklärter Quant-Jargon (YTD, Sharpe, LPPL, «Halo = starker YTD-Performer»). | u. a. `Performance.tsx:28`, `PositionsView.tsx:29` | Wording-Liste/Glossar, Tooltips («seit Jahresbeginn»). | M |
| G-12 | `/debug-test` öffentlich geroutet; `Import.tsx:129` hartkodiert «31.12.2024». | `App.tsx:241`, `Import.tsx:129` | Route entfernen/guarden; Jahr dynamisch. | S |

---

## 4. Prozesse & Kundenführung (User Flows)

### 4.1 KRITISCH

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| U-01 | **Menüpunkt «Import» importiert kein Depot, sondern überschreibt globale Kursdaten** — für alle Nutzer sichtbar; `stocks.importPrices` ist nur `protectedProcedure` (**kein Admin-Check**) und schreibt in die globale `stocks`-Tabelle. Jeder Kunde kann die Kurse aller anderen verfälschen — und erwartet hier eigentlich «mein Depot importieren». | `client/src/pages/Import.tsx:29–43`, `server/routers/stocksRouter.ts:1088–1093`, Nav `DashboardLayout.tsx:57` | `importPrices` → `adminProcedure`; Menüpunkt aus der Nutzer-Nav entfernen bzw. durch echten Positions-Import ersetzen (→ U-02/U-03). | S |
| U-02 | **Portfolio-Builder-Pfad «Import» ist eine Sackgasse** — verspricht Positions-Import aus CSV/Excel, bettet aber exakt die Kursdaten-Import-Komponente aus U-01 ein; es entsteht **kein Portfolio**, es gibt keinen Weiter-Schritt. Der wichtigste Einstiegs-Flow der Zielgruppe (Depotübertrag) ist kaputt. | `client/src/pages/PortfolioBuilderWizard.tsx:41–46,492–504` | Pfad an den Swissquote-Import (U-03) anbinden oder entfernen. | M |
| U-03 | **Der gute Swissquote-PDF-Import ist unerreichbar** — `SwissquotePDFImport` (vorbildlich: Upload → Review mit Confidence/Warnungen → selektiver Import) hängt nur in der ungerouteten `PortfolioTransactionsPage`; die alte Route wird wegge-redirected. Auch `TransactionModal` (Transaktion erfassen) ist damit toter Code — auf der erreichbaren Transaktionen-Ansicht gibt es weder «Transaktion hinzufügen» noch PDF-Import. | `client/src/pages/PortfolioTransactionsPage.tsx:95`, `App.tsx:176–178`, `PortfolioDetailsPage.tsx:1094ff` | PDF-Import + TransactionModal in den Transaktionen-Tab der Detailseite einbauen (dabei R-12 fixen). | M |
| U-04 | **Links auf nicht existierende Route `/stocks/:ticker` → 404** — Routentabelle kennt nur `/aktien/:ticker` und `/stock/:ticker`. Zentrale Drilldowns (Top-Positionen → Aktie) brechen. | `Portfolios.tsx:820`, `PortfolioDetailsPage.tsx:908,911`, `CopilotHub.tsx:649` (+2 tote Dateien) | Links korrigieren oder Redirect-Route ergänzen. | S |
| U-05 | **ErrorBoundary zeigt Endkunden einen rohen englischen Stacktrace** («An unexpected error occurred.» + `error.stack` in `<pre>`). | `client/src/components/ErrorBoundary.tsx:34–52` | Deutsche, freundliche Fehlerseite; Stack nur ins Logging. | S |

### 4.2 WICHTIG

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| U-06 | **Onboarding endet im Nichts** — 4-Schritte-Wizard speichert Präferenzen und wirft den Neukunden auf ein leeres Dashboard («CHF 0»); keine Brücke zum Portfolio-Builder; der fertige `createDemoPortfolio`-Endpoint (Schweizer Blue Chips) wird nur von der **nirgends gemounteten** `OnboardingTutorial`-Komponente aufgerufen. | `components/OnboardingWizard.tsx:54–76`, `server/routers/onboardingRouter.ts:104–182` | Nach Abschluss direkt in den Builder (Risikoprofil vorbelegt) oder Demo-Portfolio anbieten. | M |
| U-07 | **Query-Fehler ⇒ stumme «CHF 0»** — kein globales Error-Handling in der UI (`main.tsx:35–49` loggt nur); KPIs rendern `metrics?.totalValue ?? 0`. Ein fehlgeschlagener Request zeigt dem Anleger einen Depotwert von 0 — die schlimmstmögliche Falschinformation. | `client/src/main.tsx:35–49`, `Dashboard.tsx:115–118`, `Portfolios.tsx:336` | Fehlerzustand pro KPI («Daten derzeit nicht verfügbar» + erneut versuchen), globaler Error-Toast. | M |
| U-08 | Destruktive Aktionen inkonsistent bestätigt: teils AlertDialog, teils Browser-`confirm()` (Portfolio-Karte `Portfolios.tsx:222`, Bulk-Delete `PortfolioDetailsPage.tsx:1189`, `EditPositionModal.tsx:131`, `PriceAlerts.tsx:158`), danach teils `window.location.reload()` statt Query-Invalidation. | s. links | Einheitlich AlertDialog + `invalidate()`. | M |
| U-09 | Sackgassen: `/import` und der Builder rendern ohne App-Navigation (kein Zurück/Abbrechen in Schritt 0); Sidebar zeigt Design-Artefakt-Badges «9 Pages»/«N Pages»; toter «Alarm erstellen»-Button (`PortfolioDetailsPage.tsx:1309`, kein onClick) und fertig gebauter, aber nie öffenbarer Share-Dialog (`:1418–1478`). | `App.tsx:217`, `PortfolioBuilderWizard.tsx:391–508`, `DashboardLayout.tsx:45–47,295–299` | Layout um beide Seiten; Badges entfernen; Button verlinken oder entfernen. | S |
| U-10 | Leerzustand verweist Normalnutzer auf Admin-Funktion + Dev-Jargon («Klicken Sie ‹Jetzt analysieren› oder warten Sie auf den täglichen Cron um 08:00») — Button existiert nur für Admins; `PortfolioCompact` hat gar keinen Empty-State. | `Dashboard.tsx:310–343` | Nutzergerechte Texte, Empty-State mit CTA. | S |
| U-11 | Admin-Routen clientseitig ungeschützt (`/admin/*` für alle erreichbar, UI mit fehlschlagenden Queries); `ProtectedRoute.tsx` existiert, wird **0×** verwendet. Server-seitig sind die Prozeduren gated (ausser A-02!). | `App.tsx:144–158` | Route-Guard einziehen. | S |
| U-12 | Doppelter Erfolgs-Toast nach Portfolio-Erstellung; 4 parallele Builder-Routen (`/portfolios/create`, `/portfolio-builder{,/new,/wizard}`). | `PortfolioBuilderWizard.tsx:370–372`, `PortfolioDetailsPage.tsx:341–346`, `App.tsx:103–133` | Toast einmal; Routen konsolidieren. | S |
| U-13 | **Fehlende Kurse/FX werden still als falsche Werte gerendert** (Ende-zu-Ende verifiziert): fehlender Kurs → Position «CHF 0», Gesamtwert zu niedrig, kein Hinweis (`portfoliosRouter.ts:332–333` → `PortfolioDetailsPage.tsx:1010`); fehlender FX-Kurs → 1:1-Bewertung (R-10). | s. links | Daten-Qualitäts-Badge je Position («Kurs fehlt/veraltet»), Ausschluss aus Summen mit Hinweis. Gemeinsam mit R-10 umsetzen. | L |
| U-19 | **Demo-/Live-Semantik inkonsistent** (Kundenbefund Teil 1, verifiziert): zwei divergente «Demo»-Begriffe (`portfolioType`-Enum vs. `isLive`-Flag, `schema.ts:214,219`; UI entscheidet nur über `isLive`). Beim **Deaktivieren** von Live-Tracking bleiben die Transaktionen bestehen (`portfoliosRouter.ts:988–992`) — das Portfolio ist dann «Demo», zeigt aber den Transaktionen-Tab samt Alt-Transaktionen. Kundenanforderung: Demo-Portfolios ändern nur Positionen; Live-Portfolios erzeugen echte Transaktionen (inkl. Gebühren gem. Einstellungen). | `server/routers/portfoliosRouter.ts:867–992`, `client/src/pages/PortfolioDetailsPage.tsx:641,799` | Beim Deaktivieren Transaktionen löschen/archivieren; Tab für Demo ausblenden; ein Demo-Flag als Single Source of Truth; zusammen mit A-14. | M |
| U-20 | **Gebührenstruktur existiert, wird aber nicht genutzt** (Kundenbefund Teil 1, verifiziert): `Einstellungen` hat einen fertigen «Gebühren»-Tab mit Broker-Presets (Swissquote/PostFinance/IB/Neon inkl. Stempelsteuer 0.075 %, `Einstellungen.tsx:19–66`, persistiert via `userSettingsRouter.ts:15`, `schema.ts:703–704`) — aber die Kauf-Maske setzt `fees: "0"` hart (`StockDetail.tsx:256`); Backtest/Optimizer rechnen ebenfalls ohne diese Gebühren. | s. links | Gespeicherte Gebühren in Kauf-/Verkaufs-Dialog, Rebalancing-Aktionen und Backtest einrechnen (Default-Presets als Fallback). | M |
| U-14 | ~25+ Toasts reichen rohes `error.message` durch («UNAUTHORIZED», «Database not available», Zod-Meldungen) — Server-Fehlertexte sind englisch/technisch. | u. a. `PortfolioDetailsPage.tsx:272`, `Import.tsx:40`, `LoginForm.tsx:54` | Zentrales `getUserErrorMessage(error)` (tRPC-Codes → deutsche Klartexte). | M |

### 4.3 NICE-TO-HAVE

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| U-15 | Du/Sie-Mix teils im selben Viewport («Wähle deinen Pfad» über «Wie möchten Sie…»); 404- und Logged-out-Zustände englisch; «Cost CHF» statt «Einstand»; Tippfehler «Wertentwicklung seit Erstauf»; hartkodiertes «Premium»-Badge für jeden Nutzer. | `PortfolioBuilderWizard.tsx:396–398`, `NotFound.tsx:28–35`, `DashboardLayout.tsx:131–143,434`, `PortfolioDetailsPage.tsx:732,828` | String-Pass: konsequent «Sie», durchgehend Deutsch. | M |
| U-16 | Status-Wording Test/Demo/Live/geplant uneinheitlich und unerklärt; Quant-Features (Backtest, Signals, LPPL/Sornette-«Bubble-Indikator») ohne Einstiegshilfe für Laien. | `Portfolios.tsx:446–447,497–499,622` | Begriffe vereinheitlichen; Erklär-Tooltips; ggf. «Einfach/Experte»-Modus evaluieren. | M |
| U-17 | Einzelne Mutationen ohne Erfolgs-/Fehler-Feedback (`toggleAlert`, `applyRebalancing`); KPI-Leisten flackern mit 0-Werten bis Daten eintreffen. | `PriceAlerts.tsx:150–155`, `PortfolioCopilot.tsx:548` | Toast-/Skeleton-Pass. | S |
| U-18 | Kein Report-/PDF-Export für die Zielgruppe (nur Transaktions-CSV); `/reports` redirectet aufs Dashboard. | `App.tsx:227–229` | Jahres-/Depotauszug als PDF evaluieren (Feature-Entscheid). | L |

---

## 5. Architektur & Struktur

### 5.1 KRITISCH

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| A-01 | **Ghostfolio-/OpenWealth-Schicht existiert nicht** — 0 Referenzen im gesamten Repo. Stattdessen parallele, unverbundene Datenmodelle: `historicalPrices` **und** `prices`; `stocks` **und** `securities`; Holdings in **drei** Repräsentationen (`holdings`-Tabelle, `savedPortfolios.portfolioData`-JSON-Blob, abgeleitet aus `portfolioTransactions`) — Router branchen auf `isLive`, verschiedene Seiten können verschiedene Depotwerte zeigen. `transactionType`-Enum weicht von Ghostfolio-Activities ab (kein `FEE`/`INTEREST`; Swissquote-Fees/-Zinsen werden beim PDF-Import in den semantikfreien Typ `'entry'` kollabiert, `pdfImportRouter.ts:119–122`). | `drizzle/schema.ts:74–109,234,351–373,401`, `dashboardRouter.ts:2202–2212` | Transaktions-Ledger als Single Source of Truth festlegen, Rest ableiten; Enum um `fee`/`interest` erweitern und `entry`-Zeilen migrieren; Ghostfolio-konformes Domänenmodell (Activity/SymbolProfile/MarketData) als Zielbild definieren, OpenWealth-Mapping als eigene Adapter-Schicht darauf. | L |
| A-02 | **`admin.exportData`/`admin.importData` ohne Admin-Check** — nur `protectedProcedure`; `importData` akzeptiert einen Fake-Validator (`input as any`), **löscht `stocks`, `research`, `transactions` vollständig** und ersetzt sie durch die unvalidierte Payload. Da Registrierung offen ist: Jeder selbstregistrierte Nutzer kann das Aktienuniversum aller Nutzer zerstören. | `server/routers/adminRouter.ts:16–95` | Ganzen Router auf `adminProcedure` umstellen (entfernt zugleich ~28 handgeschriebene Rollen-Checks); zod-Schema für importData. **Sofort umsetzen.** | S |
| A-03 | **Öffentliche Debug-Endpoints produktiv:** `debug.envKeys` (public, listet alle ENV-Variablennamen + welche Secrets gesetzt sind + Längen) und `debugTest.testPortfolioCreate` (public **Mutation**, schreibt Portfolios auf **beliebige fremde `userId`**, echot interne Logs/Stacktraces). | `server/routers.ts:243,260–284`, `server/routers/debugRouter.ts:6–107` | Beide entfernen (oder `adminProcedure` + `ctx.user.id`). **Sofort umsetzen.** | S |
| A-14 | **`portfolioTransactions.create`/`.list` ohne Ownership-Check** (bei Verifikation von Kundenbefund Teil 1 gefunden) — jeder eingeloggte Nutzer kann Transaktionen auf **fremde** Portfolios schreiben bzw. fremde Transaktionen lesen; auch kein Demo-Guard (Transaktionen auf Demo-Portfolios möglich). | `server/routers/portfolioTransactionsRouter.ts:5–53,55–65` | Ownership via `getSavedPortfolioById(portfolioId, ctx.user.id)` prüfen (wie im PDF-Import); Demo-Portfolios ablehnen. **In Phase 0 aufnehmen.** | S |
| A-04 | **51 Prozeduren in 10 Dateien nutzen einen Fake-Validator** (`.input((val) => …) ` + `input as any`) statt zod; Auth-Endpoints ganz ohne Schema (kein E-Mail-Format, keine Passwort-Policy, `bcrypt.hash(undefined)` → 500), kein Rate-Limiting, 50-MB-Body-Limit. | `adminRouter.ts`, `routers.ts:298–422`, `stocksRouter.ts`, `portfolioTransactionsRouter.ts` u. a.; `_core/index.ts:63` | zod-Schemas flächendeckend; Auth-Validierung + Rate-Limit; Body-Limit senken. | M |
| A-05 | **Externe API-Antworten (EODHD/Finnhub/FMP/Yahoo) werden ungeprüft in DB und Berechnungen übernommen** (`await response.json()` mit blindem Cast). Eine HTML-Fehlerseite des Anbieters landet als `"undefined"`/`NaN` in varchar-Preisspalten. | `server/jobs/importHistoricalPrices.ts:79`, `_core/eodhdApi.ts:57,127`, `_core/fiscalApi.ts:51`, `dashboardRouter.ts:2227–2237` | zod-Parsing an der API-Client-Grenze; `response.ok` prüfen. | M |

### 5.2 WICHTIG

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| A-06 | **Fat-Router-Architektur ohne Service-Layer** — `server/routers/` = 20'302 Zeilen; `portfoliosRouter.ts` 3'159, `dashboardRouter.ts` 3'007 Zeilen; 28 von ~40 Routern greifen direkt auf die DB zu (175 Inline-Queries, 10 Raw-SQL); Datenzugriff, Geschäftslogik, Marktdaten-Fetches und Formatierung («STRONG BUY»-Strings) in denselben Closures. Vorbildlich dagegen: `portfolioPerformanceRouter` → `performanceCalculations`. | `server/routers/*` | Service-Schicht (marketData, scoring, portfolio) extrahieren; Router nur orchestrieren. Zusammen mit D-01 angehen. | L |
| A-07 | **Fehler werden systematisch verschluckt:** 475 catch-Blöcke, davon 60 komplett leer, 98 log-only, 88 mit stillen Defaults (`null`/`0`/`[]`) — `dashboardRouter.ts` allein 36 leere. `db.ts` hat inkonsistente Fehlerverträge (`getDb()` → `null`; manche Funktionen werfen, andere geben `false`/`[]`). UIs zeigen leere Portfolios statt Fehler (→ U-07). | server-weit; `db.ts:9–19,588–613` | Konvention: Repository wirft; Fehlerbehandlung an der Router-Grenze (tRPC errorFormatter); leere Catches eliminieren. | M–L |
| A-08 | `uncaughtException`/`unhandledRejection` werden geloggt und der Prozess läuft **weiter** (undefinierter Zustand, halb geschriebene Batches). | `server/_core/logMonitor.ts:73–95` | Loggen, flushen, mit Exit-Code ≠ 0 beenden; Supervisor restartet. | S |
| A-09 | Secrets-Verschlüsselung: AES-256-**CBC** ohne Authentizität, Schlüssel = SHA-256(`JWT_SECRET`) — Session-Signierschlüssel entschlüsselt zugleich alle gespeicherten API-Keys. | `server/_core/secretsManager.ts:6–29` | Eigener `SECRETS_ENCRYPTION_KEY`, AES-256-GCM, Re-Encryption. | M |
| A-10 | Env-Zugriff verstreut (47 Dateien, ~133 `process.env.*`; `EODHD_API_KEY` 29× direkt, teils auf Modulebene gecached, was den DB-Secret-Fallback aushebelt). | u. a. `server/jobs/importHistoricalPrices.ts:11` | Zugriff über `_core/env.ts`-Getter zentralisieren. | M |
| A-11 | 75 `publicProcedure`s exponieren u. a. das komplette Aktienuniversum inkl. proprietärer Scores/Moats unauthentifiziert (Free/Premium-Modell damit unterlaufen); `stocksRouter.fetchStockData` ist eine **öffentliche** Mutation, die kostenpflichtige API-Calls auslöst (Abuse-Vektor). | `server/routers/stocksRouter.ts:268–338` u. a. | Bewusst entscheiden; Standard: `protectedProcedure`. | M |

### 5.3 NICE-TO-HAVE

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| A-12 | `storage.ts` ist trotz Namens kein Data-Layer (Upload-Proxy); `storageGet` prüft `response.ok` nicht; API-Keys als URL-Query-Parameter (landen in Proxy-Logs). | `server/storage.ts:37–42`, `testSecretsRouter.ts:74,97` | Umbenennen, `ok`-Check, Keys in Header. | S |
| A-13 | Express-Debug-Endpoint gibt jedes Portfolio ohne User-Check zurück (nur dev-gemountet — Landmine, falls der Guard je fällt). | `server/debug-endpoint.ts:12`, `_core/index.ts:219–222` | User-Check nachrüsten oder löschen. | S |

---

## 6. Compliance & Datenqualität (revDSG)

### 6.1 KRITISCH

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| C-01 | **Portfolio- und Chatdaten fliessen an ein ausländisches LLM-Gateway** (Manus Forge → Gemini): Chat-Nachrichten inkl. Portfolio-Kontext (Name, Positionen, Gewichte, Stückzahlen), Metriken aus Copilot/Insights/Weekly-Review — in der Datenschutzerklärung **nicht erwähnt**. revDSG Art. 19 (Informationspflicht) und Art. 16 (Auslandsübermittlung) sind nicht adressiert. | `server/_core/llm.ts:212–322`, `chatRouter.ts:139–188`, `copilotRouter.ts:999`, `aiInsightsRouter.ts:96` u. a. | Datenschutzerklärung vervollständigen (inkl. KI-Verarbeitung, Empfängerliste, Auslandsübermittlung); prüfen, ob Portfolio-Kontext pseudonymisiert übergeben werden kann; AVV/SCC-Lage klären. Juristische Begleitung empfohlen. | M |
| C-02 | **Rechtsseiten sind unausgefüllte Platzhalter** («[Ihr Firmenname]», «[Registergericht]»), Datenschutzerklärung zitiert **DSGVO-Artikel statt revDSG** und erwähnt weder LLM noch Twilio/Resend. Für eine live betriebene Schweizer Finanz-App nicht haltbar. | `Impressum.tsx:28–63`, `Datenschutz.tsx:83–108,171–182`, `AGB.tsx:32,107` | Inhalte erstellen (revDSG-konform), juristisch prüfen lassen. | M |
| C-03 | **Zwei committete FMP-API-Keys** (Klartext): `fetch_ytd_fmp.mjs:3` und — im Produktivcode — `server/pegUpdater.ts:3` (als `\|\|`-Fallback). Beide bleiben in der Git-Historie. *Status: beide Dateien sind auf `process.env` umgestellt (Phase 0); beide Keys müssen extern rotiert werden.* | `fetch_ytd_fmp.mjs:3`, `server/pegUpdater.ts:3` | **Beide Keys sofort rotieren**; Historie im Zuge von D-09 bereinigen. Mittelfrist: FMP ganz ablösen (→ D-14). | S |
| C-04 | Unauthentifizierter Schreibzugriff auf fremde Konten via `debugTest.testPortfolioCreate` (= A-03; hier zusätzlich als Datenschutzverletzung relevant). | `debugRouter.ts:6–17` | Siehe A-03. | S |

### 6.2 WICHTIG

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| C-05 | **PII in Klartext-Logs:** E-Mail (`priceAlertsCron.ts:137`), Handynummer (`:150`), Käufer-E-Mail (`webhooks/stripe.ts:102`), `userId`+`openId` bei **jedem** Auth-Request (`_core/trpc.ts:21`), voller Mutations-Input inkl. Portfoliodaten (`portfoliosRouter.ts:292,496`). `logMonitor.ts:40–70` persistiert die letzten 500 Log-Einträge **ohne PII-Redaktion** (abrufbar via Admin-`logsRouter`). | s. links | PII-Redaktions-Helper (Maskierung), Guideline «IDs statt Identifikatoren», Log-Capture filtern. | S–M |
| C-06 | Weitere nicht deklarierte Empfänger: Twilio/WhatsApp (Mobilnummer + Alert-Inhalte mit Rückschluss auf Holdings), Resend (E-Mail/Name), stiller SMTP-Default **smtp.gmail.com** für Transaktionsmails. | `services/whatsapp.ts:29–54`, `_core/email.ts:23–45`, `services/email.ts:4–12` | In DSE aufnehmen (mit C-01); Gmail-Default explizit konfigurieren. | M |
| C-07 | Session-JWT 1 Jahr gültig vs. Cookie-`maxAge` 30 Tage; keine Token-Revocation. | `_core/sdk.ts:210`, `_core/index.ts:116` | Expiry angleichen (30 Tage) + Rotation. | S |
| C-08 | `new Resend(process.env.RESEND_API_KEY)` auf Modulebene → Serverstart (und 3 Testdateien) crashen ohne env-Variable. | `server/routers/authRouter.ts:19` | Lazy initialisieren (wie `_core/email.ts`). | S |
| C-09 | Private Git-Dependency `wikifolio: github:MarcWeibel1971/wikifolio` → `pnpm install --frozen-lockfile` schlägt ohne GitHub-Zugriff fehl (in CI reproduziert, `ERR_PNPM_FETCH_403`); Tests erwarten persönliche Zugangsdaten (`WIKIFOLIO_EMAIL/PASSWORD`). Builds sind nicht reproduzierbar. | `package.json:115`, `server/lib/__tests__/wikifolio.test.ts` | Paket veröffentlichen, vendoren oder Feature entkoppeln. | M |

### 6.3 Positiv (keine Massnahme nötig)

Kein `.env` committet; `.gitignore`/`.env.example` sauber; bcrypt Cost 10; Cookies `httpOnly`/`lax`/`secure`; `jose` mit Algorithmus-Pinning; die übrigen ~80 Root-Skripte nutzen durchweg `process.env`.

---

## 7. Tests

### 7.1 KRITISCH

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| T-01 | **Die Suite ist auf `main` dauerhaft rot** (verifizierter Lauf: 11 failed / 325 passed / 2 skipped in 42 Dateien): 2 echte veraltete Erwartungen in `performanceCalculations.test.ts:429–484`; 3 Dateien laden wegen C-08 gar nicht; Rest benötigt Live-APIs/DB/env (`sornetteApi`, `wikifolio`, `tradingview-mcp`, `portfolioManagement`). Eine rote Suite wird ignoriert — ihr Signalwert ist null. `pnpm check` (tsc) ist grün. | s. links | (a) Stale Erwartungen aktualisieren, (b) C-08 fixen, (c) env-/netzabhängige Tests hinter `describe.skipIf(!process.env.X)` bzw. separaten `test:integration`-Lauf. Danach ist die Unit-Suite offline grün. | S–M |

### 7.2 WICHTIG

| ID | Befund | Fundstelle | Massnahme | Aufwand |
|---|---|---|---|---|
| T-02 | **Fünf Kern-Testdateien sind Scheintests:** `__tests__/portfolioPerformance.test.ts` (15 Tests) testet Re-Implementierungen aus `testHelpers.ts`, nicht den Produktionscode; `currencyConversion`, `portfolioWeightDistribution`, `realizedGainsAndCosts` importieren **keinen** Produktionscode; `editPosition.test.ts` prüft tautologisch die eigenen Mocks; `auth-guards.test.ts` wird auch ohne laufenden Server grün (Netzwerkfehler wirft ebenfalls) — hätte A-02/A-03 nie gefunden. | `server/__tests__/*` | Durch Charakterisierungstests gegen echte Module ersetzen (siehe `CHARACTERIZATION_TESTS.md`). | M |
| T-03 | **Ungetestete Rechen-/Parsermodule:** `performanceHypothetical.ts` (589 Z.), `lib/performanceService.ts` (469 Z.), `lib/swissquoteParser.ts` (460 Z. — parst Bank-PDFs, null Tests), `qualityMetricsService`, Realized-Gains-Verkaufspfad in `db.ts`. Keine Tests für Splits, Zeitzonen-/Stichtagsgrenzen, Shorts/Oversell. `vitest.config.ts` deckt nur `server/**` ab — `client/` und `analytics_service/` laufen in keinem Testlauf. | s. links | Abdeckung gemäss `CHARACTERIZATION_TESTS.md` aufbauen; Client-Formatter (nach D-06) und Python-Service in CI aufnehmen. | M–L |

### 7.3 Positiv

`lib/performanceEngine.test.ts` (26 Tests, TTWROR/IRR inkl. Flows und Konvergenz), `performanceCore`, `weightedReturnSeries`, `fxPriceConvert`, `cashAdjust`, `riskStats` testen echte Logik und sind fachlich gut — auf dieser Basis lässt sich aufbauen.

---

## 8. Kundenbefunde aus der Fachprüfung («Überarbeitung Portfoliomanager» Teil 1–4)

Der Auftraggeber hat vier Dokumente mit eigenen Beobachtungen geliefert (Teil 1 Dashboard/Portfolios, Teil 2 Aktien, Teil 3 Markt, Teil 4 Copilot). Alle technisch prüfbaren Punkte wurden gegen den Code verifiziert; die Tabelle mappt jeden Punkt auf einen Plan-Eintrag. **Bugs** wurden oben in die Kategorien 1–7 eingereiht (IDs R-29 … R-35, A-14, U-19/U-20); reine **Feature-/Redesign-Wünsche** erhalten hier F-IDs (sie sind keine Audit-Befunde, gehören aber in die Umsetzungsplanung, da mehrere Mockups von Claude Design existieren).

> **Teil 4 (Copilot):** Die Fachprüfung des Copilot-Bereichs steht auftraggeberseitig noch aus — das Dokument enthält bewusst nur die Überschrift. Befunde werden nachgeliefert und dann hier ergänzt.
>
> Teil 1 ist laut Auftraggeber teilweise bereits von Manus umgesetzt; die Verifikation erfolgte gegen den Repo-Stand `ed96859` — bereits umgesetzte Punkte sind entsprechend als «erledigt/vorhanden» markiert.

### 8.1 Verifikations-Ergebnis der gemeldeten Fehler

| Kundenbefund | Verdikt | Plan-ID | Kern-Ursache |
|---|---|---|---|
| «Tagesveränderung kann immer noch nicht stimmen» (Teil 1) | **bestätigt** | **R-29** (kritisch) | Heute = `stocks.currentPrice` (18:00-Cron) vs. Gestern = `historicalPrices`-Close; asymmetrisches Skipping lässt ganze Positionswerte als Tagesgewinn erscheinen |
| Konstellation: Titel «zusammengequetscht», Holcim-Ausreisser «können nicht stimmen» (Teil 1) | **bestätigt** (beides) | **R-30** (Daten) + **F-05** (Darstellung) | YTD aus rohen, nicht Split-/Spin-off-adjustierten Kursen (Amrize-Spin-off Juni 2025); dazu Achsen-Floors (`xMax≥30`, `yMax≥40`) und Rand-Clamping in `PositionsKonstellation.tsx:121–134` |
| Demo-Portfolios dürfen keine Transaktionen haben (Teil 1) | **bestätigt** | **U-19** + **A-14** (kritisch) | Transaktionen überleben Live-Deaktivierung; `create`/`list` ohne Ownership-/Demo-Guard |
| Transaktionen: Löschen-Button einzeln/Bulk «hinzufügen» (Teil 1) | **bereits vorhanden** | — (U-08 verbessert den Bestätigungsdialog) | Einzeln (`PortfolioDetailsPage.tsx:262–295`) und Bulk (`:1187–1195`) existieren, für Demo ausgeblendet |
| Score-Verwirrung: 64/100 vs. Strategie-Scoring vs. Gesamt-Scoring 50/100 (Teil 2) | **bestätigt** | **R-33** (kritisch) + **F-07** | **Vier** unabhängige Score-Systeme, drei gleichzeitig sichtbar; Header-Score fällt auf `Math.random()` zurück; TA-Score 50 ist der «keine Daten»-Default; Erklärdialog beschreibt erfundene Gewichtung |
| DCF zeigt «immer massive Überbewertung» (Teil 2) | **bestätigt** | **R-32** | WACC-Floor 8 % + Spread-Floor 3.5 % + 5-J.-Wachstums-Decay + FCF-Cap ⇒ systematischer Bias |
| Optimizer schlägt Extrem-Positionen vor; Regeln max 10 %/min 1 %, min CHF 3'000, min 15 Titel (Teil 1) | **teilweise bestätigt** | **R-34** | 1–10 %-Bounds existieren seit kurzem, sind aber bei < 10 Titeln unerfüllbar und werden clientseitig wieder verletzt; CHF-/Titelanzahl-Regeln sind nur Anzeige-Checks |
| Effizienzgrenze «stimmt nicht mit Mockup überein (hardcoded?)» (Teil 1) | **nicht hardcoded, aber inkonsistent** | **R-34** | Echte Berechnung (Random-Search, 252 Tage), jedoch **ohne** die Gewichts-Constraints → Kurve passt nicht zum beschränkten Optimum |
| Indexstände MSCI World und Gold «stimmen nicht» (Teil 3) | **bestätigt** | **R-35** | GLD-ETF-Preis als «GOLD»-Stand; MSCI-World-Ticker fehlt ganz, Chartlinie serverseitig immer 0 % |
| Bubble-Indikator: «grüne Boxen unten leer — Funktion?» (Teil 1) | **teilweise bestätigt** | **F-08** | Boxen = «Risk Assessment Summary» aus `getRiskMetrics`, das in mehreren Pfaden ein Null-Objekt liefert (`dashboardRouter.ts:1579,1589,1624`); Bubble-History wird im Sornette-Pfad hart geleert (`:1869`); Detail-Popup existiert (`BubbleDetailModal`), zeigt Komposition aber nur bei `source === 'sornette_api'` |
| Gebührenstruktur unter Einstellungen hinterlegbar (Teil 1) | **bereits vorhanden, aber nicht verdrahtet** | **U-20** | Gebühren-Tab mit Broker-Presets existiert; Kauf-Maske setzt `fees: "0"` hart |
| Dividendenkalender mit Live-Zahlen des aktuellen Portfolios (Teil 3) | **teilweise vorhanden, fehlerhaft** | **R-31** + **F-06** | Backend pro Portfolio existiert (echte EODHD-Daten, echte Stückzahlen), aber: FX hartkodiert, `entry`-Transaktionen ignoriert (→ leerer Kalender bei via `toggleLive` aktivierten Portfolios), kein Tab im Portfolio-Detail |
| KI-Prognose «funktioniert nicht zuverlässig» (Teil 2) · Backtest «kein Alpha» (Teil 2) | Bestandsaufnahme | **F-09** | KI-Prognose ≈ 1'150 LOC (Tab + Router + Admin-Trainer), Backtest ≈ 2'700 LOC in zwei Systemen; Rückbau-/Ausblende-Entscheid nötig |

### 8.2 Feature-/Redesign-Wünsche (aus Teil 1–3, mit Mockups)

| ID | Wunsch | Bezug | Aufwand |
|---|---|---|---|
| F-01 | **Dashboard-Ersatz** durch neues UI/UX-Design (Claude-Design-Mockup); Portfolios-Übersicht übernimmt das bisherige Dashboard; KPI der alten Übersicht integrieren; Portfolio-Auswahl als **Dropdown** statt einzelner Buttons; Hover-Tooltips für Sharpe- und Bubble-KPI. Teilweise durch Manus umgesetzt — Abgleich mit Mockup nötig. | Teil 1; Mockups in `design/` ablegen | L |
| F-02 | **Aktions-Pop-ups statt Navigations-Buttons** für Empfehlungen («Sektoren überprüfen», «Top-Positionen analysieren»): Vorschläge anzeigen → anpassen → umsetzen. Umsetzungsregel: **Demo** = nur Positionen ändern, **Live** = echte Transaktionen inkl. Gebühren aus Einstellungen (setzt U-19, U-20, R-01/R-02 voraus). | Teil 1 | L |
| F-03 | **Performance-Attribution** als neue Box im Performance-Tab: Beitrag nach Sektor, Assetklasse, Einzeltitel und **Währung** (Wasserfall-Diagramm; Mockup-Vorschläge folgen von Claude Design). Realisierte Gewinne als aufklappbare Box (bei Demo leer). Voraussetzung: R-01/R-02/R-19 (sonst Attribution auf falschen Zahlen). | Teil 1 | L |
| F-04 | **Top-Positionen klickbar** zur Aktien-Detailseite — Achtung: die bestehenden Links zeigen auf die nicht existierende Route `/stocks/:ticker` (= Befund U-04, bereits kritisch eingestuft). | Teil 1 | S |
| F-05 | **Konstellation-Darstellung**: Achsen-Floors entfernen (Quantil-basierte Domains), Ausreisser nicht an den Rand clampen, sondern näher heranholen mit Pfeil-Indikator «ausserhalb der Skala»; Bubble-Radien reduzieren. Datenkorrektur via R-30. | Teil 1; `PositionsKonstellation.tsx:81–137` | S |
| F-06 | **Tab «Dividenden»** im Portfolio-Detail (nach «Transaktionen») auf Basis von `dividendCalendar.calendar` mit Live-Stückzahlen — nach R-31-Fixes. Bestehende tote Artefakte (`DividendCalendar.tsx`, `DividendCalendarModal.tsx`) dabei entfernen (D-05). | Teil 3 | M |
| F-07 | **Neues Score-Konzept**: ein klar benannter **Qualitäts-Score** (langfristig, fundamental) + ein **technisches Signal** (kurzfristig) statt drei konkurrierender Scores; je Info-Tooltip mit echter Gewichtung. Aufräumen der vier Systeme (`scoring.ts`, `tradingview.stockScoring`, TA-Score, Builder-Score gem. `SCORE_CALCULATION.md`). | Teil 2 | M |
| F-08 | **Risiko-Tab**: «Keine Daten»-Zustand statt leerer/0.0-%-Boxen (Null-Objekt-Pfade in `getRiskMetrics`); Bubble-History auch im Sornette-Pfad befüllen; `BubbleDetailModal` (Zusammensetzung/Gewichtung) für alle Quellen anzeigen; KPI-Tooltips. | Teil 1; `RiskTab.tsx:31–130,256,278–322`, `dashboardRouter.ts:1579–1869` | S |
| F-09 | **KI-Prognose ausblenden** (unzuverlässig; Tab `StockDetail.tsx:560/864`, Route, Nav) und **Backtest-/Signal-Framework-Entscheid**: alle Strategien unterliegen Buy & Hold (kein Alpha) — Feature-Flag/Ausblenden statt sofortigem Löschen; Signal-Framework in die Signale-Seite integrieren (gem. Mockup). | Teil 2 | S (ausblenden) / M (Rückbau) |
| F-10 | **Aktien-Detailseite restrukturieren** (gem. Mockups Teil 2): News aus der Übersicht entfernen (eigener Tab existiert), Tab «Chart & TA» direkt nach der Übersicht, «Bewertung» neu strukturieren (verständliche Einordnung), Signale-Seite gemäss Mockup neu. | Teil 2 | M–L |
| F-11 | **Marktseite**: mehrere Timeframes, Toggle Lokalwährung/CHF, Regime-Seite gemäss Design-Mockup vereinfachen. Datenkorrektur via R-35. | Teil 3 | M |
| F-13 | **Admin: Aktienliste und Watchlist mergen** (Vorgabe Auftraggeber, 2026-07-03). Ist-Zustand: zwei getrennte Tabellen ohne Beziehung — `stocks` (`schema.ts:74–109`, Stammdaten inkl. Moats, von Optimizer/Builder/PriceAlerts genutzt) und `watchlistStocks` (`schema.ts:569–601`, kuratiertes Universum inkl. `signalScore`/`signalType`, speist die Nutzer-Seite `/aktien` via `invest.filter`). `AdminStocks.tsx` ist weitgehend obsolet (Hinzufügen/Edit/Delete-Buttons **ohne onClick**, `:74–77,119–124`). Umsetzung: `listType`-Enum (`empfehlung`/`watchlist`) auf `watchlistStocks`; ein zusammengeführtes Admin-UI (AdminWatchlist erweitert) mit Header-Umschalter «Empfehlungen \| Watchlist \| Alle» und Toggle pro Zeile; `/aktien` zeigt default nur `empfehlung`; AdminStocks-Seite zurückbauen. `stocks` bleibt unangetastet (trägt Portfolios). | Vorgabe; `drizzle/schema.ts:569–601`, `server/routers/watchlistRouter.ts`, `client/src/pages/AdminWatchlist.tsx`, `AdminStocks.tsx` | M |
| F-14 | **Signal-Konzept konsolidieren** (Vorgabe Auftraggeber; konkretisiert F-07/F-09). Ist-Zustand: **3½ parallele Signal-Engines** (Regel-Engine `signalsRouter.generateSignal:254`, Signal-Orchestrator mit `buy/add/hold/reduce/sell`-Semantik inkl. `targetWeight`/StopLoss (`lib/signals/types.ts:148–180`), Watchlist-Score (`watchlistRouter.ts:16–70`), TradingView-Scoring/ML) mit potenziell widersprüchlichen Aussagen; die fertige Signale-Seite `Signals.tsx` ist **nicht geroutet**. **Mess-Infrastruktur existiert bereits**: `signal_history`-Tabelle (`schema.ts:779–808`), täglicher Snapshot-/Evaluations-Cron (`signalEvaluationCron.ts` — evaluiert nach `holdingPeriodHint`, default 14 Tage), Trefferquote/Ø-Return pro Engine/Regime im Admin (`adminRouter.getSignalPerformance:652–770`, `AdminSignalPerformance.tsx`) — aber: **kein Benchmark-Vergleich (kein Alpha)**, Snapshot nimmt `stocks` statt Watchlist (`:122–126`), Historie erst ab Cron-Aktivierung. Zweites paralleles Tracking: `copilotHistory` (30/60/90-Tage-Auswertung, `schema.ts:626–659`). Zielbild: (a) **ein** kanonischer Signalgeber = Orchestrator (nur er wird evaluiert); (b) Anzeige: Signale-Tab unter `/aktien` (Signals.tsx-Inhalt reaktivieren) + StockDetail; Kauf/Verkauf/Erhöhen/Reduzieren **mit Stückzahl/CHF** (setzt R-36-Fix voraus); (c) Empfehlungs-Historie nutzerseitig sichtbar («Empfehlung vom X, seither +Y %, vs. Benchmark +Z %») aus `signal_history`+`copilotHistory` — in der Sektion Portfolios/Signale, nicht im Copilot (konsistent mit F-12); (d) Alpha-Messung: `benchmarkReturnPct`-Spalte in `signal_history`, Benchmark-Return (SMI/MSCI) über dasselbe Fenster, Alpha = Return − Benchmark; Watchlist-Ticker in den Snapshot aufnehmen. | Vorgabe; Fundstellen s. links | M–L |
| F-15 | **Wikifolio: Trader-Suche + funktionierender Import** (Vorgabe Auftraggeber). Warum der Import heute scheitert (verifiziert): (1) `wikifolioService.authenticate()` liest nur `process.env.WIKIFOLIO_EMAIL/PASSWORD` (`wikifolioService.ts:85–89`) und ignoriert den DB-Secrets-Manager — über die Admin-Secrets-Seite erfasste Credentials kommen nie an; die Keys fehlen auch in `.env.example`. (2) Der Import schreibt **ISINs als Ticker** (`watchlistRouter.ts:696–727`, `:699`) — jede spätere Kursabfrage/Verlinkung schlägt fehl, importierte Zeilen sind unbrauchbar. (3) Login-Heuristik fragil (`wikifolioService.ts:128–134`). Trader-Suche: das bereits installierte, aber **nie importierte** npm-Paket `wikifolio` unterstützt `search({ sortBy: 'perf12m' \| 'sharperatio' \| 'aum', investable, realMoney })` — genau «erfolgreiche Trader suchen». Umsetzung: Secrets-Anbindung via `getSecret()` (S); Such-Card in AdminWikifolio mit Kriterien-Dropdown + Import-Button pro Trader (S–M); ISIN→Ticker-Auflösung via Yahoo-Search vor dem Insert, dann bestehenden `refreshMetrics`-Pfad nutzen; `source: 'wikifolio'` + `listType` gem. F-13 (M). **Vorbehalt:** Wikifolio hat keine offizielle API — Login-Scraping kann jederzeit brechen und ist ToS-rechtlich heikel; bewusster Entscheid nötig. | Vorgabe; `server/lib/wikifolioService.ts`, `server/routers/watchlistRouter.ts:696–727`, `client/src/pages/AdminWikifolio.tsx` | M |
| F-12 | **Copilot verschlanken auf Chat + Verlauf** (Vorgabe Auftraggeber, 2026-07-03): Der Copilot-Hub hat heute 5 Tabs (Insights/Chat/History/Signals/Deepdive, `CopilotHub.tsx:82–94`). Zielbild: **Copilot = nur Chat und Chatverlauf**; die übrigen KI-Tools wandern an ihren fachlichen Ort, konsistent mit den bestehenden Strukturen: **Insights** → ins Dashboard bzw. in die Portfolios-Übersicht (dort werden `getCopilotInsights` bereits abgefragt, vgl. D-11 — keine Doppel-Anzeige an zwei Orten); **Signals** → in die Signale-Seite der Aktien-Sektion (zusammen mit F-09/F-10, wo auch das Signal-Framework integriert wird); **Deepdive** → in die Sektion «Portfolios» (als Analyse-Einstieg neben den bestehenden Optimierungs-Tabs der Portfolio-Detailseite — **keinen** zweiten Optimierungs-Ort schaffen, `OptimierenTab` existiert bereits). Navigation/Routen entsprechend anpassen (`/copilot` behält Chat; alte Tab-Deep-Links redirecten). Detail-Review des Copilot-Chats durch den Auftraggeber steht noch aus; weitere Befunde werden hier ergänzt. | Teil 4 + Vorgabe; `client/src/pages/CopilotHub.tsx`, `PortfolioCopilot.tsx` (tot), `DashboardLayout.tsx` | M |

---

## Empfohlene Umsetzungsreihenfolge

Die Phasen sind so geschnitten, dass Berechnungsfixes, Refactoring und UX getrennt umsetzbar und einzeln live verifizierbar sind (CLAUDE.md: «Done heisst verified live»).

### Phase 0 — Sofortmassnahmen Sicherheit/Compliance (≈ 1–2 Tage, alles S)
1. A-02: `adminRouter` auf `adminProcedure` (verhindert Löschung der globalen Daten durch beliebige Nutzer)
2. A-03/C-04: Debug-Endpoints `debug.envKeys` + `debugTest.*` entfernen
3. U-01: `stocks.importPrices` → `adminProcedure`, Menüpunkt «Import» aus der Nutzer-Navigation
4. C-03: FMP-Key rotieren
5. C-05: PII-Logging entfernen/maskieren (E-Mail, Mobile, Auth-Log)
6. U-04: `/stocks/:ticker`-404-Links fixen · U-05: ErrorBoundary deutsch/ohne Stack
7. C-07/C-08: JWT-Expiry angleichen; Resend lazy init
8. A-14: Ownership-/Demo-Guard auf `portfolioTransactions.create`/`.list`
9. R-33: Zufalls-Score-Fallback auf der Aktienseite entfernen

### Phase 1 — Testfundament (≈ 3–5 Tage)
1. T-01: Suite grün machen (stale Tests, skipIf, Integration separieren)
2. Charakterisierungstests CT-1 … CT-10 gemäss `CHARACTERIZATION_TESTS.md` schreiben — **Voraussetzung für Phase 2**
3. T-02: Scheintests ersetzen bzw. als solche markieren

### Phase 2 — Berechnungskorrekturen (≈ 2–3 Wochen, streng in dieser Reihenfolge)
1. R-01 + R-02 (Vorzeichen-/Fee-Normalisierung — entsperrt alles Weitere)
2. R-03 (Kostenbasis) + Backfill der `realizedGains`
3. R-04/R-05: `performanceCalculations.ts` zugunsten `performanceService` stilllegen
4. R-06/R-07/R-09 (Dashboard-Sortierung, Cashflows, YTD-Jahr) — drei schnelle, sichtbare Fixes
5. R-10 (FX-Fallback) + R-13 (PDF-Import) — zusammen mit U-13 (UI-Ausweis fehlender Daten)
6. R-29 (Tagesveränderung) + R-30 (YTD/Corporate Actions — behebt den Holcim-Ausreisser) — beide hoch kundensichtbar
7. R-35 (Marktindizes GLD/MSCI) + R-31 (Dividendenkalender) — zwei schnelle, sichtbare Fixes
8. R-08 (Smoothing/Fake-Fallback entfernen), R-11 (adjustedClose/Splits), R-12, R-15 … R-23, R-32 (DCF), R-34 (Optimizer-Constraints)

### Phase 3 — Konsolidierung/Refactoring (≈ 2–3 Wochen)
1. D-02 (FX auf `fxHelper`), D-03 (ein Scheduling-System)
2. D-04/D-05: Tote Dateien löschen (Server + ~70 Frontend-Dateien; U-03-Komponenten vorher retten)
3. D-09: Repo-Root aufräumen (inkl. 17-MB-PDF)
4. D-06 (`lib/format.ts`) + G-01/G-09 + D-07 (Farbpaletten) + D-10/D-08
5. A-04/A-05 (zod flächendeckend), A-07 (Fehlerkonvention), A-08, A-09, A-10

### Phase 4 — UX für die Zielgruppe 50+ (≈ 2–3 Wochen)
1. U-02/U-03: Import-Flow reparieren (Swissquote-Import + TransactionModal anschliessen, dabei R-12)
2. U-06: Onboarding-Brücke zum ersten Portfolio (Demo-Portfolio anbieten)
3. U-07/U-13: Fehler- und Datenqualitätszustände statt stummer Nullen
4. G-02 (Schriftgrössen/Kontrast), G-04 … G-08, U-08 … U-12, U-14
5. U-15/U-16/G-10/G-11: Sprach- und Begriffs-Pass (konsequent Sie, Deutsch, Glossar)
6. U-19/U-20 (Demo-/Live-Semantik, Gebühren-Verdrahtung) — Voraussetzung für F-02
7. Kunden-Features aus Abschnitt 8.2 in Mockup-Reihenfolge: F-04/F-05/F-08/F-09 (S) → F-06/F-07/F-10/F-11/F-12/F-13/F-15 (M; F-12 Copilot-Verschlankung zusammen mit F-09/F-10/F-14, da Signals/Signal-Framework/Empfehlungs-Historie gemeinsam an die Signale-Seite bzw. Portfolios-Sektion wandern) → F-01/F-02/F-03/F-14 (L-Anteile; F-02/F-03/F-14c erst nach Phase 2, da sie auf korrekten Zahlen aufsetzen müssen; R-36 vor jedem Rebalancing-Feature)

### Phase 5 — Strukturelle Zielarchitektur (L, nach Stabilisierung)
1. R-14: Decimal-Migration (Schema + decimal.js) — hinter den Charakterisierungstests
2. A-01: Ghostfolio-konformes Domänenmodell + OpenWealth-Adapter-Schicht; Datenmodell-Konsolidierung (ein Preis-, ein Instrument-, ein Holdings-Modell)
3. A-06/D-01: Service-Layer + eine Performance-Engine
4. C-01/C-02: Rechtstexte und Datenflüsse revDSG-konform (mit juristischer Begleitung)
5. R-22: Rappenrundung als fachliche Konvention einführen · G-03: Token-Migration/Light-Mode-Entscheid

---

## Abgrenzung / bekannte Unschärfen

- Zeilenangaben beziehen sich auf Commit `ed96859`; nach den ersten Löschrunden (D-04/D-05) verschieben sie sich.
- `TransactionModal`/`SwissquotePDFImport` sind derzeit unerreichbar (U-03); dort verortete Rechenfehler (R-12, Teil von R-01) sind latent, werden aber beim Wieder-Anschluss aktiv — vor U-03 fixen.
- Die Testlauf-Ergebnisse (T-01) stammen aus einer Sandbox ohne Zugriff auf das private `wikifolio`-Repo; lokal können einzelne der 11 Failures anders ausfallen (die 2 Failures in `performanceCalculations.test.ts` sind umgebungsunabhängig reproduzierbar).
- Aufwandsschätzungen sind Netto-Engineering-Aufwände ohne Review-/Deploy-Zyklen (manus.space-Deploy-Lag 8–28 min pro Verifikation einplanen).
