/**
 * Die Admin-Navigation als reine Daten.
 *
 * Liegt getrennt von der Seite, weil die Zuordnung der Kacheln zu
 * Zwischenüberschriften über Pfade läuft — und ein Tippfehler dort eine Kachel
 * spurlos verschwinden lässt. Als eigenes Modul ohne JSX ist die Zuordnung
 * prüfbar (siehe adminNavigation.test.ts).
 */
import {
  Grid3x3, PieChart, Key, BarChart3, Eye, BrainCircuit, Activity, Wallet, Brain,
  TrendingUp, FlaskConical, Database, Upload, Zap, ScrollText, Settings, Calculator,
  SlidersHorizontal, Camera, Bell, Search, MessageSquare, Gauge, Globe,
} from "lucide-react";

// Vollständige, kategorisierte Admin-Navigation — jede Admin-Route ist hier
// als Karte erreichbar (vorher fehlten 12 von 24 Funktionen einen Button).
export type AdminKachel = { icon: any; title: string; description: string; path: string; color: string };
export const adminGroups: {
  title: string;
  sections: AdminKachel[];
  /**
   * Optionale Zwischenüberschriften. Nur dort gesetzt, wo eine Gruppe sonst
   * zu viele gleich aussehende Kacheln nebeneinanderstellt und nicht
   * erkennbar ist, welche etwas EINSTELLT, welche etwas MISST und welche
   * sich selbst anpasst. Ohne `untergruppen` wird wie bisher gerendert.
   */
  untergruppen?: { label: string; hinweis: string; pfade: string[] }[];
}[] = [
  {
    title: "Daten & Universum",
    sections: [
      { icon: Eye, title: "Aktienliste & Watchlist", description: "Aktien-Universum kuratieren — inkl. Portfolio-Titel", path: "/admin/watchlist", color: "text-emerald-500" },
      { icon: Globe, title: "Universum-Kandidaten", description: "Vorgeschlagene Titel für die Aufnahme ins Universum prüfen", path: "/admin/watchlist-candidates", color: "text-sky-500" },
      { icon: Search, title: "Universum Gap-Filling", description: "Fehlende Titel/Daten im Universum systematisch nachladen", path: "/admin/gap-filling", color: "text-cyan-500" },
      { icon: Upload, title: "Historische Daten Import", description: "Kurshistorie und Fundamentaldaten importieren", path: "/admin/data-import", color: "text-blue-500" },
      { icon: Grid3x3, title: "Kategorien-Verwaltung", description: "Kategorien erstellen und bearbeiten", path: "/admin/categories", color: "text-green-500" },
      { icon: PieChart, title: "Sektoren-Verwaltung", description: "Sektoren erstellen und bearbeiten", path: "/admin/sectors", color: "text-purple-500" },
    ],
  },
  {
    title: "Signale, Scores & ML",
    untergruppen: [
      { label: "Einstellen", hinweis: "Sie legen die Regeln fest",
        pfade: ["/admin/signal-config", "/admin/score-config"] },
      { label: "Messen", hinweis: "Sie sehen, was die Regeln bewirkt haben",
        pfade: ["/admin/signal-performance", "/admin/improvement-timeline"] },
      { label: "Lernen", hinweis: "Die Anwendung passt sich selbst an",
        pfade: ["/admin/optimizer", "/admin/ml-trainer", "/admin/algo-backtest"] },
    ],
    sections: [
      { icon: SlidersHorizontal, title: "Signal-Gewichtung", description: "Gewichte der Signal-Faktoren konfigurieren", path: "/admin/signal-config", color: "text-indigo-500" },
      { icon: Activity, title: "Signal-Performance", description: "Trefferquote, Rendite und Kalibrierung je Signal-Engine", path: "/admin/signal-performance", color: "text-teal-500" },
      { icon: Gauge, title: "Score-Konfiguration", description: "Schwellen und Gewichte des Bewertungs-Scores", path: "/admin/score-config", color: "text-rose-500" },
      { icon: Zap, title: "Signal-Optimizer", description: "Signal-Gewichte automatisch per Grid-Search tunen", path: "/admin/optimizer", color: "text-yellow-500" },
      { icon: BrainCircuit, title: "ML Trainer", description: "Gradient-Boosting-Modell trainieren, Metriken & Historie", path: "/admin/ml-trainer", color: "text-violet-500" },
      { icon: FlaskConical, title: "Algo Self-Learning Backtest", description: "Monatliche Test-Portfolios (6 Profile), 30-Tage-Performance, LLM-Analyse & Tuning-Log", path: "/admin/algo-backtest", color: "text-emerald-400" },
      { icon: TrendingUp, title: "Verbesserungs-Timeline", description: "OOS-Trefferquote/Alpha je aktivierter Gewichts- und ML-Modell-Version über Zeit", path: "/admin/improvement-timeline", color: "text-teal-400" },
    ],
  },
  {
    title: "Research & KI",
    sections: [
      { icon: Brain, title: "Research & Multi-Agent", description: "Dokumente, Makro-Quellen (Apollo/FRED), KI-Analyse & Multi-Agent", path: "/admin/research", color: "text-pink-500" },
      { icon: FlaskConical, title: "KI-Analyse Protokoll", description: "Multi-Agent Portfolio-Vorschläge: Vertrauen, Filter, Challenger-Kritik", path: "/admin/proposal-analysis", color: "text-fuchsia-500" },
      { icon: Wallet, title: "Wikifolio Portfolio", description: "Positionen aus Wikifolio abrufen, analysieren, in die Watchlist importieren", path: "/admin/wikifolio", color: "text-amber-500" },
      { icon: Calculator, title: "Berechnungen & Formeln", description: "Kennzahlen- und Formel-Referenz der Engine", path: "/admin/berechnungen", color: "text-lime-500" },
    ],
  },
  {
    title: "Konfiguration",
    sections: [
      { icon: Settings, title: "App-Einstellungen", description: "Globale Parameter, Diversifikationsregeln, Feature-Flags", path: "/admin/settings", color: "text-slate-400" },
      { icon: Bell, title: "Alert-Kriterien", description: "Schwellen für Watchlist-/Preisalarme konfigurieren", path: "/admin/alert-config", color: "text-orange-400" },
      { icon: Key, title: "API & Secrets", description: "API-Keys und Secrets verwalten", path: "/admin/secrets", color: "text-orange-500" },
      { icon: Camera, title: "App-Screenshots", description: "Screenshots für Doku und Marketing erzeugen", path: "/admin/screenshots", color: "text-zinc-400" },
    ],
  },
  {
    title: "System & Betrieb",
    sections: [
      { icon: BarChart3, title: "Platform-KPIs", description: "Benutzer-Statistiken und Metriken", path: "/admin/kpis", color: "text-cyan-500" },
      { icon: MessageSquare, title: "Feedback-Dashboard", description: "Nutzer-Feedback und Fehlermeldungen einsehen", path: "/admin/feedback-dashboard", color: "text-blue-400" },
      { icon: ScrollText, title: "Server-Logs", description: "Server-Protokolle und Fehler einsehen", path: "/admin/logs", color: "text-gray-400" },
    ],
  },
];
