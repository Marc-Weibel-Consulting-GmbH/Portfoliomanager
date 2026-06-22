# 01 · Audit — Vollständige Page-Inventur

Eine Zeile pro Page-Datei aus `client/src/pages/` und einige Schlüssel-Komponenten aus `client/src/components/`. Aktion ist eine von:

- 🟢 **keep** — bleibt als eigene Route, wird ggf. überarbeitet
- 🔵 **merge** — Inhalt wandert als Tab in eine konsolidierte Page; Route wird per 301 umgeleitet
- 🔴 **drop** — Datei wird gelöscht (entweder duplikat oder veraltete Variante)

Die Aktion verrät, **wo** der Inhalt landet (Spalte „Ziel"). Wenn du dir bei einer Datei unsicher bist, ist sie in **[05-Open-Questions.md](./05-Open-Questions.md)** referenziert.

---

## 1. Einstieg & Auth

| Datei | Aktion | Ziel / Begründung |
|---|---|---|
| `Landing.tsx` (13 KB) | 🔵 merge | Eine Marketing-Landing. Die bessere von beiden behalten, Inhalte aus `LandingPage.tsx` ergänzen falls nötig |
| `LandingPage.tsx` (18 KB) | 🔴 drop | Doppelt — Inhalte falls noch nicht in `Landing.tsx` vorher übernehmen |
| `Login.tsx` (4 KB) | 🟢 keep | Bleibt `/login` |
| `Register.tsx` | 🔵 merge | Als Tab in `/auth` mit Login zusammen |
| `Registration.tsx` | 🔴 drop | Doppelt zu `Register.tsx` — vor dem Löschen prüfen welche Felder zusätzlich vorhanden sind |
| `ForgotPassword.tsx` (4 KB) | 🟢 keep | Bleibt `/forgot-password` |
| `ResetPassword.tsx` | 🟢 keep | Bleibt `/reset-password` |
| `VerifyEmail.tsx` | 🟢 keep | Bleibt `/verify-email` |

## 2. Onboarding

| Datei | Aktion | Ziel / Begründung |
|---|---|---|
| `OnboardingWizard.tsx` (17 KB) | 🟢 keep | **Der eine** Wizard. Erweitern um Schritte aus den anderen 5 |
| `OnboardingTutorial.tsx` (11 KB) | 🔵 merge | In Wizard integrieren als Optional-Schritt „App-Tour" |
| `GuidedTourModal.tsx` (10 KB) | 🔵 merge | In Wizard integrieren — der modale Aufruf kann auch nach Onboarding noch via Hilfe-Menu getriggert werden |
| `InteractiveTour.tsx` (4 KB) | 🔴 drop | Veraltete Tour-Variante |
| `InvestorTypeTest.tsx` (6 KB) | 🔵 merge | Als Schritt „Risiko-Profil" im Wizard |
| `PremiumWizard.tsx` | 🟡 **special** | **Nicht** ins Onboarding mergen — Stripe-Flow. Bleibt eigene Route `/premium`, wird aber **nach** dem 1. Insight ausgelöst, nicht im Onboarding-Flow |

## 3. Dashboard & Layout

| Datei | Aktion | Ziel / Begründung |
|---|---|---|
| `Dashboard.tsx` (2 KB) | 🟢 keep | Der schmale Wrapper, der das Dashboard-Handoff-Package lädt — passt schon |
| `Home.tsx` (**210 KB**) | 🔴 drop | **Vor dem Löschen audit machen** (grep auf alle Imports und Routen). Wahrscheinlich ist hier ein 2. Dashboard als Fallback drin |
| `AppNavigation.tsx` (5 KB) | 🔴 drop | Doppelt zur Sidebar in `DashboardLayout.tsx` — letztere ist das Standard-Layout |
| `DashboardLayout.tsx` (21 KB) | 🟢 keep | Das Sidebar-Layout. Wird in PR 02 auf neue Gruppen-Struktur umgebaut |
| `Breadcrumb.tsx` (1 KB) | 🟢 keep | Eine Breadcrumb-Komponente |
| `BreadcrumbNav.tsx` (1 KB) | 🔴 drop | Doppelt |

## 4. Portfolios

| Datei | Aktion | Ziel / Begründung |
|---|---|---|
| `Portfolios.tsx` | 🟢 keep | `/portfolios` — Übersicht aller Portfolios |
| `PortfolioDetail.tsx` | 🔴 drop | Archivierte Alt-Version, App.tsx hat dafür `/portfolio/:id/old`-Route nur für Debugging |
| `PortfolioDetailsPage.tsx` | 🟢 keep | `/portfolios/:id` — **die** neue Detail-Page. Bekommt 6 Tabs (siehe [03-Screens.md](./03-Screens.md#portfolios--detail)) |
| `PortfolioPositions.tsx` | 🔵 merge | → Tab **Positionen** in `/portfolios/:id` |
| `PortfolioTransactionsPage.tsx` | 🔵 merge | → Tab **Transaktionen** in `/portfolios/:id` (Wrapper für `PortfolioTransactions.tsx`-Komponente) |
| `PortfolioTransactions.tsx` | 🔵 merge | → Komponente im Tab **Transaktionen** |
| `Transactions.tsx` | 🔵 merge | → Tab **Transaktionen** (mit Filter „alle Portfolios" für globale Sicht) |
| `RealizedGainsHistory.tsx` (8 KB) | 🔵 merge | → Tab **Transaktionen**, Filter „Realisierte Gewinne" |
| `PortfolioComparison.tsx` (6 KB) | 🔵 merge | → `/portfolios` Übersicht mit Toggle „Vergleichs-Modus" |
| `Reports.tsx` | 🔵 merge | → Tab **Performance** in `/portfolios/:id` |
| `Analysis.tsx` (10 KB) | 🔵 merge | → Tab **Performance** in `/portfolios/:id`. Vorher prüfen ob Inhalte überlappen |
| `LiveTracking.tsx` (14 KB) | 🔵 merge | → Tab **Übersicht** in `/portfolios/:id` mit Live-Toggle (Polling) |
| `RiskDashboard.tsx` | 🔵 merge | → Tab **Risiko** in `/portfolios/:id` |

## 5. Portfolio-Builder

| Datei | Aktion | Ziel / Begründung |
|---|---|---|
| `PortfolioBuilderLanding.tsx` | 🔵 merge | → `/portfolio-builder` Step 0: „Wähle deinen Pfad" |
| `PortfolioBuilderWizard.tsx` | 🟢 keep | `/portfolio-builder/wizard` — **der** Wizard. Erweitern um die 3 Pfade (Vorlage / Manuell / Import) |
| `PortfolioBuilderNew.tsx` | 🔵 merge | Inhalte/Komponenten in Wizard übernehmen falls neuer als Wizard |
| `PortfolioBuilder.tsx` | 🔴 drop | Veraltete Variante |

## 6. Aktien & Einzeltitel-Analyse

| Datei | Aktion | Ziel / Begründung |
|---|---|---|
| `Invest.tsx` (17 KB) | 🟢 keep | `/aktien` — Aktien-Suche und -Übersicht (renamed von `/invest`) |
| `InvestDetail.tsx` (23 KB) | 🔵 merge | → `/aktien/:ticker` Tab **Übersicht** |
| `StockDetail.tsx` | 🔵 merge | → `/aktien/:ticker` Tab **Übersicht** — die bessere der beiden behalten, andere droppen |
| `Signals.tsx` | 🔵 merge | → `/aktien/:ticker` Tab **Signale** (Signal-Scores) |
| `TechnicalAnalysis.tsx` | 🔵 merge | → `/aktien/:ticker` Tab **Chart & TA** |
| `DCFValuation.tsx` (16 KB) | 🔵 merge | → `/aktien/:ticker` Tab **Bewertung** |
| `Prediction.tsx` | 🔵 merge | → `/aktien/:ticker` Tab **KI-Prognose** |
| `Backtesting.tsx` (27 KB) | 🔵 merge | → `/aktien/:ticker` Tab **Backtest** |
| `Categories.tsx` (10 KB) | 🔵 merge | → `/aktien` als Filter-Chips (Kategorie) |
| `Sectors.tsx` | 🔵 merge | → `/aktien` als Filter-Chips (Sektor) — und im Markt-Hub als eigener Drill-Down |
| `PortfolioOptimizer.tsx` | 🔵 merge | → `/portfolios/:id` Tab **Optimieren** |

## 7. Markt

| Datei | Aktion | Ziel / Begründung |
|---|---|---|
| `MarketOverview.tsx` (3 KB) | 🔵 merge | → `/markt` Tab **Überblick** |
| `MarketHeatmap.tsx` (3 KB) | 🔵 merge | → `/markt` Tab **Heatmap** (Aktien-Heatmap) |
| `SectorHeatmap.tsx` | 🔵 merge | → `/markt` Tab **Heatmap** (Sektor-Heatmap-Toggle) |
| `MarketRegime.tsx` (8 KB) | 🔵 merge | → `/markt` Tab **Regime** |
| `Newsroom.tsx` | 🟡 **special** | **Nicht** ins Markt-Hub mergen — ist eine **public Marketing-Page** mit SEO-Relevanz. Bleibt `/newsroom`. **Im Markt-Hub** wird ein neuer Tab **News** gebaut, der dieselben tRPC-Endpoints nutzt aber im DashboardLayout läuft |
| `DividendCalendar.tsx` (13 KB) | 🔵 merge | → `/markt` Tab **Dividenden-Kalender** |

## 8. KI & Copilot

| Datei | Aktion | Ziel / Begründung |
|---|---|---|
| `PortfolioCopilot.tsx` | 🟢 keep | `/copilot` — **die** KI-Page mit 3 Tabs |
| `AIInsights.tsx` (16 KB) | 🔵 merge | → `/copilot` Tab **Insights** |
| `Chat.tsx` (13 KB) | 🔵 merge | → `/copilot` Tab **Chat** |
| `FloatingChatButton.tsx` (8 KB) | 🟢 keep | Globaler Floating-Button, öffnet `/copilot?tab=chat` |

## 9. Tools (bleiben als eigene Routen — sind nicht doppelt)

| Datei | Aktion | Ziel / Begründung |
|---|---|---|
| `PriceAlerts.tsx` | 🟢 keep | `/price-alerts` |
| `Rechner.tsx` | 🟢 keep | `/rechner` |
| `Import.tsx` (9 KB) | 🟢 keep | `/import` — CSV / PDF Import (auch aus Portfolio-Builder aufrufbar) |
| `Pricing.tsx` | 🟢 keep | `/pricing` |
| `PaymentSuccess.tsx`, `PaymentCancel.tsx` | 🟢 keep | Stripe-Callbacks |

## 10. Einstellungen

| Datei | Aktion | Ziel / Begründung |
|---|---|---|
| `Einstellungen.tsx` (4 KB) | 🟢 keep | `/einstellungen` — wird zur Hub-Page mit Sub-Tabs |
| `NotificationSettings.tsx` | 🔵 merge | → `/einstellungen` Tab **Benachrichtigungen** |

## 11. Statisch / Legal

| Datei | Aktion | Ziel / Begründung |
|---|---|---|
| `About.tsx` (9 KB) | 🟢 keep | `/about` |
| `Kontakt.tsx` (6 KB) | 🟢 keep | `/kontakt` |
| `Impressum.tsx` (6 KB) | 🟢 keep | `/impressum` |
| `Datenschutz.tsx` (13 KB) | 🟢 keep | `/datenschutz` |
| `AGB.tsx` (11 KB) | 🟢 keep | `/agb` |
| `Reviews.tsx` | 🟢 keep | `/reviews` |
| `NotFound.tsx` | 🟢 keep | 404 |

## 12. Admin

| Datei | Aktion | Ziel / Begründung |
|---|---|---|
| `AdminDashboard.tsx` (3 KB) | 🟢 keep | `/admin` — Hub mit Links zu Sub-Pages |
| `Admin.tsx` (8 KB) | 🔴 drop | Doppelt zu `AdminDashboard.tsx` |
| `AdminStocks.tsx` (8 KB) | 🟢 keep | `/admin/stocks` |
| `AdminCategories.tsx` (1 KB) | 🟢 keep | `/admin/categories` |
| `AdminSectors.tsx` (1 KB) | 🟢 keep | `/admin/sectors` |
| `AdminKPIs.tsx` (3 KB) | 🟢 keep | `/admin/kpis` |
| `AdminLogs.tsx` (9 KB) | 🟢 keep | `/admin/logs` |
| `AdminDataImport.tsx` (7 KB) | 🟢 keep | `/admin/data-import` |
| `AdminWatchlist.tsx` (25 KB) | 🟢 keep | `/admin/watchlist` |
| `AdminOptimizer.tsx` (23 KB) | 🟢 keep | `/admin/optimizer` |
| `AdminSecretsManagement.tsx` (2 KB) | 🟢 keep | `/admin/secrets` — der schmale Wrapper |
| `AdminSecrets.tsx` (10 KB) | 🔴 drop | Doppelt; Inhalte gehören in den Wrapper oben |
| `ComponentShowcase.tsx` (56 KB) | 🟡 **special** | Dev-Tool, nur in development build. Hinter Env-Flag verstecken |
| `DebugTest.tsx` (5 KB) | 🟡 **special** | Dito |
| `TestSecrets.tsx` | 🟡 **special** | Dito |

---

## Zusammenfassung in Zahlen

| Aktion | Anzahl Pages |
|---|---|
| 🟢 keep | **~25** (inkl. Statisch/Legal/Admin) |
| 🔵 merge (in Tabs) | **~30** |
| 🔴 drop | **~14** |
| 🟡 special-case (siehe Notes) | **~6** |

**Daraus folgt:** Aus ~75 authentifizierten Pages werden **~6 Top-Level-User-Routen** plus Admin + Legal + Auth-Flow. Siehe **[02-IA-Routes.md](./02-IA-Routes.md)** für die finale Routen-Liste.
