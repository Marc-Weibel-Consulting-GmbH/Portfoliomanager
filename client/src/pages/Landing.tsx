import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TrendingUp, Activity, Bell, Lock, Shield } from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f1420] to-[#1a1f2e]">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-black/20">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/">
              <a className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity">
                <TrendingUp className="h-8 w-8 text-[#00CFC1]" />
                <span className="text-xl font-bold">Portfolio Analyzer</span>
              </a>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <Link href="#features">
                <a className="text-gray-300 hover:text-white transition-colors">Features</a>
              </Link>
              <Link href="#pricing">
                <a className="text-gray-300 hover:text-white transition-colors">Pricing</a>
              </Link>
              <Link href="#about">
                <a className="text-gray-300 hover:text-white transition-colors">About</a>
              </Link>
            </nav>

            {/* Auth Buttons */}
            <div className="flex items-center gap-4">
              <a href={getLoginUrl()}>
                <Button variant="ghost" className="text-white hover:bg-white/10">
                  Login
                </Button>
              </a>
              <Link href="/onboarding">
                <Button className="bg-[#00CFC1] hover:bg-[#00b8ad] text-black font-semibold">
                  Kostenlos starten
                </Button>
              </Link>
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
              <Link href="/onboarding">
                <Button size="lg" className="bg-[#00CFC1] hover:bg-[#00b8ad] text-black font-bold text-lg px-8 py-6">
                  Kostenlos starten
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: Dashboard Mockup */}
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden border border-[#00CFC1]/30 shadow-2xl shadow-[#00CFC1]/20">
              {/* Dashboard Preview Placeholder */}
              <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] p-6 aspect-[4/3]">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-6 w-6 text-[#00CFC1]" />
                      <span className="text-white font-semibold">Portfolio</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[#00CFC1]/20 border border-[#00CFC1]"></div>
                    </div>
                  </div>

                  {/* Value Card */}
                  <Card className="bg-gradient-to-br from-[#00CFC1]/10 to-transparent border-[#00CFC1]/30 p-4">
                    <div className="text-sm text-gray-400">Gesamtwert</div>
                    <div className="text-3xl font-bold text-white mt-1">CHF 235'000.50</div>
                    <div className="text-sm text-[#00CFC1] mt-1">+14.5% YTD</div>
                  </Card>

                  {/* Chart Placeholder */}
                  <div className="h-32 bg-gradient-to-t from-[#00CFC1]/20 to-transparent rounded-lg relative overflow-hidden">
                    <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
                      <path
                        d="M 0,80 L 50,70 L 100,75 L 150,60 L 200,50 L 250,55 L 300,40 L 350,35 L 400,30"
                        fill="none"
                        stroke="#00CFC1"
                        strokeWidth="2"
                      />
                      <path
                        d="M 0,80 L 50,70 L 100,75 L 150,60 L 200,50 L 250,55 L 300,40 L 350,35 L 400,30 L 400,120 L 0,120 Z"
                        fill="url(#gradient)"
                        opacity="0.3"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#00CFC1" stopOpacity="0.5" />
                          <stop offset="100%" stopColor="#00CFC1" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>

                  {/* Asset Allocation */}
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="bg-[#1a1f2e]/50 border-white/10 p-3">
                      <div className="text-xs text-gray-400">Aktien</div>
                      <div className="text-lg font-bold text-white">85%</div>
                    </Card>
                    <Card className="bg-[#1a1f2e]/50 border-white/10 p-3">
                      <div className="text-xs text-gray-400">Cash</div>
                      <div className="text-lg font-bold text-white">15%</div>
                    </Card>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-[#00CFC1]/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-[#00CFC1]/10 rounded-full blur-3xl"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1: Portfolio-Builder */}
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30 p-8 hover:border-[#00CFC1] transition-all duration-300 hover:shadow-lg hover:shadow-[#00CFC1]/20">
            <div className="w-14 h-14 rounded-lg bg-[#00CFC1]/20 flex items-center justify-center mb-6">
              <TrendingUp className="h-7 w-7 text-[#00CFC1]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Portfolio-Builder</h3>
            <p className="text-gray-300 leading-relaxed mb-6">
              Erstelle und optimiere dein Portfolio basierend auf modernsten KI-Modellen und Risikoprofilen.
            </p>
            <a href="#" className="text-[#00CFC1] hover:text-[#00b8ad] font-semibold inline-flex items-center gap-2">
              Mehr erfahren
              <span>→</span>
            </a>
          </Card>

          {/* Feature 2: Live-Tracking */}
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30 p-8 hover:border-[#00CFC1] transition-all duration-300 hover:shadow-lg hover:shadow-[#00CFC1]/20">
            <div className="w-14 h-14 rounded-lg bg-[#00CFC1]/20 flex items-center justify-center mb-6">
              <Activity className="h-7 w-7 text-[#00CFC1]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Live-Tracking</h3>
            <p className="text-gray-300 leading-relaxed mb-6">
              Verfolge die Performance deines gesamten Portfolios in Echtzeit und erhalte sofortige Updates.
            </p>
            <a href="#" className="text-[#00CFC1] hover:text-[#00b8ad] font-semibold inline-flex items-center gap-2">
              Mehr erfahren
              <span>→</span>
            </a>
          </Card>

          {/* Feature 3: Preisalarme */}
          <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30 p-8 hover:border-[#00CFC1] transition-all duration-300 hover:shadow-lg hover:shadow-[#00CFC1]/20">
            <div className="w-14 h-14 rounded-lg bg-[#00CFC1]/20 flex items-center justify-center mb-6">
              <Bell className="h-7 w-7 text-[#00CFC1]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Preisalarme</h3>
            <p className="text-gray-300 leading-relaxed mb-6">
              Setze individuelle Alarme für Preisänderungen, News und technische Indikatoren.
            </p>
            <a href="#" className="text-[#00CFC1] hover:text-[#00b8ad] font-semibold inline-flex items-center gap-2">
              Mehr erfahren
              <span>→</span>
            </a>
          </Card>
        </div>
      </section>

      {/* Trust Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center space-y-8">
          {/* Trust Heading */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex -space-x-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00CFC1] to-[#00b8ad] border-2 border-[#0a0e1a]"></div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-[#0a0e1a]"></div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 border-2 border-[#0a0e1a]"></div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-pink-600 border-2 border-[#0a0e1a]"></div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 border-2 border-[#0a0e1a]"></div>
            </div>
            <p className="text-2xl font-semibold text-white">500+ Investoren vertrauen uns</p>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-8 pt-8">
            <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10">
              <Lock className="h-5 w-5 text-[#00CFC1]" />
              <span className="text-gray-300 font-medium">SSL verschlüsselt</span>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10">
              <Shield className="h-5 w-5 text-red-500" />
              <span className="text-gray-300 font-medium">Schweizer Datenschutz</span>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="#635BFF">
                <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"/>
              </svg>
              <span className="text-gray-300 font-medium">Stripe Payment</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20 mt-20">
        <div className="container mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-[#00CFC1]" />
                <span className="text-lg font-bold text-white">Portfolio Analyzer</span>
              </div>
              <p className="text-gray-400 text-sm">
                KI-gestützte Portfolio-Analyse für Schweizer Investoren
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold text-white mb-4">Produkt</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Dokumentation</a></li>
              </ul>
            </div>

            {/* Unternehmen */}
            <div>
              <h4 className="font-semibold text-white mb-4">Unternehmen</h4>
              <ul className="space-y-2">
                <li><a href="#about" className="text-gray-400 hover:text-white transition-colors">Über uns</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Kontakt</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Datenschutz</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold text-white mb-4">Rechtliches</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">AGB</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Impressum</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Cookie-Richtlinie</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-12 pt-8 text-center text-gray-400 text-sm">
            <p>&copy; 2025 Portfolio Analyzer. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
