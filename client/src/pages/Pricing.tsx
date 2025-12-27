import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Sparkles, Shield, CreditCard } from "lucide-react";
import { APP_LOGO, APP_TITLE } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Pricing() {
  const { isAuthenticated } = useAuth();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      window.location.href = "/dashboard";
    } else {
      window.location.href = "/register";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <a href="/" className="flex items-center gap-3">
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8 rounded-lg" />}
            <span className="text-xl font-bold text-white">{APP_TITLE}</span>
          </a>
          <div className="flex gap-3">
            {!isAuthenticated && (
              <>
                <Button variant="outline" onClick={() => window.location.href = "/login"}>
                  Login
                </Button>
                <Button onClick={handleGetStarted} className="bg-primary hover:bg-primary/90">
                  Jetzt starten
                </Button>
              </>
            )}
            {isAuthenticated && (
              <Button onClick={() => window.location.href = "/dashboard"}>
                Zum Dashboard
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm text-primary font-medium">Transparente Preise, keine versteckten Kosten</span>
        </div>
        <h1 className="text-5xl font-bold text-white mb-4">
          Einfache, faire Preise
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          Starten Sie kostenlos und upgraden Sie, wenn Sie mehr Features benötigen. 
          Jederzeit kündbar, ohne Risiko.
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Free Plan */}
          <Card className="border-slate-700 bg-slate-900/50 backdrop-blur">
            <CardHeader className="text-center pb-8 pt-8">
              <CardTitle className="text-2xl mb-2 text-white">Free</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-bold text-white">CHF 0</span>
                <span className="text-slate-400 ml-2">kostenlos</span>
              </div>
              <p className="text-sm text-slate-400 mt-4">
                Perfekt zum Ausprobieren und für Einsteiger
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4 mb-8">
                <FeatureItem included={true} text="1 Demo-Portfolio" />
                <FeatureItem included={true} text="Basis Portfolio-Optimierung" />
                <FeatureItem included={true} text="3 Analysen pro Tag" />
                <FeatureItem included={true} text="Echtzeit-Kursdaten" />
                <FeatureItem included={true} text="Fundamentaldaten" />
                <FeatureItem included={true} text="Newsroom" />
                <FeatureItem included={false} text="Live Performance-Tracking" />
                <FeatureItem included={false} text="Automatische Dividenden" />
                <FeatureItem included={false} text="Transaktionshistorie" />
                <FeatureItem included={false} text="Steuer-Reporting" />
                <FeatureItem included={false} text="KI-gestützte Analysen" />
                <FeatureItem included={false} text="WhatsApp Alerts" />
                <FeatureItem included={false} text="Priority Support" />
              </ul>
              <Button 
                className="w-full" 
                size="lg"
                variant="outline"
                onClick={handleGetStarted}
              >
                Kostenlos starten
              </Button>
            </CardContent>
          </Card>

          {/* Premium Plan */}
          <Card className="border-primary/50 bg-gradient-to-br from-slate-900 to-slate-800 backdrop-blur shadow-2xl shadow-primary/20 relative">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                Beliebt
              </span>
            </div>
            <CardHeader className="text-center pb-8 pt-8">
              <CardTitle className="text-2xl mb-2 text-white">Premium</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-bold text-white">CHF 10</span>
                <span className="text-slate-400 ml-2">einmalig</span>
              </div>
              <p className="text-sm text-slate-400 mt-4">
                Für ernsthafte Investoren mit professionellen Ansprüchen
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4 mb-8">
                <FeatureItem included={true} text="Unbegrenzte Portfolios" premium />
                <FeatureItem included={true} text="Erweiterte Portfolio-Optimierung" premium />
                <FeatureItem included={true} text="Unbegrenzte Analysen" premium />
                <FeatureItem included={true} text="Echtzeit-Kursdaten" premium />
                <FeatureItem included={true} text="Fundamentaldaten & Metriken" premium />
                <FeatureItem included={true} text="Live Performance-Tracking (IRR/MWR)" premium />
                <FeatureItem included={true} text="Automatische Dividenden" premium />
                <FeatureItem included={true} text="Vollständige Transaktionshistorie" premium />
                <FeatureItem included={true} text="Steuer-Reporting (Jahresübersicht)" premium />
                <FeatureItem included={true} text="KI-gestützte Portfolio-Analysen" premium />
                <FeatureItem included={true} text="WhatsApp & Email Alerts" premium />
                <FeatureItem included={true} text="Portfolio-Vergleich" premium />
                <FeatureItem included={true} text="Priority Support" premium />
              </ul>
              <Button 
                className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" 
                size="lg"
                onClick={handleGetStarted}
              >
                Jetzt upgraden
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-slate-900/50 border border-slate-800">
              <Shield className="h-10 w-10 text-primary mb-3" />
              <h3 className="font-semibold text-white mb-2">Schweizer Datenschutz</h3>
              <p className="text-sm text-slate-400">DSGVO-konform und sicher</p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-slate-900/50 border border-slate-800">
              <CreditCard className="h-10 w-10 text-primary mb-3" />
              <h3 className="font-semibold text-white mb-2">Sichere Zahlung</h3>
              <p className="text-sm text-slate-400">Powered by Stripe</p>
            </div>
            <div className="flex flex-col items-center text-center p-6 rounded-lg bg-slate-900/50 border border-slate-800">
              <Sparkles className="h-10 w-10 text-primary mb-3" />
              <h3 className="font-semibold text-white mb-2">14 Tage Garantie</h3>
              <p className="text-sm text-slate-400">Geld zurück bei Unzufriedenheit</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-16 bg-slate-900/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            Häufig gestellte Fragen
          </h2>
          
          <div className="space-y-6">
            <FAQItem
              question="Was beinhaltet die 'Einmalige Zahlung'?"
              answer="Mit der einmaligen Zahlung von CHF 10.00 erhalten Sie lebenslangen Zugriff auf alle Premium-Features. Keine monatlichen Gebühren, keine Abos."
            />
            <FAQItem
              question="Kann ich mein kostenloses Konto später upgraden?"
              answer="Ja, Sie können jederzeit von Free zu Premium upgraden. Ihre Daten und Portfolios bleiben erhalten."
            />
            <FAQItem
              question="Welche Zahlungsmethoden werden akzeptiert?"
              answer="Wir akzeptieren alle gängigen Kreditkarten (Visa, Mastercard, American Express), TWINT und PostFinance über unseren sicheren Payment-Provider Stripe."
            />
            <FAQItem
              question="Gibt es eine Geld-zurück-Garantie?"
              answer="Ja, wenn Sie innerhalb der ersten 14 Tage nicht zufrieden sind, erstatten wir Ihnen den vollen Betrag zurück - ohne Fragen."
            />
            <FAQItem
              question="Kann ich mehrere Portfolios verwalten?"
              answer="Im Free-Plan können Sie 1 Demo-Portfolio erstellen. Mit Premium können Sie unbegrenzt viele Live-Portfolios mit echten Transaktionen verwalten."
            />
            <FAQItem
              question="Sind meine Daten sicher?"
              answer="Ja, alle Daten werden verschlüsselt übertragen und in der Schweiz gespeichert. Wir verkaufen keine Daten an Dritte und halten uns strikt an die DSGVO."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 border-y border-primary/20 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4 text-white">Bereit zu starten?</h2>
          <p className="text-xl mb-8 text-slate-300">
            Testen Sie alle Features risikofrei mit 14 Tage Geld-zurück-Garantie
          </p>
          <Button 
            size="lg" 
            onClick={handleGetStarted}
            className="text-lg px-8 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
          >
            Jetzt kostenlos starten
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-8 border-t border-slate-800">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm">
            © 2025 {APP_TITLE}. Alle Rechte vorbehalten.
          </p>
          <div className="mt-4 flex justify-center gap-6 text-sm">
            <a href="/datenschutz" className="hover:text-white transition-colors">Datenschutz</a>
            <a href="/agb" className="hover:text-white transition-colors">AGB</a>
            <a href="/impressum" className="hover:text-white transition-colors">Impressum</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureItem({ included, text, premium = false }: { included: boolean; text: string; premium?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      {included ? (
        <Check className={`h-5 w-5 mt-0.5 flex-shrink-0 ${premium ? 'text-primary' : 'text-green-500'}`} />
      ) : (
        <X className="h-5 w-5 text-slate-600 mt-0.5 flex-shrink-0" />
      )}
      <span className={included ? "text-slate-200" : "text-slate-500"}>
        {text}
      </span>
    </li>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="border-b border-slate-800 pb-6">
      <h3 className="text-lg font-semibold text-white mb-2">{question}</h3>
      <p className="text-slate-400">{answer}</p>
    </div>
  );
}
