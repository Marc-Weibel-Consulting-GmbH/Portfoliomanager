
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
- [ ] DB-Schema: marketReports Tabelle (id, date, title, content, source, createdAt)
- [ ] Backend: POST /api/market-report Endpunkt für Manus-Task-Output
- [ ] Backend: tRPC marketReport.getLatest und marketReport.list Prozeduren
- [ ] Frontend: Markt-Seite um Market-Update-Bericht-Sektion erweitern
- [ ] Manus Skill/Task: Bericht nach Generierung via API an Portfoliomanager senden
