# Portfoliomanager · IA-Konsolidierung — Handoff für Manus

> **TL;DR.** Der Live-Code hat **~90 Pages** und **39 tRPC-Routers**. Aus User-Sicht entstehen daraus **6 sinnvolle Top-Level-Routen** (`/dashboard`, `/portfolios`, `/aktien`, `/markt`, `/copilot`, plus Onboarding / Auth / Settings / Admin). **Keine Funktion geht verloren** — alles wird unter Top-Level-Pages mit **Tabs** konsolidiert.
>
> Dieser Handoff ist **kein Big-Bang-Rewrite**. Er ist in **8 sequenzielle PRs** gegliedert, jede für sich deploybar und mit klaren Akzeptanzkriterien, die du **live im Browser verifizieren** kannst.

---

## Worum es geht

Das Repo `Marc-Weibel-Consulting-GmbH/Portfoliomanager` ist seit dem Manus-Build organisch gewachsen. Es gibt:

- **2 Landings** (`Landing.tsx` + `LandingPage.tsx`)
- **2 Dashboards** (`Dashboard.tsx` + `Home.tsx` mit **210 KB**)
- **6 Portfolio-Detail-Pages** (`PortfolioDetail`, `PortfolioDetailsPage`, `PortfolioPositions`, `PortfolioTransactionsPage`, `PortfolioTransactions`, `Transactions`)
- **4 Portfolio-Builder** (`PortfolioBuilder`, `PortfolioBuilderNew`, `PortfolioBuilderWizard`, `PortfolioBuilderLanding`)
- **9 Einzeltitel-Analyse-Tools** als eigene Routen (`Invest`, `InvestDetail`, `StockDetail`, `Signals`, `TechnicalAnalysis`, `DCFValuation`, `Prediction`, `Backtesting`, `Analysis`)
- **4 Markt-Views** (`MarketOverview`, `MarketHeatmap`, `SectorHeatmap`, `MarketRegime`)
- **3 KI-Oberflächen** (`AIInsights`, `PortfolioCopilot`, `Chat`)
- **6 Onboarding-Komponenten** (`OnboardingWizard`, `OnboardingTutorial`, `GuidedTourModal`, `InteractiveTour`, `InvestorTypeTest`, `Registration`)
- **2 Nav-Systeme** (`AppNavigation.tsx` + `DashboardLayout.tsx`-Sidebar)

Das ist nicht „falsch", aber es kostet User Zeit, Klicks und Vertrauen. Und es kostet uns Entwicklungszeit, weil dieselbe Logik an mehreren Stellen gepflegt wird.

---

## Der Prototyp

Im Projekt-Root: **`Optimierung Prototyp.html`**

Drei Modi (Top-Bar):

| Mode | Inhalt |
|---|---|
| **01 · Audit** | Vollständige Inventur, pro Datei: behalten / konsolidieren / entfernen |
| **02 · Flows** | Vorher/Nachher für 3 wichtigste Kunden-Flows (Neukunde, Bestandskunde, Recherche) |
| **03 · Prototyp** | Klickbare neue IA: Dashboard, Portfolios-Detail, Aktien-Detail, Markt, Copilot |

Lokal öffnen: `open "Optimierung Prototyp.html"` (oder serve mit `python -m http.server`). Self-contained, lädt React + Babel via CDN, keine Build-Tools nötig. Source-Files: `opt-tokens.jsx`, `opt-audit.jsx`, `opt-flow.jsx`, `opt-screens.jsx`, `opt-app.jsx`.

**Nutze den Prototyp als visuelle Referenz** während der Migration — er zeigt das Ziel-Look-and-Feel jeder konsolidierten Page.

---

## Die 4 Kern-Prinzipien

1. **Kontext halten, nicht verlieren.** Wenn Marc eine Aktie analysiert, soll diese Aktie nicht durch jeden Tool-Wechsel verloren gehen. → **Tabs statt Pages.**
2. **Pfad-Entscheidung im Wizard, nicht in der URL.** Es gibt nicht 4 „Builder"-Routen, sondern 1 Wizard mit 3 Pfaden (Vorlage / Manuell / Import).
3. **Eine KI-Oberfläche.** Insights, Chat, History sind Tabs einer einzigen `/copilot`-Page. Der Floating-Button öffnet sie überall in der App.
4. **Live als Toggle, nicht als Route.** `LiveTracking` als eigene Page ist redundant — das Dashboard hat einen Live-Mode (Polling alle X Sekunden).

---

## Inhalte dieses Handoffs

| Datei | Was drin ist |
|---|---|
| **[01-Audit.md](./01-Audit.md)** | Vollständige Inventur aller ~70 relevanten Pages mit Aktion (keep/merge/drop) und Ziel-Route |
| **[02-IA-Routes.md](./02-IA-Routes.md)** | Neue Sidebar-Struktur, neue `App.tsx`-Routen, alte → neue URL-Mapping mit 301-Redirects |
| **[03-Screens.md](./03-Screens.md)** | Per-Screen-Spec (Dashboard / Portfolios / Aktien / Markt / Copilot / Onboarding) mit Tabs, Komponenten, tRPC-Endpoints, Akzeptanzkriterien |
| **[04-Migration-Plan.md](./04-Migration-Plan.md)** | **8 sequenzierte PRs** mit Scope, Risk-Score, Test-Schritten (Live-Browser) |
| **[05-Open-Questions.md](./05-Open-Questions.md)** | Entscheidungen, die du **nicht ohne Marc treffen sollst** |

Plus die **Dashboard-Komponenten** unter `client/` und `server/` (bestehendes Drop-in-Paket aus dem ersten Handoff) — siehe **[README.md](./README.md)**. Die in `03-Screens.md` referenzierten Komponenten-Namen entsprechen dieser Code-Basis.

---

## Wie Manus damit arbeitet

Du kannst live im Browser testen — nutze das.

1. **Lies erst `01-Audit.md`**, damit du den Scope siehst.
2. **Dann `02-IA-Routes.md`**, damit du die Ziel-Struktur kennst.
3. **Arbeite `04-Migration-Plan.md` PR-für-PR ab.** Jede PR hat:
   - Scope (welche Dateien anpassen)
   - Akzeptanzkriterien (was muss live klappen)
   - Test-Schritte (welche URL aufrufen, was klicken, was sehen)
   - Risk-Score (1-5, was kann brechen)
4. **`03-Screens.md`** ist deine Detail-Referenz, wenn du an einer konkreten Page baust.
5. **`05-Open-Questions.md`** ist ein Stopper — wenn dort etwas unbeantwortet ist, frag Marc bevor du baust.

**Wichtig:** Jede PR muss `/dashboard` lauffähig lassen. Nach jeder PR den Smoke-Test laufen: `/dashboard` öffnen, 6 KPIs sichtbar, Performance-Chart 3 Linien, Positionen-Toggle alle 3 Views.

---

## Nicht-Ziele

- **Kein Redesign der Marken-Optik.** Farben (`#0a0f1a` / `#00CFC1`), Tailwind, shadcn-Primitive bleiben.
- **Keine neuen Features.** Nur Konsolidierung. Wenn du beim Migrieren eine Idee hast, schreib sie in `05-Open-Questions.md`, baue sie nicht.
- **Keine Daten-Migration.** Die DB-Schemas bleiben, nur die UI wird umgeordnet.
- **Kein TypeScript-Upgrade**, keine Library-Updates (React 19 + Tailwind 4 + tRPC bleiben).

---

## Risiken & Mitigation

| Risiko | Wahrscheinlichkeit | Mitigation |
|---|---|---|
| `Home.tsx` (210 KB) hat versteckte Funktionen, die nur dort existieren | **Hoch** | Vor dem Löschen: grep auf alle `import { ... } from "@/pages/Home"` und alle Route-Aufrufe. In Migration-Plan dokumentiert (PR 03). |
| User mit Bookmarks auf alte URLs (`/portfolio/:id/positions` etc.) | Mittel | **301-Redirects** für 60 Tage. Liste in `02-IA-Routes.md`. |
| `Newsroom` ist Marketing-Page (SEO), kein authentifizierter View | Hoch | **Nicht** konsolidieren — bleibt eigene Route. Klar gekennzeichnet in `01-Audit.md`. |
| `PremiumWizard` ist Stripe-Checkout-Flow | Hoch | **Nicht** ins Onboarding mergen. Bleibt als modaler Upsell. |
| Sidebar-Submenu für Portfolios (Portfolios → Liste der eigenen Portfolios) | Niedrig | Bleibt erhalten — ist nicht doppelt. |

---

## Definition of Done (gesamt)

- [ ] `App.tsx` hat **≤ 18 Routen** (heute: 64)
- [ ] Sidebar (`DashboardLayout.tsx`) hat **6 Top-Level-Einträge** + Admin
- [ ] Alle 8 PRs aus `04-Migration-Plan.md` gemergt
- [ ] Keine `import` mehr auf gelöschte Pages (CI grep grünt)
- [ ] 301-Redirects-Liste aus `02-IA-Routes.md` aktiv
- [ ] Smoke-Test grün: Marc öffnet `/dashboard`, sieht sein Portfolio in 1 Klick, kann zur Detail-Seite und zur Aktien-Recherche jeweils in 1 weiteren Klick

— Marc Weibel · 27.05.2026
