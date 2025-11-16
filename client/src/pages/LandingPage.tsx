import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, PieChart, Calendar, Sparkles, BarChart3, Shield, Zap, Users } from "lucide-react";
import { APP_LOGO, APP_TITLE } from "@/const";
import { useState, useEffect } from "react";
import WelcomeModal from "@/components/WelcomeModal";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

export default function LandingPage() {
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  const handleGetStarted = () => {
    window.location.href = "/register";
  };

  const handleLogin = () => {
    window.location.href = "/login";
  };

  const handleDemoClick = () => {
    setShowWelcomeModal(true);
  };

  const handleCreateDemo = () => {
    setShowWelcomeModal(false);
    // Redirect to dashboard/optimizer where users can create portfolios
    window.location.href = "/dashboard";
  };

  const handleStartTour = () => {
    setShowWelcomeModal(false);
    // Redirect to dashboard/optimizer for creating own portfolio
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
            <span className="text-xl font-bold text-gray-900">{APP_TITLE}</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={handleDemoClick}>
              Demo ansehen
            </Button>
            <Button variant="outline" onClick={handleLogin}>
              Login
            </Button>
            <Button onClick={handleGetStarted}>
              Jetzt starten
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-5xl font-bold text-gray-900 leading-tight">
            Intelligentes Portfolio-Management für <span className="text-primary">smarte Investoren</span>
          </h1>
          <p className="text-xl text-gray-600">
            Optimieren Sie Ihre Investments mit Echtzeit-Daten, KI-gestützten Analysen und professionellen Tools. 
            Alles, was Sie für erfolgreiches Portfolio-Management brauchen – an einem Ort.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" onClick={handleGetStarted} className="text-lg px-8">
              Kostenlos starten
            </Button>
            <Button size="lg" variant="outline" onClick={handleDemoClick} className="text-lg px-8">
              Demo Portfolio ansehen
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Alles, was Sie brauchen</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Professionelle Tools und Analysen, die sonst nur institutionellen Investoren vorbehalten sind
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={<TrendingUp className="h-8 w-8 text-primary" />}
            title="Echtzeit-Kursdaten"
            description="Aktuelle Kurse, News und Fundamentaldaten von führenden Finanzmarkt-APIs. Immer auf dem neuesten Stand."
          />
          <FeatureCard
            icon={<PieChart className="h-8 w-8 text-primary" />}
            title="Portfolio-Optimierung"
            description="Wissenschaftlich fundierte Optimierung nach Markowitz-Theorie. Maximieren Sie Rendite bei minimalem Risiko."
          />
          <FeatureCard
            icon={<Calendar className="h-8 w-8 text-primary" />}
            title="Automatische Dividenden"
            description="Nie wieder Dividenden verpassen. Automatische Erfassung und Tracking für alle Ihre Positionen."
          />
          <FeatureCard
            icon={<Sparkles className="h-8 w-8 text-primary" />}
            title="KI-Analysen"
            description="Intelligente Portfolio-Analysen, Markt-Sentiment und personalisierte Empfehlungen durch künstliche Intelligenz."
          />
          <FeatureCard
            icon={<BarChart3 className="h-8 w-8 text-primary" />}
            title="Professionelle Charts"
            description="Interaktive Visualisierungen für Performance, Asset Allocation und historische Entwicklung."
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8 text-primary" />}
            title="Steuer-Reporting"
            description="Jahresübersicht mit realisierten Gewinnen und Dividenden für Ihre Steuererklärung."
          />
        </div>
      </section>

      {/* Screenshots Section */}
      <section className="container mx-auto px-4 py-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Sehen Sie selbst</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Professionelle Tools und intuitive Bedienung in einer modernen Oberfläche
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <div className="space-y-4">
            <img 
              src="/screenshot-portfolio-overview.png" 
              alt="Portfolio Übersicht" 
              className="rounded-lg shadow-2xl border border-gray-200 w-full hover:scale-105 transition-transform duration-300"
            />
            <div className="text-center">
              <h3 className="font-semibold text-lg text-gray-900">Portfolio Übersicht</h3>
              <p className="text-sm text-gray-600">Alle Ihre Investments auf einen Blick</p>
            </div>
          </div>

          <div className="space-y-4">
            <img 
              src="/screenshot-optimizer.png" 
              alt="Portfolio Optimizer" 
              className="rounded-lg shadow-2xl border border-gray-200 w-full hover:scale-105 transition-transform duration-300"
            />
            <div className="text-center">
              <h3 className="font-semibold text-lg text-gray-900">Portfolio Optimizer</h3>
              <p className="text-sm text-gray-600">Wissenschaftlich fundierte Optimierung</p>
            </div>
          </div>

          <div className="space-y-4">
            <img 
              src="/screenshot-live-tracking.png" 
              alt="Live Tracking" 
              className="rounded-lg shadow-2xl border border-gray-200 w-full hover:scale-105 transition-transform duration-300"
            />
            <div className="text-center">
              <h3 className="font-semibold text-lg text-gray-900">Live Tracking</h3>
              <p className="text-sm text-gray-600">Echtzeit Performance-Tracking</p>
            </div>
          </div>

          <div className="space-y-4">
            <img 
              src="/screenshot-dividends.png" 
              alt="Dividenden Kalender" 
              className="rounded-lg shadow-2xl border border-gray-200 w-full hover:scale-105 transition-transform duration-300"
            />
            <div className="text-center">
              <h3 className="font-semibold text-lg text-gray-900">Dividenden Kalender</h3>
              <p className="text-sm text-gray-600">Automatisches Dividenden-Tracking</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">So einfach geht's</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              In wenigen Schritten zu Ihrem optimierten Portfolio
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <StepCard
              number="1"
              title="Aktien auswählen"
              description="Fügen Sie Ihre gewünschten Aktien hinzu oder nutzen Sie unsere Suchfunktion für Empfehlungen."
            />
            <StepCard
              number="2"
              title="Portfolio optimieren"
              description="Wählen Sie Ihre Strategie (Max. Sharpe, Min. Volatilität) und lassen Sie den Algorithmus die optimale Gewichtung berechnen."
            />
            <StepCard
              number="3"
              title="Live tracken"
              description="Aktivieren Sie Live-Tracking für automatische Performance-Berechnung, Dividenden und Transaktionshistorie."
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto text-center">
          <div>
            <div className="text-4xl font-bold text-primary mb-2">99.9%</div>
            <div className="text-gray-600">Uptime Garantie</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary mb-2">24/7</div>
            <div className="text-gray-600">Echtzeit-Daten</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-primary mb-2">50+</div>
            <div className="text-gray-600">Metriken & KPIs</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Bereit, Ihr Portfolio zu optimieren?</h2>
          <p className="text-xl mb-8 opacity-90">
            Starten Sie jetzt kostenlos und erleben Sie professionelles Portfolio-Management
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" variant="secondary" onClick={handleGetStarted} className="text-lg px-8">
              Jetzt kostenlos starten
            </Button>
            <Button size="lg" variant="outline" onClick={handleDemoClick} className="text-lg px-8 bg-transparent border-white text-white hover:bg-white/10">
              Demo ansehen
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-6 w-6" />}
                <span className="text-white font-bold">{APP_TITLE}</span>
              </div>
              <p className="text-sm">
                Professionelles Portfolio-Management für smarte Investoren
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Produkt</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Preise</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Demo</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Unternehmen</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Über uns</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Kontakt</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Datenschutz</a></li>
                <li><a href="#" className="hover:text-white transition-colors">AGB</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Impressum</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
            <p>© 2025 {APP_TITLE}. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>

      {/* Welcome Modal */}
      <WelcomeModal
        open={showWelcomeModal}
        onClose={() => setShowWelcomeModal(false)}
        onCreateDemo={handleCreateDemo}
        onStartTour={handleStartTour}
      />
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="border-2 hover:border-primary/50 transition-colors">
      <CardHeader>
        <div className="mb-2">{icon}</div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
