# 02 · Informations­architektur & Routes

Die neue Top-Level-Struktur. Ziel: User finden in maximal **2 Klicks** alles, was sie täglich brauchen.

---

## Neue Sidebar (Soll)

Implementierung: `client/src/components/DashboardLayout.tsx` — `menuGroups`-Konstante ersetzen durch die folgende Struktur. Heute hat sie 5 Gruppen mit teilweise überlappenden Pfaden — neu: **flach, 6 Einträge**.

```ts
const topLevelItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard",  path: "/dashboard" },
  { icon: Wallet,          label: "Portfolios", path: "/portfolios" },
  { icon: TrendingUp,      label: "Aktien",     path: "/aktien" },
  { icon: Globe,           label: "Markt",      path: "/markt" },
  { icon: Brain,           label: "Copilot",    path: "/copilot" },
];

const toolsGroup: NavGroup = {
  icon: Wrench, label: "Tools",
  items: [
    { icon: Bell,       label: "Preisalarme",  path: "/price-alerts" },
    { icon: Calculator, label: "Rechner",      path: "/rechner" },
    { icon: FileText,   label: "Import",       path: "/import" },
  ],
};

const settingsItem: NavItem = { icon: Settings, label: "Einstellungen", path: "/einstellungen" };

// Admin bleibt wie bisher, eigene Gruppe unten in der Sidebar
```

**Submenu unter „Portfolios"** bleibt erhalten — die Liste der eigenen Portfolios (max 6 sichtbar) ist genau eine Klick-Verkürzung wert.

**Top-Bar im Mobil-Header** behält den Eintrag der aktiven Page (logic in `DashboardLayout.tsx` bereits korrekt).

---

## Neue Routen (App.tsx)

Heute hat `App.tsx` **64 Route-Einträge**. Ziel: **≤ 18** (plus Admin-Sub-Routen und Legal).

### Authentifiziert (Top-Level)

| Route | Datei | Notiz |
|---|---|---|
| `/dashboard` | `pages/Dashboard.tsx` | Aggregierte Sicht über alle Portfolios |
| `/portfolios` | `pages/Portfolios.tsx` | Liste + Vergleichs-Modus-Toggle |
| `/portfolios/:id` | `pages/PortfolioDetailsPage.tsx` | **6 Tabs** — siehe `03-Screens.md` |
| `/portfolios/:id/:tab` | dito | optional, damit Tab in URL persistent ist (z.B. `?tab=optimieren` oder `/portfolios/abc/risiko`) |
| `/portfolio-builder` | `pages/PortfolioBuilderWizard.tsx` | Einstieg = Wizard Step 0 |
| `/aktien` | `pages/Invest.tsx` (umbenannt) | Suche + Filter |
| `/aktien/:ticker` | `pages/StockDetail.tsx` (überarbeitet) | **7 Tabs** — siehe `03-Screens.md` |
| `/markt` | **neu** `pages/Markt.tsx` | **5 Tabs** — siehe `03-Screens.md` |
| `/copilot` | `pages/PortfolioCopilot.tsx` | **3 Tabs** — siehe `03-Screens.md` |
| `/copilot?tab=chat` | dito | Floating-Button öffnet diesen Deep-Link |
| `/price-alerts` | `pages/PriceAlerts.tsx` | bleibt |
| `/rechner` | `pages/Rechner.tsx` | bleibt |
| `/import` | `pages/Import.tsx` | bleibt — auch aus Portfolio-Builder aufrufbar |
| `/einstellungen` | `pages/Einstellungen.tsx` | Sub-Tabs: Profil · Benachrichtigungen · Sicherheit · API · Datenschutz |

### Public / Pre-Auth

| Route | Datei | Notiz |
|---|---|---|
| `/` | `pages/Landing.tsx` | bleibt |
| `/auth` | **neu** `pages/Auth.tsx` | Tab Login / Register / Forgot — ersetzt 3 separate Pages |
| `/forgot-password` | `pages/ForgotPassword.tsx` | bleibt (Deep-Link für Mail-Token) |
| `/reset-password` | `pages/ResetPassword.tsx` | bleibt (Deep-Link) |
| `/verify-email` | `pages/VerifyEmail.tsx` | bleibt (Deep-Link) |
| `/onboarding` | `components/OnboardingWizard.tsx` | unverändert als Komponente |
| `/newsroom` | `pages/Newsroom.tsx` | **bleibt** (SEO-Marketing-Page) |
| `/pricing` | `pages/Pricing.tsx` | bleibt |
| `/premium` | `pages/PremiumWizard.tsx` (umbenannt) | Stripe-Flow, kontextuell ausgelöst |
| `/payment/success` | `pages/PaymentSuccess.tsx` | bleibt |
| `/payment/cancel` | `pages/PaymentCancel.tsx` | bleibt |
| `/about`, `/kontakt`, `/reviews`, `/impressum`, `/datenschutz`, `/agb` | unverändert | bleiben |

### Admin (nur für `user.role === "admin"`)

| Route | Datei |
|---|---|
| `/admin` | `pages/AdminDashboard.tsx` |
| `/admin/stocks` | `pages/AdminStocks.tsx` |
| `/admin/watchlist` | `pages/AdminWatchlist.tsx` |
| `/admin/optimizer` | `pages/AdminOptimizer.tsx` |
| `/admin/categories`, `/admin/sectors`, `/admin/kpis`, `/admin/logs`, `/admin/data-import`, `/admin/secrets` | bleiben unverändert |

### Total

| Block | Routen |
|---|---|
| Authentifiziert Top-Level | 14 |
| Public / Pre-Auth | 12 |
| Admin | 10 |
| **Summe** | **36** (heute: 64) |

---

## 301-Redirects (60 Tage)

User mit Bookmarks landen sonst auf 404. Implementierung: in `App.tsx` Route-Handlers mit `<Redirect to="…" />` aus `wouter`. Liste vollständig:

```tsx
{/* Portfolio-Detail: alle alten Sub-Routen → neue Tab-Struktur */}
<Route path="/portfolio/:id"><Redirect to={`/portfolios/:id`} /></Route>
<Route path="/portfolio/:id/positions"><Redirect to={`/portfolios/:id?tab=positionen`} /></Route>
<Route path="/portfolio/:id/transactions"><Redirect to={`/portfolios/:id?tab=transaktionen`} /></Route>
<Route path="/portfolio/:id/realized-gains"><Redirect to={`/portfolios/:id?tab=transaktionen&filter=gewinne`} /></Route>
<Route path="/portfolios/:id/transactions"><Redirect to={`/portfolios/:id?tab=transaktionen`} /></Route>

{/* Einzeltitel-Analyse-Tools → Aktien-Detail-Tabs */}
<Route path="/stock/:ticker"><Redirect to={`/aktien/:ticker`} /></Route>
<Route path="/invest"><Redirect to="/aktien" /></Route>
<Route path="/invest/:ticker"><Redirect to={`/aktien/:ticker`} /></Route>
<Route path="/signals"><Redirect to="/aktien" /></Route>
<Route path="/technical-analysis"><Redirect to="/aktien" /></Route>
<Route path="/dcf-valuation"><Redirect to="/aktien" /></Route>
<Route path="/prediction"><Redirect to="/aktien" /></Route>
<Route path="/backtesting"><Redirect to="/aktien" /></Route>
<Route path="/analysis"><Redirect to="/aktien" /></Route>
<Route path="/categories"><Redirect to="/aktien?filter=kategorie" /></Route>
<Route path="/sectors"><Redirect to="/aktien?filter=sektor" /></Route>

{/* Markt-Views → Markt-Hub-Tabs */}
<Route path="/market-overview"><Redirect to="/markt?tab=ueberblick" /></Route>
<Route path="/market-heatmap"><Redirect to="/markt?tab=heatmap" /></Route>
<Route path="/sector-heatmap"><Redirect to="/markt?tab=heatmap&scope=sektoren" /></Route>
<Route path="/market-regime"><Redirect to="/markt?tab=regime" /></Route>
<Route path="/dividends"><Redirect to="/markt?tab=dividenden" /></Route>

{/* KI-Oberflächen → Copilot-Tabs */}
<Route path="/ai-insights"><Redirect to="/copilot?tab=insights" /></Route>
<Route path="/chat"><Redirect to="/copilot?tab=chat" /></Route>

{/* Portfolio-Builder Varianten */}
<Route path="/portfolio-builder/new"><Redirect to="/portfolio-builder/wizard" /></Route>
<Route path="/portfolio-builder/old"><Redirect to="/portfolio-builder/wizard" /></Route>

{/* Dashboard Aliasse */}
<Route path="/home"><Redirect to="/dashboard" /></Route>
<Route path="/optimizer"><Redirect to="/dashboard" /></Route>
<Route path="/live-tracking"><Redirect to="/dashboard?live=1" /></Route>

{/* Andere Konsolidierungen */}
<Route path="/portfolio-comparison"><Redirect to="/portfolios?mode=vergleich" /></Route>
<Route path="/risk-dashboard"><Redirect to={`/portfolios?tab=risiko`} /></Route>
<Route path="/portfolio-optimizer"><Redirect to={`/portfolios?tab=optimieren`} /></Route>
<Route path="/reports"><Redirect to={`/portfolios?tab=performance`} /></Route>
<Route path="/registration"><Redirect to="/auth?tab=register" /></Route>
<Route path="/register"><Redirect to="/auth?tab=register" /></Route>
<Route path="/login"><Redirect to="/auth?tab=login" /></Route>
<Route path="/settings/notifications"><Redirect to="/einstellungen?tab=benachrichtigungen" /></Route>
<Route path="/premium-wizard"><Redirect to="/premium" /></Route>
```

**Wichtig:** `wouter`'s `<Redirect to>` macht client-seitige Weiterleitung. Für **SEO-relevante** öffentliche Routen (gibt's nicht in der obigen Liste, weil alles privat ist) müsste der Server 301-Header schicken — hier nicht nötig.

---

## URL-Schema für Tabs

Drei Optionen, **Empfehlung: `?tab=…` query param**.

| Schema | Vor | Nachteil | Wir nutzen es weil … |
|---|---|---|---|
| `/portfolios/:id/positionen` | Sieht „web-nativ" aus | Routes-Inflation in App.tsx + jede Tab-Seite braucht eigene Route | Nein |
| `/portfolios/:id#positionen` | Sehr leichtgewichtig | Hash wird nicht serverseitig gelogt, schlecht für Analytics | Nein |
| **`/portfolios/:id?tab=positionen`** | Eine Route pro Page, Tab im Query, sharebar | Etwas länger | ✅ **Ja** |

Implementierung in jeder Tab-Page:
```tsx
const [location, setLocation] = useLocation();
const params = new URLSearchParams(window.location.search);
const tab = params.get("tab") ?? "uebersicht";
const setTab = (t: string) => setLocation(`${location}?tab=${t}`, { replace: true });
```

Detail dazu in `03-Screens.md`.

---

## DEV-/Showcase-Routen

Hinter `import.meta.env.DEV` verstecken:

```tsx
{import.meta.env.DEV && (
  <>
    <Route path="/dev/showcase" component={ComponentShowcase} />
    <Route path="/dev/debug" component={DebugTest} />
    <Route path="/dev/test-secrets" component={TestSecrets} />
  </>
)}
```

Im Production-Build sind diese Routen nicht erreichbar.
