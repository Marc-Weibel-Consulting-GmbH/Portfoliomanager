import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Newsroom from "./pages/Newsroom";
import StockDetail from "./pages/StockDetail";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Reviews from "./pages/Reviews";
import Categories from "./pages/Categories";
import Sectors from "./pages/Sectors";
import PortfolioDetail from "./pages/PortfolioDetail";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/register" component={Register} />
      <Route path="/login" component={Login} />
      <Route path="/newsroom" component={Newsroom} />
      <Route path="/reviews">
        {() => <Reviews />}
      </Route>
      <Route path="/stock/:ticker" component={StockDetail} />
      <Route path="/portfolio/:id" component={PortfolioDetail} />
      <Route path="/categories" component={Categories} />
      <Route path="/sectors" component={Sectors} />
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
        defaultTheme="light"
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

