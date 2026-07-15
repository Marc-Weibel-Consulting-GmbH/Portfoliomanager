
- [x] Fix ROG.SW → RO.SW (Roche Holding AG) - EODHD uses RO.SW for SIX Swiss Exchange
- [x] Fix HELN.SW → HBAN.SW (Helvetia Baloise Holding AG) in watchlist + portfolio data
- [x] Deactivate MESA.US (delisted Nov 2025, merged with Republic Airways)
- [x] Backfill LVMUY historical prices (1633 records, 2020-2026)
- [x] Backfill RO.SW historical prices (15816 records from 1995)
- [x] Backfill HBAN.SW historical prices (17050+ records)
- [x] Update portfolioData in savedPortfolios (Yvonne, Demo Swiss Blue Chips) for ROG.SW→RO.SW and HELN.SW→HBAN.SW
- [x] Centralize toEodhdSymbol() mapping across ALL server files (12+ files fixed)
- [x] Add Italian (.MI → .F Frankfurt proxy), London (.L → .LSE), Warsaw (.WA → .WAR), Australian (.AX → .AU) exchange mappings to eodhdSymbol.ts
- [x] Fix multiApiDataMerger.ts to use toEodhdSymbol
- [x] Fix stockDataApi.ts to use toEodhdSymbol
- [x] Fix tickerValidator.ts to use toEodhdSymbol
- [x] Fix analytics/engine.ts to use toEodhdSymbol
- [x] Fix analytics/optimizerWorker.ts to use toEodhdSymbol
- [x] Fix analytics/signalOptimizer.ts to use toEodhdSymbol
- [x] Fix qualityMetricsService.ts to use toEodhdSymbol
- [x] Fix cron/ytdUpdater.ts to use toEodhdSymbol
- [x] Fix historical-pe.ts to use toEodhdSymbol
- [x] Fix logoService.ts to use toEodhdSymbol
- [x] Fix backfillHistoricalPrices.ts to use toEodhdSymbol
- [x] Fix routers/weeklyOverviewRouter.ts to use toEodhdSymbol
- [x] Fix routers/stocksRouter.ts to use toEodhdSymbol
- [x] Fix ytd-performance.ts to use toEodhdSymbol (prioritize mapping over variant fallback)
- [x] Backfill ACWI.US (MSCI World), CHSPI.SW (SMI), SPY (S&P500) benchmark data to 2026-07-06
- [x] Populate benchmarkData table for MSCI_WORLD, SMI, SP500 (397/393/397 rows)
- [x] Add benchmark proxy tickers (ACWI.US, CHSPI.SW, SPY) to daily historicalPrices import
- [x] Add refreshBenchmarkData() call to daily historicalPricesCron (runs after main import)
- [x] Rename SMI → SPI everywhere (Dashboard, MarktHub, TradingViewWidget, PortfolioDetailsPage, marketRegimeRouter, dashboardRouter, marketAnalysisCron)
- [x] Benchmark backfill: ACWI.US (2055 rows), CHSPI.SW (2078 rows), SPY (2075 rows) in benchmarkData from 2020-01-01
- [x] PDF export for AdminBerechnungen (browser print dialog with formatted HTML)
- [x] Text copy function for AdminBerechnungen (per-formula copy button + copy-all + TXT download)
- [x] Day Change cashflow-bereinigen: Bereits korrekt implementiert in dayChange.ts (symmetrisches Skipping R-29, nur historicalPrices closes, keine currentPrice-Mischung). Dokumentation in AdminBerechnungen aktualisiert.
- [x] FX-Bewertungsdatum: Bereits korrekt implementiert (convertToCHF mit today für Marktwert, Transaktionsdatum für Kostenbasis). Dokumentation in AdminBerechnungen mit zwei getrennten Formeln aktualisiert.

## Score-System Überarbeitung (2026-07-09)
- [x] Qualitäts-Score: fehlende Daten (ROE/D-E/FCF/Margin alle null) → Grade 'N/A' statt 'C'
- [x] Signal-Score-Anzeige: Transparenz-Panel mit Erklärung der Komponenten
- [x] Optimierungs-Prompt: LLM bekommt Signal-Score, Qualitäts-Score und Signal-Typ als Input
- [x] Optimierungs-Empfehlungen: Nur "aufstocken" wenn Signal-Score >= 55 (BUY-Zone)

## Signal-Konsistenz Fix (2026-07-09)
- [x] Signal-Typ-Berechnung: RF-Flags und combined Score müssen denselben Signal-Typ ergeben
- [x] RF-Flags nicht als Widerspruch anzeigen, sondern als Begründung für den Signal-Typ
- [x] Grade C-Badge im Signale-Tab entfernen oder erklären (ist Qualitäts-Grade, nicht Signal-Grade)
- [x] Begründungstext muss mit Signal-Typ übereinstimmen

## Tägliches Market-Update Integration (2026-07-09)
- [x] DB-Schema: marketReports Tabelle (id, date, title, content, source, createdAt)
- [x] Backend: POST /api/market-report Endpunkt für Manus-Task-Output
- [x] Backend: tRPC marketReport.getLatest und marketReport.list Prozeduren
- [x] Frontend: Markt-Seite um Market-Update-Bericht-Sektion erweitern
- [x] Manus Skill/Task: Bericht nach Generierung via API an Portfoliomanager senden (Anleitung an Benutzer geliefert, manuell im Chancen-Task konfigurieren)

## Performance-Optimierung (2026-07-09)
- [x] Frontend: Code-Splitting und Lazy Loading für alle Seiten-Komponenten (Bundle 3.6 MB → 498 kB, −86%)
- [x] Frontend: react-markdown und andere grosse Libraries dynamisch laden
- [x] Backend: Redis-Caching für Portfolio-Detail (2 min TTL, cache-aside Pattern)
- [x] Backend: N+1-Probleme in portfoliosRouter beheben (getStocksByTickers Batch-Query)
- [x] Backend: Parallele Fetches statt sequentielle in getWithCurrency
- [x] Backend: DB-Indexes für häufige Queries prüfen und ergänzen (savedPortfolios.userId Index hinzugefügt)

## Bug Fixes & Improvements (2026-07-11)
- [x] Fix Anlageprofil crash: add defensive null-checks + local ErrorBoundary in AnlageprofilTab
- [x] Fix signal scoring: change blendCombinedScore factor 0.8→1.0 so neutral stocks get HOLD instead of SELL
- [x] Fix cash balance deduction: applyOptimization should update cashBalance in savedPortfolios
- [x] Create market_regime_history table migration (DB insert failures in cron logs)

## KI-Boom Monitoring Verbesserungen (Juli 2026)
- [x] DB-Tabelle ki_boom_metrics_history für historisches Tracking aller Signalwerte
- [x] Täglicher Heartbeat-Job zum automatischen Speichern der Metriken
- [x] Backend: getHistory-Procedure für historische Daten pro Metrik
- [x] Szenario-konsistente Ausstiegsempfehlung (kein Sofortausstieg wenn nur 1 Kriterium rot)
- [x] Frontend: Historische Linien-Charts für jedes Ausstiegskriterium
- [x] Frontend: Ausstiegskriterien-Karte mit Live-Status (Ampel) statt statischer Liste

## Optimierung anwenden (Juli 2026)
- [x] Backend: applyOptimization erweitern — Verkäufe schwacher Positionen + Käufe neuer Titel in einem Schritt
- [x] Frontend: "Optimierung anwenden" Button mit Bestätigungs-Dialog (zeigt Verkäufe + Käufe + Cash-Effekt)
- [x] Frontend: Fortschrittsanzeige während Transaktion läuft (Spinner + "Wird gebucht…" Text)

## Optimierung anwenden — Erweiterungen (Juli 2026)
- [x] Backend: undoRecommendations Prozedur — löscht Transaktionen anhand IDs + stellt cashBalance wieder her
- [x] Backend: applyRecommendations gibt transactionIds zurück (für Undo)
- [x] Frontend: Snapshot-Checkbox im Dialog ("Snapshot vor Umsetzung erstellen")
- [x] Frontend: Kandidaten-Slider (Top 3–10 neue Kandidaten konfigurierbar)
- [x] Frontend: Undo-Button nach erfolgreicher Buchung (löscht alle soeben gebuchten Transaktionen)

## KI-Boom Historische Charts Backfill (Juli 2026)
- [x] Backfill-Skript: 65 Handelstage (13.04.–10.07.2026) in ki_boom_metrics_history eingefügt
- [x] NVDA-Preise und Mag7-YTD aus historicalPrices DB berechnet
- [x] Statische Metriken (OpenAI, Hyperscaler, VC, ROI) für alle Tage eingetragen
- [x] Charts zeigen korrekte Zeitreihe mit vollständiger X-Achse (13.04.–11.07.)

## Yahoo Finance → EODHD Migration (engine.ts)
- [x] fetchReturns: Yahoo Finance chart() → DB historicalPrices (EODHD-Daten)
- [x] fetchReturnsWithDates: Yahoo Finance chart() → DB historicalPrices
- [x] fetchPricesWithDates: Yahoo Finance chart() → DB historicalPrices
- [x] calcTechnicalAnalysis: Yahoo Finance chart() → DB historicalPrices
- [x] dividendYields: Yahoo Finance quoteSummary() → stocks.dividendYield aus DB
- [x] fetchDCFFromYahoo: Yahoo Finance quoteSummary() → DB-basierter Fallback
- [x] TypeScript kompiliert ohne Fehler nach Migration
- [x] buildProposal: Scoring auf watchlistStocks.signalScore umgestellt (kein Yahoo Finance, kein Preishistorie-Scoring)
- [x] SELL-Kandidaten aus Vorschlag ausschliessen (signalType === "sell" Filter)
- [x] Max. 10% Positionsgrösse erzwingen (hartes Cap + iterative Renormalisierung)
- [x] Performance: buildProposal von >60s auf <1s reduziert
- [x] End-to-End Test: KI-Portfolio Vorschlag generiert korrekt (20 Titel, alle BUY, max 5.8% pro Position)

## Optimierung anwenden — Kritische Bugfixes (11.07.2026)
- [x] Cash-Constraint: Käufe dürfen Cash + Verkaufserlös nicht übersteigen (Dialog + Backend)
- [x] Portfolio-Refresh: Nach Buchung Redis-Cache invalidieren + tRPC-Queries neu laden

## KI-Boom Dynamische Metriken + Optimierungs-Dialog (11.07.2026)
- [x] Backend: fetchDynamicKiBoomMetrics() via Perplexity — OpenAI-Bewertung, Hyperscaler CapEx, VC-Anteil, ROI-Quote
- [x] Backend: DB-Tabelle ki_boom_dynamic_metrics (key, value, unit, source, fetchedAt) als Cache
- [x] Backend: kiBoomRouter.getDynamicMetrics Prozedur + täglicher Heartbeat-Update
- [x] Frontend: KI-Boom Dashboard zeigt dynamische Werte mit Quelle + Datum
- [x] Frontend: Optimierungs-Dialog zeigt skalierte Kauf-Beträge pro Position

## Kritischer Bug: Optimierung sichtbar im Depot (12.07.2026)
- [x] applyRecommendations: portfolioData.stocks JSON nach Buchung aktualisieren (Verkäufe entfernen, Käufe hinzufügen, Gewichte neu berechnen)

## Neue Features (12.07.2026)

- [x] Transaktions-Tab: Filter "Optimierung" als Quelle (source-Feld in portfolioTransactions)
- [x] Optimierungs-Tab: Nach Buchung automatisch zum Positionen-Tab navigieren
- [x] Optimierungs-Verlauf: Übersicht aller Optimierungen mit Datum, Anzahl Transaktionen und Cash-Effekt

## Multi-Agent Layer Verbesserungen (Jul 2026)
- [x] KI-Analyse aus Nutzer-UI entfernen (nicht sichtbar im PortfolioBuilderWizard)
- [x] KI-Analyse-Resultate in Admin-Bereich speichern und abrufbar machen (DB-Tabelle + Admin-Seite)
- [x] Kennzahlen-Filter: Vorschläge nur umsetzen wenn Sharpe/Dividende verbessert wird
- [x] Handelbarkeit (Marktkapitalisierung/Liquidität) als Kriterium im Algorithmus
- [x] Fremdwährungsanteil strikt durchsetzen (harte Grenze, kein Überschreiten)
- [x] Vertrauen-Logik verbessern: klare Kriterien für hoch/mittel/niedrig

## Positionsgrössenstreuung + Liquiditätsfilter Fix (Jul 2026)
- [x] Positionsgrössen-Cap: maxPositionPercent von 25% → 15%, minPositionPercent von 1% → 3%
- [x] Liquiditätsfilter: NULL-marketCap Werte werden jetzt als "unbekannt/zu klein" ausgeschlossen (nicht mehr übersprungen)

## Admin Pre-Approval Workflow (Jul 2026)
- [x] Backend: Admin-Endpunkt `approveProposalAndCreate` — Proposal mit editierten Positionen genehmigen und Portfolio erstellen
- [x] Frontend: AdminProposalAnalysis — KI-Empfehlungen (finalAdjustments) mit Aktions-Icons anzeigen (↓ reduzieren / ↑ aufstocken / ↔ austauschen / ✓ behalten)
- [x] Frontend: Positions-Editor mit editierbaren Gewichten und automatischer Normierung auf 100%
- [x] Frontend: «Portfolio erstellen»-Button öffnet Approve-Panel mit Portfolio-Name, Betrag, Typ (Demo/Live)
- [x] Frontend: Positions-Vorschau mit farbkodierten Aktions-Icons aus finalAdjustments
