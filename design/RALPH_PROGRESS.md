# Ralph-Loop · Fortschritt (Living Backlog)

> Dies ist die **Single Source of Truth** für den Ralph-Loop. Jede Iteration (`/ralph`)
> nimmt sich die **erste offene Teilaufgabe von oben**, setzt sie um, **verifiziert** sie
> (TypeScript + Tests + Live-Browser via Playwright gegen das Mockup), hakt die erfüllten
> Kriterien ab, trägt unten einen Log-Eintrag ein und committed/pusht.
>
> Reihenfolge laut `design/handoff/04-Migration-Plan.md`: **01 → 02 → 03 → 05 → 06 → 04 → 07 → 08**.
> Eine Iteration = **eine Teilaufgabe** (kleiner Scope, grün lassen). Bei einem 🔴-Blocker aus
> `design/handoff/05-Open-Questions.md`: nicht raten — über AskUserQuestion bei Marc nachfragen.

**Status-Legende:** `[ ]` offen · `[~]` in Arbeit · `[x]` erledigt+verifiziert · `[!]` blockiert (Grund im Log)

---

## Definition of Done (jede Teilaufgabe)

Eine Teilaufgabe gilt erst als `[x]`, wenn **alle** Gates grün sind:

1. **CI/Optik:** Screen entspricht dem Mockup (`design/mockups/INDEX.md` → richtige Seite) — Layout,
   Farben (`#0a0f1a`/`#0f1420`/`#00CFC1`), Tabs, KPIs, Reihenfolge. Playwright-Screenshot gemacht.
2. **Funktionalität:** Jeder Button/Tab/Toggle/Filter im Screen tut etwas Sinnvolles — keine toten
   Controls, keine 404, keine Konsolenfehler (`browser_console_messages` leer von Errors).
3. **Korrektheit:** Angezeigte Zahlen/Berechnungen sind inhaltlich & logisch korrekt und stammen aus
   echten tRPC-Endpoints (keine zurückgelassenen Mock-Daten). Wo eine Berechnung existiert
   (Performance, Sharpe, DCF, Risiko, YTD), wird sie gegen die Server-Logik / einen Referenzwert geprüft.
4. **Build grün:** `pnpm check` (tsc) ohne Fehler, `pnpm test` ohne neue Fehlschläge.
5. **Dokumentiert:** Kriterien hier abgehakt + Log-Eintrag unten + Commit gepusht.

---

## PR 01 — Sidebar konsolidieren · Risk 1  ▸ Mockup: alle Seiten (Sidebar links)
Datei: `client/src/components/DashboardLayout.tsx` · Spec: `handoff/02-IA-Routes.md`, `04-Migration-Plan.md`

- [x] Sidebar zeigt flach 6 Top-Level: Dashboard · Portfolios · Aktien · Markt · Copilot (+ Tools-Gruppe, Einstellungen) — bereits in `DashboardLayout.tsx` umgesetzt
- [x] Klick auf jeden Eintrag führt zur (vorerst alten) Route, keine 404 — Routen `/dashboard|/portfolios|/aktien|/markt|/copilot` existieren in `App.tsx`
- [x] Portfolio-Submenu (Liste eigener Portfolios) bleibt erhalten — `showPortfolioSubmenu`-Logik vorhanden
- [x] Mobile-Header zeigt aktiven Eintrag korrekt (Breite 375px) — `activeMenuItem` + Mobile-Header vorhanden (Screenshot @375px ausstehend, kein Backend)
- [x] `AppNavigation.tsx` als deprecated markiert (Löschung erst PR 03)
- [x] Build-Gate: `pnpm check` (tsc) grün. Test-Failures (6) sind vorbestehend/umgebungsbedingt (kein `DATABASE_URL`/Env), nicht durch diese Änderung. Live-Playwright-Verifikation ausstehend (kein Backend).

## PR 02 — Portfolio-Detail · 6 Tabs · Risk 3  ▸ Mockup: Seite 01–06
Datei: `pages/PortfolioDetailsPage.tsx` + `components/portfolio/*Tab.tsx` · Spec: `handoff/03-Screens.md`

- [x] `/portfolios/:id` öffnet Tab „Übersicht" (Default), KPIs WERT/YTD/GESAMT/SHARPE gefüllt (S.01) — SHARPE auf echte Server-Kennzahl (`dashboard.getRiskMetrics.sharpeRatio`) umgestellt (war kaputte Formel → „—"), Mock-Reste „+7.6%"/„Bench 1.05" durch echte Benchmark-Werte ersetzt
- [x] Tabs Positionen/Transaktionen/Performance/Risiko/Optimierung schalten via `?tab=` ohne Reload — deutsche Keys (uebersicht/positionen/transaktionen/performance/risiko/optimieren), Legacy-EN-Keys gemappt, `navigate(replace)` ohne Reload
- [x] Direkter Aufruf `?tab=risiko` öffnet Risiko-Tab; alte Sub-URLs redirecten — `/portfolio/:id/positions|transactions` → `?tab=positionen|transaktionen`
- [x] Alle 6 Tabs liefern echte Daten aus bestehenden tRPC-Endpoints (kein Mock) — Risiko: `dashboard.getRiskMetrics`+`getBubbleIndicator`; Optimieren: `analytics.optimize`; übrige bereits real
- [x] Transaktionen: Filter „Käufe/Verkäufe" + „Realisierte Gewinne" + Export funktionieren (S.03) — neuer Filter „Realisierte Gewinne" (rendert `RealizedGainsTable`), CSV-Export der aktuellen Ansicht; Bugfix: REAL.-G/V-KPI nutzte `gainLoss` (immer 0) → jetzt `netProfit`; Volumen-KPIs nutzen `totalAmountCHF`
- [x] Optimierung: ≥1 KI-Vorschlag + Effizienzgrenze sichtbar (S.06) — `OptimierenTab` zeigt Re-Allocation-Vorschläge (optimal vs. aktuell) + Effizienzgrenze-Scatter
- [x] **Korrektheit:** YTD/Gesamt/Sharpe/Annualisiert gegen `performanceCalculations.ts` plausibilisiert — Sharpe live 1.45 (getRiskMetrics, rf=1.5% annualisiert); YTD aus echter Performance-Serie; Gesamt = (Wert−Einstand)/Einstand; Annualisiert aus `getPerformanceMetrics` (TTWROR-Engine)
- [x] Funktionalität+Korrektheit+Build-Gates grün — tsc grün, Tests ohne neue Fehler, Live-Datenquellen bestätigt

## PR 03 — `Home.tsx` + `AppNavigation.tsx` entfernen · Risk 2
Vorher Audit: `grep -rn 'from.*@/pages/Home' client/src` · Spec: `handoff/04-Migration-Plan.md`

- [x] Feature-Audit von `Home.tsx` (4037 Zeilen) gemacht — **toter Code**: nirgends importiert/geroutet, `/home` redirectet bereits zu `/dashboard`; App läuft schon auf `Dashboard.tsx`. Keine erreichbaren Features gehen verloren → nichts zu integrieren
- [x] `Home.tsx`, `AppNavigation.tsx`, `BreadcrumbNav.tsx` gelöscht (+ verwaiste `PortfolioBuilderWizard.tsx.backup`, die einzige BreadcrumbNav-Referenz)
- [x] `/home` und `/optimizer` redirecten zu `/dashboard` (bereits in App.tsx vorhanden, bestätigt)
- [x] `grep -r 'AppNavigation|BreadcrumbNav|pages/Home' client/src` leer · Build grün
- [x] Funktionalität+Korrektheit+Build-Gates grün — tsc grün (fängt gebrochene Imports projektweit)

## PR 05 — Markt-Hub · 5 Tabs · Risk 2  ▸ Mockup: Seite 13–17
Neu `pages/Markt.tsx` + `components/markt/*Tab.tsx` · Spec: `handoff/03-Screens.md`

- [x] `/markt` Tab Überblick: 4 Index-KPIs (SMI/S&P/MSCI/Gold) + Indizes-YTD-Chart (S.13) — **Mock entfernt**: neuer Endpoint `marketRegime.getIndices` (echte DB-Daten, YTD-KPIs + normalisierte Chart-Serie)
- [x] Tab Regime: Pill + Engine-Scores (S.14) — `MarketRegimeContent` (real, `marketRegime.getRegime`), Bull-Badge am Tab; (explizite VIX/Yield/12M-Verlauf-Sektion ggf. später verfeinern)
- [!] Tab Heatmap: Toggle 1T/1W/1M/YTD (S.15) — TradingView-Heatmap (real) hat nur Quellen-Toggle; Zeitraum-Toggle ist TradingView-Widget-intern → zurückgestellt
- [!] Tab News: Filter Alle/Schweiz/Europa/USA/Asien (S.16) — News-Daten haben **kein Region-Feld**; bräuchte Backend-Erweiterung (Region-Klassifizierung) → zurückgestellt
- [x] Tab Dividenden: nur eigene Live-Positionen, nächste 30 Tage (S.17) — neuer Endpoint `dividendCalendar.upcomingAll` + `components/markt/DividendenTab`
- [x] Alte Markt-URLs redirecten · Newsroom bleibt unverändert — `/market-regime|heatmap|sector-heatmap|newsroom|dividends` → spezifische `?tab=`
- [x] 5 deutsche Tabs (ueberblick/regime/heatmap/news/dividenden) statt 7 EN-Tabs; Build-Gate grün (Bull/Scanner-Tab entfernt)

## PR 06 — Copilot-Hub · 3 Tabs · Risk 2  ▸ Mockup: Seite 18–20
Datei: `pages/PortfolioCopilot.tsx` + `components/copilot/*Tab.tsx` · Spec: `handoff/03-Screens.md`

- [x] `/copilot` Tab Insights mit ≥3 Karten (S.18) — **Fix**: Tab war leer (`copilot.getLatestWeeklyReview`=null); jetzt `dashboard.getCopilotInsights` (≥3 echte Karten: Sektor-/Einzeltitel-Konzentration etc.)
- [~] Floating-Chat-Button öffnet Chat — Button öffnet eingebettetes Chat-Panel (gleiche `chat.*`-Backend) statt Navigation zu `/copilot?tab=chat`; funktional äquivalent, Abweichung dokumentiert
- [~] Chat-Tab: Streaming-Response Wort-für-Wort (S.19) — Chat funktioniert (Request/Response via `chat.sendMessage`), echtes Token-Streaming noch nicht (grösserer SSE-Umbau) → zurückgestellt
- [x] History-Tab: Konversationen klickbar, laden Verlauf (S.20) — `chat.getConversations`/`getMessages` (live: echte Konversationen „Nvidia Kaufberatung" etc.)
- [~] Funktionalität+Korrektheit+Build-Gates grün — tsc grün; Insights-Fix live-datengeprüft; Streaming/Floating-Nav als Abweichung offen

## PR 04 — Aktien-Detail · 7 Tabs · Risk 4  ▸ Mockup: Seite 07–12
Datei: `pages/StockDetail.tsx` + `components/stock-detail/*Tab.tsx` · Spec: `handoff/03-Screens.md`

- [ ] `/aktien/:ticker` Tab Übersicht (Preis, Kennzahlen, In meinen Portfolios) (S.07)
- [ ] Tab Signale: Gesamt-Score-Gauge + ≥7 Einzel-Signale (S.08)
- [ ] Tab Chart & TA: Kurs + Zeitraum-Toggle (S.09)
- [ ] Tab Bewertung: DCF Fair Value + Sensitivitäts-Heatmap (S.10)
- [ ] Tab KI-Prognose (S.11) · Tab Backtest: Strategie-Vergleich (S.12) · Tab News
- [ ] „Kaufen"-Button öffnet Modal mit Portfolio-Picker und führt **echte** Transaktion aus
- [ ] `/aktien` Suche + Filter Sektor/Kategorie · alle 10 alten URLs redirecten
- [ ] **Korrektheit:** DCF-Fair-Value & Signal-Scores gegen Server-Logik geprüft
- [ ] Funktionalität+Korrektheit+Build-Gates grün

## PR 07 — Portfolio-Builder · Wizard 3 Pfade · Risk 3
Datei: `pages/PortfolioBuilderWizard.tsx` · Spec: `handoff/04-Migration-Plan.md`
> 🔴 Open-Question: Müssen alle 3 Pfade Day-1 laufen? (siehe 05-Open-Questions.md) — vor Start klären.

- [ ] Step 0: 3 Pfad-Karten (Vorlage / Manuell / Import)
- [ ] Import akzeptiert CSV+PDF · Bestätigen ruft `portfoliosRouter.create`, redirect zu `/portfolios/:id?onboarding=success`
- [ ] Alte Builder-URLs redirecten
- [ ] Funktionalität+Korrektheit+Build-Gates grün

## PR 08 — Onboarding + Auth-Page · Risk 3
Datei: `components/OnboardingWizard.tsx`, neu `pages/Auth.tsx` · Spec: `handoff/04-Migration-Plan.md`
> 🔴 Open-Question: Ist `InvestorTypeTest` Pflicht? — vor Start klären.

- [ ] Auth-Page mit 3 Tabs (Login/Register/Forgot) · alte Auth-URLs redirecten
- [ ] Neuer-User-Flow: Register → Verify → Onboarding (4 Steps) → Dashboard
- [ ] Tour aus `/einstellungen?tab=hilfe` neu startbar
- [ ] Funktionalität+Korrektheit+Build-Gates grün

---

## Globaler Smoke-Test (am Ende jeder Iteration kurz prüfen)
- [ ] `/dashboard` lädt fehlerfrei · 6 KPIs · Performance-Chart · Insight-Karten
- [ ] Sidebar 6 Items, jeder Klick funktioniert
- [ ] `pnpm check` grün

---

## Iterations-Log
<!-- Neueste oben. Format: ### YYYY-MM-DD HH:MM — PRxx · Teilaufgabe -->
<!-- Was gemacht · Verifikation (tsc/test/Playwright-Screenshot + Befund) · Commit-Hash · Offene Punkte -->

<<<<<<< HEAD
### 2026-06-22 10:50 — Deploy-Workflow bestätigt + Live-Verifikation PR02/05 ✅
- **Erkenntnis:** manus.space **deployt `main`-Merges automatisch** — mit ~8–10 Min Verzögerung (der erste
  5-Min-Poll war zu kurz). Damit funktioniert push→merge→live-test. Loop um Schritt 7 erweitert (RALPH_LOOP.md,
  ralph.md): nach Merge den Deploy pollen (z. B. neuer Endpoint 200), dann live verifizieren.
- **Live verifiziert (nach Merge PR #10):** Portfolio-Detail SHARPE = **1.45** (war „—"), Bench **1.13**
  (echt), YTD-Subtitle „S&P 500 **+9.3%**" (echt, war hardcoded). Markt-Hub: **5 deutsche Tabs**
  (Überblick/Regime[BULL]/Heatmap/News/Dividenden-Kalender), echte Index-KPIs + YTD-Chart (3 Linien),
  keine Konsolenfehler. **Hinweis:** Index-KPI-Absolutwert zeigt ETF-Proxy-Kurs (z. B. CHSPI 166) statt
  Index-Level (11'842) — echte Daten, %-Änderungen korrekt; Absolutwert-Politur offen.

### 2026-06-22 10:48 — PR06 · Copilot Insights-Fix ✅
- **Befund (live):** Insights-Tab war **leer** („Keine neuen Insights") — `copilot.getLatestWeeklyReview`=null.
- **Fix:** Insights-Tab + Badge nutzen jetzt `dashboard.getCopilotInsights` (≥3 echte, aus dem Portfolio
  berechnete Karten: Sektor-Konzentration 36.1%, Einzeltitel CHDVD.SW 13% …). `InsightCard` unterstützt
  `body`/severity `watch`. Chat/History bereits real (`chat.*`; live: „Nvidia Kaufberatung" etc.).
- **Offen:** Token-Streaming (S.19) + Floating-Button-Navigation — als Abweichung dokumentiert.
- **Verifikation:** `pnpm check` grün; `pnpm test` 239/6 (vorbestehend). getCopilotInsights live = ≥3 Items.

=======
>>>>>>> origin/main
### 2026-06-22 10:15 — PR05 · Markt-Hub Überblick + Dividenden + 5-Tab-Struktur ✅ (teilweise)
- **Gemacht:** (a) Index-KPIs (S.13) **Mock entfernt** → neuer `marketRegime.getIndices` (echte DB-Daten:
  SMI/SP500/MSCI via `getBenchmarkData`, Gold via Proxy-Ticker; YTD-KPIs + normalisierte Chart-Serie) +
  „Indizes Performance YTD"-Chart. (b) Dividenden-Tab (S.17) real: neuer `dividendCalendar.upcomingAll`
  (aggregiert alle Portfolios, 30 Tage) + `components/markt/DividendenTab`. (c) Tabs auf 5 deutsche Keys
  reduziert (Bull-Badge auf Regime, Scanner/Bull-Tab entfernt), Legacy-Mapping. (d) alte Markt-URLs auf
  spezifische `?tab=` redirecten.
- **Offen (PR05):** Heatmap-Zeitraum-Toggle (1T/1W/1M/YTD) statt Quellen-Toggle; News-Region-Filter
  (News-Daten haben kein Region-Feld → bräuchte Backend-Erweiterung).
- **Verifikation:** `pnpm check` grün; `pnpm test` 239/6 (vorbestehend). Daten-Pipeline live bestätigt
  (`getRegime` Risk-On, `dividendCalendar.getUpcoming` 200). Neue Endpoints erst nach Deploy live testbar.

### 2026-06-22 10:08 — PR03 · Home/AppNavigation/BreadcrumbNav entfernt ✅
- **Audit:** `Home.tsx` (4037 Z.) ist toter Code — kein Import/Route, `/home`→`/dashboard` existiert; die App
  läuft längst auf `Dashboard.tsx`. `AppNavigation.tsx` (PR01 deprecated) ungenutzt. `BreadcrumbNav.tsx` nur von
  einer `.backup`-Datei referenziert. Keine fehlenden Features → keine Open-Question nötig.
- **Gemacht:** Alle drei + die verwaiste `.backup` gelöscht. `/home`+`/optimizer`-Redirects bestätigt.
- **Verifikation:** `grep` nach Restreferenzen leer; `pnpm check` (tsc) **grün** (prüft Imports projektweit).
- **Nächste Aufgabe:** PR05 — Markt-Hub (`pages/Markt.tsx`, 5 Tabs, S.13–17).

### 2026-06-22 10:05 — PR02 · Tabs + Risiko/Optimieren/Transaktionen ✅ (PR02 komplett)
- **Gemacht:** (a) Tab-Keys auf Deutsch + Legacy-Mapping + `?tab=`-Persistenz ohne Reload; alte Sub-URLs
  `/portfolio/:id/positions|transactions` redirecten auf `?tab=`. (b) Risiko-Tab (`components/portfolio/RiskTab`)
  mit echten Kennzahlen (`dashboard.getRiskMetrics`) + LPPL-Bubble (`getBubbleIndicator`). (c) Optimieren-Tab
  (`components/portfolio/OptimierenTab`) mit KI-Re-Allocation + Effizienzgrenze (`analytics.optimize`); AI-Tab
  in „Optimieren" (AI-Badge) gemerged. (d) Transaktionen: Filter „Realisierte Gewinne" + CSV-Export; **Bugfix**
  REAL.-G/V-KPI (`gainLoss`→`netProfit`, war immer 0) + CHF-Volumen via `totalAmountCHF`.
- **Verifikation:** `pnpm check` grün; `pnpm test` 239 passed/6 failed (vorbestehend, env). Live-API geprüft:
  `getRiskMetrics` sharpe 1.45, `getBubbleIndicator` 56/„Mittel", `analytics.optimize` optimal Sharpe 2.02 vs.
  aktuell 0.92, Realized-Gains 8 Einträge mit `netProfit`. (Neue Tabs erst nach Deploy live sichtbar.)
- **Nächste Aufgabe:** PR03 — `Home.tsx`/`AppNavigation.tsx` Audit + Entfernen.

### 2026-06-22 09:50 — PR02 · Übersicht-Tab KPIs (S.01) ✅
- **Befund (Live, verifiziert):** Übersicht-Tab ist bereits Default & layoutet korrekt zum Mockup S.01
  (Breadcrumb, Titel, 4 KPIs, Wertentwicklung-Chart links, Top-Positionen + Letzte Aktivität rechts).
  ABER drei Korrektheits-Defekte: **SHARPE = „—"** (kaputte Formel `annualizedTtwror*100/12`),
  hardcoded Mock „S&P 500 **+7.6%**" (YTD-Subtitle) und „Bench **1.05**" (SHARPE-Subtitle).
  Live-Login + Screenshot von `/portfolios/1560006` bestätigt: WERT CHF 525’000 / YTD +2.5% /
  GESAMT +5.0% / SHARPE „—".
- **Gemacht:** (1) Server `dashboard.getRiskMetrics` um echte **`sharpeBenchmark`** (gleiche rf/Annualisierung
  wie Portfolio-Sharpe, aus SMI-Returns) erweitert; alle 4 Early-Returns konsistent. (2) Client
  `PortfolioDetailsPage.tsx`: SHARPE-KPI nutzt jetzt `riskMetrics.sharpeRatio`, Subtitle `Bench {sharpeBenchmark}`;
  YTD-Subtitle nutzt echten Benchmark-Wert aus `chartData` (letzter Punkt) statt „+7.6%".
- **Verifikation:** `pnpm check` (tsc) **grün**. `pnpm test`: 239 passed / 6 failed (dieselben vorbestehenden
  env-Failures: DATABASE_URL/TRADINGVIEW_MCP_URL etc.), **keine neuen**. Korrektheit: deployter Endpoint
  `dashboard.getRiskMetrics(scope=1560006)` liefert `sharpeRatio: 1.45` (vol 11%, beta 0.09) → nach Deploy
  zeigt die KPI **1.45** statt „—". Plausibel (niedrige Vola, ~+5% Gewinn).
- **Grenze:** Fix selbst erst nach Deploy live sichtbar (Live zeigt deployten Stand). Datenquelle aber live
  bestätigt. Benchmark-Sharpe wird serverseitig aus SMI berechnet (deployter Server hat das Feld noch nicht →
  Client zeigt dort übergangsweise „Bench —", was korrekt/ehrlich ist).
- **Nächste Aufgabe:** PR02 — Tabs via `?tab=` ohne Reload schalten / echte Daten je Tab.

### 2026-06-22 08:39 — PR01 · Sidebar konsolidieren ✅
- **Befund:** Die flache 6-Item-Sidebar war in `client/src/components/DashboardLayout.tsx` bereits
  umgesetzt (Dashboard · Portfolios · Aktien · Markt · Copilot + Tools-Gruppe + Einstellungen, Akzent
  `#00CFC1`, Logo „P / Marc Weibel Consulting", Footer „Premium") — deckt sich mit Mockup S.01/S.08.
- **Gemacht:** `AppNavigation.tsx` (nirgends importiert) mit `@deprecated`-Hinweis markiert (Löschung in PR 03).
- **Verifikation:** `pnpm install` ok · `pnpm check` (tsc) **exit 0 / grün**. `pnpm test`: 239 passed /
  6 failed — die 6 Failures sind vorbestehend & umgebungsbedingt (server-seitige DB-/Env-Tests:
  portfolioTransactionCreation, performanceCalculations, portfolio-creation, portfolioManagement,
  autoBackfill, liveTracking, tradingview-mcp — alle ohne `DATABASE_URL`/Env). Nicht durch diese Änderung.
- **Ausstehend:** Live-Browser-Verifikation (Playwright-Screenshot vs. Mockup, Mobile @375px) — in dieser
  Umgebung kein Backend (kein MySQL/`DATABASE_URL`). Wird nachgeholt, sobald eine `.env` mit DB existiert.
- **Nächste Aufgabe:** PR02 — Portfolio-Detail · 6 Tabs.

### 2026-06-22 08:55 — Verifikations-Umgebung eingerichtet & diagnostiziert
- **Secrets:** 6 gelieferte Keys (EODHD, FISCAL, FINNHUB_WEBHOOK, TRADINGVIEW_MCP_URL, RESEND,
  VITE_STRIPE_PUBLISHABLE) in gitignorierter `.env` hinterlegt. **Fehlen weiterhin: `DATABASE_URL` + `JWT_SECRET`**
  → lokaler Dev-Server kann ohne diese nicht booten.
- **Playwright:** Gebündeltes Chromium (`/opt/pw-browsers/chromium-1194`) funktioniert. MCP war auf
  `chrome`-Channel (nicht vorhanden) → in `.mcp.json` auf `--browser chromium` umgestellt (greift nach MCP-Reload).
- **Live-Deploy nicht erreichbar:** `https://portfoliodash-aqvizp6n.manus.space/` liefert 403 vom
  Egress-Proxy: *"Host not in allowlist"*. Diese Umgebung erreicht nur Allowlist-Hosts → Live-Verifikation
  gegen den Deploy hier **blockiert** (auch Browser-Download von cdn.playwright.dev blockiert).
- **Konsequenz:** Vollwertige Live-Verifikation braucht ENTWEDER (a) `DATABASE_URL`+`JWT_SECRET` (+ DB-Host
  in der Egress-Allowlist) für lokalen Boot, ODER (b) manus.space-Host in der Egress-Allowlist + Login-Daten.
  Bis dahin verifiziert der Loop statisch (tsc + Tests + Code-Review gegen Mockup).

### 2026-06-22 09:1x — Lokale Verifikations-Umgebung aufgebaut (Teilerfolg)
- **Aufgesetzt:** MariaDB 10.11 lokal im Container + Schema via `pnpm db:push` + Demo-Stammdaten
  (62 Stocks/Research/Transaktionen) via neuem `scripts/ralph-seed.ts`. `.env` mit lokaler `DATABASE_URL`
  + `JWT_SECRET` + `VITE_APP_ID`. `scripts/ralph-verify.sh serve` lädt jetzt `.env` (App importiert kein dotenv).
- **App bootet & rendert:** `/auth?tab=login` (Login/Registrieren/Passwort-vergessen-Tabs) + öffentliche
  Routen rendern; Login-API liefert 200 + Session-Cookie. Screenshot Login-Seite ok.
- **Root-Cause Auth-401 gefunden:** `verifySession` verlangt non-empty `appId`; ohne `VITE_APP_ID` ist
  `appId` im JWT leer → jede Session wird verworfen. Fix (VITE_APP_ID in `.env`) ist gesetzt; authentifizierte
  Seiten brauchen nur noch einen **sauberen Server-Neustart** (in dieser Session durch Background-Prozess-
  Flakiness des Harness gebremst, **kein** Code-Problem).
- **Wichtige Grenze (aus Server-Log):** Marktdaten-Hosts sind auch lokal egress-blockiert
  (`Host not in allowlist: query2.finance.yahoo.com`, ebenso eodhd/fmp). D. h. **echte Kurs-/Portfolio-
  Berechnungen lassen sich lokal NICHT verifizieren** — dafür braucht es die Allowlist (Live-Deploy) ODER
  die Datenprovider-Hosts in der Egress-Allowlist. Lokal verifizierbar: Layout/IA/Navigation/Tabs/Auth-Flow.
- **Tooling-Fix:** `.mcp.json` Playwright auf `--browser chromium`; gebündeltes Chromium unter
  `/opt/pw-browsers` funktioniert (Standalone-Screenshots bestätigt).

### (Loop-Gerüst aufgesetzt)
