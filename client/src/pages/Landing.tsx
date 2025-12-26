import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Activity, Bell, Lock, Shield, BarChart3, Zap, Users } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1420] to-[#1a1f2e]">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-black/20 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity">
              <TrendingUp className="h-8 w-8 text-[#00CFC1]" />
              <span className="text-xl font-bold">Portfolio Analyzer</span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-300 hover:text-white transition-colors">
                Funktionen
              </a>
              <a href="#pricing" className="text-gray-300 hover:text-white transition-colors">
                Preise
              </a>
              <a href="#about" className="text-gray-300 hover:text-white transition-colors">
                Über uns
              </a>
            </nav>

            {/* Auth Buttons */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" className="text-white hover:bg-white/10" asChild>
                <Link href="/login">
                  Login
                </Link>
              </Button>
              <Button className="bg-[#00CFC1] hover:bg-[#00b8ad] text-black font-semibold" asChild>
                <Link href="/onboarding">
                  Jetzt starten
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text Content */}
          <div className="space-y-8">
            <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight">
              Optimiere dein <br />
              <span className="text-[#00CFC1]">Aktienportfolio</span> mit <br />
              KI-gestützter Analyse
            </h1>
            <p className="text-xl text-gray-300 leading-relaxed">
              Live-Tracking, Fundamentalanalyse und automatische Alerts für Schweizer Investoren
            </p>
            <div>
              <Button size="lg" className="bg-[#00CFC1] hover:bg-[#00b8ad] text-black font-bold text-lg px-8 py-6 rounded-full" asChild>
                <Link href="/onboarding">
                  Kostenlos starten
                </Link>
              </Button>
            </div>
          </div>

          {/* Right: Dashboard Mockup */}
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden border border-[#00CFC1]/30 shadow-2xl shadow-[#00CFC1]/20 bg-gradient-to-br from-[#1a1f2e] to-[#0f1420]">
              {/* Dashboard Preview */}
              <div className="p-6 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-6 w-6 text-[#00CFC1]" />
                    <span className="text-white font-semibold text-lg">Portfolio</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-[#00CFC1]" />
                    <div className="w-8 h-8 rounded-full bg-[#00CFC1]/20 border border-[#00CFC1]"></div>
                  </div>
                </div>

                {/* Value Card */}
                <div className="bg-gradient-to-br from-[#00CFC1]/10 to-transparent border border-[#00CFC1]/30 rounded-xl p-4">
                  <div className="text-sm text-gray-400">Gesamtwert</div>
                  <div className="text-3xl font-bold text-white mt-1">CHF 235'000.50</div>
                  <div className="text-sm text-[#00CFC1] mt-1 flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    +14.5%
                  </div>
                </div>

                {/* Mini Chart */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#1a1f2e]/50 border border-white/10 rounded-lg p-3">
                    <div className="h-20 bg-gradient-to-t from-[#00CFC1]/30 to-transparent rounded relative">
                      <svg className="w-full h-full" viewBox="0 0 100 50" preserveAspectRatio="none">
                        <path
                          d="M 0,40 L 20,35 L 40,30 L 60,25 L 80,20 L 100,15"
                          fill="none"
                          stroke="#00CFC1"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">Performance YTD</div>
                    <div className="text-sm font-semibold text-[#00CFC1]">+8.5%</div>
                  </div>
                  <div className="bg-[#1a1f2e]/50 border border-white/10 rounded-lg p-3">
                    <div className="relative h-20">
                      <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#1a1f2e" strokeWidth="8" />
                        <circle
                          cx="50"
                          cy="50"
                          r="40"
                          fill="none"
                          stroke="#00CFC1"
                          strokeWidth="8"
                          strokeDasharray="251.2"
                          strokeDashoffset="62.8"
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">Asset Allocation</div>
                    <div className="text-sm font-semibold text-white">Diversifiziert</div>
                  </div>
                </div>

                {/* Watchlist Preview */}
                <div className="space-y-2">
                  <div className="text-xs text-gray-400">Watchlist</div>
                  {[
                    { ticker: "NOVN", price: "227.15", change: "+0.5%" },
                    { ticker: "NESN", price: "98.40", change: "+1.2%" },
                    { ticker: "UBS", price: "12.38", change: "-0.3%" },
                  ].map((stock) => (
                    <div key={stock.ticker} className="flex items-center justify-between bg-[#1a1f2e]/50 border border-white/10 rounded-lg p-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#00CFC1]/20 rounded"></div>
                        <span className="text-white text-sm font-medium">{stock.ticker}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-white text-sm">{stock.price}</div>
                        <div className={`text-xs ${stock.change.startsWith("+") ? "text-[#00CFC1]" : "text-red-400"}`}>
                          {stock.change}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Leistungsstarke Funktionen</h2>
          <p className="text-xl text-gray-400">Alles, was du für erfolgreiches Portfolio-Management brauchst</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1: Portfolio-Builder */}
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30 hover:border-[#00CFC1]/60 transition-all duration-300 hover:shadow-xl hover:shadow-[#00CFC1]/20">
            <CardHeader>
              <div className="w-12 h-12 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-[#00CFC1]" />
              </div>
              <CardTitle className="text-white text-xl">Portfolio-Builder</CardTitle>
              <CardDescription className="text-gray-400">
                Erstelle und optimiere dein Portfolio basierend auf modernsten KI-Modellen und Risikoprofilen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href="#" className="text-[#00CFC1] hover:text-[#00b8ad] font-medium inline-flex items-center gap-2">
                Mehr erfahren
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </CardContent>
          </Card>

          {/* Feature 2: Live-Tracking */}
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30 hover:border-[#00CFC1]/60 transition-all duration-300 hover:shadow-xl hover:shadow-[#00CFC1]/20">
            <CardHeader>
              <div className="w-12 h-12 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center mb-4">
                <Activity className="h-6 w-6 text-[#00CFC1]" />
              </div>
              <CardTitle className="text-white text-xl">Live-Tracking</CardTitle>
              <CardDescription className="text-gray-400">
                Verfolge die Performance deines gesamten Portfolios in Echtzeit und erhalte sofortige Updates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href="#" className="text-[#00CFC1] hover:text-[#00b8ad] font-medium inline-flex items-center gap-2">
                Mehr erfahren
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </CardContent>
          </Card>

          {/* Feature 3: Preisalarme */}
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30 hover:border-[#00CFC1]/60 transition-all duration-300 hover:shadow-xl hover:shadow-[#00CFC1]/20">
            <CardHeader>
              <div className="w-12 h-12 bg-[#00CFC1]/20 rounded-lg flex items-center justify-center mb-4">
                <Bell className="h-6 w-6 text-[#00CFC1]" />
              </div>
              <CardTitle className="text-white text-xl">Preisalarme</CardTitle>
              <CardDescription className="text-gray-400">
                Setze individuelle Alarme für Preisänderungen, News und technische Indikatoren.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href="#" className="text-[#00CFC1] hover:text-[#00b8ad] font-medium inline-flex items-center gap-2">
                Mehr erfahren
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border border-[#00CFC1]/20 rounded-2xl p-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Left: Trust Indicators */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-[#00CFC1]" />
                <span className="text-white font-semibold text-lg">500+ Investoren vertrauen uns</span>
              </div>
              <div className="flex items-center gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00CFC1]/30 to-[#00CFC1]/10 border border-[#00CFC1]/50"></div>
                ))}
              </div>
            </div>

            {/* Right: Security Badges */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-gray-300">
                <Lock className="h-5 w-5 text-[#00CFC1]" />
                <span className="text-sm font-medium">SSL verschlüsselt</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Shield className="h-5 w-5 text-[#00CFC1]" />
                <span className="text-sm font-medium">Schweizer Datenschutz</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#00CFC1">
                  <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 1.315 0 2.088.472 2.779 1.196l.671.736 1.697-1.697-.671-.736c-.806-.806-1.697-1.305-2.779-1.697V2h-2v1.305c-2.088.472-3.356 1.901-3.356 3.672 0 2.409 1.901 3.356 4.073 4.162 2.172.806 3.356 1.426 3.356 2.409 0 .831-.683 1.305-1.901 1.305-1.315 0-2.088-.472-2.779-1.196l-.671-.736-1.697 1.697.671.736c.806.806 1.697 1.305 2.779 1.697V22h2v-1.305c2.088-.472 3.356-1.901 3.356-3.672 0-2.409-1.901-3.356-4.073-4.162z"/>
                </svg>
                <span className="text-sm font-medium">Stripe Payment</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="bg-gradient-to-r from-[#00CFC1] to-[#00b8ad] rounded-2xl p-12 text-center">
          <h2 className="text-4xl font-bold text-black mb-4">Bereit, dein Portfolio zu optimieren?</h2>
          <p className="text-xl text-black/80 mb-8">
            Starte jetzt kostenlos und erhalte Zugriff auf alle Basis-Funktionen
          </p>
          <Link href="/onboarding">
            <Button size="lg" className="bg-black hover:bg-black/90 text-white font-bold text-lg px-8 py-6 rounded-full">
              Kostenlos starten
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-gray-400">
              <TrendingUp className="h-5 w-5 text-[#00CFC1]" />
              <span className="font-semibold">Portfolio Analyzer</span>
            </div>
            <div className="text-gray-400 text-sm">
              © 2024 Portfolio Analyzer. Alle Rechte vorbehalten.
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                Datenschutz
              </a>
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                AGB
              </a>
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                Impressum
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
