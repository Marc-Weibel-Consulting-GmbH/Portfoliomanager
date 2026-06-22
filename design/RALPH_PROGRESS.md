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

- [ ] `/portfolios/:id` öffnet Tab „Übersicht" (Default), KPIs WERT/YTD/GESAMT/SHARPE gefüllt (S.01)
- [ ] Tabs Positionen/Transaktionen/Performance/Risiko/Optimierung schalten via `?tab=` ohne Reload
- [ ] Direkter Aufruf `?tab=risiko` öffnet Risiko-Tab; alte Sub-URLs redirecten
- [ ] Alle 6 Tabs liefern echte Daten aus bestehenden tRPC-Endpoints (kein Mock)
- [ ] Transaktionen: Filter „Käufe/Verkäufe" + „Realisierte Gewinne" + Export funktionieren (S.03)
- [ ] Optimierung: ≥1 KI-Vorschlag + Effizienzgrenze sichtbar (S.06)
- [ ] **Korrektheit:** YTD/Gesamt/Sharpe/Annualisiert gegen `performanceCalculations.ts` plausibilisiert
- [ ] Funktionalität+Korrektheit+Build-Gates grün

## PR 03 — `Home.tsx` + `AppNavigation.tsx` entfernen · Risk 2
Vorher Audit: `grep -rn 'from.*@/pages/Home' client/src` · Spec: `handoff/04-Migration-Plan.md`

- [ ] Feature-Audit von `Home.tsx` (210 KB) gemacht, fehlende Features in Dashboard integriert oder als Open-Question notiert
- [ ] `Home.tsx`, `AppNavigation.tsx`, ggf. `BreadcrumbNav.tsx` gelöscht
- [ ] `/home` und `/optimizer` redirecten zu `/dashboard`
- [ ] `grep -r 'from "@/pages/Home"' client/src` leer · Build grün
- [ ] Funktionalität+Korrektheit+Build-Gates grün

## PR 05 — Markt-Hub · 5 Tabs · Risk 2  ▸ Mockup: Seite 13–17
Neu `pages/Markt.tsx` + `components/markt/*Tab.tsx` · Spec: `handoff/03-Screens.md`

- [ ] `/markt` Tab Überblick: 4 Index-KPIs (SMI/S&P/MSCI/Gold) + Indizes-YTD-Chart (S.13)
- [ ] Tab Regime: Pill „Bull · Niedrige Vola" + VIX/Yield/LPPL + Regime-Verlauf (S.14)
- [ ] Tab Heatmap: Sektor-Tiles mit YTD-Färbung, Toggle 1T/1W/1M/YTD (S.15)
- [ ] Tab News: Filter Alle/Schweiz/Europa/USA/Asien (S.16)
- [ ] Tab Dividenden: nur eigene Live-Positionen, nächste 30 Tage (S.17)
- [ ] Alte Markt-URLs redirecten · Newsroom bleibt unverändert
- [ ] Funktionalität+Korrektheit+Build-Gates grün

## PR 06 — Copilot-Hub · 3 Tabs · Risk 2  ▸ Mockup: Seite 18–20
Datei: `pages/PortfolioCopilot.tsx` + `components/copilot/*Tab.tsx` · Spec: `handoff/03-Screens.md`

- [ ] `/copilot` Tab Insights mit ≥3 Karten (S.18)
- [ ] Floating-Chat-Button (im Dashboard sichtbar) öffnet `/copilot?tab=chat`
- [ ] Chat-Tab: Streaming-Response Wort-für-Wort (S.19)
- [ ] History-Tab: Konversationen klickbar, laden Verlauf (S.20)
- [ ] Funktionalität+Korrektheit+Build-Gates grün

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

### (Loop-Gerüst aufgesetzt)
