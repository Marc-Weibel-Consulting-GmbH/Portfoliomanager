import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// ─── Public Pages ───
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Registration from "./pages/Registration";
import ForgotPassword from "./pages/ForgotPassword";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import Pricing from "./pages/Pricing";
import Impressum from "./pages/Impressum";
import Datenschutz from "./pages/Datenschutz";
import AGB from "./pages/AGB";
import Kontakt from "./pages/Kontakt";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import OnboardingWizard from "./components/OnboardingWizard";
import PremiumWizard from "./pages/PremiumWizard";

// ─── Main App Pages (IA-Optimierung: 6 Sections) ───
import Dashboard from "./pages/Dashboard";
import Portfolios from "./pages/Portfolios";
import PortfolioDetailsPage from "./pages/PortfolioDetailsPage";
import StockDetail from "./pages/StockDetail";
import Invest from "./pages/Invest";
import MarktHub from "./pages/MarktHub";
import CopilotHub from "./pages/CopilotHub";

// ─── Tools (unter Sidebar "Tools" Gruppe) ───
import PortfolioBuilderWizard from "./pages/PortfolioBuilderWizard";
import Rechner from "./pages/Rechner";
import PortfolioComparison from "./pages/PortfolioComparison";
import StrategyBacktest from "./pages/StrategyBacktest";
import Import from "./pages/Import";

// ─── Einstellungen ───
import Einstellungen from "./pages/Einstellungen";
import NotificationSettings from "./pages/NotificationSettings";
import PriceAlerts from "./pages/PriceAlerts";

// ─── Admin ───
import AdminDashboard from "./pages/AdminDashboard";
import AdminStocks from "./pages/AdminStocks";
import AdminCategories from "./pages/AdminCategories";
import AdminSectors from "./pages/AdminSectors";
import AdminSecretsManagement from "./pages/AdminSecretsManagement";
import AdminKPIs from "./pages/AdminKPIs";
import AdminDataImport from "./pages/AdminDataImport";
import AdminWatchlist from "./pages/AdminWatchlist";
import AdminOptimizer from "./pages/AdminOptimizer";
import AdminLogs from "./pages/AdminLogs";
import AdminSecrets from "./pages/AdminSecrets";
import AdminMlTrainer from "./pages/AdminMlTrainer";
import AdminSignalPerformance from "./pages/AdminSignalPerformance";
import AdminWikifolio from "./pages/AdminWikifolio";
import AdminSettings from "./pages/AdminSettings";

// ─── Legacy (für Redirects) ───
import DebugTest from "./pages/DebugTest";

function Router() {
  return (
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
      <Route path="/portfolios" component={Portfolios} />
      <Route path="/portfolios/:id" component={PortfolioDetailsPage} />
      <Route path="/portfolios/create">
        <Redirect to="/portfolio-builder" />
      </Route>

      {/* ═══ 3. AKTIEN ═══ */}
      <Route path="/aktien" component={Invest} />
      <Route path="/aktien/:ticker" component={StockDetail} />
      {/* Legacy stock routes → redirect */}
      <Route path="/stock/:ticker">
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
      <Route path="/portfolio-builder/wizard" component={PortfolioBuilderWizard} />
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
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/stocks" component={AdminStocks} />
      <Route path="/admin/categories" component={AdminCategories} />
      <Route path="/admin/sectors" component={AdminSectors} />
      <Route path="/admin/secrets" component={AdminSecretsManagement} />
      <Route path="/admin/kpis" component={AdminKPIs} />
      <Route path="/admin/data-import" component={AdminDataImport} />
      <Route path="/admin/watchlist" component={AdminWatchlist} />
      <Route path="/admin/optimizer" component={AdminOptimizer} />
      <Route path="/admin/logs" component={AdminLogs} />
      <Route path="/admin/ml-trainer" component={AdminMlTrainer} />
      <Route path="/admin/signal-performance" component={AdminSignalPerformance} />
      <Route path="/admin/wikifolio" component={AdminWikifolio} />
      <Route path="/admin/settings" component={AdminSettings} />

      {/* ═══ Legacy Redirects (alte Routen → neue Struktur) ═══ */}
      <Route path="/home">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/optimizer">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/live-tracking">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/portfolio/:id">
        {(params: { id?: string }) => <Redirect to={`/portfolios/${params.id}`} />}
      </Route>
      <Route path="/portfolio/:id/positions">
        {(params: { id?: string }) => <Redirect to={`/portfolios/${params.id}?tab=positionen`} />}
      </Route>
      <Route path="/portfolio/:id/transactions">
        {(params: { id?: string }) => <Redirect to={`/portfolios/${params.id}?tab=transaktionen`} />}
      </Route>
      <Route path="/market-overview">
        <Redirect to="/markt" />
      </Route>
      <Route path="/market-regime">
        <Redirect to="/markt?tab=regime" />
      </Route>
      <Route path="/market-heatmap">
        <Redirect to="/markt?tab=heatmap" />
      </Route>
      <Route path="/sector-heatmap">
        <Redirect to="/markt?tab=heatmap" />
      </Route>
      <Route path="/newsroom">
        <Redirect to="/markt?tab=news" />
      </Route>
      <Route path="/dividends">
        <Redirect to="/markt?tab=dividenden" />
      </Route>
      <Route path="/chat">
        <Redirect to="/copilot" />
      </Route>
      <Route path="/ai-insights">
        <Redirect to="/copilot" />
      </Route>
      <Route path="/risk-dashboard">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/dcf-valuation">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/portfolio-optimizer">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/technical-analysis">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/backtesting" component={StrategyBacktest} />
      <Route path="/backtest" component={StrategyBacktest} />
      <Route path="/import">{() => <Import />}</Route>
      <Route path="/prediction">
        <Redirect to="/copilot" />
      </Route>
      <Route path="/signals">
        <Redirect to="/aktien" />
      </Route>
      <Route path="/analysis">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/reports">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/categories">
        <Redirect to="/aktien?filter=kategorie" />
      </Route>
      <Route path="/sectors">
        <Redirect to="/aktien?filter=sektor" />
      </Route>
      <Route path="/transactions">
        <Redirect to="/portfolios" />
      </Route>

      {/* Debug */}
      <Route path="/debug-test" component={DebugTest} />

      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
