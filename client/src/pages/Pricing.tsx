import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Sparkles, Shield, CreditCard } from "lucide-react";
import { APP_LOGO, APP_TITLE } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Interval = "month" | "year";
type PaidPlan = "plus" | "pro";

// Preise in CHF. Jahrespreise entsprechen ~10 Monaten (2 Monate geschenkt).
const PRICES: Record<PaidPlan, Record<Interval, number>> = {
  plus: { month: 12, year: 120 },
  pro: { month: 25, year: 240 },
};

export default function Pricing() {
  const { isAuthenticated } = useAuth();
  const [interval, setInterval] = useState<Interval>("year");

  const checkout = trpc.billing.createSubscriptionCheckout.useMutation({
    onSuccess: (data) => {
      if (data?.checkoutUrl) window.location.href = data.checkoutUrl;
    },
    onError: (err) => toast.error("Checkout nicht möglich", { description: err.message }),
  });

  const startCheckout = (plan: PaidPlan) => {
    if (!isAuthenticated) {
      window.location.href = "/register";
      return;
    }
    checkout.mutate({ plan, interval });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <a href="/" className="flex items-center gap-3">
            {APP_LOGO && (
              <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8 rounded-lg"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            )}
            <span className="text-xl font-bold text-white">{APP_TITLE}</span>
          </a>
          <div className="flex gap-3">
            {!isAuthenticated ? (
              <>
                <Button variant="outline" onClick={() => window.location.href = "/login"}>Login</Button>
                <Button onClick={() => window.location.href = "/register"} className="bg-primary hover:bg-primary/90">Jetzt starten</Button>
              </>
            ) : (
              <Button onClick={() => window.location.href = "/dashboard"}>Zum Dashboard</Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm text-primary font-medium">Transparente Preise, jederzeit kündbar</span>
        </div>
        <h1 className="text-5xl font-bold text-white mb-4">Einfache, faire Preise</h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          Starten Sie kostenlos und upgraden Sie, wenn Sie mehr benötigen. Kein Kleingedrucktes.
        </p>

        {/* Intervall-Umschalter */}
        <div className="inline-flex items-center gap-1 mt-8 p-1 rounded-lg bg-slate-800/80 border border-slate-700">
          <button onClick={() => setInterval("month")}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${interval === "month" ? "bg-primary text-slate-900 font-medium" : "text-slate-300 hover:text-white"}`}>
            Monatlich
          </button>
          <button onClick={() => setInterval("year")}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${interval === "year" ? "bg-primary text-slate-900 font-medium" : "text-slate-300 hover:text-white"}`}>
            Jährlich <span className="text-emerald-400 font-semibold">−17 %</span>
          </button>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-start">

          {/* Free */}
          <Card className="border-slate-700 bg-slate-900/50 backdrop-blur">
            <CardHeader className="text-center pb-6 pt-8">
              <CardTitle className="text-2xl mb-2 text-white">Free</CardTitle>
              <div className="mb-2"><span className="text-5xl font-bold text-white">CHF 0</span></div>
              <p className="text-sm text-slate-400">Zum Ausprobieren</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <ul className="space-y-3">
                <FeatureItem included text="1 Demo-Portfolio" />
                <FeatureItem included text="Verzögerte Kursdaten" />
                <FeatureItem included text="Markt-Hub (Überblick)" />
                <FeatureItem included text="Basis-Optimierung" />
                <FeatureItem included text="5 Copilot-Fragen/Monat" />
                <FeatureItem included text="3 Preisalarme" />
                <FeatureItem included={false} text="Live-Portfolios" />
                <FeatureItem included={false} text="KI-Auto-Portfolio" />
                <FeatureItem included={false} text="Steuer-Reporting" />
              </ul>
              <Button variant="outline" className="w-full"
                onClick={() => window.location.href = isAuthenticated ? "/dashboard" : "/register"}>
                Kostenlos starten
              </Button>
            </CardContent>
          </Card>

          {/* Basic (hervorgehoben) */}
          <Card className="border-primary bg-slate-900/70 backdrop-blur relative shadow-lg shadow-primary/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-slate-900 text-xs font-semibold">Beliebt</div>
            <CardHeader className="text-center pb-6 pt-8">
              <CardTitle className="text-2xl mb-2 text-white">Basic</CardTitle>
              <div className="mb-1">
                <span className="text-5xl font-bold text-white">CHF {PRICES.plus[interval]}</span>
                <span className="text-slate-400 ml-2">/ {interval === "month" ? "Monat" : "Jahr"}</span>
              </div>
              <p className="text-sm text-slate-400">{interval === "year" ? "entspricht CHF 10/Monat" : "jederzeit kündbar"}</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <ul className="space-y-3">
                <FeatureItem included premium text="3 Live-Portfolios" />
                <FeatureItem included premium text="Echtzeit-Kursdaten" />
                <FeatureItem included premium text="Performance (TTWROR/IRR)" />
                <FeatureItem included premium text="KI-Auto-Portfolio-Vorschlag" />
                <FeatureItem included premium text="Portfolio-Optimierung (unbegrenzt)" />
                <FeatureItem included premium text="100 Copilot-Fragen/Monat" />
                <FeatureItem included premium text="25 Preisalarme" />
                <FeatureItem included premium text="Steuer-Reporting & Dividenden" />
              </ul>
              <Button className="w-full bg-primary hover:bg-primary/90 text-slate-900"
                disabled={checkout.isPending} onClick={() => startCheckout("plus")}>
                {checkout.isPending ? "Wird geöffnet…" : "Basic wählen"}
              </Button>
            </CardContent>
          </Card>

          {/* Pro */}
          <Card className="border-slate-700 bg-slate-900/50 backdrop-blur">
            <CardHeader className="text-center pb-6 pt-8">
              <CardTitle className="text-2xl mb-2 text-white">Pro</CardTitle>
              <div className="mb-1">
                <span className="text-5xl font-bold text-white">CHF {PRICES.pro[interval]}</span>
                <span className="text-slate-400 ml-2">/ {interval === "month" ? "Monat" : "Jahr"}</span>
              </div>
              <p className="text-sm text-slate-400">Für aktive & vermögende Anleger</p>
            </CardHeader>
            <CardContent className="space-y-5">
              <ul className="space-y-3">
                <FeatureItem included premium text="Alles aus Basic" />
                <FeatureItem included premium text="Unbegrenzte Live-Portfolios" />
                <FeatureItem included premium text="Exakter Optimierer + Sektor-Caps" />
                <FeatureItem included premium text="Multi-Agent-Challenge-Report" />
                <FeatureItem included premium text="Unbegrenzte Copilot-Fragen" />
                <FeatureItem included premium text="Unbegrenzte Preisalarme" />
                <FeatureItem included premium text="Prioritäts-Support" />
              </ul>
              <Button variant="outline" className="w-full border-primary/50 text-primary hover:text-primary"
                disabled={checkout.isPending} onClick={() => startCheckout("pro")}>
                {checkout.isPending ? "Wird geöffnet…" : "Pro wählen"}
              </Button>
            </CardContent>
          </Card>

        </div>
      </section>

      {/* Trust Badges */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
          <TrustBadge icon={<Shield className="h-10 w-10 text-primary mb-3" />} title="Schweizer Datenschutz" sub="revDSG-konform und sicher" />
          <TrustBadge icon={<CreditCard className="h-10 w-10 text-primary mb-3" />} title="Sichere Zahlung" sub="Stripe · Kreditkarte, TWINT, PostFinance" />
          <TrustBadge icon={<Sparkles className="h-10 w-10 text-primary mb-3" />} title="Jederzeit kündbar" sub="Monatlich oder jährlich, ohne Mindestlaufzeit" />
        </div>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 py-16 bg-slate-900/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">Häufig gestellte Fragen</h2>
          <div className="space-y-6">
            <FAQItem question="Was unterscheidet Basic von Pro?"
              answer="Basic deckt alles ab, was Sie für Ihr reales Depot brauchen: Echtzeit-Tracking, KI-Auto-Portfolio, Steuer-Reporting. Pro ist für aktive Anleger mit mehreren Depots — mit exaktem Optimierer, Sektor-Caps, Multi-Agent-Challenge-Report und unbegrenztem Copilot." />
            <FAQItem question="Kann ich jederzeit kündigen?"
              answer="Ja. Sie verwalten Ihr Abo (Kündigung, Zahlungsmittel, Rechnungen) selbst über das Kundenportal unter Einstellungen › Abo. Bei jährlicher Zahlung läuft der Zugriff bis zum Periodenende." />
            <FAQItem question="Welche Zahlungsmethoden werden akzeptiert?"
              answer="Kreditkarten (Visa, Mastercard, American Express), TWINT und PostFinance über unseren sicheren Payment-Provider Stripe." />
            <FAQItem question="Was passiert mit meinen Daten bei einem Downgrade?"
              answer="Ihre Daten und Portfolios bleiben erhalten. Übersteigt die Zahl Ihrer Live-Portfolios das Limit des tieferen Plans, bleiben sie sichtbar, aber schreibgeschützt, bis Sie wieder Platz schaffen oder upgraden." />
            <FAQItem question="Sind meine Daten sicher?"
              answer="Alle Daten werden verschlüsselt übertragen und in der Schweiz gespeichert. Wir verkaufen keine Daten an Dritte und halten uns strikt an das revidierte Schweizer Datenschutzgesetz (revDSG)." />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-8 border-t border-slate-800">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm">© {new Date().getFullYear()} {APP_TITLE}. Alle Rechte vorbehalten.</p>
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
      {included
        ? <Check className={`h-5 w-5 mt-0.5 flex-shrink-0 ${premium ? 'text-primary' : 'text-green-500'}`} />
        : <X className="h-5 w-5 text-slate-600 mt-0.5 flex-shrink-0" />}
      <span className={included ? "text-slate-200" : "text-slate-500"}>{text}</span>
    </li>
  );
}

function TrustBadge({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center text-center p-6 rounded-lg bg-slate-900/50 border border-slate-800">
      {icon}
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400">{sub}</p>
    </div>
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
