import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrendingUp, Activity, Bell, Lock, Flag, CreditCard, ChevronRight, BarChart2, Zap, Shield } from "lucide-react";
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
      <nav className="relative border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-teal-400" />
              <span className="text-xl font-bold text-white">Portfoliomanager</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-slate-300 hover:text-teal-400 transition-colors">Funktionen</a>
              <Link href="/pricing" className="text-slate-300 hover:text-teal-400 transition-colors cursor-pointer">
                Preise
              </Link>
              <a href="#how-it-works" className="text-slate-300 hover:text-teal-400 transition-colors">Wie es funktioniert</a>
              <a href="#about" className="text-slate-300 hover:text-teal-400 transition-colors">Über uns</a>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800">
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-teal-500 hover:bg-teal-600 text-white font-semibold px-6 shadow-lg shadow-teal-500/30">
                  Registrieren
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
              Optimieren Sie Ihr<br />
              Aktienportfolio mit<br />
              KI-gestützter Analyse
            </h1>
            <p className="text-2xl text-slate-300 leading-relaxed">
              Live-Tracking, Fundamentalanalyse und<br />
              automatische Alerts für Schweizer Investoren
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/register">
                <Button
                  size="lg"
                  className="bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold text-lg px-8 py-6 rounded-full shadow-xl shadow-teal-500/40 hover:shadow-teal-500/60 transition-all"
                >
                  Kostenlos starten
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:text-white hover:border-teal-400 bg-transparent text-lg px-8 py-6 rounded-full"
                >
                  Wie es funktioniert
                </Button>
              </a>
            </div>
          </div>

          {/* Right Column - Dashboard Preview Mockup — N-01: Demo-Hinweis */}
          <div className="relative z-10">
            <div className="absolute inset-0 bg-teal-500/20 blur-3xl rounded-full -z-10"></div>
            {/* N-01: Demo badge */}
            <div className="absolute -top-3 -right-3 z-20 bg-amber-500 text-amber-950 text-xs font-bold px-3 py-1 rounded-full shadow-lg">
              Demo-Vorschau
            </div>
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

              {/* Portfolio Value — N-01: Demo label */}
              <div className="mb-6">
                <p className="text-sm text-slate-400 mb-1">Current Balance <span className="text-amber-400 text-xs">(Demo)</span></p>
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

      {/* How it works — N-03 */}
      <section id="how-it-works" className="relative container mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Wie es funktioniert</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">In drei Schritten zu Ihrem optimierten Portfolio</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-10 left-1/3 right-1/3 h-0.5 bg-teal-500/30"></div>
          {[
            {
              step: "01",
              icon: Shield,
              title: "Anlageprofil erstellen",
              desc: "Definieren Sie Ihre Ziele, Risikobereitschaft und Anlagehorizont in wenigen Minuten.",
            },
            {
              step: "02",
              icon: Zap,
              title: "KI-Portfolio generieren",
              desc: "Unser Algorithmus erstellt einen massgeschneiderten Portfoliovorschlag basierend auf aktuellen Marktdaten.",
            },
            {
              step: "03",
              icon: BarChart2,
              title: "Verfolgen & optimieren",
              desc: "Behalten Sie Ihre Performance im Blick und erhalten Sie KI-gestützte Optimierungsempfehlungen.",
            },
          ].map((item) => (
            <div key={item.step} className="flex flex-col items-center text-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
                  <item.icon className="h-9 w-9 text-teal-400" />
                </div>
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-teal-500 text-slate-900 text-xs font-bold flex items-center justify-center">
                  {item.step}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white">{item.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link href="/register">
            <Button className="bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold px-8 py-4 rounded-full shadow-xl shadow-teal-500/40">
              Jetzt kostenlos starten <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature Cards — N-02: "Mehr erfahren" links to real anchors */}
      <section id="features" className="relative container mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Alle Funktionen auf einen Blick</h2>
        </div>
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
              Erstellen und optimieren Sie Ihr Portfolio basierend auf modernsten KI-Modellen und Risikoprofilen.
            </p>
            <Link href="/register" className="text-teal-400 hover:text-teal-300 font-semibold inline-flex items-center gap-2">
              Jetzt starten <ChevronRight className="h-4 w-4" />
            </Link>
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
              Verfolgen Sie die Performance Ihres gesamten Portfolios in Echtzeit und erhalten Sie sofortige Updates.
            </p>
            <Link href="/register" className="text-teal-400 hover:text-teal-300 font-semibold inline-flex items-center gap-2">
              Mehr erfahren <ChevronRight className="h-4 w-4" />
            </Link>
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
              Setzen Sie individuelle Alarme für Preisänderungen, News und technische Indikatoren.
            </p>
            <Link href="/register" className="text-teal-400 hover:text-teal-300 font-semibold inline-flex items-center gap-2">
              Mehr erfahren <ChevronRight className="h-4 w-4" />
            </Link>
          </Card>
        </div>
      </section>

      {/* Trust Section */}
      <section id="about" className="relative container mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-7 w-7 text-teal-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-xl">Für Schweizer Privatanleger entwickelt</p>
              <p className="text-slate-400 text-sm">CHF-first · Fundamentaldaten · KI-gestützte Analyse</p>
            </div>
          </div>

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
              <span className="font-medium text-lg">Sichere Zahlung (Stripe)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer — N-04: AGB, Datenschutz, Impressum */}
      <footer className="relative border-t border-slate-700/50 bg-slate-900/80 backdrop-blur-sm mt-8">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal-400" />
              <span className="text-slate-400 text-sm font-medium">© 2026 portfolio.mw — Alle Rechte vorbehalten</span>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm text-slate-400">
              <Link href="/agb" className="hover:text-teal-400 transition-colors">AGB</Link>
              <Link href="/datenschutz" className="hover:text-teal-400 transition-colors">Datenschutz</Link>
              <Link href="/impressum" className="hover:text-teal-400 transition-colors">Impressum</Link>
              <Link href="/pricing" className="hover:text-teal-400 transition-colors">Preise</Link>
              <a href="mailto:support@portfolio.mw" className="hover:text-teal-400 transition-colors">Kontakt</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
