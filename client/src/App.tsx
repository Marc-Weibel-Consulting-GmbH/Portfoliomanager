import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import RequireAdmin from "./components/RequireAdmin";
import { ThemeProvider } from "./contexts/ThemeContext";

// Loading fallback — minimal spinner to avoid layout shift
function PageLoader() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#00CFC1]/30 border-t-[#00CFC1] rounded-full animate-spin" />
    </div>
  );
}

// ─── Public Pages (lazy) ───
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const OnboardingWizard = lazy(() => import("./components/OnboardingWizard"));
const PremiumWizard = lazy(() => import("./pages/PremiumWizard"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Impressum = lazy(() => import("./pages/Impressum"));
const Datenschutz = lazy(() => import("./pages/Datenschutz"));
const AGB = lazy(() => import("./pages/AGB"));
const Kontakt = lazy(() => import("./pages/Kontakt"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCancel = lazy(() => import("./pages/PaymentCancel"));
const NotFound = lazy(() => import("./pages/NotFound"));

// ─── Main App Pages (lazy) ───
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PortfolioDetailsPage = lazy(() => import("./pages/PortfolioDetailsPage"));
const StockDetail = lazy(() => import("./pages/StockDetail"));
const Invest = lazy(() => import("./pages/Invest"));
const Signals = lazy(() => import("./pages/Signals"));
const MarktHub = lazy(() => import("./pages/MarktHub"));
const CopilotHub = lazy(() => import("./pages/CopilotHub"));

// ─── Tools (lazy) ───
const PortfolioBuilderWizard = lazy(() => import("./pages/PortfolioBuilderWizard"));
const Rechner = lazy(() => import("./pages/Rechner"));
const PortfolioComparison = lazy(() => import("./pages/PortfolioComparison"));
const StrategyBacktest = lazy(() => import("./pages/StrategyBacktest"));
const Import = lazy(() => import("./pages/Import"));

// ─── Einstellungen (lazy) ───
const Einstellungen = lazy(() => import("./pages/Einstellungen"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const PriceAlerts = lazy(() => import("./pages/PriceAlerts"));

// ─── Admin (lazy — only loaded when admin navigates there) ───
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminCategories = lazy(() => import("./pages/AdminCategories"));
const AdminSectors = lazy(() => import("./pages/AdminSectors"));
const AdminSecretsManagement = lazy(() => import("./pages/AdminSecretsManagement"));
const AdminKPIs = lazy(() => import("./pages/AdminKPIs"));
const AdminDataImport = lazy(() => import("./pages/AdminDataImport"));
const AdminWatchlist = lazy(() => import("./pages/AdminWatchlist"));
const AdminOptimizer = lazy(() => import("./pages/AdminOptimizer"));
const AdminLogs = lazy(() => import("./pages/AdminLogs"));
const AdminMlTrainer = lazy(() => import("./pages/AdminMlTrainer"));
const AdminSignalPerformance = lazy(() => import("./pages/AdminSignalPerformance"));
const AdminWikifolio = lazy(() => import("./pages/AdminWikifolio"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminResearch = lazy(() => import("./pages/AdminResearch"));
const AdminBerechnungen = lazy(() => import("./pages/AdminBerechnungen"));
const AdminSignalConfig = lazy(() => import("./pages/AdminSignalConfig"));
const AdminScreenshots = lazy(() => import("./pages/AdminScreenshots"));

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* ═══ Public ═══ */}
        <Route path="/" component={Landing} />
        <Route path="/auth" component={Auth} />
        <Route path="/register">
          <Redirect to="/auth?tab=register" />
        </Route>
        <Route path="/login">
          <Redirect to="/auth?tab=login" />
        </Route>
        <Route path="/registration">
          <Redirect to="/auth?tab=register" />
        </Route>
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/onboarding" component={OnboardingWizard} />
        <Route path="/premium-wizard" component={PremiumWizard} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/impressum" component={Impressum} />
        <Route path="/datenschutz" component={Datenschutz} />
        <Route path="/agb" component={AGB} />
        <Route path="/kontakt" component={Kontakt} />
        <Route path="/payment/success" component={PaymentSuccess} />
        <Route path="/payment/cancel" component={PaymentCancel} />

        {/* ═══ 1. DASHBOARD ═══ */}
        <Route path="/dashboard" component={Dashboard} />

        {/* ═══ 2. PORTFOLIOS ═══ */}
        <Route path="/portfolios">
          <Redirect to="/dashboard" />
        </Route>
        <Route path="/portfolios/:id" component={PortfolioDetailsPage} />
        <Route path="/portfolios/create">
          <Redirect to="/portfolio-builder" />
        </Route>

        {/* ═══ 3. AKTIEN ═══ */}
        <Route path="/aktien" component={Invest} />
        <Route path="/aktien/signale" component={Signals} />
        <Route path="/aktien/:ticker" component={StockDetail} />
        <Route path="/stock/:ticker">
          {(params: { ticker?: string }) => <Redirect to={`/aktien/${params.ticker}`} />}
        </Route>
        <Route path="/stocks/:ticker">
          {(params: { ticker?: string }) => <Redirect to={`/aktien/${params.ticker}`} />}
        </Route>
        <Route path="/invest" component={Invest} />
        <Route path="/invest/:ticker">
          {(params: { ticker?: string }) => <Redirect to={`/aktien/${params.ticker}`} />}
        </Route>

        {/* ═══ 4. MARKT ═══ */}
        <Route path="/markt" component={MarktHub} />

        {/* ═══ 5. COPILOT ═══ */}
        <Route path="/copilot" component={CopilotHub} />

        {/* ═══ 6. TOOLS ═══ */}
        <Route path="/portfolio-builder" component={PortfolioBuilderWizard} />
        <Route path="/portfolio-builder/wizard">
          <Redirect to="/portfolio-builder" />
        </Route>
        <Route path="/portfolio-builder/new">
          <Redirect to="/portfolio-builder" />
        </Route>
        <Route path="/portfolio-builder/old">
          <Redirect to="/portfolio-builder" />
        </Route>
        <Route path="/rechner" component={Rechner} />
        <Route path="/portfolio-comparison" component={PortfolioComparison} />
        <Route path="/price-alerts" component={PriceAlerts} />

        {/* ═══ EINSTELLUNGEN ═══ */}
        <Route path="/einstellungen" component={Einstellungen} />
        <Route path="/settings" component={Einstellungen} />
        <Route path="/settings/notifications" component={NotificationSettings} />

        {/* ═══ ADMIN ═══ */}
        <Route path="/admin"><RequireAdmin><AdminDashboard /></RequireAdmin></Route>
        {/* Stammdaten-Seite in «Aktienliste & Watchlist» zusammengeführt (Tab «Nicht kuratiert») */}
        <Route path="/admin/stocks"><Redirect to="/admin/watchlist" /></Route>
        <Route path="/admin/categories"><RequireAdmin><AdminCategories /></RequireAdmin></Route>
        <Route path="/admin/sectors"><RequireAdmin><AdminSectors /></RequireAdmin></Route>
        <Route path="/admin/secrets"><RequireAdmin><AdminSecretsManagement /></RequireAdmin></Route>
        <Route path="/admin/kpis"><RequireAdmin><AdminKPIs /></RequireAdmin></Route>
        <Route path="/admin/data-import"><RequireAdmin><AdminDataImport /></RequireAdmin></Route>
        <Route path="/admin/watchlist"><RequireAdmin><AdminWatchlist /></RequireAdmin></Route>
        <Route path="/admin/optimizer"><RequireAdmin><AdminOptimizer /></RequireAdmin></Route>
        <Route path="/admin/logs"><RequireAdmin><AdminLogs /></RequireAdmin></Route>
        <Route path="/admin/ml-trainer"><RequireAdmin><AdminMlTrainer /></RequireAdmin></Route>
        <Route path="/admin/signal-performance"><RequireAdmin><AdminSignalPerformance /></RequireAdmin></Route>
        <Route path="/admin/wikifolio"><RequireAdmin><AdminWikifolio /></RequireAdmin></Route>
        <Route path="/admin/settings"><RequireAdmin><AdminSettings /></RequireAdmin></Route>
        <Route path="/admin/research"><RequireAdmin><AdminResearch /></RequireAdmin></Route>
        <Route path="/admin/berechnungen"><RequireAdmin><AdminBerechnungen /></RequireAdmin></Route>
        <Route path="/admin/signal-config"><RequireAdmin><AdminSignalConfig /></RequireAdmin></Route>
        <Route path="/admin/screenshots"><RequireAdmin><AdminScreenshots /></RequireAdmin></Route>

        {/* ═══ Legacy Redirects ═══ */}
        <Route path="/home"><Redirect to="/dashboard" /></Route>
        <Route path="/optimizer"><Redirect to="/dashboard" /></Route>
        <Route path="/live-tracking"><Redirect to="/dashboard" /></Route>
        <Route path="/portfolio/:id">
          {(params: { id?: string }) => <Redirect to={`/portfolios/${params.id}`} />}
        </Route>
        <Route path="/portfolio/:id/positions">
          {(params: { id?: string }) => <Redirect to={`/portfolios/${params.id}?tab=positionen`} />}
        </Route>
        <Route path="/portfolio/:id/transactions">
          {(params: { id?: string }) => <Redirect to={`/portfolios/${params.id}?tab=transaktionen`} />}
        </Route>
        <Route path="/market-overview"><Redirect to="/markt" /></Route>
        <Route path="/market-regime"><Redirect to="/markt?tab=regime" /></Route>
        <Route path="/market-heatmap"><Redirect to="/markt?tab=heatmap" /></Route>
        <Route path="/sector-heatmap"><Redirect to="/markt?tab=heatmap" /></Route>
        <Route path="/newsroom"><Redirect to="/markt?tab=news" /></Route>
        <Route path="/dividends"><Redirect to="/dashboard" /></Route>
        <Route path="/chat"><Redirect to="/copilot" /></Route>
        <Route path="/ai-insights"><Redirect to="/copilot" /></Route>
        <Route path="/risk-dashboard"><Redirect to="/dashboard" /></Route>
        <Route path="/dcf-valuation"><Redirect to="/dashboard" /></Route>
        <Route path="/portfolio-optimizer"><Redirect to="/dashboard" /></Route>
        <Route path="/technical-analysis"><Redirect to="/dashboard" /></Route>
        <Route path="/backtesting" component={StrategyBacktest} />
        <Route path="/backtest" component={StrategyBacktest} />
        <Route path="/import">{() => <Import />}</Route>
        <Route path="/prediction"><Redirect to="/copilot" /></Route>
        <Route path="/signals"><Redirect to="/aktien" /></Route>
        <Route path="/analysis"><Redirect to="/dashboard" /></Route>
        <Route path="/reports"><Redirect to="/dashboard" /></Route>
        <Route path="/categories"><Redirect to="/aktien?filter=kategorie" /></Route>
        <Route path="/sectors"><Redirect to="/aktien?filter=sektor" /></Route>
        <Route path="/transactions"><Redirect to="/dashboard" /></Route>

        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
