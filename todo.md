
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

## Admin Pre-Approval Workflow Erweiterungen (Jul 2026)
- [x] Frontend: Titel-Austausch mit Suchfeld im Approve-Panel (Ersatztitel aus Universum wählen)
- [x] Frontend: Vorschlag-Vergleich — Original-Gewichte neben editierten Gewichten anzeigen
- [x] Backend + Frontend: Nutzer-Benachrichtigung nach Portfolio-Erstellung durch Admin (E-Mail + Owner-Notification)

## UX-Verbesserungen Wizard + Badge (Jul 2026)
- [x] Frontend: «Ohne KI-Anpassungen übernehmen»-Button neben Hauptbutton im PortfolioBuilderWizard
- [x] Backend + DB: isAiOptimized-Feld in savedPortfolios-Tabelle (ALTER TABLE + portfoliosRouter.create)
- [x] Frontend: «KI-optimiert»-Badge im Portfolio-Header wenn isAiOptimized=true

## KI-Empfehlung direkt anwenden + Training-Feedback-Loop (Jul 2026)
- [x] Frontend: «Empfehlung anwenden»-Button in AdminProposalAnalysis — Klick auf Empfehlung passt Gewicht automatisch an (reduce −30%, increase +30%, replace → Ticker tauschen)
- [x] Backend + DB: Training-Feedback-Loop — adminFeedback JSON-Feld in portfolioProposalLog (ALTER TABLE + Schema) + Diff-Berechnung in approveProposalAndCreate
- [x] Backend: Synthesizer-Agent liest historische adminFeedback-Signale beim nächsten Vorschlag ein (implementiert in Synthesizer-Feedback-Phase: letzten 8 Einträge, Muster-Injektion in Prompt)

## Synthesizer-Feedback + Dashboard + Alle-Anwenden (Jul 2026)
- [x] Frontend: «Alle Empfehlungen anwenden»-Button im Approve-Panel (alle finalAdjustments auf einmal anwenden)
- [x] Backend: Synthesizer-Agent liest letzte adminFeedback-Signale ein und passt Empfehlungen an (letzten 8 Einträge, Muster-Injektion in Prompt)
- [x] Frontend: Feedback-Dashboard in Admin-Ansicht (/admin/feedback-dashboard — Ticker-Muster, dominante Aktionen, Synthesizer-Bereitschaftsindikator)

## Admin-Review-Workflow Überarbeitung (Jul 2026)
- [x] Fix: Crash auf /admin/proposal-analysis beheben
- [x] Backend: saveAdminReview-Endpunkt — angepasste Positionen + Kommentare speichern, Status auf 'reviewed' setzen
- [x] Backend: getProposalById-Endpunkt — gibt gespeicherten Admin-Review zurück für Wizard-Rückkehr
- [x] Frontend: Wizard — nur Admin-Review-Block für Admins (kein Positions-Editor, kein «KI-Angepasst übernehmen»)
- [x] Frontend: Admin-Seite — Deep-Link ?proposalId=X öffnet Eintrag direkt aufgeklappt
- [x] Frontend: Admin-Seite — «Angepassten Vorschlag speichern»-Button + Zurück-zum-Wizard-Link mit returnTo-Param
- [x] Frontend: Wizard — nach Admin-Review-Rückkehr den gespeicherten Vorschlag laden (?reviewedProposalId=X) und normalen Flow fortführen
- [x] TS-Fehler behoben: korrekte Feldnamen (sharpe, expectedReturnPct, volatilityPct, fxWeightPct, meetsKennzahlenFilter)

## Admin-Review Panel Redesign (Jul 2026)
- [x] Admin-Review: 2-Spalten-Layout — Links: Originale Positionen (Algorithmus), Rechts: KI-Synthesizer-Empfehlungen mit Aktions-Badges
- [x] Admin-Review: Pro Empfehlung «Übernehmen»/«Ablehnen»-Toggle-Buttons
- [x] Admin-Review: «Alle Empfehlungen übernehmen»-Button
- [x] Admin-Review: Inline-Gewichts-Editierung pro Position (direkt im 2-Spalten-View)
- [x] Admin-Review: Vorschau der resultierenden Positionen nach Übernahme der Empfehlungen (live in der rechten Spalte sichtbar)

## Backfill-Fix für KI-Portfolios (Jul 2026)
- [x] Bug: approveProposalAndCreate löste keinen automatischen Backfill aus (fehlende historische Daten)
- [x] Fix: autoBackfillNewSymbols nach createSavedPortfolio in approveProposalAndCreate eingefügt
- [x] UX: BackfillButton nach Portfolio-Erstellung in ApprovePanel (teal, mit Spinner)
- [x] UX: Toast-Meldung informiert über gestarteten Backfill

## Admin Review Erweiterungen (Jul 2026)
- [x] Admin-Kommentarfeld: adminComments-Feld bereits im Schema (JSON: {[ticker]: string, __global__: string})
- [x] Admin-Kommentarfeld: Kommentar-Inputs im 2-Spalten-Review-Panel (global + pro Empfehlung)
- [x] Admin-Kommentarfeld: saveAdminReview speichert Kommentare, beim Öffnen werden bestehende Kommentare geladen
- [x] E-Mail-Notification: notifyOwner nach Proposal-Generierung in autoPortfolioRouter (fire-and-forget)
- [x] Review-Status-Badge: «Pending Review» (amber) / «Reviewed» (teal) Badge in der Admin-Proposal-Tabelle

## Admin Review Panel UX-Fixes (Jul 2026)
- [x] Fix: isApplied-Erkennung — expliziter acceptedSet statt Diff-Erkennung, alle Aktionstypen korrekt
- [x] Fix: Layout-Entkopplung — Klick auf Empfehlung zeigt Detail-Panel inline, Positionstabelle rechts bleibt fix
- [x] Fix: returnTo-Navigation — window.location.href statt navigate() für korrekte Query-Param-Übergabe

## Deep-Dive Gewichts-Fix (Jul 2026)
- [x] Fix: Deep-Dive verwendete shares×avgPrice statt portfolioData.weight → SON.LS zeigte 58.9% statt ~8%
- [x] Fix: portfolioData.weight wird jetzt direkt verwendet wenn vorhanden (Zielgewichte aus Portfolio-Erstellung)
- [x] Info: Div. Rendite Header (2.5%) vs Deep-Dive (3.3%) — unterschiedliche Datenquellen (DB vs EODHD). Erklärungstext unter der KPI-Karte ergänzt (EODHD vs lokale DB).

## Transaktions-Tab Bugfixes (Jul 2026)
- [x] Fix: Preis = CHF 0.00 bei Optimierungs-Transaktionen (applyRecommendations speichert keinen Preis)
- [x] Fix: Firmenname fehlt in Transaktions-Tabelle (nur Ticker sichtbar, kein companyName)

## Score & Performance Bugfixes (Jul 2026)
- [x] Fix: Qualitäts-Signal im Score-Verlauf = 1/100 (signalCacheCron skaliert jetzt -1..+1 → 0..100 beim DB-Schreiben)
- [x] Fix: Score-Komponenten zeigen immer 100/100 (Frontend-Anzeige rückwärtskompatibel für alte + neue DB-Werte)
- [x] Fix: Performance seit Kauf = 0% (portfoliosRouter nutzt jetzt Transaktions-avgBuyPrice als Fallback wenn portfolioData leer)
- [x] Fix: Score-Diskrepanz Positionen vs. Aktiendetails (Spalte umbenannt zu "Bewertung" mit erklärendem Tooltip)
- [x] DB: Alte fehlerhafte qualityScore/momentumScore Werte (0/1) aus stock_signal_cache und stock_score_snapshot gelöscht

## Admin-Dashboard Erweiterungen + Quality-Fixes (Jul 2026)
- [x] Admin: Neuer Button "Signal-Cache neu berechnen" (triggerSignalCacheRefresh) — triggert refreshSignalCache() direkt
- [x] Admin: Neuer Button "Quality-Cache leeren" (clearQualityMetricsCache) — leert 12h In-Memory-Cache für EODHD-Fundamentaldaten
- [x] Fix: Forward PEG = 0 wenn EODHD ForwardPE = 0 (Guard forwardPE > 0.1 hinzugefügt)
- [x] Fix: EPS-Stabilität = 0/100 (negative EPS-Werte wurden ausgeschlossen; jetzt werden alle Werte != 0 einbezogen, CV mit |prev| berechnet)
- [x] Performance seit Kauf: Runtime-Fallback auf Transaktions-avgBuyPrice bereits aktiv (kein JSON-Backfill nötig)

## Positions Discrepancy Bug (Jul 2026)
- [x] Fix: Positionen-Tab und Deep-Dive-Fundamentaldaten zeigen unterschiedliche Positionen/Gewichte (verschiedene Datenquellen)

## Deep Dive Optimierungen (Jul 2026)
- [x] Perf: 24h In-Memory-Cache für EODHD-Fundamentaldaten in qualityMetricsService (Ladezeit ~7s → <1s)
- [x] Perf: Sektor-Klassifikation vereinheitlichen — EODHD-Sektoren beim Aktien-Refresh in DB schreiben
- [x] Perf: 6h-Cache für Deep-Dive-KI-Zusammenfassung (LLM-Kosten sparen, Antwortzeit verbessern)

## Portfolio Quality History Charts (Jul 2026)
- [x] DB: portfolioMetricsSnapshot Tabelle (portfolioId, date, avgSharpe, avgPEG, avgDividendYield, avgBeta, avgPE)
- [x] DB: täglicher Snapshot-Cron der Metriken für alle aktiven Portfolios
- [x] Backend: tRPC-Endpunkt getPortfolioMetricsHistory mit Optimierungs-Events
- [x] Frontend: Zeitreihen-Chart (Sharpe/PEG/Dividende/Beta) mit Optimierungs-Markierungen in Portfolio-Übersicht
- [x] Frontend: Quadranten-Scatter-Chart (PEG vs. Sharpe, Blasengrösse = Dividende) mit Portfolio-Trajektorie

## Backfill-Timeout Fix (Jul 2026)
- [x] Fix: triggerPortfolioMetricsSnapshot Mutation timeout im Browser (fire-and-forget, sofortige Rückgabe)

## Bug Fixes (Jul 16, 2026)
- [x] Fix: Performance seit Kauf = +0.00% (hasBuyPrice-Flag verhindert Anzeige ohne echten Kaufpreis)
- [x] Fix: Qualitäts-Score 0/100 (byTicker berechnet Score dynamisch wenn DB-Wert = 0)
- [x] Fix: Kategorie-Klassifizierung in scoring.ts (Dividendenaktien, Wachstumsaktien, ETF, Value, Balanced, Andere)
- [x] Fix: Forward PEG / EPS-Stabilität (TTM-EPS-Berechnung schliesst EODHD-Nullwerte aus)
- [x] Fix: PE Ratio auf 1 Kommastelle gerundet (StockDetail.tsx)
- [x] Fix: Finanzkennzahlen aus EODHD live berechnen wenn DB-Felder leer (Revenue Growth, Operating Margin, ROIC)

## Portfolio-Qualität Redesign E0–E2 (Jul 2026, Konzept PR #118)

### E0 — Datenfundament reparieren
- [x] E0/D1: Fix COALESCE-Bug (Drizzle-Spaltenobjekte statt Werte → SQL COALESCE)
- [x] E0/D2: CHF-Umrechnung bei Gewichten (fxHelper.convertToCHF + GBp-Normalisierung)
- [x] E0/D3: Sharpe-Fenster rollierend 252 Tage + risikofreier Zins 2% (aus riskStats.ts)
- [x] E0/D4: Portfolio-Sharpe aus Wertreihe (performanceService) statt Ø Einzeltitel-Sharpes
- [x] E0/D5: Beta nur als heutiger gewichteter Durchschnitt, keine Fake-Historie; Filter b>0 entfernen
- [x] E0/D6: Fundamental-Backfill stoppen (PEG/PE/Dividende nur für live-Snapshots, nicht rückwirkend)
- [x] E0/Migration: Neue Spalten (source, volatility, sortino, maxDrawdown) + verunreinigte Snapshots löschen
- [x] E0/Backfill: Kursbasierte Kennzahlen 1 Jahr zurück (Sharpe/Sortino/Vol/Drawdown, source='backfill')
- [x] E0/Akzeptanz: Sharpe im Snapshot == Sharpe im Tearsheet (±0.05), Differenz < 0.001 ✓

### E1 — Portfolio Quality Score
- [x] E1: portfolioQualityScore.ts — pure Funktion, 5 Komponenten (30/25/20/15/10), 11 tests pass
- [x] E1: Fehlende Kennzahl → Renormalisierung + dataCoveragePct
- [x] E1: Snapshot-Job speichert qualityScore/qualityComponents/dataCoveragePct

### E2 — UI-Redesign
- [x] E2: KPI-Karten-Zeile (Quality Score, Sharpe, Max Drawdown, Beta, Ø Forward-PEG, Dividendenrendite)
- [x] E2: 3 Small-Multiple-Panels (Risiko&Performance, Bewertung, Ertrag) — keine Doppelachse
- [x] E2: Vorher/Nachher-Karten pro Optimierungs-Event
- [x] E2: Regelbasierte «Aktuelle Einschätzung» (deterministisch, kein LLM)
- [x] E2: Farbsystem (Cyan=Performance, Violett=Risiko, Orange=Bewertung, Grün=Ertrag, Amber=Events)
- [x] E2: connectNulls entfernt, null = Lücke

## Admin-konfigurierbare Score-Schwellen (Jul 2026)
- [x] DB: appSettings key='score_thresholds' (JSON) + Defaults in portfolioQualityScore.ts
- [x] Backend: getScoreConfig/updateScoreConfig/previewScoreConfig in adminRouter
- [x] Backend: portfolioQualityScore.ts akzeptiert optionale Config (5-Min-Cache aus DB)
- [x] Frontend: AdminScoreConfig.tsx mit Inputs pro Komponente (Gewichte + Schwellenwerte)
- [x] Frontend: Live-Preview Button (berechnet Score mit Beispiel-Portfolio)
- [x] Frontend: Reset-auf-Defaults Button
- [x] Navigation: Link in Admin-Sidebar (Gauge-Icon)

## Markt-Hub → Portfolio-Integration (Option B + C, Jul 2026)
- [x] marktHubSignals.ts: Zentrales Signal-Aggregations-Modul (Makro + Regime + MSCI-Faktoren + Marktbericht)
- [x] autoPortfolioRouter: Sektor-Tilts aus Makro-Signalen (invertierte Zinskurve, Inflation, HY-Spread)
- [x] autoPortfolioRouter: MSCI-Faktor-Tilts (Value/Momentum/Quality/MinVol) als Score-Adjustments
- [x] autoPortfolioRouter: Marktbericht-Kontext in LLM-Challenger-Prompt injizieren
- [x] autoPortfolioRouter: Market-Regime-Multiplikator (Risk-On/Off) in Gewichtung einbeziehen
- [x] analyticsRouter: riskFreeRate dynamisch aus FRED DGS10 statt hardcoded 2%
- [x] analyticsRouter: Sektor-Tilts und Regime-Kontext in LLM-Upgrade-Empfehlungen

## Algo-Backtesting Self-Learning System + Markt-Hub-Badge
- [x] DB-Schema: algoBacktestRuns (monatliche Runs mit Markt-Hub-Kontext, Algo-Version, LLM-Analyse)
- [x] DB-Schema: algoBacktestPortfolios (6 Profil-Portfolios pro Run mit Positionen + 30-Tage-Performance)
- [x] DB-Schema: algoTuningLog (Feinajustierungen mit Begründung + Overfitting-Schutz)
- [x] Backtesting-Engine: createBacktestRun() - 6 Profil-Portfolios erstellen (konservativ/ausgewogen/aggressiv × dividenden/wachstum)
- [x] Backtesting-Engine: evaluateBacktestRun() - 30-Tage-Performance messen, LLM-Analyse, Tuning-Empfehlung
- [x] Heartbeat-Cron: monatlicher Job (1. des Monats) für Portfolio-Erstellung + vormonatliche Evaluation
- [x] Express-Handler: /api/scheduled/algo-backtest
- [x] Admin-UI: Backtesting-Kachel mit Run-Übersicht, Portfolio-Details, LLM-Analyse, Tuning-Log
- [x] Admin-UI: Manuelle "Run Now" Funktion für sofortigen Test
- [x] Markt-Hub-Badge im Portfolio-Builder: aktive Sektor-Tilts + MSCI-Faktor anzeigen
- [x] Markt-Hub-Badge: buildProposal Response um marktHubContext erweitern

## Audit-Fixes Beta-Launch (2026-07-18)

### Phase 1 — Kritische Fehler
- [x] K-01: Duplikate im KI-Builder (AAPL.US + AAPL) deduplizieren
- [x] K-02: NaN-Kennzahlen im KI-Vorschlag beheben (Fallback bei fehlenden Kursdaten)
- [x] K-03: GPW.WA und nicht-investierbare Titel aus Kandidatenliste filtern
- [x] K-04: Markt-Hub-Badge Sektor-Duplikate (DE+EN) bereinigen
- [x] K-05: Falsches Datum im Marktbericht korrigieren
- [x] K-06: Heatmap Fehlerbehandlung (kein schwarzes Rechteck)
- [x] K-07: Newsroom Rendering-Bug beheben
- [x] K-08: Rechner-Seite aus Navigation entfernen (nicht funktionsfähig)
- [x] K-09: Benachrichtigungen-Tab ausblenden (leer)

### Phase 2 — UX-Verbesserungen
- [x] M-01: Registrierungs-Toast "Portfolio BIG" → korrekter App-Name
- [x] M-02: Dashboard Allokation/Treemap direkt nach Portfolio-Erstellung laden
- [x] M-03: Ticker+Firmenname Formatierungsfehler beheben
- [x] M-04: Fortschrittsbalken auf 100% nach KI-Analyse
- [x] M-08: YTD-Wert konsistent über alle Tabs
- [x] M-09: MSCI Faktoren-Chart Fehlerbehandlung
- [x] M-12: /tools Route 404 beheben
- [x] M-16: Hilfe-Tab FAQ und Kontakt hinzufügen

## N-Punkte Sprint (2026-07-18)

### Gruppe A — Landing Page & Dashboard
- [x] N-01: Landing Page Hero-Widget "Demo"-Hinweis hinzufügen (CHF 235'000 / +8.5% YTD)
- [x] N-02: "Mehr erfahren →" Links auf Landing Page zu echten Anchor-Zielen verlinken
- [x] N-04: Footer auf Landing Page: AGB, Datenschutz, Impressum Links hinzufügen
- [x] N-13: Dashboard "Willkommen zurück, Beta" → Vorname des Nutzers verwenden
- [x] N-14: Top-Gewinner/Verlierer "+0.0%" — Hinweis "Intraday-Daten folgen" wenn keine Daten
- [x] N-15: Trustpilot Widget in Footer verschieben (nicht auf internem Dashboard)

### Gruppe B — KI-Builder UX
- [x] N-07: Onboarding-Hinweis im KI-Builder: "Ihr Anlageprofil wurde übernommen"
- [x] N-08: Schritt 4 Sektoren: "Alle auswählen / Alle abwählen" Button
- [x] N-09: Placeholder "Min. CHF 100'000" → "Beispiel: CHF 100'000" klarstellen
- [x] N-10: Badge "Automatisch eingearbeitet" → "Eingearbeitet — im nächsten Schritt anpassbar"
- [x] N-11: Button-Hierarchie im KI-Vorschlag: "KI-Angepasst übernehmen" als primärer CTA
- [x] N-12: Gesamtwert vs. Startkapital Differenz erklären (Rundungsdifferenz-Hinweis)

### Gruppe C — Copilot & Einstellungen
- [x] N-19: Copilot Tabs (Chat, Verlauf) zusammenführen — Verlauf als Teil des Chats
- [x] N-20: Copilot Beispielfragen hinzufügen (Onboarding-Hinweis was der Copilot kann)
- [x] N-21: Einstellungen Profil: Profilbild-Upload oder Avatar-Initialen
- [x] N-22: Einstellungen Profil: Text anpassen für E-Mail/Passwort-Nutzer

## Beta-Onboarding (2026-07-18)
- [x] Welcome-E-Mail nach Registrierung (Resend): Begrüssung + 3 Key-Features + CTA
- [x] In-App-Banner für neue Nutzer ohne Portfolio: "Starten Sie mit dem KI-Builder" (WelcomeBanner)
- [x] Copilot Beispielfragen als Chips in der Eingabe (N-20 kombiniert)
- [x] Tour-Trigger: WelcomeBanner als erster Einstiegspunkt (localStorage-persistent)

## Aktienuniversum-Erweiterung im KI-Builder (2026-07-18)
- [x] DB-Schema: Externe Kandidaten in stocks-Tabelle mit source='ai_recommended' + notes='universe_expansion|...'
- [x] Server: Lücken-Analyse pro Sektor/Dividende/Sharpe/Momentum in universeExpansion.ts
- [x] Server: EODHD-Screening für externe Kandidaten wenn Lücken erkannt (max. 20% der Positionen)
- [x] Server: Externe Kandidaten mit Score-Berechnung und Quellenmarkierung versehen
- [x] Frontend: Externe Kandidaten im KI-Builder mit "✨ Universum"-Badge kennzeichnen
- [x] Admin: Kandidaten-Review-Seite /admin/watchlist-candidates für Watchlist-Übernahme
- [x] Admin: Bulk-Approve/Reject-Workflow für Kandidaten

## Bug: Aufstocken-Empfehlung fügt Titel nicht zur Positionsliste hinzu (2026-07-18)
- [x] Fix: applyRecommendation 'increase' — wenn Ticker nicht in positions, Titel hinzufügen statt nur Gewicht erhöhen

## KI-Erklärungsfenster (Insight-Panels) (2026-07-18)
- [x] Gemeinsame InsightPanel-Komponente (visuell attraktiv, animiert, KI-Icon, Glassmorphism)
- [x] KI-Builder Schritt 4: Erklärungspanel pro Titel (Warum dieser Titel? Score-Begründung)
- [x] KI-Builder Schritt 4: Gesamt-Portfolio-Qualitätserklärung (Warum diese Zusammensetzung?)
- [x] Portfolio-Details Deep Dive: Qualitäts-Erklärungspanel (Stärken/Schwächen-Analyse)
- [x] Synthesizer Empfehlungen: Erklärungs-Tooltip pro Empfehlung (Warum Tausch/Aufstocken/Reduzieren?)
- [x] Portfolio-Qualitätsscore: Erklärungspanel mit Detailbegründung pro Faktor

## InsightPanel Erweiterungen (2026-07-18)
- [x] Optimierungsempfehlungen: InsightExpandable pro Ersatz-Vorschlag (Warum ersetzen? Score-Gap, Cash-Bedarf)
- [x] Optimierungsempfehlungen: InsightExpandable pro Ergänzungs-Vorschlag (Warum hinzufügen? Score, Signal, Quelle)
- [x] InsightFactor: description-Feld hinzugefügt (optionale Erklärung pro Faktor)
- [x] Signale-Tab: InsightTooltip auf Score (M+Q+LPPL) — Hover zeigt Berechnungslogik
- [x] Signale-Tab: InsightTooltip auf Kriterien-Badges — Hover erklärt Kriterium

## HTTP 524 Timeout Fix — Async-Job-Muster (Jul 2026)
- [x] Backend: startProposal-Prozedur — gibt sofort jobId zurück, KI-Analyse läuft im Hintergrund (in-memory ProposalJob Registry)
- [x] Backend: getProposalStatus-Prozedur — Polling-Endpoint mit Status, Progress-Array und Ergebnis
- [x] Backend: Job-Cleanup-Intervall (alle 30 Min, Jobs älter als 2h werden gelöscht)
- [x] Frontend: PortfolioBuilderWizard — startProposal + getProposalStatus Polling (alle 3s) statt blockierendem buildProposal
- [x] Frontend: Progress-Anzeige mit Schritt-für-Schritt-Fortschritt (Berechtigungen → Profil → Diversifikation → Markt-Hub → Scoring → Positionen → Fundamentaldaten → Challenger → Synthesizer)
- [x] End-to-End Test: Job startet sofort, läuft ~5 Min im Hintergrund, Ergebnis erscheint ohne 524-Fehler

## Auto-Backfill bei KI-Portfolio-Vorschlag (Jul 2026)
- [x] Backend: autoBackfillNewSymbols vor optimizePortfolio in startProposal eingebaut (Progress-Schritt "Kurshistorie prüfen und nachladen...")
- [x] Backend: autoBackfillNewSymbols vor optimizePortfolio in buildProposal (Legacy) eingebaut
- [x] Fehlermeldung "unvollständige Kurshistorie" wird durch automatisches Nachladen verhindert

## Challenger + Wizard Fixes (Jul 2026)
- [x] Challenger-Prompt: muss immer konkrete Optimierungsvorschläge liefern (spezifische Ticker-Tausche + Gewichtsänderungen), nicht nur Kritik
- [x] Wizard-Ergebnis: Kurse (currentPrice) werden nicht angezeigt — Bug finden und beheben

## Algorithmus + Challenger Verbesserungen (Jul 2026)
- [x] Sektor-Cap Default: maxSectorPercent 40% → 30% (balanced-Profil)
- [x] Heimatmarkt-Korrelations-Cap: max. 3 Titel aus demselben Land+Sektor (z.B. CH-Finanz)
- [x] Markt-Hub-Faktor-Tilt stärker ins Scoring: Value-Signal → Momentum-Titel abwerten, Momentum-Signal → Value-Titel abwerten
- [x] Challenger-Prompt: JSON-Schema um swaps-Feld erweitern (remove/add/weightAdjustment), konkrete Tausch-Paare erzwingen
- [x] Wizard-Ergebnis: currentPrice wird nicht angezeigt — Bug finden und beheben

## Portfolio Aktivieren Bug (Jul 2026)
- [x] Fix: "Fehler beim Aktivieren" — Deposit-Transaktion wird jetzt vor den Kauftransaktionen erstellt (Cash-Balance-Validierung erforderte positiven Saldo)

## Backfill-Verbesserungen (Jul 2026)
- [x] Backfill-Timeout: 60s pro Ticker in fetchHistoricalPricesFromAPI (AbortController, verhindert hängende Jobs bei TSE-404-Titeln)
- [x] Fehlermeldung verbessern: konkrete Ticker nennen die ausgeschlossen wurden (backfillFailed-Ticker in weightingNote)
- [x] Admin-Dashboard Backfill-Status-Panel: ausstehende Ticker (amber), zuletzt nachgeladen (grün), dauerhaft keine EODHD-Daten (rot, löschbar per Klick) — aktualisiert alle 10s
- [x] Backend: permanentlyFailedBackfills-Registry in autoBackfill.ts + clearPermanentlyFailedBackfills-Prozedur in adminRouter

## YTD-Inkonsistenz Bug (Jul 2026)
- [x] Fix: YTD-Inkonsistenz (Dashboard +54.24% vs Portfolio-Details +22.9%) — calculatePortfolioValueAtDate nutzte currentPrice statt historicalPrice für shares-Berechnung

## Wizard Toggle: Mit/Ohne Admin-Review (Jul 2026)
- [x] Frontend: Toggle/Checkbox im Wizard Step 5 — "Mit Admin-Review" (Standard) vs. "Direkt erstellen"
- [x] Frontend: Bei "Direkt erstellen" → Proposal direkt als Portfolio speichern (ohne Admin-Genehmigung)
- [x] Frontend: Beide Aktionsbuttons entsprechend anpassen (Label + Aktion)

## Bug Fixes & UX Improvements (Jul 19, 2026)
- [x] Fix: Kaufwerte nach Portfolio-Übernahme — 0×CHF 0.00 / NaN% (adminReviewedPositions haben kein currentPrice)
- [x] Fix: KPI-Lücken im KI-Analyse-Protokoll (Sharpe/Erwartete Rendite/Volatilität = "—") — nur wenn Optimizer NaN liefert (fehlende Kurshistorie)
- [x] Fix: Div.-Rendite-Diskrepanz Übersicht (3.82%) vs. Deep Dive (3.2%) — unterschiedliche Datenquellen
- [x] Feature: Neuoptimierung neue Kandidaten default NICHT angekreuzt + Bulk-Toggle (Alle an/aus)
- [x] Feature: Fortschrittsbalken beim Portfolio-Erstellen (Spinner + Schritt-Anzeige)
- [x] Feature: Fortschrittsbalken beim Deep Dive laden (Skeleton/Progress statt leere Seite)

## Fixes 2026-07-19 (Batch 2)
- [x] Fix: Kaufwerte 0×CHF 0.00 nach Portfolio-Übernahme — adminReviewedPositions mit currentPrice aus Original-Positionen anreichern
- [x] Fix: handleAcceptProposal fallback zu allStocks-Preis wenn currentPrice fehlt
- [x] Fix: KPI-Lücken (Sharpe/Rendite/Volatilität) — Tooltip-Hinweis auf fehlende Kurshistorie
- [x] Fix: Div.-Rendite-Diskrepanz — Deep Dive nutzt DB-dividendYield als Fallback wenn EODHD null/0 liefert
- [x] Fix: Neuoptimierung neue Kandidaten default ALLE deaktiviert (useEffect initialisiert deselectedAdditions)
- [x] Feature: Bulk-Toggle "Alle ✔ / Alle ✕" für neue Kandidaten in Neuoptimierung
- [x] Feature: Fortschrittsbalken beim Portfolio-Erstellen (Schritt 5)
- [x] Feature: Fortschrittsbalken beim KI-Vorschlag erstellen (mit Zeitschätzung + Step-Log)
- [x] Feature: Fortschrittsbalken im Deep Dive (mit Zeitschätzung + EODHD-Hinweis)

## Neue Anlageklassen: Gold-ETF, Krypto, Obligationen (Jul 2026)
- [x] Importlogik: Obligationen (Bonds) erkennen und als Anlageklasse "Bond" / "Fixed Income" klassifizieren (ISIN-Prefix CH/XS/US + Kupon/Fälligkeit als Erkennungsmerkmal)
- [x] Importlogik: Gold-ETF erkennen und als Anlageklasse "Commodity" / "Gold" klassifizieren (Swisscanto Gold ETF CH0139101601, iShares Gold etc.)
- [x] Importlogik: Krypto-Zertifikate/ETPs erkennen und als Anlageklasse "Crypto" klassifizieren (VONT BTC/USD CH0595154060, Bitcoin-ETPs etc.)
- [x] DB-Schema: assetType in portfolioData JSON (bond/commodity/crypto/cash/stock) — kein separates DB-Feld nötig da portfolioData JSON-basiert
- [x] Preisabruf: Für Obligationen historische Preise via EODHD abrufen (ISIN.EUFUND oder .SWX Exchange) — Bond-ISINs werden in importHistoricalPrices übersprungen (kein Sekundärmarkt-Kurs via EODHD verfügbar)
- [x] Preisabruf: Für Gold-ETF historische Preise via EODHD abrufen — Commodity-ETF-ISINs werden via eodhdSymbol.ts zu handelbaren Tickern gemappt
- [x] Preisabruf: Für Krypto-Zertifikate historische Preise abrufen — Crypto-ETP-ISINs werden via eodhdSymbol.ts zu BTC-Proxy-Tickern gemappt
- [x] Dashboard Allokation: Neue Anlageklassen in Allokations-Donut-Chart anzeigen (Bond, Commodity, Crypto) — neuer "Klasse"-Modus im Allokations-Widget
- [x] Portfolio-Anzeige: Anlageklasse-Badge pro Position anzeigen (Obligation=blau, Rohwaren=gelb, Krypto=lila)

## Neue Anlageklassen: Gold-ETF, Krypto, Obligationen (Jul 2026)
- [x] assetType enum erweitert: 'bond' | 'commodity' | 'crypto' | 'cash' | 'stock' in bankParsers/index.ts, swissquoteParser.ts, pdfImportRouter.ts, SwissquotePDFImport.tsx
- [x] KI-Extraktions-Prompt: Klassifikationsregeln für Obligationen, Gold-ETFs, Krypto-Zertifikate
- [x] isinResolver: Bond und Fund Typen von EODHD/Yahoo akzeptiert
- [x] SwissquotePDFImport: Badge-Anzeige für alle Anlageklassen (Obligation=blau, Rohwaren/Gold=gelb, Krypto=lila, Cash=grau, Aktie/ETF=grün)

## Portfolio-Vorschlag: individuelle KI-Texte (Jul 2026)
- [x] fillTexts-Batching: Bei > 10 Positionen in Gruppen von 8 aufteilen, um Token-Limits zu vermeiden
- [x] Bessere Fehlerprotokollierung: Batch-Nummer, Anzahl erhaltener Begründungen, Fallback-Warnung
- [x] Fortschritts-Meldung: "KI-Texte: X/Y Titel individuell begründet" im Progress-Stream

## Aggregiertes Dashboard: Fixes (Jul 2026)
- [x] Performance-Chart YTD: startDate nicht mehr auf earliestTransactionDate beschränken für YTD/1J/3J/5J-Ranges bei Live-Portfolios (Chart zeigt Benchmarks ab 1.1., Portfolio-Linie ab erstem Kauf)
- [x] Sharpe "Keine Daten": getRiskMetrics schloss im Aggregat-Modus Demo-Portfolios aus → jetzt alle Portfolios eingeschlossen (analog getAggregatedMetrics)

## KI-Briefing: 24h-Cache (Jul 2026)
- [x] DB-Tabelle `stock_briefing_cache` (ticker UNIQUE, briefing LONGTEXT, generatedAt, meta JSON) — direkt via SQL erstellt
- [x] Backend: Cache-Lookup vor LLM-Aufruf (TTL 24h), Cache-Write nach erfolgreichem LLM-Aufruf (fire-and-forget)
- [x] Backend: `forceRefresh`-Parameter um Cache zu umgehen (für "Aktualisieren"-Button)
- [x] Frontend: Cache-Altersanzeige ("Aus Cache · vor 3h 12m") im Datenstreifen
- [x] Frontend: "Aktualisieren"-Button löst `forceRefresh: true` aus (neues LLM-Briefing)
