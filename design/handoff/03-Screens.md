# 03 · Per-Screen Specs

Detail-Specs der 6 konsolidierten Top-Level-Pages. Jede Page hat:

- **Route**
- **Datei(en)**
- **Tabs** mit Inhalt
- **tRPC-Endpoints** die aufgerufen werden
- **Akzeptanzkriterien** die du **live im Browser verifizieren** kannst

Visuelle Referenz: jeweils der entsprechende Screen im Prototyp (`Optimierung Prototyp.html` → Modus „03 · Prototyp").

---

## Dashboard

**Route:** `/dashboard`
**Datei:** `client/src/pages/Dashboard.tsx` (existiert bereits als schlanker Wrapper; die Sub-Komponenten kommen aus dem ersten Dashboard-Handoff-Paket in `handoff/client/src/components/dashboard/*`)

### Layout (sticht im Prototyp am Dashboard-Screen)

```
┌──────────────────────────────────────────────────────────┐
│ Header: "Willkommen zurück, Marc" + Scope-Selector       │
│ (Aggregiert / Bluechips CH / Globale Div. / Dividenden) │
├──────────────────────────────────────────────────────────┤
│ KPI-Hero (Gesamtwert, groß) + 3 kleine KPIs (YTD/Sharpe/Bubble) │
├──────────────────────────────────────────────────────────┤
│ Performance-Chart (2 col)        │ Allokations-Donut (1) │
├──────────────────────────────────────────────────────────┤
│ Copilot-Insights (1)             │ Meine Portfolios (1)  │
└──────────────────────────────────────────────────────────┘
```

### Konsolidierung aus

- `Dashboard.tsx` (bleibt) — der Wrapper
- `Home.tsx` (gelöscht) — falls Funktionen darin nur dort existieren, vor PR 03 dokumentieren
- `LiveTracking.tsx` (gelöscht) — der Live-Mode ist hier ein Toggle in der Header-Bar, kein eigener View

### tRPC-Endpoints

Bereits im ersten Handoff-Paket spezifiziert (siehe `handoff/README.md` Schritt 3). Zusätzlich:

- `dashboard.getAggregatedMetrics` — existiert
- `dashboard.getTopPortfolios` — existiert
- `dashboard.getPerformanceTimeseries` — **neu**
- `dashboard.getAggregatedHoldings` — **neu**
- `dashboard.getSectorAllocation` — **neu**
- `dashboard.getRegionAllocation` — **neu**
- `dashboard.getRiskMetrics` — **neu**
- `dashboard.getBubbleIndicator` — **neu**
- `dashboard.getCopilotInsights` — **neu**

### Akzeptanzkriterien (live im Browser)

- [ ] `/dashboard` lädt ohne Console-Errors
- [ ] Hero-KPI „Gesamtwert" zeigt CHF-Summe aller Live-Portfolios
- [ ] Scope-Switcher wechselt zwischen aggregiert und einzelnem Portfolio
- [ ] Performance-Chart rendert 3 Linien (Portfolio, SMI, MSCI)
- [ ] Allokations-Donut hat ≥ 5 Sektoren mit Prozent-Summe = 100%
- [ ] Copilot-Insights-Card zeigt ≥ 3 Items aus `dashboard.getCopilotInsights`
- [ ] „Meine Portfolios"-Liste hat klickbare Rows → führen auf `/portfolios/:id`

---

## Portfolios · Detail

**Route:** `/portfolios/:id?tab=…`
**Datei:** `client/src/pages/PortfolioDetailsPage.tsx`

### Layout

Header (sticky) — Breadcrumb + Portfolio-Name + Status + Action-Buttons („Position hinzufügen", „Bearbeiten", „Optimieren").

Darunter **4 sticky KPIs**: Wert · YTD · Gesamt · Sharpe.

Darunter **6 Tabs**:

| Tab-Key (`?tab=`) | Label | Inhalt |
|---|---|---|
| `uebersicht` | Übersicht | Wert-Chart + Top-Positionen-Liste + Letzte Aktivität |
| `positionen` | Positionen | Tabelle (default) / Heatmap / Konstellation — Toggle. „Position hinzufügen"-Button |
| `transaktionen` | Transaktionen | 4 KPIs (Käufe/Verkäufe/Dividenden/Realisierte G/V) + filterable Tabelle. Filter: Alle/Käufe/Verkäufe/Dividenden/Realisierte Gewinne |
| `performance` | Performance | Großer Chart vs. Benchmarks + Annualisierte Rendite / Bester / Schlechtester Monat + Monatliche Returns-Heatmap |
| `risiko` | Risiko | Volatilität / Max Drawdown / Beta / VaR / Sharpe / Konzentration Top 3 + LPPL-Gauge mit 8-Wochen-Verlauf |
| `optimieren` | Optimieren | KI-Vorschläge (Re-Allocation) + Effizienzgrenze-Scatter („Aktuelles" vs. „Optimum"-Punkt) |

**Tab-Persistenz:** der `?tab=`-Query muss beim Reload erhalten bleiben. Bei keinem `?tab=` → `uebersicht`.

### Konsolidierung aus

- `PortfolioDetailsPage.tsx` (Wrapper bleibt)
- `PortfolioDetail.tsx` (gelöscht)
- `PortfolioPositions.tsx` → Tab Positionen
- `PortfolioTransactionsPage.tsx` + `PortfolioTransactions.tsx` → Tab Transaktionen
- `Transactions.tsx` → Tab Transaktionen (mit zusätzlichem „alle Portfolios"-Scope)
- `RealizedGainsHistory.tsx` → Tab Transaktionen, Filter „Realisierte Gewinne"
- `Reports.tsx` + `Analysis.tsx` + `LivePerformanceChart.tsx` + `PortfolioPerformanceChart.tsx` → Tab Performance
- `RiskDashboard.tsx` → Tab Risiko
- `PortfolioOptimizer.tsx` → Tab Optimieren
- `LiveTracking.tsx` (gelöscht) — Live-Mode ist Toggle im Tab Übersicht

### tRPC-Endpoints

Existieren bereits, nur neu gruppieren:

- `portfolios.getById` (mit `?include[positions,transactions,performance]=true`)
- `portfolioPerformanceRouter.getTimeseries`
- `portfolioTransactionsRouter.list` (mit Filter-Param)
- `realizedGainsHistoryRouter.list` — kann unter Transaktionen mit Filter laufen
- `marketRegimeRouter.getLPPL` (für Risiko-Tab)
- `portfolioOptimizerRouter.getProposals` (für Optimieren-Tab)
- `aiInsightsRouter.forPortfolio` (für Optimieren-Tab)

### Akzeptanzkriterien

- [ ] Direkter Aufruf `/portfolios/abc?tab=transaktionen` öffnet Tab „Transaktionen" direkt
- [ ] Reload behält den Tab
- [ ] Wechsel zwischen Tabs ist **ohne** Page-Reload (kein Loading-Spinner für den Header)
- [ ] 4 KPIs oben bleiben bei Tab-Wechsel unverändert (Daten cached)
- [ ] Tab Optimieren ruft `portfolioOptimizerRouter.getProposals` und zeigt ≥ 1 Vorschlag
- [ ] Filter im Transaktionen-Tab ändert die Tabelle ohne Page-Reload
- [ ] Alte URL `/portfolio/abc/positions` redirected via 301 zu `/portfolios/abc?tab=positionen`

---

## Aktien (Suche)

**Route:** `/aktien`
**Datei:** `client/src/pages/Invest.tsx` (umbenannt → `Aktien.tsx`)

### Layout

Top: Sucheingabe + Filter-Chips (Sektor, Kategorie, Region, Score-Min). Default-View: Karten-Grid mit Aktien aus der Watchlist + Top-Scores.

Wenn `?filter=kategorie` oder `?filter=sektor` per URL gesetzt: entsprechende Filter-Chip ist aktiv (Backward-Compat für 301-Redirects aus `/categories` und `/sectors`).

### Konsolidierung aus

- `Invest.tsx` (Wrapper bleibt unter neuem Namen)
- `Categories.tsx` (gelöscht — wird Filter)
- `Sectors.tsx` (gelöscht — wird Filter)

### Akzeptanzkriterien

- [ ] Sucheingabe mit ≥ 2 Zeichen triggered tRPC-Call
- [ ] Filter-Chip „Sektor: Tech" filtert Liste und persistet in `?filter=`-URL
- [ ] Klick auf Karte → `/aktien/:ticker?tab=uebersicht`

---

## Aktien · Detail

**Route:** `/aktien/:ticker?tab=…`
**Datei:** `client/src/pages/StockDetail.tsx` (überarbeitet)

### Layout

Header (sticky): Breadcrumb + Aktien-Name + Ticker-Pill + Sektor-Pill + Region-Pill. Darunter: Preis groß + Tages-Change + Live-Indicator.

Action-Buttons rechts: „Alarm setzen", „Beobachten", **„Kaufen"** (öffnet Modal mit Portfolio-Picker).

**7 Tabs:**

| Tab-Key | Label | Inhalt |
|---|---|---|
| `uebersicht` | Übersicht | Preis-Chart + Kennzahlen-Box (KGV, KBV, Div-Rendite, Markt-Kap, 52W) + „In meinen Portfolios" |
| `signale` | Signale | Gesamt-Score-Gauge + 7 Einzel-Signale als Balken (Trend, Momentum, Mean-Reversion, Vola, Value/DCF, Quality, Sentiment) |
| `chart` | Chart & TA | Candle/Linie/Bar-Toggle + Indicator-Auswahl (EMA-50, EMA-200, RSI, MACD, Bollinger) |
| `bewertung` | Bewertung (DCF) | Fair-Value-Berechnung + Sensitivitäts-Heatmap (WACC × Wachstum) + Annahmen-Editor |
| `prognose` | KI-Prognose | Monte-Carlo-Forecast 30T mit P5/Median/P95-Bändern |
| `backtest` | Backtest | Strategie-Vergleich (Buy & Hold, MA-Cross, RSI) mit CAGR + Drawdown |
| `news` | News | News + Analystenstimmen (gefiltert auf Ticker) |

### Konsolidierung aus

- `StockDetail.tsx` (bleibt, bekommt Tabs)
- `InvestDetail.tsx` (gelöscht — Inhalte falls noch nicht vorhanden in `uebersicht`-Tab portieren)
- `Signals.tsx` → Tab Signale
- `TechnicalAnalysis.tsx` → Tab Chart & TA
- `DCFValuation.tsx` → Tab Bewertung
- `Prediction.tsx` → Tab KI-Prognose
- `Backtesting.tsx` → Tab Backtest
- `Analysis.tsx` (gelöscht — Inhalte ggf. in `signale` oder eigenes Mini-Card im `uebersicht`)

### tRPC-Endpoints

- `stocksRouter.getByTicker`
- `signalsRouter.getScoresByTicker`
- `stocksRouter.getOHLC` (für Chart-Tab)
- `stocksRouter.getDcf` (Bewertung)
- `predictionRouter.forecast` (KI-Prognose)
- `backtestRouter.compare` (Backtest)
- `newsRouter.byTicker`
- `priceAlertsRouter.create` (Alarm-Action)
- `watchlistRouter.toggle` (Beobachten-Action)
- `portfoliosRouter.buy` (Kaufen-Action, mit `portfolioId` aus dem Modal)

### Akzeptanzkriterien

- [ ] `/aktien/NESN.SW` zeigt Nestlé mit aktuellem Preis innerhalb 2s
- [ ] Tab-Wechsel zwischen Signale/Chart/DCF lädt jeweils Daten ohne Header-Flackern
- [ ] „Kaufen"-Button öffnet Modal mit allen Live-Portfolios als Picker
- [ ] „Alarm setzen"-Button speichert Alarm und zeigt Toast
- [ ] Alte URL `/stock/NESN.SW` redirected zu `/aktien/NESN.SW`
- [ ] Alte URL `/signals` redirected zu `/aktien` (Liste, da Signal-Page ohne Ticker keinen Sinn machte)

---

## Markt

**Route:** `/markt?tab=…`
**Datei:** **neu** `client/src/pages/Markt.tsx`

### Layout

5 Tabs (default `ueberblick`):

| Tab-Key | Label | Inhalt |
|---|---|---|
| `ueberblick` | Überblick | 4 Index-KPIs (SMI, S&P, MSCI, Gold) + Indizes-Chart YTD |
| `regime` | Regime | Aktuelles Regime (Pill: Bull/Bear/Korrektur + Vola-Level) + Regime-Verlauf 12 Monate als Timeline-Bar + VIX/Yield-Curve/LPPL-Kennzahlen |
| `heatmap` | Heatmap | Toggle Aktien-Heatmap / Sektor-Heatmap + Zeitraum-Picker (1T/1W/1M/YTD) |
| `news` | News | Markt-News, kuratiert nach Region (Schweiz / Europa / USA / Asien) |
| `dividenden` | Dividenden-Kalender | Tabelle der nächsten 30 Tage, gefiltert auf eigene Positionen |

### Konsolidierung aus

- `MarketOverview.tsx`, `MarketHeatmap.tsx`, `SectorHeatmap.tsx`, `MarketRegime.tsx` (alle gelöscht — Inhalte zu Tabs)
- `DividendCalendar.tsx` (gelöscht — wird Tab)
- **`Newsroom.tsx` bleibt** — als Marketing-Page. Der News-Tab im Markt-Hub konsumiert dieselben Endpoints.

### tRPC-Endpoints

- `marketRegimeRouter.*` (für Regime-Tab)
- `analyticsRouter.heatmap` (Aktien-Heatmap)
- `analyticsRouter.sectorHeatmap` (Sektor-Heatmap)
- `newsRouter.list` (News-Tab)
- `dividendCalendarRouter.upcoming` (Dividenden-Tab)

### Akzeptanzkriterien

- [ ] `/markt` öffnet default Tab Überblick mit 4 Index-KPIs
- [ ] Tab Regime zeigt aktuelles Regime-Pill (Farbe = grün/gelb/rot)
- [ ] Tab Heatmap: Toggle zwischen Aktien-Heatmap (≥ 30 Ticker) und Sektor-Heatmap (10 Sektoren)
- [ ] Tab Dividenden zeigt **nur** Ticker aus eigenen Positionen
- [ ] Alte URL `/market-regime` redirected zu `/markt?tab=regime`

---

## Copilot

**Route:** `/copilot?tab=…`
**Datei:** `client/src/pages/PortfolioCopilot.tsx`

### Layout

3 Tabs:

| Tab-Key | Label | Inhalt |
|---|---|---|
| `insights` | Insights | Karten-Grid mit ≥ 3 Insights, sortiert nach Severity (watch > info > positive). Jede Karte: Icon + Title + Body + Action-Button |
| `chat` | Chat | Voll-Höhe-Chat mit Message-History + Eingabezeile. Floating-Button aus dem Rest der App öffnet diesen Tab direkt |
| `history` | History | Liste aller Konversationen, klickbar → öffnet Tab Chat mit der Konversation geladen |

### Konsolidierung aus

- `PortfolioCopilot.tsx` (bleibt als Wrapper)
- `AIInsights.tsx` (gelöscht — wird Tab)
- `Chat.tsx` (gelöscht — wird Tab)
- `FloatingChatButton.tsx` (bleibt!) — nur die Ziel-URL ändert sich auf `/copilot?tab=chat`

### tRPC-Endpoints

- `aiInsightsRouter.list` (Insights-Tab)
- `copilotRouter.chat` (Chat-Tab — streamed)
- `copilotRouter.listConversations` (History-Tab)
- `chatRouter.*` ggf. mergen oder beides nutzen (im Audit prüfen welches Router-Set besser ist)

### Akzeptanzkriterien

- [ ] `/copilot` öffnet default Tab Insights mit ≥ 3 Items
- [ ] Floating-Chat-Button irgendwo in der App → öffnet `/copilot?tab=chat`
- [ ] Eine Frage stellen im Chat → Streaming-Response erscheint (kein „Wait, then full reply")
- [ ] Tab History → klick auf Konversation → öffnet Chat mit Verlauf
- [ ] Alte URL `/ai-insights` redirected zu `/copilot?tab=insights`
- [ ] Alte URL `/chat` redirected zu `/copilot?tab=chat`

---

## Portfolio-Builder · Wizard

**Route:** `/portfolio-builder`
**Datei:** `client/src/pages/PortfolioBuilderWizard.tsx`

### Flow (5 Schritte)

1. **Pfad wählen:** „Vorlage" / „Manuell" / „Import (CSV/PDF)" — die Pfad-Entscheidung wandert hier rein (heute: 4 separate Routen)
2. **Strategie / Vorlage:** je nach Pfad — Risiko-Profil-Picker (falls Vorlage), leeres Portfolio benennen (falls Manuell), File-Upload (falls Import)
3. **Positionen:** Pre-fill je nach Strategie. User kann editieren
4. **Review:** Allokation als Donut + erwartete Sharpe/Vola
5. **Bestätigen:** Portfolio anlegen, redirect zu `/portfolios/:id`

### Konsolidierung aus

- `PortfolioBuilderWizard.tsx` (bleibt)
- `PortfolioBuilderLanding.tsx` → Step 1
- `PortfolioBuilderNew.tsx` → ggf. Komponenten extrahieren
- `PortfolioBuilder.tsx` (gelöscht)

### Akzeptanzkriterien

- [ ] Auf `/portfolio-builder` ist Step 1 sichtbar mit den 3 Pfad-Karten
- [ ] Step 5 → POST an `portfoliosRouter.create` und Redirect zu `/portfolios/:id` mit `?onboarding=success`-Param

---

## Onboarding · Wizard

**Route:** `/onboarding`
**Datei:** `client/src/components/OnboardingWizard.tsx`

### Flow (4 Schritte)

1. **Willkommen** — Was kann der Portfoliomanager
2. **Risiko-Profil** — `InvestorTypeTest.tsx`-Inhalt als Step
3. **Erstes Portfolio** — Inline-Wizard (alternativ Skip → Dashboard mit Demo-Portfolio)
4. **Tour starten?** — Optional App-Tour (Inhalt aus `OnboardingTutorial.tsx` + `GuidedTourModal.tsx`)

### Konsolidierung aus

- `OnboardingWizard.tsx` (bleibt)
- `OnboardingTutorial.tsx`, `GuidedTourModal.tsx`, `InvestorTypeTest.tsx` → als Steps integriert
- `InteractiveTour.tsx` (gelöscht)

### Akzeptanzkriterien

- [ ] Neuer User wird **einmal** durch Onboarding geführt — danach `onboardingStatus.hasCompletedOnboarding = true`
- [ ] Tour kann später aus `/einstellungen` (Help-Sektion) erneut gestartet werden

---

## Einstellungen

**Route:** `/einstellungen?tab=…`
**Datei:** `client/src/pages/Einstellungen.tsx`

### Layout (Sub-Tabs)

| Tab-Key | Label | Inhalt |
|---|---|---|
| `profil` | Profil | Name, Avatar, Email, Passwort ändern |
| `benachrichtigungen` | Benachrichtigungen | Inhalt aus `NotificationSettings.tsx` |
| `sicherheit` | Sicherheit | 2FA, aktive Sessions, Login-History |
| `api` | API | API-Keys (Read-only nach Plan), Webhook-URLs |
| `hilfe` | Hilfe | „App-Tour erneut starten", FAQ-Link, Kontakt |

### Konsolidierung aus

- `Einstellungen.tsx` (Wrapper bleibt)
- `NotificationSettings.tsx` → Tab Benachrichtigungen

---

## Auth (zusammengefasst)

**Route:** `/auth?tab=login|register|forgot`
**Datei:** **neu** `client/src/pages/Auth.tsx`

3 Tabs (heute 3 separate Pages). Deep-Link via `?tab=` aus E-Mail-Templates möglich.

`ForgotPassword.tsx`, `ResetPassword.tsx`, `VerifyEmail.tsx` bleiben als eigene Routen (haben Token-Parameter und werden aus E-Mails verlinkt).
