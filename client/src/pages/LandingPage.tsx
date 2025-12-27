import { Button } from "@/components/ui/button";
import { TrendingUp, Activity, Bell, Lock, Shield } from "lucide-react";
import { APP_LOGO, APP_TITLE } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      window.location.href = "/dashboard";
    } else {
      window.location.href = "/register";
    }
  };

  const handleLogin = () => {
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex items-center gap-2">
              {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
              <span className="text-xl font-bold text-white">Portfolio Analyzer</span>
            </div>

            {/* Center Navigation */}
            <div className="hidden md:flex gap-8 items-center">
              <a href="#features" className="text-slate-300 hover:text-teal-400 transition-colors">
                Features
              </a>
              <a href="/pricing" className="text-slate-300 hover:text-teal-400 transition-colors">
                Pricing
              </a>
              <a href="/about" className="text-slate-300 hover:text-teal-400 transition-colors">
                About
              </a>
            </div>

            {/* Right Actions */}
            <div className="flex gap-3 items-center">
              {!isAuthenticated && (
                <>
                  <Button 
                    variant="ghost" 
                    onClick={handleLogin} 
                    className="text-slate-300 hover:text-white hover:bg-slate-800"
                  >
                    Login
                  </Button>
                  <Button 
                    onClick={handleGetStarted} 
                    className="bg-teal-500 hover:bg-teal-600 text-white px-6"
                  >
                    Get Started
                  </Button>
                </>
              )}
              {isAuthenticated && (
                <Button 
                  onClick={() => window.location.href = "/dashboard"} 
                  className="bg-teal-500 hover:bg-teal-600 text-white px-6"
                >
                  Zum Dashboard
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Column - Text Content */}
          <div className="space-y-6">
            <h1 className="text-5xl lg:text-6xl font-bold text-white leading-[1.1]">
              Optimiere dein<br />
              Aktienportfolio mit<br />
              KI-gestützter Analyse
            </h1>
            
            <p className="text-lg lg:text-xl text-slate-300 leading-relaxed max-w-xl">
              Live-Tracking, Fundamentalanalyse und automatische Alerts für Schweizer Investoren
            </p>

            <div className="pt-2">
              <Button 
                size="lg" 
                onClick={handleGetStarted}
                className="bg-teal-500 hover:bg-teal-600 text-white text-base px-10 py-6 rounded-full shadow-lg shadow-teal-500/30 hover:shadow-teal-500/50 transition-all"
              >
                Kostenlos starten
              </Button>
            </div>
          </div>

          {/* Right Column - Portfolio Dashboard Mockup */}
          <div className="relative">
            {/* Main Dashboard Card */}
            <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl shadow-slate-900/50">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-teal-500/20 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-teal-400" />
                  </div>
                  <span className="text-white font-semibold text-lg">Portfolio</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-xs font-semibold text-white">
                    JD
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-700"></div>
                </div>
              </div>

              {/* Portfolio Value */}
              <div className="mb-6">
                <div className="text-sm text-slate-400 mb-1">Current balance</div>
                <div className="flex items-baseline gap-3">
                  <div className="text-4xl font-bold text-white">CHF 235'000.50</div>
                  <div className="text-sm font-semibold text-teal-400 bg-teal-500/10 px-2 py-1 rounded">
                    +4.5%
                  </div>
                </div>
              </div>

              {/* Performance Chart */}
              <div className="mb-6">
                <div className="text-xs text-slate-400 mb-3">Performance YTD</div>
                <div className="h-40 bg-gradient-to-t from-teal-500/10 to-transparent rounded-xl relative overflow-hidden">
                  <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,90 L40,85 L80,80 L120,75 L160,70 L200,60 L240,55 L280,50 L320,45 L360,40 L400,35"
                      fill="none"
                      stroke="#14b8a6"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M0,90 L40,85 L80,80 L120,75 L160,70 L200,60 L240,55 L280,50 L320,45 L360,40 L400,35 L400,120 L0,120 Z"
                      fill="url(#chartGradient)"
                    />
                  </svg>
                </div>
              </div>

              {/* Bottom Grid - Asset Allocation & Watchlist */}
              <div className="grid grid-cols-2 gap-4">
                {/* Asset Allocation */}
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                  <div className="text-xs text-slate-400 mb-3">Asset Allocation</div>
                  <div className="relative w-20 h-20 mx-auto">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="20" />
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="40" 
                        fill="none" 
                        stroke="#14b8a6" 
                        strokeWidth="20"
                        strokeDasharray="175 251"
                        strokeLinecap="round"
                      />
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="40" 
                        fill="none" 
                        stroke="#8b5cf6" 
                        strokeWidth="20"
                        strokeDasharray="50 251"
                        strokeDashoffset="-175"
                        strokeLinecap="round"
                      />
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="40" 
                        fill="none" 
                        stroke="#06b6d4" 
                        strokeWidth="20"
                        strokeDasharray="26 251"
                        strokeDashoffset="-225"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-xs text-white font-semibold">Diversified</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-teal-400"></div>
                        <span className="text-slate-400">Aktien</span>
                      </div>
                      <span className="text-white font-medium">65%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <span className="text-slate-400">Anleihen</span>
                      </div>
                      <span className="text-white font-medium">20%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-cyan-400"></div>
                        <span className="text-slate-400">ETFs</span>
                      </div>
                      <span className="text-white font-medium">15%</span>
                    </div>
                  </div>
                </div>

                {/* Watchlist */}
                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30">
                  <div className="text-xs text-slate-400 mb-3">Watchlist</div>
                  <div className="space-y-3">
                    <WatchlistItem ticker="NOVN" price="227.15" change="+3.2%" positive />
                    <WatchlistItem ticker="NESN" price="98.40" change="+1.8%" positive />
                    <WatchlistItem ticker="UBS" price="12.38" change="-0.5%" positive={false} />
                  </div>
                </div>
              </div>
            </div>

            {/* Glow Effects */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section id="features" className="container mx-auto px-6 py-12">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<TrendingUp className="h-12 w-12 text-teal-400" />}
            title="Portfolio-Builder"
            description="Erstelle und optimiere dein Portfolio basierend auf modernsten KI-Modellen und Risikoprofilen."
          />
          <FeatureCard
            icon={<Activity className="h-12 w-12 text-teal-400" />}
            title="Live-Tracking"
            description="Verfolge die Performance deines gesamten Portfolios in Echtzeit und erhalte sofortige Updates."
          />
          <FeatureCard
            icon={<Bell className="h-12 w-12 text-teal-400" />}
            title="Preisalarme"
            description="Setze individuelle Alarme für Preisänderungen, News und technische Indikatoren."
          />
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="container mx-auto px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-8 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8">
          {/* Left - User Count */}
          <div className="flex items-center gap-4">
            <div className="text-white text-2xl font-bold">500+ Investoren vertrauen uns</div>
            <div className="flex -space-x-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-slate-800"></div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 border-2 border-slate-800"></div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 border-2 border-slate-800"></div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 border-2 border-slate-800"></div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 border-2 border-slate-800"></div>
            </div>
          </div>

          {/* Right - Trust Badges */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-teal-400" />
              <span className="text-slate-300 text-sm">SSL verschlüsselt</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🇨🇭</span>
              <span className="text-slate-300 text-sm">Schweizer Datenschutz</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-400" />
              <span className="text-slate-300 text-sm">Stripe Payment</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/50 hover:bg-slate-800/60 transition-all duration-300">
      <div className="mb-6 w-16 h-16 bg-teal-500/10 rounded-xl flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed mb-4">{description}</p>
      <a href="#" className="text-teal-400 hover:text-teal-300 text-sm font-medium inline-flex items-center gap-1 group-hover:gap-2 transition-all">
        Mehr erfahren
        <span>→</span>
      </a>
    </div>
  );
}

// Watchlist Item Component
function WatchlistItem({ ticker, price, change, positive }: { ticker: string; price: string; change: string; positive: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
          <span className="text-xs font-semibold text-slate-400">{ticker.substring(0, 1)}</span>
        </div>
        <span className="text-white text-sm font-medium">{ticker}</span>
      </div>
      <div className="text-right">
        <div className="text-white text-sm font-medium">{price}</div>
        <div className={`text-xs font-medium ${positive ? 'text-teal-400' : 'text-red-400'}`}>
          {change}
        </div>
      </div>
    </div>
  );
}
