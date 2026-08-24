
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
- [x] feat/multi-asset-universe: 6 Feature-Dateien aus PR #174 via cherry-pick in main integriert (multiAssetSleeve.ts, multiAssetSleeve.test.ts, autoPortfolioShared.ts, autoPortfolioJobs.ts, autoPortfolioRouter.ts, PortfolioBuilderWizard.tsx) — tsc sauber, 11/11 Tests grün

## Multi-Asset Follow-ups (Jul 2026)
- [x] Allokations-Matrix admin-konfigurierbar: appSettings-Key "multi_asset_allocation", Admin-UI in AdminSettings, getMultiAssetAllocation() liest aus DB mit Fallback auf Konstanten
- [x] FX-Enforcement für Sleeve-ETFs: Nach applyMultiAssetSleeve USD/GBP-ETFs auf CHF-Alternativen umschalten wenn FX-Limit überschritten
- [x] Täglicher Cron für Sleeve-ETF-Preise: MULTI_ASSET_ETFS-Tickers immer in getUniqueTickers() inkludieren
- [x] bug: Tag-1-Rendite -14% bei Multi-Asset-Portfolios — avgBuyPrice/avgBuyPriceCHF beim Portfolio-Erstellen aus Vorschlag explizit setzen (adminRouter.ts)
- [x] bug: BCOM.SW kein EODHD-Endpunkt — durch CMOD.SW (iShares Diversified Commodity Swap, SIX) ersetzt
- [x] fix: KI-Briefing array-content von Gemini/invokeLLM-Fallback (contentToString)
- [x] fix: KI-Briefing vollständige Fallback-Kaskade (kimi→gemini→claude→omniroute→groq→perplexity)
- [x] fix: Deep-Dive erkennt Multi-Asset-Sleeve-ETFs korrekt (Sektor-Label + LLM-Prompt)
- [x] Deep-Dive Cache-Clear Button im Admin-Dashboard
- [x] Sleeve-ETF-Icons in Positionen-Tabelle (Deep-Dive)
- [x] Asset-Allokations-Donut-Chart im Deep-Dive
- [x] Sleeve-ETF-Icons in Positionen-Tabelle (PortfolioDetailsPage)
- [x] Asset-Allokations-Zeile unter KPI-Karten (PortfolioDetailsPage)
- [x] Positionen-Tabelle nach Anlageklassen sortiert (Aktien → Immobilien → Obligationen → Gold → Krypto → Cash)
- [x] Sleeve-ETF-Backfill-Button im Admin-Dashboard (backfillSleeveEtfs)

## Assetklassen-Verbesserungen (Jul 2026)
- [x] Admin Dashboard: Manual signal cache refill trigger ("Scores neu berechnen" button)
- [x] Admin Settings: Configurable scoring weights for non-equity asset classes (DB-backed, sliders per class: Obligationen, Gold, Rohstoffe, Krypto, Immobilien)
- [x] Watchlist table: Asset-class-specific column values (Rendite instead of P/E, YTD instead of PEG for non-equity)

## Kritisches Repository-Audit — Phase 0 (2026-08-13)
- [x] Audit-Branch `audit/phase-0-baseline` und fortlaufendes `docs/audit/AUDIT_LOG.md` anlegen
- [x] Reproduzierbare technische Baseline dokumentieren: Installation, Build, TypeScript und vollständige Test-Suite
- [x] Architektur-, Modul-, Abhängigkeits- und Externe-Dienste-Inventur erstellen
- [x] Secrets-Scan über Arbeitsbaum und Git-Historie sowie Dependency-/Lizenz-Audit durchführen
- [x] Systemdokumentation mit dem Code abgleichen und dokumentierte Abweichungen erfassen
- [x] Baseline-Bericht, detaillierten Prüfplan für Phase 1 und offene Rückfragen zur Freigabe vorlegen

## Kritisches Repository-Audit — Phase 1: Fachliche und quantitative Korrektheit (2026-08-13)
- [x] Einheitenvertrag und handgerechnete Referenzfälle für Renditen, Risiken, Kosten, Bewertungen und Scores festlegen
- [x] Score-, Signal- und Regime-Pipeline auf Gewichte, Schwellen, Skalierungen und Null-Semantik prüfen
- [x] Risiko-, Performance-, Optimierungs- und Kostenmodule mit deterministischen Referenzreihen prüfen
- [x] Punkt-in-Zeit-Datenflüsse auf Look-Ahead-, Survivorship-, Split-, Dividenden- und FX-Bias prüfen
- [x] Numerische Grenzfälle und parallele Code-Pfade auf Einheiten-/Vorzeichen-/Datums-Konsistenz prüfen
- [x] Alle Phase-1-Befunde mit Beleg, Falsch-positiv-Check, Fix-Vorschlag und Verifikation zur Freigabe vorlegen

## Audit-Remediation — F1-03 Punkt-in-Zeit (2026-08-13)
- [x] Separaten Branch für F1-03 anlegen und roten Test für ein Filing am gleichen Stichtag schreiben
- [x] Fundamentals ohne Zeitstempel erst ab folgendem Handelstag als verfügbar behandeln
- [x] Historische Score-Reihe und Vorwärtsrendite auf den konservativen Verfügbarkeitsvertrag gegenprüfen
- [x] Zielgerichtete Tests, Gesamt-Suite, TypeScript und Build ausführen sowie Audit-Nachweis aktualisieren

## Audit-Remediation — F1-01 Sortino-Ratio (2026-08-14)
- [x] Target-aware Sortino-Definition als verbindlichen Projektstandard dokumentieren
- [x] Roten Referenztest für positiven risikofreien Satz und negative Überschussrendite ergänzen
- [x] Downside-Deviation und Zähler auf dieselbe Tages-Mindesthürde ausrichten
- [x] Modellselektion, Risikostatistik, Gesamt-Suite, TypeScript und Build gegenprüfen sowie Audit-Nachweis aktualisieren

## Screener-Stichprobenvalidierung — 20 neu berechnete Aktien (2026-08-14)
- [x] Reproduzierbare Zufallsstichprobe von 20 bereits berechneten Aktien samt Datenstichtag und Kennzahlendefinitionen festhalten
- [x] Interne Werte (Kurs, KGV, PEG, ROIC, Marge, FCF-Rendite, Dividendenrendite) gegen unabhängige externe Referenzen abgleichen
- [x] Materielle Abweichungen nach Zeitraum, Währung, Adjustierung, Datenbasis oder Berechnungsfehler klassifizieren
- [x] Ausschliesslich bestätigte Berechnungsfehler mit roten Tests beheben und die 20-Titel-Stichprobe erneut messen — keine bestätigten Berechnungsfehler, daher kein Code-Fix
- [x] Quellen-, Abweichungs- und Remediationsbericht dokumentieren, alle Prüfungen ausführen und Checkpoint sichern

## Automatisierte Screener-Stichprobenvalidierung (2026-08-14)
- [x] Wöchentlichen Prüfvertrag verbindlich dokumentieren: montags 08:30 UTC, 20 Titel, bestehende Schwellen und Befundbenachrichtigung
- [x] Idempotenten Hintergrundjob mit deterministischer Zufallsauswahl, externer Preis-/Kennzahlprüfung und persistentem Laufprotokoll implementieren
- [x] Materielle Abweichungen revisionssicher speichern und nur bei bestätigten Befunden benachrichtigen
- [x] Wiederkehrenden Hintergrundlauf registrieren, End-to-End testen und Audit-Dokumentation aktualisieren

## Datenintegrität — Novo Nordisk Dividendenrendite (2026-08-15)
- [x] Angezeigten und gespeicherten Dividendenrenditewert für Novo Nordisk samt Datenursprung reproduzieren — aktueller Wert 3.92 %, kein 25-%-Ausreisser auffindbar
- [x] Dividende, Kurs, Einheiten, Ausschüttungsfrequenz und Corporate-Actions gegen offizielle sowie unabhängige Quellen abgleichen
- [x] Bestätigte Ursache mit rotem Test beheben und Screenerwert neu berechnen — keine Ursache bestätigt, daher keine spekulative Mutation
- [x] Regression über weitere Dividendenaktien durchführen, Auditnachweis aktualisieren und Checkpoint sichern — bestehende 16 Dividendenrendite-Regressionstests bestanden

## Datenintegrität — vermeintlich verlorene Screener-Berechnungen (2026-08-15)
- [x] Aktuelle und historische Anzahl berechneter Cache-Einträge, Stammdaten und sichtbarer Screener-Zeilen erfassen
- [x] Universe-/Listenfilter, Ausschlussregeln und jüngste Änderungen auf eine Ausblendung statt einen Datenverlust prüfen
- [x] Überschreib-, Lösch- und Archivierungspfade anhand von Job-Logs, SQL-Historie und Git-Diffs ausschliessen oder belegen
- [x] Ursache mit minimalem Test und ohne Neuberechnung korrigieren; Datenbestand und UI anschliessend gegenprüfen

## Priorisierte Auditfortsetzung (2026-08-15)
- [x] F1-02: verbindlichen TTWROR-Datenqualitäts- und Reportingvertrag entscheiden und testgetrieben umsetzen
- [x] Fehlerursache des fehlgeschlagenen Screener-Laufs #90002 analysieren und den neuen Universumsimport stabilisieren — Prozessneustart während des Sammelns, 598 Kandidaten erhalten; gültiger Lauf bleibt per Fallback sichtbar
- [x] Bekannte vollständige Test-Suite-Fehler in Formatierung, TradingView-MCP und Sornette einzeln reproduzieren und getrennt priorisieren — 145 Dateien / 1'289 Tests grün; TradingView-Upstream-Healthcheck bewusst opt-in
- [x] Phase 2 Security & Governance durchführen: Authentisierung, Autorisierung, Mandantentrennung, Secrets, Abhängigkeiten und Datenschutz — technische Remediations und Release-Gates dokumentiert
- [x] Externe Zweitquelle für KGV/PEG in die wöchentliche Screener-Validierung integrieren — unabhängige Finnhub-TTM-Referenz (`peTTM`, `pegTTM`) mit Parser- und Vergleichstests ergänzt

## Audit — Phase 2 Security & Governance (2026-08-15)
- [x] Öffentliche, geschützte und administrative tRPC-Prozeduren auf Authentisierung und fail-fast Schreibschutz prüfen — Inventar und priorisierte Remediations dokumentiert
- [x] Portfolio-, Transaktions- und Dokumentzugriffe auf Mandantentrennung und IDOR-Risiken prüfen — Ownership-Guards und globales Legacy-Log geprüft
- [x] Geheimnisse, HTTP-Sicherheitsheader, Eingabevalidierung, Logs und Datenschutzflächen prüfen — CSP, PII-/Secretlog- und Formularremediations verifiziert
- [x] Produktionsabhängigkeiten, kritische Schwachstellen und Lizenzbefunde erneut bewerten — 0 kritisch, 22 hoch; Rest und fünf unbekannte Lizenzmetadaten als Gate erfasst
- [x] Reproduzierbare Security-Befunde mit minimalen Fixes, Tests, Auditnachweis und Freigabe-Gates vorlegen

## Security-Remediation — Kritische PDF-Abhängigkeiten (2026-08-15)
- [x] jsPDF auf die auditbereinigte 4.x-Linie und jsPDF-AutoTable auf die kompatible 5.0.8-Linie aktualisieren
- [x] PDF-Export, TypeScript, Produktions-Build und Produktionsabhängigkeits-Audit nach dem Upgrade verifizieren

## Security-Remediation — Kritischer XML-Parser (2026-08-15)
- [x] AWS-S3-SDK und S3-Presigner auf konsistente Versionen mit `fast-xml-parser` mindestens 5.3.5 aktualisieren
- [x] Storage-Zugriffe, TypeScript, Produktions-Build und Produktionsabhängigkeits-Audit nach dem Upgrade verifizieren

## Security-Remediation — Scheduled Endpoints (2026-08-15)
- [x] `portfolioMetricsSnapshot`, `researchSignalsRefresh` und `signalAlerts` mit Task-UID-Prüfung und Idempotenz abschliessen — aktive Heartbeats gebunden; Snapshot derzeit nur autorisiert in-memory
- [x] Nicht autorisierte Aufrufe dieser Scheduled-Endpoints mit Handler-Tests abweisen
- [x] Persistente Handler-zu-Task-UID-Bindungen anlegen und nur registrierte Cron-Tasks akzeptieren
- [x] Prozessübergreifende DB-Idempotenz für die drei geplanten Seiteneffekte ergänzen

## Security-Remediation — Market-Report-Webhook (2026-08-15)
- [x] JWT-Secret-Fallback im Webhook entfernen und bei fehlendem dediziertem Webhook-Key fail-closed arbeiten
- [x] API-Key-Autorisierung und Eingabegrenzen mit isolierten Handler-Tests absichern

## Security-Remediation — KI-Boom-Trigger (2026-08-15)
- [x] Öffentliche Snapshot-, Perplexity-Fetch- und Credit-Spread-Backfill-Mutationen durch fail-fast `adminProcedure` absichern
- [x] Nicht autorisierten Zugriff gegen alle manuellen KI-Boom-Trigger mit Routertests abweisen

## Teststabilität — Externe Kimi-API (2026-08-15)
- [x] Kimi-K3-Provider-Healthcheck wie alle externen Live-Integrationsprüfungen nur mit `RUN_LIVE_INTEGRATION_TESTS=true` ausführen
- [x] Perplexity-Provider-Healthcheck auf dasselbe explizite Live-Opt-in umstellen
- [x] Ungültige ISIN-Werte vor dem Yahoo-/EODHD-Fallback abweisen, damit Negativtests keine Netzabhängigkeit auslösen

## Security-Remediation — HTTP-Transport (2026-08-15)
- [x] Fingerprinting, MIME-Sniffing, Clickjacking, Referrer- und Geräteberechtigungen mit getesteten HTTP-Headern begrenzen
- [x] Restriktive Content-Security-Policy nach verifizierter Inventur aller Produktionsressourcen, Einbettungen und API-Ursprünge ergänzen

## Security-Remediation — Globales Transaktions-Auditlog (2026-08-15)
- [x] Anonymen und regulären Nutzerzugriff auf das nicht mandantierbare Transaktions-Auditlog vor jeder DB-Abfrage bzw. Löschung fail-fast abweisen

## Security-Remediation — TradingView-Analysebrücke (2026-08-15)
- [x] Öffentliche, kosten- und lastintensive TradingView-Analyse-, Scan- und Backtestprozeduren vor jeder MCP-Initialisierung auf `protectedProcedure` begrenzen

## Security-Remediation — Secret-Metadaten in Logs (2026-08-15)
- [x] Automatische Boot- und Verzögerungslogs mit Secret-Präfixen und -längen entfernen; nur wertfreie, explizite Verfügbarkeitsdiagnostik belassen

## Phase-2-Release-Gates — Umsetzung (2026-08-15)
- [x] Die 22 transitiven High-Dependency-Befunde paketweise auf sichere, getestete Updates oder begründete Rest-Risiken reduzieren — Nodemailer 9, jsdom 30 und Twilio 6 verifiziert; verbleibend 19 hohe, überwiegend ohne sichere Upstream-Zielversion
- [x] Die fünf `Unknown`-Lizenzmetadaten gegen die Primärlizenzen der jeweiligen Pakete verifizieren und dokumentieren — Numeric und Buffers primär belegt; nur der Entwicklungsplugin `vite-plugin-manus-runtime` ohne Primärlizenz unklar
- [x] Einen Portfolio-Metrics-Heartbeat mit persistierter Task-UID-Bindung vorbereiten und nur nach erfolgreicher Handlerverifikation aktivieren — täglicher Heartbeat 14:30 UTC, UID `mmrK8Eey5oq7PiuuAQu9Kn` gebunden; kontrollierter Handlerlauf HTTP 200 ohne Fehler

## Screener-Lauf 150001 — Datenintegritätsprüfung (2026-08-16)
- [x] Exportarbeitsmappe, Laufstatus und Kandidatenbestand auf Vollständigkeit, Dubletten und konsistente Identifikatoren prüfen
- [x] Kennzahlen, Quellenfrische, Einheiten und Berechnungslogik auf Ausreisser und reproduzierbare Datenfehler untersuchen
- [x] Ursachen bis zum Import-, Normalisierungs- oder Berechnungspfad zurückverfolgen und priorisierte, testbare Remediation vorschlagen
- [x] P0 umgesetzt: EODHD-Fundamentalsymbole für XETRA/LSE zentral korrekt auflösen; kontrollierte Neuberechnung von Lauf 150001 ist vorbereitet
- [x] P0 umgesetzt: Dividendenrenditen über einen expliziten Einheitenvertrag statt über die `<0.3`-Heuristik normalisieren
- [x] P1 umgesetzt: ISO-Stammdaten, Emittentenschlüssel, Zweitnotierungsregeln und Transparenzfelder im Screener-Export ergänzen
- [x] Lauf 150001 kontrolliert neu rechnen, damit die korrigierten Daten- und Symbolpfade die bestehenden Ergebnisfelder aktualisieren — 914 berechnete Zeilen seriell verarbeitet; Lauf `fertig`, keine Kandidaten oder Entscheidungen gelöscht
- [x] Nach dem neu gerechneten Screener-Lauf die verbleibenden Punkte gegen Claudes parallele Bugprüfung konsolidieren und doppelte Befunde bereinigen — PR #297 konfliktfrei enthalten; keine offenen Claude-Bug-PRs in `main`, Restpunkte dokumentiert
- [x] QualityMetrics-EODHD-Timeouts begrenzt wiederholen, damit einzelne Provider-Aussetzer keine stillen Screener-Leerdaten erzeugen

## Research-Triage-Loop — offene Issues (2026-08-16)
- [x] Offene `[Research]`-Issues ohne Fortschrittslabel nach Konfidenz laden, filtern und maximal zwei priorisieren — keine qualifizierenden offenen Issues vorhanden
- [x] Daten- und Engine-Umsetzbarkeit der priorisierten Hypothesen prüfen und nicht umsetzbare Issues nachvollziehbar ablehnen — keine priorisierten Issues vorhanden
- [x] Für umsetzbare Hypothesen Feature-flagged Prototypen sowie echte OOS-Backtests mit Regime- und Sensitivitätschecks ausführen — keine qualifizierenden Issues vorhanden
- [x] Backtestnachweis, Labels, Research-Branches, Draft-PRs und Abschlusskommentare auf GitHub veröffentlichen — keine qualifizierenden Issues vorhanden

## Screener-Lauf 150001 — erneuter Detailaudit (2026-08-17)
- [x] Den gelieferten Export strukturell gegen den aktuellen Laufbestand und die Persistenzschicht abgleichen
- [x] Vollständigkeit, Statusgründe, Dubletten, Kennzahleneinheiten, Scoreabdeckung und Metadatenlücken reproduzierbar prüfen
- [x] Einen revisionsfähigen Auditbericht mit quantifizierten Befunden, Ursachen, Restrisiken und priorisierten Massnahmen erstellen
- [x] P0 umgesetzt: Titel-Level-Timeouts mit begrenztem Wiederanlauf statt dauerhaftem Fehlerstatus behandeln
- [x] P0 umgesetzt: auffällige Dividendenrenditen mit ISIN-gebundener Zweitquelle als Datenqualitätsstatus validieren
- [x] P1 umgesetzt: Identitäts-Review-Queue und Exportstatus für fehlende Anbieter-Primärticker und ISIN ergänzen

## Screener-Detailaudit — PDF-Review (2026-08-17)
- [x] Den aktuellen Screener-Detailaudit als professionellen PDF-Review erzeugen und lesbar verifizieren

## KGV-Rohdiagnose — Vendor oder App (2026-08-17)
- [x] Sechs EODHD-Fundamentalsantworten read-only mit den vorgegebenen EODHD-Symbolen abrufen und Rohfelder belegen
- [x] Bit-identische PERatio-/ForwardPE-Werte je Partnergruppe auf vier Dezimalstellen vergleichen und Vendor oder App eindeutig klassifizieren — Ursache: EODHD `Valuation.ForwardPE`, nicht die App

## Visual- und Funktionsaudit — End-to-End (2026-08-20)
- [x] Isoliertes Testkonto und eindeutig gekennzeichnetes Testportfolio vorbereiten; keine produktiven Benachrichtigungen oder irreversiblen Löschungen auslösen
- [x] Navigation, Konto, Suche, Aktiendetails und alle erreichbaren Nutzeraktionen visuell und funktional prüfen
- [x] Portfolioanlage, Positionsbearbeitung, Optimierung, Performance, Kennzahlen und Fehlerzustände end-to-end prüfen
- [x] Adminbereich, Screener, Exporte, Berechtigungen und Datenqualitäts-Review-Queue prüfen
- [x] Preise, KGV/PEG, Dividenden und Performancekennzahlen stichprobenartig gegen Drittquellen vergleichen
- [x] Reproduzierbare Befunde mit Ursachen, Minimalremediation, Tests und Release-Gates als Auditbericht dokumentieren
- [x] P0-Onboarding-Rückleitungsprüfung: Im aktuellen Stand nicht reproduzierbar. Der Abschlussstatus wird vor der Beispielportfolio-Erstellung persistiert, die Portfolio-Liste invalidiert und anschliessend direkt zur erzeugten Portfolio-ID navigiert; der Onboarding-Wizard ist als eigenständige Route ohne Dashboard-Redirect-Layout registriert.
- [x] P0: Erfolgreiche manuelle Testtransaktion aktualisiert Positionen und Kennzahlen des Demo-Portfolios nicht; Datenfluss bis zur Ursache analysieren und testgetrieben beheben
- [x] P0: Aktivierung erzeugt Initialtransaktionen, belässt das Testportfolio aber im Demo-/Nicht-Live-Zustand und aktualisiert Kennzahlen nicht; Ursache bestimmen und testgetrieben beheben
- [x] P0-Optimierungsprüfung: Nach vollständiger Portfolioladung zeigt `?tab=optimierung` den erklärten Optimierungs-/Empfehlungsbereich mit Anlageprofilhinweis, Kadenzsteuerung und expliziter Ladeaktion; kein Produktfehler im aktuellen Stand reproduzierbar.
- [x] P1-Bearbeitungsprüfung Kurslücke: Kein Produktfehler im aktuellen Stand reproduzierbar. Der ROG.SW-Bearbeitungsbutton öffnet den vollständigen Dialog mit Ticker, ISIN, Stück, Einstand und Währung; Abbruch stellt den unveränderten Zustand wieder her.
- [x] P0: Empfehlungslauf bleibt im Ladezustand, weil `copilotHistory.currentWeight` für den berechneten Gewichtsstring zu kurz ist; Schema, Speicherkonvertierung und Fehlerzustand testgetrieben beheben
- [x] P1-Empfehlungsstatusprüfung: Kein persistenter Doppelvorschlag im aktuellen Vertrag. Die Übernahme erstellt Ledgerbuchungen mit Quelle `optimization`, synchronisiert die Portfolio-Bestände, invalidiert Detail- und Upgrade-Proposal-Caches und berechnet die dynamische Liste danach gegen die aktualisierten Holdings neu; die ursprünglichen Verkäufe/Käufe erscheinen dadurch nicht erneut.
- [x] P1: Deep-Dive-KI benötigt deutlich länger als die kommunizierten 15–30 Sekunden und hat keinen globalen Timeout mit verständlichem Fehlerzustand; asynchronen Fundamentaldaten-/KI-Pfad begrenzen und transparent machen
- [x] QA-Bereinigung: Die temporär erhöhte Adminrolle des isolierten Auditkontos nach Abschluss wieder auf Nutzerrolle zurücksetzen
- [x] P1-Research-Priorisierungsprüfung: Kein UI-Fehler. Das Observatory ist als vollständige, nach Relevanz sortierte n8n-Signalansicht konzipiert und filtert bewusst nicht nach Topics; der gewünschte Ausschluss von `monetary_policy`/`central_bank` betrifft ausschliesslich die externe n8n→GitHub-Issue-Erstellung und bleibt dort als Workflow-Konfiguration zu behandeln.
- [x] P0: Markt-Hub zeigt einen zukünftigen Tagesbericht (5.9.2026) und widersprüchliche S&P-500-Stände; Zeitstempel-, Datenfrische- und Quellenvertrag analysieren und korrigieren
- [x] P0: Markt-Hub markiert oder verbirgt zeitlich veraltete Berichtsinhalte nicht, obwohl der angezeigte Berichtstag aktuell ist; Ursprungsdatum/Quellenalter im Erzeugungs- und Anzeigevertrag absichern
- [x] P0: Globaler Copilot bleibt nach einer Portfolio-Diversifikationsfrage ohne Antwort oder Fehlerhinweis im Ladezustand; Provider- und Timeoutpfad analysieren und testgetrieben beheben
- [x] P1: Copilot-Timeouts zusätzlich als dauerhafte, nicht nur flüchtige Gesprächsstatusmeldung zeigen
- [x] P1-Validierungsprüfung KI-Builder: Kein Produktfehler bestätigt. Der automatisierte Klick traf ausserhalb des sichtbaren Buttonbereichs; der verifizierte `Weiter`-Handler erzeugt bei leeren Pflichtfeldern den sichtbaren Hinweis „Bitte wählen Sie einen Portfolio-Typ“.

## Visual Audit — verifizierte Teilremediation (2026-08-21)
- [x] P0-Teilbefund Aktivierung: Beim Übergang von Demo zu Live zusätzlich `portfolioType='live'` persistieren; rote Regression, Datenbanknachweis und Browsernachprüfung des Audit-Testportfolios durchgeführt

## Datenqualitäts-Release — EU/SIX und Emittentenidentität (2026-08-21)
- [x] P0: Für EU-/SIX-Titel einen datierten, nachvollziehbaren KGV-/PEG-Fallback aus verfügbaren Earnings-History-Daten definieren; Vendor-Multiples nur bei bestandener Plausibilitätsprüfung verwenden. Der Score-Flag bleibt verpflichtend standardmässig `false`, bis die separate OOS-/Walk-Forward-Freigabe vorliegt.
- [x] P0: ISIN als ergänzenden Emittentenschlüssel im Screener-Persistenz- und Deduplizierungspfad verwenden, ohne unterschiedliche Unternehmen mit fehlender ISIN zusammenzuführen
- [x] P1: Datenqualitätsstatus und konkrete Prüfhinweise in Screener- und Admin-UI sichtbar machen; fehlende Kurse, Vendor-Konflikte und unvollständige Fundamentals eindeutig erklären
- [x] P1: Reale EU-/SIX-Stichprobe, vollständige Regression und nicht-destruktive Datenmigration für das Datenqualitäts-Release dokumentieren

## Research-Desk-Konzeptanalyse (2026-08-21)
- [x] Konzept eines spezialisierten Research-Agentenverbunds gegen bestehende Research-Observatory-, Scheduler-, Datenqualitäts- und Backtest-Komponenten abgleichen
- [x] Einen eng begrenzten, beobachtenden Pilot für Filing-/Earnings-/Insider-Ereignisse mit Quellenbeleg, Maker-Checker-Trennung, Stop-Bedingungen und OOS-Erfolgsmessung spezifizieren

## Research Desk Lite — Shadow-Mode-Pilot (2026-08-21)
- [x] P0: Evidenz-Ledger für US-Filing-, Earnings- und Insider-Ereignisse mit Quellen-URL, Ereignis-/Abrufzeit, Rohdatenhash, ISIN/Ticker und Laufversion nicht-destruktiv anlegen
- [x] P0: Deterministischen, idempotenten täglichen Shadow-Mode-Collector mit Quoten, Laufprotokoll, Quellenvalidierung und keinen Score-/Handelsnebenwirkungen implementieren
- [x] P1: Maker-Checker-Adminansicht für Evidenz, Mehrquellenbestätigung und verworfene/unvollständige Datensätze erstellen
- [x] P1: Sechs-Wochen-Shadow-Run gestartet; Datenvollständigkeits- und Punkt-in-Zeit-Outcome-Gates dokumentiert sowie automatische Regeländerungen ausdrücklich gesperrt. Das OOS-Freigabegate bleibt bis zum vollständigen Beobachtungszeitraum geschlossen.

## Empfehlungen nach KI-Portfolioerstellung (2026-08-21)
- [x] P0: Signalrichtung und vorgeschlagene Handelsrichtung fachlich konsistent machen; ein positives Kauf-/Haltesignal darf eine Reduzierung nur mit klarer, übergeordneter Portfolio- oder Risikobegründung erzeugen
- [x] P0: Für neu über den KI-Wizard erstellte Portfolios eine nachvollziehbare Schutzfrist und Materialitätsschwelle gegen voreilige Umschichtungen einführen; echte Risiko-/Datenintegritätsausnahmen separat kennzeichnen
- [x] P1: Empfehlungen als klare Kauf-, Verkauf-, Aufstocken-, Reduzieren- oder Austauschhandlung mit Zielgewicht, Delta, Kategorie und vollständiger Begründung darstellen. Der laufende Modus ist bewusst auf bestehende Positionen begrenzt; neue Käufe und gekoppelte Austausche gehören in die vollständige Neu-Optimierung.
- [x] P1: Die korrigierte Empfehlungslogik am gezeigten Testportfolio sowie per Regression und Live-UI prüfen

## Profilgerechte Diversifikation und Optimierungs-UX (2026-08-21)
- [x] P0: Bei der Auswahl «nur Aktien» ausschliesslich aktienrelevante Diversifikationsregeln prüfen; nicht gewählte Anlageklassen nicht als Warnung oder Zielquote darstellen
- [x] P1: Diversifikationsübersicht auf eine kompakte Zusammenfassung mit nur Handlungsbedarf reduzieren; Details auf expliziten Aufklappbereich verschieben
- [x] P1: Vollständige Neu-Optimierung auf klare, schrittweise Entscheidungsblöcke reduzieren und technische Analyse-/Backtestdetails standardmässig verbergen
- [x] P1: Vereinfachte, profilorientierte Ansicht mit dem betroffenen Aktienportfolio live und per Regression verifizieren

## Research-Triage-Loop — GitHub (2026-08-21)
- [x] Maximal zwei offene, nicht priorisierte `[Research]`-Issues nach Konfidenz, Engine-Umsetzbarkeit und realer Historienabdeckung triagieren. Ergebnis des Durchlaufs: keine zulässigen offenen Kandidaten; alle offenen Research-Issues tragen bereits einen Fortschrittslabel.
- [x] Je umsetzbarem Issue einen default-false Feature-Flag, einen punkt-in-zeit-sicheren OOS-Backtest sowie Regime-/Sensitivitätschecks auf einem eigenen Research-Branch implementieren. Nicht ausgelöst, da kein zulässiger Kandidat vorlag.
- [x] Je bearbeitetem Issue Ergebnis, Entscheidung, Draft-PR, Labels und Abschlusskommentar nach dem verbindlichen Triage-Protokoll veröffentlichen. Nicht ausgelöst, da kein zulässiger Kandidat vorlag.

## Audit-Remediation — F1-02 TTWROR (2026-08-15)
- [x] Tatsächliche TTWROR ohne stille 50-%-Tageskappung als verbindlichen Reportingwert festlegen
- [x] Datenanomalien separat kennzeichnen statt Renditen unbemerkt zu verändern
- [x] Roten Referenztest für eine echte Tagesrendite oberhalb 50 % ergänzen und minimal implementieren
- [x] Performance-, UI- und Regressionstests ausführen sowie Audit-Nachweis aktualisieren
