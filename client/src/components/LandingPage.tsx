import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE } from "@/const";
import { 
  BarChart3, 
  TrendingUp, 
  Shield, 
  Zap, 
  Target, 
  LineChart,
  PieChart,
  Bell,
  Calculator,
  Sparkles
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-emerald-500" />
            <span className="text-2xl font-bold text-white">{APP_TITLE}</span>
          </div>
          <Button asChild variant="default" className="bg-emerald-600 hover:bg-emerald-700">
            <a href="/login">Jetzt starten</a>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            <span>Professionelle Portfolio-Analyse für Schweizer Anleger</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight">
            Dein Portfolio.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              Intelligent analysiert.
            </span>
          </h1>
          
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Optimiere deine Aktien-Investments mit KI-gestützter Analyse, Echtzeit-Performance-Tracking 
            und professionellen Portfolio-Optimierungstools – speziell für den Schweizer Markt.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button asChild size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-6">
              <a href="/login">Kostenlos starten</a>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 text-lg px-8 py-6">
              <a href="#features">Mehr erfahren</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Alles, was du brauchst</h2>
          <p className="text-xl text-slate-400">Professionelle Tools für deine Anlageentscheidungen</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <Card className="bg-slate-900/50 border-slate-800 hover:border-emerald-500/50 transition-all duration-300">
            <CardHeader>
              <div className="h-12 w-12 bg-emerald-500/10 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-emerald-500" />
              </div>
              <CardTitle className="text-white">Portfolio-Optimierung</CardTitle>
              <CardDescription className="text-slate-400">
                KI-gestützte Optimierung deines Portfolios basierend auf historischen Daten und Risikoprofil
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 2 */}
          <Card className="bg-slate-900/50 border-slate-800 hover:border-emerald-500/50 transition-all duration-300">
            <CardHeader>
              <div className="h-12 w-12 bg-cyan-500/10 rounded-lg flex items-center justify-center mb-4">
                <LineChart className="h-6 w-6 text-cyan-500" />
              </div>
              <CardTitle className="text-white">Live Performance-Tracking</CardTitle>
              <CardDescription className="text-slate-400">
                Verfolge deine Portfolio-Performance in Echtzeit mit detaillierten Charts und Metriken
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 3 */}
          <Card className="bg-slate-900/50 border-slate-800 hover:border-emerald-500/50 transition-all duration-300">
            <CardHeader>
              <div className="h-12 w-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4">
                <PieChart className="h-6 w-6 text-purple-500" />
              </div>
              <CardTitle className="text-white">Diversifikations-Analyse</CardTitle>
              <CardDescription className="text-slate-400">
                Analysiere deine Sektor- und Länderallokation für optimale Risikostreuung
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 4 */}
          <Card className="bg-slate-900/50 border-slate-800 hover:border-emerald-500/50 transition-all duration-300">
            <CardHeader>
              <div className="h-12 w-12 bg-orange-500/10 rounded-lg flex items-center justify-center mb-4">
                <Target className="h-6 w-6 text-orange-500" />
              </div>
              <CardTitle className="text-white">Realisierte Gewinne</CardTitle>
              <CardDescription className="text-slate-400">
                Automatische Berechnung und Tracking deiner realisierten Gewinne und Verluste
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 5 */}
          <Card className="bg-slate-900/50 border-slate-800 hover:border-emerald-500/50 transition-all duration-300">
            <CardHeader>
              <div className="h-12 w-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                <Bell className="h-6 w-6 text-blue-500" />
              </div>
              <CardTitle className="text-white">Preis-Alarme</CardTitle>
              <CardDescription className="text-slate-400">
                Erhalte Benachrichtigungen bei wichtigen Kursbewegungen deiner Aktien
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 6 */}
          <Card className="bg-slate-900/50 border-slate-800 hover:border-emerald-500/50 transition-all duration-300">
            <CardHeader>
              <div className="h-12 w-12 bg-pink-500/10 rounded-lg flex items-center justify-center mb-4">
                <Calculator className="h-6 w-6 text-pink-500" />
              </div>
              <CardTitle className="text-white">Schweizer Steuer-Tools</CardTitle>
              <CardDescription className="text-slate-400">
                Berechne Kapitalabzugssteuern und Verrechnungssteuern nach Schweizer Recht
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-2xl p-12">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold text-white mb-2">500+</div>
              <div className="text-slate-400">Aktien analysiert</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-white mb-2">99.9%</div>
              <div className="text-slate-400">Uptime</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-white mb-2">24/7</div>
              <div className="text-slate-400">Echtzeit-Daten</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Bereit, dein Portfolio zu optimieren?
          </h2>
          <p className="text-xl text-slate-400">
            Starte jetzt kostenlos und erhalte sofortigen Zugriff auf alle Features
          </p>
          <Button asChild size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-6">
            <a href="/login">Jetzt kostenlos starten</a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-emerald-500" />
              <span className="text-slate-400">© 2025 {APP_TITLE}. Alle Rechte vorbehalten.</span>
            </div>
            <div className="flex gap-6 text-slate-400">
              <a href="#" className="hover:text-emerald-500 transition-colors">Datenschutz</a>
              <a href="#" className="hover:text-emerald-500 transition-colors">AGB</a>
              <a href="#" className="hover:text-emerald-500 transition-colors">Kontakt</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
