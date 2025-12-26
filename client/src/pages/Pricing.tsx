import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <a href="/" className="flex items-center gap-3">
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
            <span className="text-xl font-bold text-gray-900">{APP_TITLE}</span>
          </a>
          <div className="flex gap-3">
            {!isAuthenticated && (
              <>
                <Button variant="outline" onClick={() => window.location.href = "/login"}>
                  Login
                </Button>
                <Button onClick={handleGetStarted}>
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
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Einfache, transparente Preise
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Starten Sie kostenlos und upgraden Sie, wenn Sie mehr Features benötigen. 
          Keine versteckten Kosten, jederzeit kündbar.
        </p>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Free Plan */}
          <Card className="border-2">
            <CardHeader className="text-center pb-8 pt-8">
              <CardTitle className="text-2xl mb-2">Free</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-bold text-gray-900">CHF 0</span>
                <span className="text-gray-500 ml-2">kostenlos</span>
              </div>
              <p className="text-sm text-gray-500 mt-4">
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
                <FeatureItem included={true} text="Community Support" />
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
          <Card className="border-primary border-2 shadow-xl relative">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold">
                Beliebt
              </span>
            </div>
            <CardHeader className="text-center pb-8 pt-8">
              <CardTitle className="text-2xl mb-2">Premium</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-bold text-gray-900">CHF 10</span>
                <span className="text-gray-500 ml-2">pro Monat</span>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Für ernsthafte Investoren mit professionellen Ansprüchen
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4 mb-8">
                <FeatureItem included={true} text="Unbegrenzte Portfolios" />
                <FeatureItem included={true} text="Erweiterte Portfolio-Optimierung" />
                <FeatureItem included={true} text="Unbegrenzte Analysen" />
                <FeatureItem included={true} text="Echtzeit-Kursdaten" />
                <FeatureItem included={true} text="Fundamentaldaten & Metriken" />
                <FeatureItem included={true} text="Live Performance-Tracking" />
                <FeatureItem included={true} text="Automatische Dividenden" />
                <FeatureItem included={true} text="Vollständige Transaktionshistorie" />
                <FeatureItem included={true} text="Steuer-Reporting (Jahresübersicht)" />
                <FeatureItem included={true} text="KI-gestützte Portfolio-Analysen" />
                <FeatureItem included={true} text="WhatsApp Alerts" />
                <FeatureItem included={true} text="Portfolio-Vergleich" />
                <FeatureItem included={true} text="Priority Support" />
              </ul>
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleGetStarted}
              >
                Jetzt upgraden
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="container mx-auto px-4 py-16 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Häufig gestellte Fragen
          </h2>
          
          <div className="space-y-6">
            <FAQItem
              question="Kann ich jederzeit upgraden?"
              answer="Ja, Sie können jederzeit von Free zu Premium upgraden. Die Abrechnung erfolgt anteilig."
            />
            <FAQItem
              question="Wie kann ich kündigen?"
              answer="Sie können Ihr Premium-Abo jederzeit in den Einstellungen kündigen. Es gibt keine Kündigungsfrist."
            />
            <FAQItem
              question="Welche Zahlungsmethoden werden akzeptiert?"
              answer="Wir akzeptieren alle gängigen Kreditkarten (Visa, Mastercard, American Express) über unseren sicheren Payment-Provider Stripe."
            />
            <FAQItem
              question="Gibt es eine Geld-zurück-Garantie?"
              answer="Ja, wenn Sie innerhalb der ersten 14 Tage nicht zufrieden sind, erstatten wir Ihnen den vollen Betrag zurück."
            />
            <FAQItem
              question="Kann ich mehrere Portfolios verwalten?"
              answer="Im Free-Plan können Sie 1 Demo-Portfolio erstellen. Mit Premium können Sie unbegrenzt viele Portfolios verwalten."
            />
            <FAQItem
              question="Sind meine Daten sicher?"
              answer="Ja, alle Daten werden verschlüsselt übertragen und gespeichert. Wir verkaufen keine Daten an Dritte und halten uns strikt an die DSGVO."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Bereit zu starten?</h2>
          <p className="text-xl mb-8 opacity-90">
            Testen Sie alle Features 14 Tage kostenlos
          </p>
          <Button 
            size="lg" 
            variant="secondary" 
            onClick={handleGetStarted}
            className="text-lg px-8"
          >
            Jetzt kostenlos starten
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
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

function FeatureItem({ included, text }: { included: boolean; text: string }) {
  return (
    <li className="flex items-start gap-3">
      {included ? (
        <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
      ) : (
        <X className="h-5 w-5 text-gray-300 mt-0.5 flex-shrink-0" />
      )}
      <span className={included ? "text-gray-700" : "text-gray-400"}>
        {text}
      </span>
    </li>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="border-b border-gray-200 pb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{question}</h3>
      <p className="text-gray-600">{answer}</p>
    </div>
  );
}
