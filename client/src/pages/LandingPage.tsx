import { Button } from "@/components/ui/button";
import { TrendingUp, Activity, Bell, Lock, Shield, ChevronRight } from "lucide-react";
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
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* Navigation - Exact Mockup Match */}
      <nav className="border-b border-slate-800/50 bg-[#0a0e1a]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Portfolio Analyzer</span>
            </div>

            {/* Center Navigation */}
            <div className="hidden md:flex gap-8 items-center">
              <a href="#features" className="text-slate-400 hover:text-white transition-colors text-sm">
                Features
              </a>
              <a href="/pricing" className="text-slate-400 hover:text-white transition-colors text-sm">
                Pricing
              </a>
              <a href="/about" className="text-slate-400 hover:text-white transition-colors text-sm">
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
                    className="text-white hover:text-white hover:bg-slate-800 text-sm"
                  >
                    Login
                  </Button>
                  <Button 
                    onClick={handleGetStarted} 
                    className="bg-teal-500 hover:bg-teal-600 text-white px-6 text-sm font-medium"
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

      {/* Hero Section - Pixel Perfect Match */}
      <section className="container mx-auto px-6 pt-20 pb-12">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Column - Text Content */}
          <div className="space-y-8">
            <h1 className="text-6xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight">
              Optimiere dein<br />
              Aktienportfolio mit<br />
              KI-gestützter<br />
              Analyse
            </h1>
            
            <p className="text-lg text-slate-400 leading-relaxed max-w-xl">
              Live-Tracking, Fundamentalanalyse und automatische Alerts für Schweizer Investoren
            </p>

            <div className="pt-2">
              <Button 
                size="lg" 
                onClick={handleGetStarted}
                className="bg-teal-500 hover:bg-teal-600 text-white text-base px-10 py-6 rounded-full font-semibold shadow-lg shadow-teal-500/20 hover:shadow-teal-500/40 transition-all"
              >
                Kostenlos starten
              </Button>
            </div>
          </div>

          {/* Right Column - Portfolio Dashboard Mockup */}
          <div className="relative">
            {/* Main Dashboard Card with exact mockup styling */}
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/30 rounded-3xl p-8 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <span className="text-white font-semibold text-lg">Portfolio</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">JD</span>
                  </div>
                  <button className="w-9 h-9 rounded-full bg-slate-700/50 flex items-center justify-center hover:bg-slate-700 transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                  </button>
                </div>
              </div>

              {/* Portfolio Value */}
              <div className="mb-8">
                <div className="flex items-baseline gap-3 mb-2">
                  <div className="text-4xl font-bold text-white">CHF 235'000.50</div>
                  <div className="text-sm font-semibold text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full">
                    +4.5%
                  </div>
                </div>
              </div>

              {/* Performance Chart & Asset Allocation Grid */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Performance Chart */}
                <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-700/30">
                  <div className="text-xs text-slate-400 mb-3 font-medium">Performance YTD</div>
                  <div className="h-32 bg-gradient-to-t from-teal-500/10 to-transparent rounded-xl relative overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,90 L40,85 L80,78 L120,72 L160,65 L200,55 L240,48 L280,42 L320,38 L360,35 L400,30"
                        fill="none"
                        stroke="#14b8a6"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      <path
                        d="M0,90 L40,85 L80,78 L120,72 L160,65 L200,55 L240,48 L280,42 L320,38 L360,35 L400,30 L400,120 L0,120 Z"
                        fill="url(#chartGradient)"
                      />
                    </svg>
                  </div>
                </div>

                {/* Asset Allocation */}
                <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-700/30">
                  <div className="text-xs text-slate-400 mb-3 font-medium">Asset Allocation</div>
                  <div className="relative w-24 h-24 mx-auto mb-3">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="35" fill="none" stroke="#1e293b" strokeWidth="14" />
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="35" 
                        fill="none" 
                        stroke="#14b8a6" 
                        strokeWidth="14"
                        strokeDasharray="140 220"
                        strokeLinecap="round"
                      />
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="35" 
                        fill="none" 
                        stroke="#a855f7" 
                        strokeWidth="14"
                        strokeDasharray="44 220"
                        strokeDashoffset="-140"
                        strokeLinecap="round"
                      />
                      <circle 
                        cx="50" 
                        cy="50" 
                        r="35" 
                        fill="none" 
                        stroke="#06b6d4" 
                        strokeWidth="14"
                        strokeDasharray="36 220"
                        strokeDashoffset="-184"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-xs text-white font-semibold">Diversified</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Watchlist */}
              <div className="bg-slate-900/60 rounded-2xl p-4 border border-slate-700/30">
                <div className="text-xs text-slate-400 mb-3 font-medium">Watchlist</div>
                <div className="space-y-3">
                  <WatchlistItem ticker="NOVN" price="227.15" change="+3.2%" positive />
                  <WatchlistItem ticker="NESN" price="98.40" change="+1.8%" positive />
                  <WatchlistItem ticker="UBS" price="12.38" change="-0.5%" positive={false} />
                </div>
              </div>
            </div>

            {/* Glow Effects */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section id="features" className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<TrendingUp className="h-10 w-10 text-teal-400" />}
            title="Portfolio-Builder"
            description="Erstelle und optimiere dein Portfolio basierend auf modernsten KI-Modellen und Risikoprofilen."
          />
          <FeatureCard
            icon={<Activity className="h-10 w-10 text-teal-400" />}
            title="Live-Tracking"
            description="Verfolge die Performance deines gesamten Portfolios in Echtzeit und erhalte sofortige Updates."
          />
          <FeatureCard
            icon={<Bell className="h-10 w-10 text-teal-400" />}
            title="Preisalarme"
            description="Setze individuelle Alarme für Preisänderungen, News und technische Indikatoren."
          />
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="container mx-auto px-6 py-12">
        <div className="flex flex-wrap items-center justify-between gap-8 bg-slate-800/20 backdrop-blur-sm border border-slate-700/30 rounded-2xl p-8">
          {/* Left - User Count */}
          <div className="flex items-center gap-4">
            <div className="text-white text-xl font-semibold">500+ Investoren vertrauen uns</div>
            <div className="flex -space-x-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-[#0a0e1a]"></div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 border-2 border-[#0a0e1a]"></div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 border-2 border-[#0a0e1a]"></div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 border-2 border-[#0a0e1a]"></div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 border-2 border-[#0a0e1a]"></div>
            </div>
          </div>

          {/* Right - Trust Badges */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-teal-400" />
              <span className="text-slate-400 text-sm">SSL verschlüsselt</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🇨🇭</span>
              <span className="text-slate-400 text-sm">Schweizer Datenschutz</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-400" />
              <span className="text-slate-400 text-sm">Stripe Payment</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Spacing */}
      <div className="h-20"></div>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group bg-slate-800/30 backdrop-blur-sm border border-slate-700/30 rounded-2xl p-8 hover:border-teal-500/40 hover:bg-slate-800/40 transition-all duration-300">
      <div className="mb-6 w-14 h-14 bg-teal-500/10 rounded-xl flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed text-sm">{description}</p>
    </div>
  );
}

// Watchlist Item Component
function WatchlistItem({ ticker, price, change, positive }: { ticker: string; price: string; change: string; positive: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-slate-700/50 flex items-center justify-center">
          <span className="text-xs font-semibold text-slate-300">{ticker.substring(0, 1)}</span>
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
