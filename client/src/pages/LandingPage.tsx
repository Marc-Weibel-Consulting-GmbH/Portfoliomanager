import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Activity, Bell, PieChart, Calendar, Sparkles, BarChart3, Shield, Check, Users, Lock } from "lucide-react";
import { APP_LOGO, APP_TITLE } from "@/const";
import { useState } from "react";
import WelcomeModal from "@/components/WelcomeModal";
import GuidedTourModal from "@/components/GuidedTourModal";
import { useAuth } from "@/_core/hooks/useAuth";

export default function LandingPage() {
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showGuidedTour, setShowGuidedTour] = useState(false);
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

  const handleDemoClick = () => {
    setShowWelcomeModal(true);
  };

  const handleCreateDemo = () => {
    setShowWelcomeModal(false);
    window.location.href = "/dashboard";
  };

  const handleStartTour = () => {
    setShowWelcomeModal(false);
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
            <span className="text-xl font-bold text-white">{APP_TITLE}</span>
          </div>
          <div className="hidden md:flex gap-8 items-center">
            <a href="#features" className="text-slate-300 hover:text-teal-400 transition-colors">Features</a>
            <a href="/pricing" className="text-slate-300 hover:text-teal-400 transition-colors">Pricing</a>
            <a href="/kontakt" className="text-slate-300 hover:text-teal-400 transition-colors">About</a>
          </div>
          <div className="flex gap-3">
            {!isAuthenticated && (
              <>
                <Button variant="ghost" onClick={handleLogin} className="text-slate-300 hover:text-white hover:bg-slate-800">
                  Login
                </Button>
                <Button onClick={handleGetStarted} className="bg-teal-500 hover:bg-teal-600 text-white">
                  Get Started
                </Button>
              </>
            )}
            {isAuthenticated && (
              <Button onClick={() => window.location.href = "/dashboard"} className="bg-teal-500 hover:bg-teal-600 text-white">
                Zum Dashboard
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text Content */}
          <div className="space-y-8">
            <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight">
              Optimiere dein <br />
              <span className="text-teal-400">Aktienportfolio</span> mit <br />
              KI-gestützter Analyse
            </h1>
            <p className="text-xl text-slate-300 leading-relaxed">
              Live-Tracking, Fundamentalanalyse und automatische Alerts für Schweizer Investoren
            </p>
            <div className="flex gap-4">
              <Button 
                size="lg" 
                onClick={handleGetStarted} 
                className="bg-teal-500 hover:bg-teal-600 text-white text-lg px-8 py-6"
              >
                Kostenlos starten
              </Button>
            </div>
          </div>

          {/* Right: Dashboard Preview */}
          <div className="relative">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
              {/* Mock Dashboard Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-teal-400" />
                  <span className="text-white font-semibold">Portfolio</span>
                </div>
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30"></div>
                  <div className="w-8 h-8 rounded-full bg-slate-700"></div>
                </div>
              </div>

              {/* Mock Value Display */}
              <div className="mb-6">
                <div className="text-sm text-slate-400 mb-1">Current balance</div>
                <div className="text-3xl font-bold text-white mb-1">CHF 235'000.50</div>
                <div className="text-sm text-teal-400">+14.5%</div>
              </div>

              {/* Mock Chart */}
              <div className="h-32 bg-gradient-to-t from-teal-500/20 to-transparent rounded-lg mb-6 relative overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                  <path
                    d="M0,80 Q30,70 60,75 T120,65 T180,55 T240,45 T300,35"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-teal-400"
                  />
                  <path
                    d="M0,80 Q30,70 60,75 T120,65 T180,55 T240,45 T300,35 L300,100 L0,100 Z"
                    fill="url(#gradient)"
                    className="text-teal-500"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" className="text-teal-500" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-teal-500" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              {/* Mock Asset Allocation */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-2">Asset Allocation</div>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500" style={{ width: '65%' }}></div>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-2">Performance YTD</div>
                  <div className="text-lg font-semibold text-teal-400">+8.6%</div>
                </div>
              </div>
            </div>

            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-teal-500/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section id="features" className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<TrendingUp className="h-10 w-10 text-teal-400" />}
            title="Portfolio-Builder"
            description="Erstelle und optimiere dein Portfolio basierend auf modernsten KI-Modellen und Risikoprofilen."
            link="#"
          />
          <FeatureCard
            icon={<Activity className="h-10 w-10 text-teal-400" />}
            title="Live-Tracking"
            description="Verfolge die Performance deines gesamten Portfolios in Echtzeit und erhalte sofortige Updates."
            link="#"
          />
          <FeatureCard
            icon={<Bell className="h-10 w-10 text-teal-400" />}
            title="Preisalarme"
            description="Setze individuelle Alarme für Preisänderungen, News und technische Indikatoren."
            link="#"
          />
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="container mx-auto px-4 py-12">
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8">
          <div className="flex flex-wrap items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-teal-400" />
              <div>
                <div className="text-2xl font-bold text-white">500+</div>
                <div className="text-sm text-slate-400">Investoren vertrauen uns</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-teal-400" />
              <span className="text-slate-300">SSL verschlüsselt</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-400" />
              <span className="text-slate-300">🇨🇭 Schweizer Datenschutz</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">💳</span>
              <span className="text-slate-300">Stripe Payment</span>
            </div>
          </div>
        </div>
      </section>

      {/* Extended Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Alles, was Sie brauchen</h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Professionelle Tools und Analysen, die sonst nur institutionellen Investoren vorbehalten sind
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ExtendedFeatureCard
            icon={<PieChart className="h-8 w-8 text-teal-400" />}
            title="Portfolio-Optimierung"
            description="Wissenschaftlich fundierte Optimierung nach Markowitz-Theorie. Maximieren Sie Rendite bei minimalem Risiko."
          />
          <ExtendedFeatureCard
            icon={<Calendar className="h-8 w-8 text-teal-400" />}
            title="Automatische Dividenden"
            description="Nie wieder Dividenden verpassen. Automatische Erfassung und Tracking für alle Ihre Positionen."
          />
          <ExtendedFeatureCard
            icon={<Sparkles className="h-8 w-8 text-teal-400" />}
            title="KI-Analysen"
            description="Intelligente Portfolio-Analysen, Markt-Sentiment und personalisierte Empfehlungen durch künstliche Intelligenz."
          />
          <ExtendedFeatureCard
            icon={<BarChart3 className="h-8 w-8 text-teal-400" />}
            title="Professionelle Charts"
            description="Interaktive Visualisierungen für Performance, Asset Allocation und historische Entwicklung."
          />
          <ExtendedFeatureCard
            icon={<Shield className="h-8 w-8 text-teal-400" />}
            title="Steuer-Reporting"
            description="Jahresübersicht mit realisierten Gewinnen und Dividenden für Ihre Steuererklärung."
          />
          <ExtendedFeatureCard
            icon={<TrendingUp className="h-8 w-8 text-teal-400" />}
            title="Echtzeit-Kursdaten"
            description="Aktuelle Kurse, News und Fundamentaldaten von führenden Finanzmarkt-APIs."
          />
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Was unsere Nutzer sagen</h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Tausende Investoren vertrauen bereits auf unsere Plattform
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <TestimonialCard
            quote="Die Portfolio-Optimierung hat meine Rendite um 15% gesteigert. Endlich verstehe ich, wie professionelles Asset Management funktioniert."
            author="Michael S."
            role="Private Investor"
          />
          <TestimonialCard
            quote="Das automatische Dividenden-Tracking spart mir Stunden an Arbeit. Ich verpasse keine Ausschüttung mehr und habe alles für die Steuererklärung bereit."
            author="Sarah K."
            role="Dividenden-Investorin"
          />
          <TestimonialCard
            quote="Die Echtzeit-Performance-Analyse gibt mir volle Kontrolle über meine Investments. Ich kann jederzeit sehen, wie mein Portfolio performt."
            author="Thomas B."
            role="Aktiver Trader"
          />
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Einfache, transparente Preise</h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Starten Sie kostenlos und upgraden Sie, wenn Sie mehr Features benötigen
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <PricingCard
            title="Free"
            price="CHF 0"
            period="kostenlos"
            features={[
              "1 Demo-Portfolio",
              "Basis Portfolio-Optimierung",
              "3 Analysen pro Tag",
              "Echtzeit-Kursdaten",
              "Community Support"
            ]}
            cta="Kostenlos starten"
            onCtaClick={handleGetStarted}
            highlighted={false}
          />
          <PricingCard
            title="Premium"
            price="CHF 10"
            period="pro Monat"
            features={[
              "Unbegrenzte Portfolios",
              "Live Performance-Tracking",
              "Automatische Dividenden",
              "Steuer-Reporting",
              "KI-gestützte Analysen",
              "WhatsApp Alerts",
              "Priority Support"
            ]}
            cta="Jetzt upgraden"
            onCtaClick={handleGetStarted}
            highlighted={true}
          />
        </div>

        <div className="text-center mt-8">
          <a href="/pricing" className="text-teal-400 hover:text-teal-300 font-medium">
            Alle Features im Detail ansehen →
          </a>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-teal-600 to-teal-500 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Bereit, Ihr Portfolio zu optimieren?</h2>
          <p className="text-xl text-teal-50 mb-8">
            Starten Sie jetzt kostenlos und erleben Sie professionelles Portfolio-Management
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg" 
              variant="secondary" 
              onClick={handleGetStarted} 
              className="text-lg px-8 bg-white text-teal-600 hover:bg-slate-100"
            >
              Jetzt kostenlos starten
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={handleDemoClick} 
              className="text-lg px-8 bg-transparent border-white text-white hover:bg-white/10"
            >
              Demo ansehen
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-800">
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
                <li><a href="#features" className="hover:text-teal-400 transition-colors">Features</a></li>
                <li><a href="/pricing" className="hover:text-teal-400 transition-colors">Preise</a></li>
                <li><a href="/" onClick={handleDemoClick} className="hover:text-teal-400 transition-colors cursor-pointer">Demo</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Unternehmen</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/kontakt" className="hover:text-teal-400 transition-colors">Kontakt</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="/datenschutz" className="hover:text-teal-400 transition-colors">Datenschutz</a></li>
                <li><a href="/agb" className="hover:text-teal-400 transition-colors">AGB</a></li>
                <li><a href="/impressum" className="hover:text-teal-400 transition-colors">Impressum</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
            <p>© 2025 {APP_TITLE}. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>

      {/* Welcome Modal */}
      <WelcomeModal
        open={showWelcomeModal}
        onOpenChange={setShowWelcomeModal}
        onCreateDemo={handleCreateDemo}
        onStartTour={handleStartTour}
      />
      <GuidedTourModal open={showGuidedTour} onOpenChange={setShowGuidedTour} />
    </div>
  );
}

function FeatureCard({ icon, title, description, link }: { icon: React.ReactNode; title: string; description: string; link: string }) {
  return (
    <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 hover:border-teal-500/50 transition-all group">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-slate-400 mb-4 leading-relaxed">{description}</p>
      <a href={link} className="text-teal-400 hover:text-teal-300 text-sm font-medium inline-flex items-center gap-1 group-hover:gap-2 transition-all">
        Mehr erfahren →
      </a>
    </div>
  );
}

function ExtendedFeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-slate-800/20 backdrop-blur-sm border border-slate-700/30 rounded-xl p-6 hover:border-teal-500/30 transition-all">
      <div className="mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function TestimonialCard({ quote, author, role }: { quote: string; author: string; role: string }) {
  return (
    <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
      <div className="mb-4">
        <svg className="h-8 w-8 text-teal-400 opacity-50" fill="currentColor" viewBox="0 0 32 32">
          <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
        </svg>
      </div>
      <p className="text-slate-300 mb-4 italic leading-relaxed">{quote}</p>
      <div>
        <div className="font-semibold text-white">{author}</div>
        <div className="text-sm text-slate-400">{role}</div>
      </div>
    </div>
  );
}

function PricingCard({ 
  title, 
  price, 
  period, 
  features, 
  cta, 
  onCtaClick, 
  highlighted 
}: { 
  title: string; 
  price: string; 
  period: string; 
  features: string[]; 
  cta: string; 
  onCtaClick: () => void;
  highlighted: boolean;
}) {
  return (
    <div className={`bg-slate-800/30 backdrop-blur-sm border rounded-2xl p-8 relative ${highlighted ? 'border-teal-500' : 'border-slate-700/50'}`}>
      {highlighted && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="bg-teal-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
            Beliebt
          </span>
        </div>
      )}
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
        <div className="mt-4">
          <span className="text-5xl font-bold text-white">{price}</span>
          <span className="text-slate-400 ml-2">{period}</span>
        </div>
      </div>
      <ul className="space-y-3 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <Check className="h-5 w-5 text-teal-400 mt-0.5 flex-shrink-0" />
            <span className="text-slate-300">{feature}</span>
          </li>
        ))}
      </ul>
      <Button 
        className={`w-full ${highlighted ? 'bg-teal-500 hover:bg-teal-600' : 'bg-slate-700 hover:bg-slate-600'}`}
        size="lg"
        onClick={onCtaClick}
      >
        {cta}
      </Button>
    </div>
  );
}
