import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Newspaper, 
  Shield, 
  Zap,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

export default function Landing() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      setLocation('/dashboard');
    } else {
      setLocation('/registration');
    }
  };

  const features = [
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Live-Tracking",
      description: "Verfolgen Sie Ihr Portfolio in Echtzeit mit aktuellen Kursen und Performance-Metriken"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Fundamentalanalyse",
      description: "Detaillierte Kennzahlen wie P/E, PEG, Dividendenrendite und Wachstumsprognosen"
    },
    {
      icon: <PieChart className="w-6 h-6" />,
      title: "KI-Portfolio-Optimierung",
      description: "Intelligente Empfehlungen zur Diversifikation und Risikominimierung"
    },
    {
      icon: <Newspaper className="w-6 h-6" />,
      title: "News & Sentiment",
      description: "Aktuelle Nachrichten und KI-gestützte Sentiment-Analyse für Ihre Aktien"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Schweizer Steuerrechner",
      description: "Berechnen Sie Kapitalertragssteuern nach Kanton und Religion"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Automatische Updates",
      description: "Tägliche Aktualisierung aller Kurse, Kennzahlen und Nachrichten"
    }
  ];

  const benefits = [
    "Unbegrenzte Portfolios und Aktien",
    "Echtzeit-Kursdaten von Finnhub",
    "KI-gestützte Marktanalyse",
    "Export als PDF-Report",
    "Schweizer Steuerberechnung",
    "Responsive Design für Mobile & Desktop"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-teal-400" />
              <span className="font-bold text-xl text-white">Portfolio Analyzer</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#analysen" className="text-slate-300 hover:text-white transition-colors">Analysen</a>
              <a href="#funktionen" className="text-slate-300 hover:text-white transition-colors">Funktionen</a>
              <a href="#pricing" className="text-slate-300 hover:text-white transition-colors">Preise</a>
              <a href="#about" className="text-slate-300 hover:text-white transition-colors">Über uns</a>
              <a href="/login" className="text-slate-300 hover:text-white transition-colors font-medium">Anmelden</a>
              <Button onClick={() => setLocation('/registration')} variant="outline" className="border-2 border-teal-500 bg-transparent hover:bg-teal-500/10 text-teal-400">
                Konto erstellen
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left: Hero Text */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight">
                Optimiere dein <span className="text-teal-400">Aktienportfolio</span> mit KI-gestützter Analyse
              </h1>
              <p className="text-xl text-slate-300 leading-relaxed">
                Live-Tracking, Fundamentalanalyse und intelligente Optimierungsempfehlungen für Schweizer Investoren
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                onClick={handleGetStarted} 
                size="lg" 
                className="bg-teal-500 hover:bg-teal-600 text-white text-lg px-8 py-6"
              >
                Jetzt starten <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                onClick={() => setLocation('/pricing')} 
                size="lg" 
                variant="outline" 
                className="border-white/20 text-white hover:bg-white/10 text-lg px-8 py-6"
              >
                Mehr erfahren
              </Button>
            </div>

            <div className="flex items-center gap-8 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-400" />
                <span>Kostenlos testen</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-teal-400" />
                <span>Keine Kreditkarte nötig</span>
              </div>
            </div>
          </div>

          {/* Right: Portfolio Preview Card */}
          <div className="relative">
            <div className="absolute inset-0 bg-teal-500/20 blur-3xl rounded-full"></div>
            <Card className="relative bg-slate-900/80 border-white/10 backdrop-blur-sm overflow-hidden">
              <div className="bg-gradient-to-r from-teal-500/20 to-blue-500/20 px-6 py-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-teal-400" />
                  <span className="font-semibold text-white">Portfolio</span>
                </div>
              </div>
              <CardContent className="p-6 space-y-6">
                <div>
                  <p className="text-sm text-slate-400 mb-2">Current Balance</p>
                  <p className="text-4xl font-bold text-white">CHF 235'000.50</p>
                  <p className="text-teal-400 text-lg font-medium mt-1">+4.5%</p>
                </div>

                {/* Mini Chart Visualization */}
                <div className="h-32 relative">
                  <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="rgb(20, 184, 166)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="rgb(20, 184, 166)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0 80 L 50 70 L 100 75 L 150 60 L 200 55 L 250 45 L 300 35 L 350 30 L 400 20"
                      fill="none"
                      stroke="rgb(20, 184, 166)"
                      strokeWidth="2"
                    />
                    <path
                      d="M 0 80 L 50 70 L 100 75 L 150 60 L 200 55 L 250 45 L 300 35 L 350 30 L 400 20 L 400 100 L 0 100 Z"
                      fill="url(#chartGradient)"
                    />
                  </svg>
                </div>

                {/* Asset Allocation */}
                <div className="space-y-3">
                  <p className="text-sm text-slate-400 font-medium">Asset Allocation</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-teal-400"></div>
                        <span className="text-slate-300">Aktien 60%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                        <span className="text-slate-300">ETFs 40%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance YTD */}
                <div className="bg-slate-800/50 rounded-lg p-4 border border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Performance YTD</span>
                    <span className="text-teal-400 font-semibold">+8.5%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Leistungsstarke Features</h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Alles was Sie brauchen, um Ihr Portfolio professionell zu analysieren und zu optimieren
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="bg-slate-800/50 border-white/10 hover:border-teal-500/50 transition-all duration-300">
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                  <p className="text-slate-300 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="about" className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-4xl font-bold text-white">Warum Portfolio Analyzer?</h2>
              <p className="text-xl text-slate-300 leading-relaxed">
                Professionelle Portfolio-Analyse war noch nie so einfach. Nutzen Sie die Kraft von KI und Echtzeit-Daten für bessere Investitionsentscheidungen.
              </p>
              <div className="space-y-3">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0" />
                    <span className="text-slate-200">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-teal-500/20 to-teal-500/5 border-teal-500/30 p-6">
                <div className="text-4xl font-bold text-white mb-2">24/7</div>
                <div className="text-slate-300">Live Tracking</div>
              </Card>
              <Card className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-blue-500/30 p-6">
                <div className="text-4xl font-bold text-white mb-2">50+</div>
                <div className="text-slate-300">Kennzahlen</div>
              </Card>
              <Card className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border-purple-500/30 p-6">
                <div className="text-4xl font-bold text-white mb-2">AI</div>
                <div className="text-slate-300">Powered</div>
              </Card>
              <Card className="bg-gradient-to-br from-pink-500/20 to-pink-500/5 border-pink-500/30 p-6">
                <div className="text-4xl font-bold text-white mb-2">CHF</div>
                <div className="text-slate-300">Steuerrechner</div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Einfache, transparente Preise</h2>
            <p className="text-xl text-slate-300">Starten Sie kostenlos und upgraden Sie, wenn Sie bereit sind</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Plan */}
            <Card className="bg-slate-800/50 border-white/10 p-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Free</h3>
                  <div className="text-4xl font-bold text-white mb-1">CHF 0</div>
                  <p className="text-slate-400">Für Einsteiger</p>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">1 Portfolio</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">Bis zu 10 Aktien</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">Basis-Kennzahlen</span>
                  </li>
                </ul>
                <Button onClick={handleGetStarted} variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
                  Jetzt starten
                </Button>
              </div>
            </Card>

            {/* Pro Plan */}
            <Card className="bg-gradient-to-br from-teal-500/20 to-teal-500/5 border-teal-500/50 p-8 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-teal-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                Beliebt
              </div>
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
                  <div className="text-4xl font-bold text-white mb-1">CHF 19</div>
                  <p className="text-slate-400">pro Monat</p>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">Unbegrenzte Portfolios</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">Unbegrenzte Aktien</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">Alle Features</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">KI-Optimierung</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">Priority Support</span>
                  </li>
                </ul>
                <Button onClick={handleGetStarted} className="w-full bg-teal-500 hover:bg-teal-600 text-white">
                  Upgrade auf Pro
                </Button>
              </div>
            </Card>

            {/* Enterprise Plan */}
            <Card className="bg-slate-800/50 border-white/10 p-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Enterprise</h3>
                  <div className="text-4xl font-bold text-white mb-1">Custom</div>
                  <p className="text-slate-400">Für Teams</p>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">Alles aus Pro</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">Team-Zugang</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">API-Zugang</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">Dedicated Support</span>
                  </li>
                </ul>
                <Button onClick={() => setLocation('/kontakt')} variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
                  Kontakt aufnehmen
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="bg-gradient-to-r from-teal-500/20 to-blue-500/20 border-teal-500/30 p-12 text-center">
            <div className="max-w-3xl mx-auto space-y-6">
              <h2 className="text-4xl font-bold text-white">Bereit, Ihr Portfolio zu optimieren?</h2>
              <p className="text-xl text-slate-300">
                Starten Sie jetzt kostenlos und erleben Sie die Kraft von KI-gestützter Portfolio-Analyse
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  onClick={handleGetStarted} 
                  size="lg" 
                  className="bg-teal-500 hover:bg-teal-600 text-white text-lg px-8 py-6"
                >
                  Kostenlos starten <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button 
                  onClick={() => setLocation('/pricing')} 
                  size="lg" 
                  variant="outline" 
                  className="border-white/20 text-white hover:bg-white/10 text-lg px-8 py-6"
                >
                  Demo ansehen
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-950/50 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-teal-400" />
                <span className="font-bold text-xl text-white">Portfolio Analyzer</span>
              </div>
              <p className="text-slate-400 text-sm">
                Professionelle Portfolio-Analyse für Schweizer Investoren
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Produkt</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Ressourcen</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Dokumentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li><a href="/datenschutz" className="hover:text-white transition-colors">Datenschutz</a></li>
                <li><a href="/agb" className="hover:text-white transition-colors">AGB</a></li>
                <li><a href="/impressum" className="hover:text-white transition-colors">Impressum</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-12 pt-8 text-center text-slate-400 text-sm">
            <p>&copy; 2025 Portfolio Analyzer. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
