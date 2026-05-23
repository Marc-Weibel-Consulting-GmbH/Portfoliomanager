import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Newsroom from "./pages/Newsroom";
import StockDetail from "./pages/StockDetail";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Reviews from "./pages/Reviews";
import Categories from "./pages/Categories";
import Sectors from "./pages/Sectors";
import PortfolioDetail from "./pages/PortfolioDetail";
// PortfolioDetailRedesign wurde archiviert - verwende stattdessen PortfolioDetailsPage unter /portfolios/:id
import PortfolioPositions from "./pages/PortfolioPositions";
import PortfolioTransactionsPage from "./pages/PortfolioTransactionsPage";
import PortfolioTransactions from "./pages/PortfolioTransactions";
import PortfolioComparison from "./pages/PortfolioComparison";
import PriceAlerts from "./pages/PriceAlerts";
import RealizedGainsHistory from "./pages/RealizedGainsHistory";
import AdminSecrets from "./pages/AdminSecrets";
import TestSecrets from "./pages/TestSecrets";
import AdminLogs from "./pages/AdminLogs";
import NotificationSettings from "./pages/NotificationSettings";
import Chat from "./pages/Chat";
import LiveTracking from "./pages/LiveTracking";
import DividendCalendar from "./pages/DividendCalendar";
import Transactions from "./pages/Transactions";

import Signals from "./pages/Signals";
import AdminStocks from "./pages/AdminStocks";
import AdminDashboard from "./pages/AdminDashboard";
import AdminCategories from "./pages/AdminCategories";
import AdminSectors from "./pages/AdminSectors";
import AdminSecretsManagement from "./pages/AdminSecretsManagement";
import AdminKPIs from "./pages/AdminKPIs";
import AdminDataImport from "./pages/AdminDataImport";
import Dashboard from "./pages/Dashboard";
import PortfolioBuilder from "./pages/PortfolioBuilder";
import PortfolioBuilderNew from "./pages/PortfolioBuilderNew";
import PortfolioBuilderLanding from "./pages/PortfolioBuilderLanding";
import PortfolioBuilderWizard from "./pages/PortfolioBuilderWizard";
import Rechner from "./pages/Rechner";
import Einstellungen from "./pages/Einstellungen";
import Kontakt from "./pages/Kontakt";
import Pricing from "./pages/Pricing";
import Impressum from "./pages/Impressum";
import Datenschutz from "./pages/Datenschutz";
import DebugTest from "./pages/DebugTest";
import AGB from "./pages/AGB";
import OnboardingWizard from "./components/OnboardingWizard";
import Registration from "./pages/Registration";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import Portfolios from "./pages/Portfolios";
import Analysis from "./pages/Analysis";
import AIInsights from "./pages/AIInsights";
import Reports from "./pages/Reports";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import PortfolioDetailsPage from "./pages/PortfolioDetailsPage";
import PremiumWizard from "./pages/PremiumWizard";
import RiskDashboard from "./pages/RiskDashboard";
import DCFValuation from "./pages/DCFValuation";
import PortfolioOptimizer from "./pages/PortfolioOptimizer";
import TechnicalAnalysis from "./pages/TechnicalAnalysis";
import Invest from "./pages/Invest";
import InvestDetail from "./pages/InvestDetail";
import AdminWatchlist from "./pages/AdminWatchlist";
import Backtesting from "./pages/Backtesting";
import SectorHeatmap from "./pages/SectorHeatmap";
import Prediction from "./pages/Prediction";
import AdminOptimizer from "./pages/AdminOptimizer";
import MarketRegime from "./pages/MarketRegime";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/onboarding" component={OnboardingWizard} />
      <Route path="/registration" component={Registration} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/premium-wizard" component={PremiumWizard} />
      <Route path="/home" component={Home} />
      <Route path="/optimizer" component={Home} />
      <Route path="/register" component={Register} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/newsroom" component={Newsroom} />
      <Route path="/reviews">
        {() => <Reviews />}
      </Route>
      <Route path="/stock/:ticker" component={StockDetail} />
      {/* Alte /portfolio/:id Route - Redirect zu /portfolios/:id */}
      <Route path="/portfolio/:id">
        {(params: { id?: string }) => <Redirect to={`/portfolios/${params.id}`} />}
      </Route>
      {/* Alte Seite archiviert - nur noch für Debugging */}
      <Route path="/portfolio/:id/old" component={PortfolioDetail} />
      <Route path="/portfolio/:id/positions" component={PortfolioPositions} />
      <Route path="/portfolio/:id/transactions" component={PortfolioTransactionsPage} />
      <Route path="/portfolio/:id/realized-gains" component={RealizedGainsHistory} />
      <Route path="/portfolio-comparison" component={PortfolioComparison} />
      <Route path="/price-alerts" component={PriceAlerts} />
      <Route path="/admin/secrets" component={AdminSecrets} />
            <Route path="/test-secrets" component={TestSecrets} />
      <Route path="/debug-test" component={DebugTest} />
      <Route path="/admin/logs" component={AdminLogs} />
      <Route path="/settings/notifications" component={NotificationSettings} />
      <Route path="/chat" component={Chat} />
      <Route path="/categories" component={Categories} />
      <Route path="/sectors" component={Sectors} />
      <Route path="/live-tracking" component={LiveTracking} />
      <Route path="/dividends" component={DividendCalendar} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/portfolios/:id/transactions" component={Transactions} />
      <Route path="/portfolios" component={Portfolios} />
      <Route path="/portfolios/:id" component={PortfolioDetailsPage} />
      <Route path="/portfolios/create">
        <Redirect to="/portfolio-builder" />
      </Route>
      <Route path="/analysis" component={Analysis} />
      <Route path="/ai-insights" component={AIInsights} />
      <Route path="/risk-dashboard" component={RiskDashboard} />
      <Route path="/dcf-valuation" component={DCFValuation} />
      <Route path="/portfolio-optimizer" component={PortfolioOptimizer} />
      <Route path="/technical-analysis" component={TechnicalAnalysis} />
      <Route path="/backtesting" component={Backtesting} />
      <Route path="/sector-heatmap" component={SectorHeatmap} />
      <Route path="/market-regime" component={MarketRegime} />
      <Route path="/prediction" component={Prediction} />
      <Route path="/invest" component={Invest} />
      <Route path="/invest/:ticker" component={InvestDetail} />
      <Route path="/reports" component={Reports} />
      <Route path="/portfolio-builder" component={PortfolioBuilderLanding} />
      <Route path="/portfolio-builder/wizard" component={PortfolioBuilderWizard} />
      <Route path="/portfolio-builder/new" component={PortfolioBuilderNew} />
      <Route path="/portfolio-builder/old" component={PortfolioBuilder} />

      <Route path="/signals" component={Signals} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/stocks" component={AdminStocks} />
      <Route path="/admin/categories" component={AdminCategories} />
      <Route path="/admin/sectors" component={AdminSectors} />
      <Route path="/admin/secrets" component={AdminSecretsManagement} />
      <Route path="/admin/kpis" component={AdminKPIs} />
      <Route path="/admin/data-import" component={AdminDataImport} />
      <Route path="/admin/watchlist" component={AdminWatchlist} />
      <Route path="/admin/optimizer" component={AdminOptimizer} />
      <Route path="/rechner" component={Rechner} />
      <Route path="/einstellungen" component={Einstellungen} />
      <Route path="/kontakt" component={Kontakt} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/payment/success" component={PaymentSuccess} />
      <Route path="/payment/cancel" component={PaymentCancel} />
      <Route path="/impressum" component={Impressum} />
      <Route path="/datenschutz" component={Datenschutz} />
      <Route path="/agb" component={AGB} />
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
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

