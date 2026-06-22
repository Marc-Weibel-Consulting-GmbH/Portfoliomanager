# 04 · Migration-Plan — 8 PRs, sequenziell

Jede PR ist **deploy-fähig für sich**. Nach jeder PR muss `/dashboard` lauffähig bleiben. Sequenz von risikoarm → riskant — wenn was hängen bleibt, hast du schon einen Mehrwert gemerged.

**Pro PR:**
- **Scope:** welche Dateien anpassen
- **Akzeptanzkriterien:** was muss klappen
- **Test im Browser:** klare Schritt-für-Schritt-Anleitung
- **Risk:** 1 (trivial) — 5 (kritisch)
- **Rollback:** wie zurück, falls was schief geht

---

## PR 01 — Sidebar konsolidieren · Risk **1**

**Ziel:** Die neue Top-Level-Sidebar (6 Einträge) — ohne dass Routen sich ändern.

### Scope

- `client/src/components/DashboardLayout.tsx` — `menuGroups` / `topLevelItems` ersetzen durch die Struktur aus `02-IA-Routes.md`
- Alte Gruppen (Markt / Portfolio / Einzeltitel-Analyse / Tools / Einstellungen) entfernen
- `client/src/components/AppNavigation.tsx` — als **deprecated** markieren mit Code-Kommentar (Löschung erst in PR 03)

### Akzeptanzkriterien

- [ ] Sidebar zeigt: Dashboard · Portfolios · Aktien · Markt · Copilot · Tools · Einstellungen
- [ ] Klick auf jeden Eintrag führt zur **alten** Route (z.B. „Aktien" → `/invest`), keine 404
- [ ] Bestehende Portfolio-Submenu-Funktionalität (Liste der eigenen Portfolios) bleibt erhalten
- [ ] Mobile-Header zeigt den richtigen aktiven Eintrag

### Test im Browser

1. `/dashboard` öffnen
2. Sidebar prüfen: 6 sichtbare Top-Level-Items
3. Auf „Portfolios" klicken → Liste expandiert mit Submenu der eigenen Portfolios
4. Auf eines der Portfolios klicken → `/portfolios/abc` öffnet (Live oder Lokal)
5. Sidebar einklappen (Icon-Mode), Icons erkennbar
6. Auf Mobile (DevTools width 375): Hamburger öffnet Sidebar, alle Items sichtbar

### Risk · Rollback

Niedrig — kein DB- oder Router-Change. Rollback: einen Commit revertieren.

---

## PR 02 — Portfolios-Detail · 6 Tabs zusammenführen · Risk **3**

**Ziel:** Alle Portfolio-bezogenen Sub-Pages (Positions / Transactions / Realized Gains / Risk / Reports / Optimizer) als Tabs in `/portfolios/:id?tab=…`.

### Scope

- `client/src/pages/PortfolioDetailsPage.tsx` — Tab-Switcher implementieren (siehe `03-Screens.md`). Tab-State aus `?tab=`-Query, Default `uebersicht`
- Tab-Inhalte als Komponenten extrahieren in `client/src/pages/portfolio-detail/` oder Tab-Komponenten in `client/src/components/portfolio/`:
  - `OverviewTab.tsx` — bisher Inhalt von `PortfolioDetailsPage`
  - `PositionsTab.tsx` — Wrapper um Inhalt aus `PortfolioPositions.tsx`
  - `TransactionsTab.tsx` — Wrapper um `PortfolioTransactions.tsx` + Filter „Realisierte Gewinne" für `RealizedGainsHistory`-Logik
  - `PerformanceTab.tsx` — Inhalt aus `Reports.tsx` + `Analysis.tsx` (vorher prüfen ob die zwei sich überlappen oder ergänzen)
  - `RiskTab.tsx` — Inhalt aus `RiskDashboard.tsx`
  - `OptimieenTab.tsx` — Inhalt aus `PortfolioOptimizer.tsx` + `aiInsightsRouter`-Calls
- `App.tsx` — alte Sub-Routen behalten, aber als `<Redirect>` zu `/portfolios/:id?tab=…` (siehe `02-IA-Routes.md`)

### Akzeptanzkriterien

- [ ] `/portfolios/abc` öffnet Tab „Übersicht" (Default)
- [ ] Klick auf Tab „Positionen" → ändert URL zu `?tab=positionen` (ohne Page-Reload)
- [ ] Direkter Aufruf `/portfolios/abc?tab=risiko` öffnet Risiko-Tab
- [ ] **Alle 6 Tabs** liefern echte Daten aus den bestehenden tRPC-Endpoints
- [ ] Alte URL `/portfolio/abc/positions` redirected zu `/portfolios/abc?tab=positionen`
- [ ] Tab-Wechsel ist instant (< 200 ms perceived latency — Daten ggf. parallel preloaden)

### Test im Browser

1. `/portfolios/<einer-deiner-portfolios>` öffnen → Übersicht sichtbar, KPIs gefüllt
2. Tab „Positionen" klicken → Tabelle mit Holdings
3. URL kopieren, neuer Tab öffnen → öffnet direkt mit Tab Positionen
4. Tab „Transaktionen" → Filter „Realisierte Gewinne" aktivieren → Liste filtert
5. Tab „Optimieren" → ≥ 1 KI-Vorschlag sichtbar
6. Alte URL `/portfolio/<id>/positions` aufrufen → Server/Wouter redirected zu neuer URL

### Risk · Rollback

Mittel — viele Code-Pfade konsolidiert. Vor Merge: regression-test über alle drei Portfolio-Beispiele aus der Demo-DB (Bluechips, Globale Div., Dividenden).

Rollback: alte Routen wiederbeleben (sind im Code als Komponenten noch vorhanden — nur `App.tsx` reverten).

---

## PR 03 — `Home.tsx` und `AppNavigation.tsx` entfernen · Risk **2**

**Ziel:** Das 2. Dashboard (`Home.tsx`, 210 KB) und die alte Top-Nav (`AppNavigation.tsx`) endgültig löschen.

### Scope (vorher!)

**Audit vor dem Löschen** (kannst du im Browser & Repo machen):
```bash
# Im Repo:
grep -rn "from.*\"@/pages/Home\"" client/src/
grep -rn "Home.tsx" client/src/
grep -rn "AppNavigation" client/src/
```
Wenn `Home.tsx` Komponenten **exportiert**, die anderswo importiert werden: erst diese Komponenten in `client/src/components/` extrahieren.

### Scope (löschen)

- `client/src/pages/Home.tsx` (löschen)
- `client/src/components/AppNavigation.tsx` (löschen)
- `client/src/components/BreadcrumbNav.tsx` (löschen — falls nicht woanders importiert)
- `App.tsx` — Routen `/home` und `/optimizer` als Redirect zu `/dashboard`
- `App.tsx` — Import von `Home` entfernen

### Akzeptanzkriterien

- [ ] `npm run build` läuft durch ohne TS-Fehler
- [ ] `/home` redirected zu `/dashboard`
- [ ] `/dashboard` zeigt alles korrekt (visueller Diff vor/nach: keine fehlenden Features)

### Test im Browser

1. `/home` aufrufen → redirected zu `/dashboard`
2. `/optimizer` aufrufen → redirected zu `/dashboard`
3. `/dashboard` öffnen → alle 6 KPI-Cards + Performance-Chart + Positionen-Toggle wie vorher
4. Wenn `Home.tsx` versteckte Features hatte (z.B. ein spezieller Filter): diese müssen vorher als Tab oder Toggle in `Dashboard.tsx` integriert sein

### Risk · Rollback

Niedrig-Mittel. `Home.tsx` ist 210 KB — viel kann drin stecken. Mitigation: vor dem Löschen Inhalt sichten (Manus: lies `client/src/pages/Home.tsx` und mache eine eigene Liste von Features, die in `Dashboard.tsx` nicht abgedeckt sind. Schreib sie in `05-Open-Questions.md` falls unklar).

Rollback: file restore aus Git.

---

## PR 04 — Aktien-Detail · 7 Tabs · Risk **4**

**Ziel:** Alle 8 Einzeltitel-Analyse-Tools (`Signals`, `TechnicalAnalysis`, `DCFValuation`, `Prediction`, `Backtesting`, `Analysis`, `InvestDetail`) als Tabs in `/aktien/:ticker?tab=…`. Plus `Categories` und `Sectors` als Filter in `/aktien`.

### Scope

- `client/src/pages/StockDetail.tsx` — überarbeiten zu Tab-Page (siehe `03-Screens.md`)
- Tab-Komponenten in `client/src/components/stock-detail/`:
  - `OverviewTab.tsx`, `SignalsTab.tsx`, `ChartTab.tsx`, `DcfTab.tsx`, `PredictionTab.tsx`, `BacktestTab.tsx`, `NewsTab.tsx`
- `pages/Invest.tsx` umbenennen zu `pages/Aktien.tsx`
- Filter-Chips für Kategorie / Sektor in der Aktien-Suche (heutige `Categories.tsx`- und `Sectors.tsx`-Inhalte)
- `App.tsx` — Routen-Block ersetzen: `/aktien`, `/aktien/:ticker`. Alte Routen als Redirects (`/stock/`, `/invest/`, `/signals`, `/technical-analysis`, `/dcf-valuation`, `/prediction`, `/backtesting`, `/analysis`, `/categories`, `/sectors`)
- Sidebar-Eintrag in `DashboardLayout.tsx`: `path: "/aktien"`
- Pages löschen: `InvestDetail.tsx`, `Signals.tsx`, `TechnicalAnalysis.tsx`, `DCFValuation.tsx`, `Prediction.tsx`, `Backtesting.tsx`, `Analysis.tsx`, `Categories.tsx`, `Sectors.tsx`

### Akzeptanzkriterien

- [ ] `/aktien/NESN.SW` lädt mit Tab Übersicht
- [ ] Tab Signale zeigt Signal-Scores (≥ 7 Einzel-Signale)
- [ ] Tab Bewertung zeigt DCF mit Sensitivitäts-Heatmap
- [ ] „Kaufen"-Button öffnet Modal mit Portfolio-Picker und führt eine echte Transaktion aus
- [ ] Alle 10 alten URLs (Liste in `02-IA-Routes.md`) redirected korrekt

### Test im Browser

1. `/aktien` → Sucheingabe, Filter „Sektor: Tech" → Liste filtert
2. Klick auf Ticker → `/aktien/NESN.SW?tab=uebersicht`
3. Alle 7 Tabs einmal durchklicken — jeder zeigt Inhalt
4. `/stock/NESN.SW` aufrufen → redirected zu `/aktien/NESN.SW`
5. `/signals` aufrufen → redirected zu `/aktien` (Liste)
6. „Kaufen"-Button → Modal öffnet → Portfolio auswählen → Submit → Toast „Position hinzugefügt"

### Risk · Rollback

Hoch — viele Pages. Mitigation: in **2 Sub-PRs** splitten falls nötig:
- 04a: nur das Tab-Gerüst auf `StockDetail.tsx` mit 3 Tabs (Übersicht / Signale / Chart)
- 04b: restliche 4 Tabs (Bewertung / Prognose / Backtest / News) plus Page-Löschungen

Rollback: PR-revert.

---

## PR 05 — Markt-Hub · 5 Tabs · Risk **2**

**Ziel:** `/markt` als neue Top-Level-Page. Alle 4 Markt-Views + Dividenden-Kalender als Tabs.

### Scope

- **Neu** `client/src/pages/Markt.tsx` (Wrapper mit Tab-Switcher)
- Tab-Komponenten in `client/src/components/markt/`:
  - `UeberblickTab.tsx`, `RegimeTab.tsx`, `HeatmapTab.tsx`, `NewsTab.tsx`, `DividendenTab.tsx`
- Inhalt aus `MarketOverview`, `MarketRegime`, `MarketHeatmap`, `SectorHeatmap`, `DividendCalendar` jeweils umsiedeln
- `App.tsx` — neue Route `/markt`, alte Routen als Redirects
- Sidebar-Eintrag: `path: "/markt"`
- **Newsroom bleibt unverändert** als public marketing page
- Pages löschen: `MarketOverview.tsx`, `MarketHeatmap.tsx`, `SectorHeatmap.tsx`, `MarketRegime.tsx`, `DividendCalendar.tsx`

### Akzeptanzkriterien

- [ ] `/markt` öffnet Tab Überblick mit 4 Index-KPIs (SMI, S&P, MSCI, Gold)
- [ ] Tab Heatmap: Toggle Aktien/Sektor-Heatmap funktioniert
- [ ] Tab Dividenden zeigt nur Ticker aus eigenen Live-Positionen
- [ ] Alte URLs (`/market-overview`, `/market-heatmap`, `/sector-heatmap`, `/market-regime`, `/dividends`) redirected

### Test im Browser

1. `/markt` → 4 KPIs sichtbar
2. Tab Regime → Pill zeigt aktuelles Regime (z.B. „Bull · Niedrige Vola" grün)
3. Tab Heatmap → Sektor-Toggle: 10 Sektor-Tiles, mit YTD-Färbung (grün/rot)
4. `/dividends` aufrufen → redirected

### Risk · Rollback

Niedrig — die Markt-Views sind read-only (keine User-Mutations). Rollback unkompliziert.

---

## PR 06 — Copilot-Hub · 3 Tabs · Risk **2**

**Ziel:** Insights + Chat in einer Page; Floating-Button bleibt der globale Einstieg.

### Scope

- `client/src/pages/PortfolioCopilot.tsx` — Tab-Switcher (Insights / Chat / History)
- Tab-Komponenten:
  - `InsightsTab.tsx` — aus `AIInsights.tsx`
  - `ChatTab.tsx` — aus `Chat.tsx`
  - `HistoryTab.tsx` — aus `CopilotHistory.tsx`
- `FloatingChatButton.tsx` — Klick führt zu `/copilot?tab=chat` (heute öffnet er ggf. das Inline-Chat — auf Deep-Link umstellen)
- `App.tsx` — Redirects `/ai-insights`, `/chat` → `/copilot`
- Pages löschen: `AIInsights.tsx`, `Chat.tsx`

### Akzeptanzkriterien

- [ ] `/copilot` → Insights-Tab mit ≥ 3 Karten
- [ ] Floating-Button (sichtbar in `/dashboard`) → öffnet `/copilot?tab=chat`
- [ ] Chat-Tab: Streaming-Response funktioniert (kein Wait-Then-Reply)
- [ ] History-Tab: Konversationen sind klickbar und öffnen Chat mit Verlauf

### Test im Browser

1. `/dashboard` → Floating-Button rechts unten sichtbar
2. Floating-Button klicken → `/copilot?tab=chat` öffnet
3. „Wie steht mein Portfolio?" eingeben → Streaming-Response erscheint Wort für Wort
4. Tab History → klick auf Konversation → Chat lädt Verlauf

### Risk · Rollback

Niedrig — Chat ist isoliert. Falls die `chatRouter`- und `copilotRouter`-Endpoints divergieren: in `05-Open-Questions.md` festhalten und vor PR-Merge klären.

---

## PR 07 — Portfolio-Builder · Wizard mit 3 Pfaden · Risk **3**

**Ziel:** 1 Wizard mit Pfad-Wahl statt 4 Routen.

### Scope

- `client/src/pages/PortfolioBuilderWizard.tsx` — Step 0 hinzufügen: 3 Pfad-Karten (Vorlage / Manuell / Import)
- Inhalt aus `PortfolioBuilderLanding.tsx` und `PortfolioBuilderNew.tsx` jeweils als Step-Inhalt
- `App.tsx` — Redirects `/portfolio-builder/new` und `/portfolio-builder/old` → `/portfolio-builder/wizard`
- Routen `/portfolio-builder` und `/portfolio-builder/wizard` zeigen beide auf den Wizard (Default Step 0)
- Pages löschen: `PortfolioBuilder.tsx`, `PortfolioBuilderNew.tsx`, `PortfolioBuilderLanding.tsx`

### Akzeptanzkriterien

- [ ] `/portfolio-builder` zeigt 3 Pfad-Karten
- [ ] Pfad „Import" akzeptiert CSV und PDF (aus `Import.tsx`-Logik wiederverwenden)
- [ ] Step 5 (Bestätigen) ruft `portfoliosRouter.create` und redirected zu `/portfolios/:id?onboarding=success`

### Test im Browser

1. `/portfolio-builder` → 3 Pfad-Karten
2. „Vorlage" wählen → Risiko-Profil-Schritt (3 Optionen: Konservativ / Mittel / Mutig)
3. Weiter durch alle Steps
4. Bestätigen → neues Portfolio existiert in DB, Redirect zu `/portfolios/<neue-id>`

### Risk · Rollback

Mittel — Builder ist ein Revenue-Touchpoint. Vor Merge mit Marc abstimmen ob alle 3 Pfade Day-1 nötig sind oder ob „Import" in einem Follow-up kommen darf.

---

## PR 08 — Onboarding-Konsolidierung + Auth-Page · Risk **3**

**Ziel:** 6 Onboarding-Komponenten → 1 Wizard. 3 Auth-Pages → 1 Page mit Tabs.

### Scope

- `client/src/components/OnboardingWizard.tsx` — Steps aus `OnboardingTutorial.tsx`, `GuidedTourModal.tsx`, `InvestorTypeTest.tsx` integrieren
- `InteractiveTour.tsx` löschen
- **Neu** `client/src/pages/Auth.tsx` — 3 Tabs (Login / Register / Forgot)
- Inhalt aus `Login.tsx`, `Register.tsx`, `Registration.tsx`, `ForgotPassword.tsx` migrieren
- `App.tsx` — Route `/auth`, alte als Redirects
- `Registration.tsx` löschen (Doppelt zu `Register.tsx`)

### Akzeptanzkriterien

- [ ] Neuer User: Register → E-Mail-Verify → Onboarding-Wizard (4 Steps) → Dashboard
- [ ] Wizard kann abgebrochen werden (Skip) — User landet im Dashboard mit Demo-Portfolio
- [ ] Tour aus `/einstellungen?tab=hilfe` erneut startbar
- [ ] `/login` redirected zu `/auth?tab=login`

### Test im Browser

1. Inkognito-Tab öffnen, `/auth?tab=register` → Register-Form
2. Account anlegen → E-Mail-Verify-Flow → automatisch in Onboarding
3. Onboarding durchklicken → Dashboard
4. Logout → `/auth?tab=login` → Login → Dashboard
5. Setting-Tab Hilfe → „Tour neu starten" → Onboarding-Modal öffnet

### Risk · Rollback

Mittel-Hoch. Auth ist kritisch — vor Merge unbedingt End-to-End-Test mit echtem Mail-Versand. Mitigation: bestehende `Login.tsx` und `Register.tsx` nicht direkt löschen, sondern erstmal `Auth.tsx` daneben deployen und Routen umlenken. Löschen in einer Follow-up-PR.

---

## Reihenfolge & Geschätzter Aufwand

| PR | Risk | Aufwand (Manus h) | Abhängig von |
|---|---|---|---|
| 01 — Sidebar | 1 | 1 | — |
| 02 — Portfolios-Detail | 3 | 4-6 | 01 |
| 03 — Home + AppNav weg | 2 | 1-2 | 02 |
| 04 — Aktien-Detail | 4 | 6-8 | 01 |
| 05 — Markt-Hub | 2 | 2-3 | 01 |
| 06 — Copilot-Hub | 2 | 2-3 | 01 |
| 07 — Portfolio-Builder | 3 | 3-4 | 02 |
| 08 — Onboarding + Auth | 3 | 4-5 | — |

**Empfohlene Reihenfolge:** 01 → 02 → 03 → 05 → 06 → 04 → 07 → 08.

PR 04 (Aktien-Detail) und PR 08 (Onboarding) sind die riskantesten — bewusst nach hinten geschoben, damit du erst Vertrauen in das Tab-Pattern aus PR 02 / 05 / 06 aufbauen kannst.

---

## Globaler Smoke-Test (nach jeder PR)

1. `/dashboard` öffnet ohne Fehler — 6 KPIs, Performance-Chart, 3 Insight-Karten
2. Sidebar: 6 Items sichtbar, Klick auf jeden funktioniert
3. `/portfolios` → Liste, klick auf eines → `/portfolios/:id?tab=uebersicht`
4. `/aktien/NESN.SW` (wenn live) → Tabs durchklickbar
5. Floating-Chat-Button → öffnet Copilot
6. `npm run build` → keine TS-Fehler
7. `grep -r "from \"@/pages/Home\"" client/src/` → keine Treffer (nach PR 03)
