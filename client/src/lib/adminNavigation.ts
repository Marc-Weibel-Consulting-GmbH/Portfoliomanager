/**
 * Die Admin-Navigation als reine Daten — geordnet nach dem
 * Vier-Schichten-Zielbild (design/KONSOLIDIERUNG_RECHENWERKE.md, Paket K8):
 * Universum & Daten (kuratieren) · Rechnung & Transparenz · Messung
 * (berichtet nur) · Labor (entscheidet nichts) · Betrieb · Rückbau geplant.
 *
 * Liegt getrennt von der Seite, weil die Zuordnung über Pfade läuft — und ein
 * Tippfehler dort eine Kachel spurlos verschwinden lässt. Als eigenes Modul
 * ohne JSX ist die Zuordnung prüfbar (siehe adminNavigation.test.ts).
 */
import {
  Grid3x3, PieChart, Key, BarChart3, Eye, BrainCircuit, Activity, Wallet, Brain,
  TrendingUp, FlaskConical, Upload, Zap, ScrollText, Settings, Calculator,
  SlidersHorizontal, Camera, Bell, Search, MessageSquare, Gauge, Globe,
} from "lucide-react";

export type AdminKachel = { icon: any; title: string; description: string; path: string; color: string };
export const adminGroups: {
  title: string;
  sections: AdminKachel[];
  /** Optionale Zwischenüberschriften (Pfad-Zuordnung, exakt deckend). */
  untergruppen?: { label: string; hinweis: string; pfade: string[] }[];
}[] = [
  {
    title: "Universum & Daten — kuratieren (Stationen S1/S2)",
    sections: [
      { icon: Eye, title: "Aktienliste & Watchlist", description: "Aktien-Universum kuratieren — mit Datenqualitäts-Ampel je Titel", path: "/admin/watchlist", color: "text-emerald-500" },
      { icon: Globe, title: "Universum-Kandidaten", description: "Vorgeschlagene Titel für die Aufnahme ins Universum prüfen", path: "/admin/watchlist-candidates", color: "text-sky-500" },
      { icon: Wallet, title: "Wikifolio Portfolio", description: "Positionen aus Wikifolio abrufen und in die Watchlist importieren", path: "/admin/wikifolio", color: "text-amber-500" },
      { icon: Upload, title: "Historische Daten Import", description: "Kurshistorie und Fundamentaldaten importieren", path: "/admin/data-import", color: "text-blue-500" },
      { icon: Grid3x3, title: "Kategorien-Verwaltung", description: "Kategorien erstellen und bearbeiten", path: "/admin/categories", color: "text-green-500" },
      { icon: PieChart, title: "Sektoren-Verwaltung", description: "Sektoren erstellen und bearbeiten", path: "/admin/sectors", color: "text-purple-500" },
    ],
  },
  {
    title: "Rechnung & Transparenz (Schicht A)",
    sections: [
      { icon: Calculator, title: "Berechnungen & Formeln", description: "Kennzahlen- und Formel-Referenz der Kernrechnung (drei Scores + Signal)", path: "/admin/berechnungen", color: "text-lime-500" },
    ],
  },
  {
    title: "Messung — berichtet nur (Schicht C)",
    sections: [
      { icon: TrendingUp, title: "Verbesserungs-Timeline", description: "OOS-Trefferquote/Alpha je aktivierter Version über Zeit — reine Messung", path: "/admin/improvement-timeline", color: "text-teal-400" },
      { icon: FlaskConical, title: "KI-Analyse Protokoll", description: "Protokoll der Portfolio-Vorschläge: Vertrauen, Filter, Challenger-Kritik", path: "/admin/proposal-analysis", color: "text-fuchsia-500" },
      { icon: MessageSquare, title: "Feedback-Dashboard", description: "Nutzer-Feedback und Fehlermeldungen einsehen", path: "/admin/feedback-dashboard", color: "text-blue-400" },
    ],
  },
  {
    title: "Labor — entscheidet nichts (Schicht D)",
    sections: [
      { icon: Activity, title: "Signal-Performance", description: "Labor: Engine-Messung (Messfenster-Fix K7 ausstehend) — fliesst in keine Kundenrechnung", path: "/admin/signal-performance", color: "text-teal-500" },
      { icon: BrainCircuit, title: "ML Trainer", description: "Labor: Gradient-Boosting-Modelle trainieren — Kandidaten, Aktivierung nur per Klick (K1)", path: "/admin/ml-trainer", color: "text-violet-500" },
      { icon: Zap, title: "Signal-Optimizer", description: "Labor: Grid-Search auf die F2-Fallback-Gewichte — Lauf nur per Knopf, mit Out-of-Sample-Gate", path: "/admin/optimizer", color: "text-yellow-500" },
      { icon: FlaskConical, title: "Algo Self-Learning Backtest", description: "Labor: Monats-Backtests (6 Profile); der Feedback-Loop berichtet nur noch (K1)", path: "/admin/algo-backtest", color: "text-emerald-400" },
    ],
  },
  {
    title: "Betrieb",
    sections: [
      { icon: Settings, title: "App-Einstellungen", description: "Globale Parameter, Diversifikationsregeln, Feature-Flags", path: "/admin/settings", color: "text-slate-400" },
      { icon: Key, title: "API & Secrets", description: "API-Keys und Secrets verwalten", path: "/admin/secrets", color: "text-orange-500" },
      { icon: ScrollText, title: "Server-Logs", description: "Server-Protokolle und Fehler einsehen", path: "/admin/logs", color: "text-gray-400" },
      { icon: BarChart3, title: "Platform-KPIs", description: "Benutzer-Statistiken und Metriken", path: "/admin/kpis", color: "text-cyan-500" },
      { icon: Brain, title: "Research & Multi-Agent", description: "Dokumente, Makro-Quellen (Apollo/FRED), Multi-Agent-Werkzeuge", path: "/admin/research", color: "text-pink-500" },
      { icon: Camera, title: "App-Screenshots", description: "Screenshots für Doku und Marketing erzeugen", path: "/admin/screenshots", color: "text-zinc-400" },
    ],
  },
  {
    title: "Rückbau geplant — ohne Wirkung auf die Rechnung",
    sections: [
      { icon: Bell, title: "Alert-Kriterien", description: "Ohne Wirkung seit K2 — Hinweise folgen dem Drei-Score-Signal", path: "/admin/alert-config", color: "text-orange-400" },
      { icon: Gauge, title: "Score-Konfiguration", description: "Portfolio-Zustand (reine Anzeige); Bewertungs-Felder ohne Wirkung seit K6", path: "/admin/score-config", color: "text-rose-500" },
      { icon: SlidersHorizontal, title: "Signal-Gewichtung", description: "Gewichte der F2-Fallback-Formel — im Kundenpfad ohne Wirkung", path: "/admin/signal-config", color: "text-indigo-500" },
      { icon: Search, title: "Universum Gap-Filling", description: "Durch den Screener ersetzt", path: "/admin/gap-filling", color: "text-cyan-500" },
    ],
  },
];
