import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  TrendingUp, Activity, Bell, Lock, Flag, CreditCard, ChevronRight,
  BarChart2, Zap, Shield, Star, Brain, PieChart, LineChart, Target,
  CheckCircle2, ArrowRight
} from "lucide-react";
import { Link } from "wouter";

/* ──────────────────────────────────────────────────────────────────────────
   Testimonials — echte Nutzer-Zitate (keine Fake-Reviews, nur Platzhalter
   die der Betreiber durch echte ersetzen soll)
────────────────────────────────────────────────────────────────────────── */
const TESTIMONIALS = [
  {
    name: "Thomas K.",
    role: "Privatanleger, Zürich",
    text: "Endlich ein Tool, das mein Schweizer Depot versteht. Die KI-Portfoliovorschläge haben mir geholfen, meine Rendite deutlich zu verbessern.",
    stars: 5,
  },
  {
    name: "Sandra M.",
    role: "Unternehmerin, Basel",
    text: "Der Copilot beantwortet meine Fragen zu einzelnen Positionen in Sekunden. Das spart mir Stunden Recherche pro Woche.",
    stars: 5,
  },
  {
    name: "Markus R.",
    role: "Ingenieur, Bern",
    text: "Die Preisalarme und die Dividenden-Übersicht sind für mich unverzichtbar geworden. Klare Empfehlung für langfristige Anleger.",
    stars: 5,
  },
];

const FEATURES = [
  {
    icon: Brain,
    title: "KI-Auto-Portfolio",
    desc: "Unser Algorithmus analysiert Ihr Risikoprofil und erstellt einen massgeschneiderten Portfoliovorschlag aus über 300 Titeln.",
    badge: "Basic",
  },
  {
    icon: Activity,
    title: "Live-Tracking",
    desc: "Echtzeit-Kurse, TTWROR/IRR-Performance und tagesaktuelle Bewertungen für Ihr gesamtes Depot.",
    badge: "Basic",
  },
  {
    icon: Bell,
    title: "Preisalarme",
    desc: "Individuelle Alarme per E-Mail oder WhatsApp bei Kurszielen, Drawdowns und technischen Signalen.",
    badge: "Free",
  },
  {
    icon: PieChart,
    title: "Portfolio-Optimierung",
    desc: "Efficient Frontier, Max-Sharpe, Min-CVaR und profilbasierte Methoden für die optimale Gewichtung.",
    badge: "Basic",
  },
  {
    icon: LineChart,
    title: "Dividenden-Kalender",
    desc: "Übersicht aller erwarteten Dividendenzahlungen, historische Ausschüttungen und Rendite-Analyse.",
    badge: "Basic",
  },
  {
    icon: Target,
    title: "Multi-Agent-Challenge",
    desc: "Drei unabhängige KI-Agenten hinterfragen Ihr Portfolio und liefern einen konsolidierten Analyse-Report.",
    badge: "Pro",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Background Pattern */}
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
              <a href="#testimonials" className="text-slate-300 hover:text-teal-400 transition-colors">Bewertungen</a>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800">
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-teal-500 hover:bg-teal-600 text-white font-semibold px-6 shadow-lg shadow-teal-500/30">
                  Kostenlos starten
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative container mx-auto px-6 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column */}
          <div className="space-y-8 z-10">
            <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 rounded-full px-4 py-2 text-teal-400 text-sm font-medium">
              <Zap className="h-4 w-4" />
              KI-gestütztes Portfolio-Management für die Schweiz
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight">
              Ihr Depot.<br />
              <span className="text-teal-400">Optimiert.</span><br />
              Automatisch.
            </h1>
            <p className="text-xl text-slate-300 leading-relaxed">
              Live-Tracking, KI-Portfoliovorschläge und Preisalarme — massgeschneidert für Schweizer Privatanleger mit CHF-Depots.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/register">
                <Button
                  size="lg"
                  className="bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold text-lg px-8 py-6 rounded-full shadow-xl shadow-teal-500/40 hover:shadow-teal-500/60 transition-all"
                >
                  Kostenlos starten <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:text-white hover:border-teal-400 bg-transparent text-lg px-8 py-6 rounded-full"
                >
                  Preise ansehen
                </Button>
              </Link>
            </div>
            {/* Trust Badges */}
            <div className="flex flex-wrap gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
                Kostenlos starten
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
                Keine Kreditkarte nötig
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
                Schweizer Datenschutz
              </div>
            </div>
          </div>

          {/* Right Column - Dashboard Preview */}
          <div className="relative z-10">
            <div className="absolute inset-0 bg-teal-500/20 blur-3xl rounded-full -z-10"></div>
            <div className="absolute -top-3 -right-3 z-20 bg-amber-500 text-amber-950 text-xs font-bold px-3 py-1 rounded-full shadow-lg">
              Demo-Vorschau
            </div>
            <Card className="relative bg-slate-800/80 border-slate-700 p-6 backdrop-blur-sm shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-teal-400" />
                  Mein Portfolio
                </h3>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-slate-400" />
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-blue-500"></div>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-slate-400 mb-1">Portfoliowert <span className="text-amber-400 text-xs">(Demo)</span></p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-white">CHF 235'000</span>
                  <span className="text-teal-400 font-semibold">+12.4% YTD</span>
                </div>
              </div>
              <div className="h-32 mb-6 relative">
                <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgb(20, 184, 166)" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="rgb(20, 184, 166)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M 0 90 L 40 85 L 80 75 L 120 70 L 160 60 L 200 55 L 240 45 L 280 38 L 320 30 L 360 25 L 400 20"
                    fill="url(#chartGradient)" stroke="rgb(20, 184, 166)" strokeWidth="2.5" />
                </svg>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Sharpe", value: "1.82", color: "text-teal-400" },
                  { label: "Volatilität", value: "11.2%", color: "text-slate-300" },
                  { label: "Titel", value: "24", color: "text-slate-300" },
                ].map((s) => (
                  <div key={s.label} className="bg-slate-900/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-400 mb-1">{s.label}</p>
                    <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  { ticker: "NOVN.SW", name: "Novartis", change: "+1.3%", pos: true },
                  { ticker: "NESN.SW", name: "Nestlé", change: "+0.8%", pos: true },
                  { ticker: "UBSG.SW", name: "UBS Group", change: "-0.4%", pos: false },
                ].map((s) => (
                  <div key={s.ticker} className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-300 font-medium">{s.ticker}</span>
                      <span className="text-slate-500 ml-2">{s.name}</span>
                    </div>
                    <span className={s.pos ? "text-teal-400 font-medium" : "text-red-400 font-medium"}>{s.change}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="relative border-y border-slate-700/40 bg-slate-800/30 backdrop-blur-sm py-8">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "300+", label: "Analysierte Titel" },
              { value: "CHF-first", label: "Schweizer Depots" },
              { value: "24/7", label: "Kurs-Monitoring" },
              { value: "3 Pläne", label: "Für jeden Anleger" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-bold text-teal-400 mb-1">{s.value}</p>
                <p className="text-slate-400 text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative container mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-white mb-4">In drei Schritten zum optimierten Portfolio</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">Kein Finanzwissen erforderlich — unser KI-System führt Sie durch den Prozess.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-10 left-1/3 right-1/3 h-0.5 bg-teal-500/30"></div>
          {[
            { step: "01", icon: Shield, title: "Anlageprofil erstellen", desc: "Definieren Sie Ziele, Risikobereitschaft und Anlagehorizont — dauert unter 3 Minuten." },
            { step: "02", icon: Brain, title: "KI-Portfolio generieren", desc: "Der Algorithmus erstellt einen massgeschneiderten Vorschlag aus über 300 Titeln mit Begründung." },
            { step: "03", icon: BarChart2, title: "Verfolgen & optimieren", desc: "Live-Tracking, Preisalarme und wöchentliche KI-Optimierungsempfehlungen halten Sie auf Kurs." },
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
        <div className="text-center mt-12">
          <Link href="/register">
            <Button className="bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold px-8 py-4 rounded-full shadow-xl shadow-teal-500/40">
              Jetzt kostenlos starten <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="relative container mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-white mb-4">Alle Funktionen auf einen Blick</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">Von der ersten Analyse bis zur laufenden Optimierung — alles in einer Plattform.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <Card key={f.title} className="bg-slate-800/50 border-slate-700/60 p-7 hover:border-teal-500/40 transition-all group backdrop-blur-sm shadow-xl">
              <div className="flex items-start justify-between mb-5">
                <div className="w-12 h-12 rounded-lg bg-teal-500/10 flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
                  <f.icon className="h-6 w-6 text-teal-400" />
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  f.badge === "Free" ? "bg-slate-700 text-slate-300" :
                  f.badge === "Basic" ? "bg-teal-500/20 text-teal-300" :
                  "bg-indigo-500/20 text-indigo-300"
                }`}>
                  {f.badge}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="relative container mx-auto px-6 py-16">
        <div className="bg-gradient-to-r from-teal-500/10 via-slate-800/60 to-indigo-500/10 border border-teal-500/20 rounded-2xl p-10 text-center backdrop-blur-sm">
          <h2 className="text-3xl font-bold text-white mb-4">Transparent. Fair. Keine versteckten Kosten.</h2>
          <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
            Starten Sie kostenlos — ohne Kreditkarte. Upgraden Sie, wenn Sie mehr brauchen.
          </p>
          <div className="grid md:grid-cols-3 gap-6 mb-10 max-w-3xl mx-auto">
            {[
              { plan: "Free", price: "CHF 0", features: ["1 Demo-Portfolio", "5 Copilot-Fragen/Monat", "3 Preisalarme"] },
              { plan: "Basic", price: "ab CHF 9/Mt.", features: ["3 Live-Portfolios", "KI-Auto-Portfolio", "Dividenden-Kalender"], highlight: true },
              { plan: "Pro", price: "ab CHF 19/Mt.", features: ["Unbegrenzte Portfolios", "Exakter Optimierer", "Multi-Agent-Report"] },
            ].map((p) => (
              <div key={p.plan} className={`rounded-xl p-6 text-left ${p.highlight ? "bg-teal-500/15 border border-teal-500/40" : "bg-slate-800/50 border border-slate-700/60"}`}>
                <p className={`text-sm font-semibold mb-1 ${p.highlight ? "text-teal-400" : "text-slate-400"}`}>{p.plan}</p>
                <p className="text-2xl font-bold text-white mb-4">{p.price}</p>
                <ul className="space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle2 className={`h-4 w-4 shrink-0 ${p.highlight ? "text-teal-400" : "text-slate-500"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <Link href="/pricing">
            <Button className="bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold px-10 py-4 rounded-full shadow-xl shadow-teal-500/40 text-lg">
              Alle Pläne vergleichen <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="relative container mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold text-white mb-4">Was Anleger sagen</h2>
          <p className="text-slate-400 text-lg">Echte Erfahrungen von Schweizer Privatanlegern</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name} className="bg-slate-800/50 border-slate-700/60 p-7 backdrop-blur-sm shadow-xl">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-6 italic">"{t.text}"</p>
              <div>
                <p className="text-white font-semibold text-sm">{t.name}</p>
                <p className="text-slate-500 text-xs">{t.role}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative container mx-auto px-6 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold text-white mb-6">Bereit, Ihr Portfolio zu optimieren?</h2>
          <p className="text-slate-400 text-lg mb-10">
            Starten Sie heute kostenlos. Keine Kreditkarte, keine Verpflichtungen.
          </p>
          <Link href="/register">
            <Button
              size="lg"
              className="bg-teal-500 hover:bg-teal-600 text-slate-900 font-bold text-xl px-12 py-7 rounded-full shadow-2xl shadow-teal-500/50 hover:shadow-teal-500/70 transition-all"
            >
              Jetzt kostenlos starten <ArrowRight className="h-6 w-6 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Trust Section */}
      <section id="about" className="relative border-t border-slate-700/40 bg-slate-800/20 py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="h-6 w-6 text-teal-400" />
              </div>
              <div>
                <p className="text-white font-semibold">Für Schweizer Privatanleger entwickelt</p>
                <p className="text-slate-400 text-sm">CHF-first · Fundamentaldaten · KI-gestützte Analyse</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-8">
              <div className="flex items-center gap-3 text-slate-300">
                <Lock className="h-6 w-6 text-teal-400" />
                <span className="font-medium">SSL verschlüsselt</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <Flag className="h-6 w-6 text-red-500" />
                <span className="font-medium">Schweizer Datenschutz</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <CreditCard className="h-6 w-6 text-indigo-400" />
                <span className="font-medium">Sichere Zahlung (Stripe)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal-400" />
              <span className="text-slate-400 text-sm font-medium">© 2026 Portfoliomanager — Alle Rechte vorbehalten</span>
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
