import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrendingUp, Activity, Bell, Lock, Flag, CreditCard } from "lucide-react";
import { Link } from "wouter";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Tech Background Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle, rgba(20, 184, 166, 0.3) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      {/* Navigation */}
      <nav className="relative border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-teal-400" />
              <span className="text-xl font-bold text-white">Portfolio Analyzer</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-slate-300 hover:text-teal-400 transition-colors">Features</a>
              <Link href="/pricing" className="text-slate-300 hover:text-teal-400 transition-colors cursor-pointer">
                Pricing
              </Link>
              <a href="#about" className="text-slate-300 hover:text-teal-400 transition-colors">About</a>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800">
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-teal-500 hover:bg-teal-600 text-white font-semibold px-6 shadow-lg shadow-teal-500/30">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative container mx-auto px-6 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <div className="space-y-8 z-10">
            <h1 className="text-6xl lg:text-7xl font-bold text-white leading-tight">
              Optimiere dein<br />
              Aktienportfolio mit<br />
              KI-gestützter Analyse
            </h1>
            <p className="text-2xl text-slate-300 leading-relaxed">
              Live-Tracking, Fundamentalanalyse und<br />
              automatische Alerts für Schweizer Investoren
            </p>
            <Link href="/register">
              <Button 
                size="lg" 
                className="bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold text-lg px-8 py-6 rounded-full shadow-xl shadow-teal-500/40 hover:shadow-teal-500/60 transition-all"
              >
                Kostenlos starten
              </Button>
            </Link>
          </div>

          {/* Right Column - Dashboard Preview Mockup */}
          <div className="relative z-10">
            <div className="absolute inset-0 bg-teal-500/20 blur-3xl rounded-full -z-10"></div>
            <Card className="relative bg-slate-800/80 border-slate-700 p-6 backdrop-blur-sm shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-teal-400" />
                  Portfolio
                </h3>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-slate-400" />
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-blue-500"></div>
                </div>
              </div>

              {/* Portfolio Value */}
              <div className="mb-6">
                <p className="text-sm text-slate-400 mb-1">Current Balance</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">CHF 235'000.50</span>
                  <span className="text-teal-400 font-semibold">+4.5%</span>
                </div>
              </div>

              {/* Chart Area */}
              <div className="h-32 mb-6 relative">
                <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgb(20, 184, 166)" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="rgb(20, 184, 166)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0 80 L 50 75 L 100 70 L 150 65 L 200 60 L 250 55 L 300 45 L 350 35 L 400 30"
                    fill="url(#chartGradient)"
                    stroke="rgb(20, 184, 166)"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Card className="bg-slate-900/50 border-slate-700 p-4">
                  <p className="text-xs text-slate-400 mb-1">Asset Allocation</p>
                  <div className="flex items-center gap-3">
                    <svg className="w-12 h-12" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="none" stroke="#1e293b" strokeWidth="3" />
                      <circle cx="18" cy="18" r="16" fill="none" stroke="#14b8a6" strokeWidth="3" strokeDasharray="60 40" strokeDashoffset="25" />
                      <circle cx="18" cy="18" r="16" fill="none" stroke="#3b82f6" strokeWidth="3" strokeDasharray="30 70" strokeDashoffset="-35" />
                    </svg>
                    <div className="text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-teal-400"></div>
                        <span className="text-slate-300">Aktien 60%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-slate-300">ETFs 40%</span>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="bg-slate-900/50 border-slate-700 p-4">
                  <p className="text-xs text-slate-400 mb-2">Performance YTD</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">+8.5%</span>
                      <Activity className="h-3 w-3 text-teal-400" />
                    </div>
                  </div>
                </Card>
              </div>

              {/* Watchlist */}
              <div>
                <p className="text-xs text-slate-400 mb-3">Watchlist</p>
                <div className="space-y-2">
                  {[
                    { ticker: "NOVN", price: "227.55", change: "+0.3%" },
                    { ticker: "NESN", price: "38.04", change: "+1.2%" },
                    { ticker: "UBS", price: "1.93", change: "-0.5%" },
                  ].map((stock) => (
                    <div key={stock.ticker} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">{stock.ticker}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{stock.price}</span>
                        <span className={stock.change.startsWith("+") ? "text-teal-400" : "text-red-400"}>
                          {stock.change}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section id="features" className="relative container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Portfolio-Builder */}
          <Card className="bg-slate-800/50 border-teal-500/30 p-8 hover:border-teal-500/60 transition-all group backdrop-blur-sm shadow-xl hover:shadow-teal-500/20">
            <div className="mb-6">
              <div className="w-14 h-14 rounded-lg bg-teal-500/10 flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
                <TrendingUp className="h-7 w-7 text-teal-400" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-white mb-4">Portfolio-Builder</h3>
            <p className="text-lg text-slate-300 mb-6 leading-relaxed">
              Erstelle und optimiere dein Portfolio basierend auf modernsten KI-Modellen und Risikoprofilen.
            </p>
            <a href="#" className="text-teal-400 hover:text-teal-300 font-semibold inline-flex items-center gap-2">
              Mehr erfahren
              <span>→</span>
            </a>
          </Card>

          {/* Live-Tracking */}
          <Card className="bg-slate-800/50 border-teal-500/30 p-8 hover:border-teal-500/60 transition-all group backdrop-blur-sm shadow-xl hover:shadow-teal-500/20">
            <div className="mb-6">
              <div className="w-14 h-14 rounded-lg bg-teal-500/10 flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
                <Activity className="h-7 w-7 text-teal-400" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-white mb-4">Live-Tracking</h3>
            <p className="text-lg text-slate-300 mb-6 leading-relaxed">
              Verfolge die Performance deines gesamten Portfolios in Echtzeit und erhalte sofortige Updates.
            </p>
            <a href="#" className="text-teal-400 hover:text-teal-300 font-semibold inline-flex items-center gap-2">
              Mehr erfahren
              <span>→</span>
            </a>
          </Card>

          {/* Preisalarme */}
          <Card className="bg-slate-800/50 border-teal-500/30 p-8 hover:border-teal-500/60 transition-all group backdrop-blur-sm shadow-xl hover:shadow-teal-500/20">
            <div className="mb-6">
              <div className="w-14 h-14 rounded-lg bg-teal-500/10 flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
                <Bell className="h-7 w-7 text-teal-400" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-white mb-4">Preisalarme</h3>
            <p className="text-lg text-slate-300 mb-6 leading-relaxed">
              Setze individuelle Alarme für Preisänderungen, News und technische Indikatoren.
            </p>
            <a href="#" className="text-teal-400 hover:text-teal-300 font-semibold inline-flex items-center gap-2">
              Mehr erfahren
              <span>→</span>
            </a>
          </Card>
        </div>
      </section>

      {/* Trust Section */}
      <section className="relative container mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row items-center justify-between gap-12">
          {/* Left - Social Proof */}
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3">
              {[
                "/manus-storage/investor-1_7966a08a.jpg",
                "/manus-storage/investor-2_ff152502.jpg",
                "/manus-storage/investor-3_84ffeac2.jpg",
                "/manus-storage/investor-4_ecaa8659.jpg",
                "/manus-storage/investor-5_b7c66885.jpg"
              ].map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`Investor ${i + 1}`}
                  className="w-14 h-14 rounded-full border-2 border-slate-900 object-cover"
                />
              ))}
            </div>
            <div>
              <p className="text-white font-semibold text-xl">500+ Investoren vertrauen uns</p>
            </div>
          </div>

          {/* Right - Trust Badges */}
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-3 text-slate-300">
              <Lock className="h-7 w-7 text-teal-400" />
              <span className="font-medium text-lg">SSL verschlüsselt</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <Flag className="h-7 w-7 text-red-600" />
              <span className="font-medium text-lg">Schweizer Datenschutz</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <CreditCard className="h-7 w-7 text-indigo-400" />
              <span className="font-medium text-lg">Stripe Payment</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
