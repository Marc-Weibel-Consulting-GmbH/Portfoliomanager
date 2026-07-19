import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useCallback } from "react";
import { Copy, Check, Download, FileText } from "lucide-react";
import { toast } from "sonner";

interface FormulaSection {
  id: string;
  category: string;
  title: string;
  description: string;
  formula: string;
  variables: { name: string; desc: string }[];
  example: {
    input: string;
    calculation: string;
    result: string;
  };
  notes?: string;
}

const FORMULAS: FormulaSection[] = [
  // ─── PERFORMANCE ────────────────────────────────────────────────────────────
  {
    id: "ttwror",
    category: "Performance",
    title: "TTWROR – True Time-Weighted Rate of Return",
    description:
      "Misst die reine Anlageperformance unabhängig von Zu- und Abflüssen. Jeder Handelstag wird als eigene Sub-Periode betrachtet; die Tagesrenditen werden geometrisch verkettet.",
    formula: "(1+rᵢ) = (MVE_i + CF_out,i) / (MVB_i + CF_in,i)\nTTWROR = [ ∏(1 + rᵢ) ] − 1",
    variables: [
      { name: "rᵢ", desc: "Cashflow-bereinigte Tagesrendite der Sub-Periode i" },
      { name: "MVB_i", desc: "Marktwert zu Beginn der Sub-Periode i (in CHF)" },
      { name: "MVE_i", desc: "Marktwert am Ende der Sub-Periode i (in CHF)" },
      { name: "CF_in,i", desc: "Zuflüsse (Käufe) innerhalb der Sub-Periode i (addiert zum MVB)" },
      { name: "CF_out,i", desc: "Abflüsse (Verkäufe) innerhalb der Sub-Periode i (addiert zum MVE)" },
    ],
    example: {
      input:
        "Portfolio-Wert: Tag 0 = CHF 10 000, kein Cashflow, Tag 3 = CHF 10 350",
      calculation:
        "Keine Cashflows → r = (MVE + 0) / (MVB + 0) − 1\nr = 10350 / 10000 − 1\nTTWROR = (1.0350) − 1",
      result: "TTWROR = +3.50 % (cashflow-bereinigt)",
    },
    notes:
      "Annualisiert: TTWROR_ann = (1 + TTWROR)^(365/n) − 1, wobei n = Anzahl Tage im Messzeitraum. Bei Cashflows (Käufe/Verkäufe) wird jede Sub-Periode separat berechnet, damit Zu-/Abflüsse die Rendite nicht verzerren.",
  },
  {
    id: "irr",
    category: "Performance",
    title: "IRR – Internal Rate of Return (Geldgewichtete Rendite)",
    description:
      "Berücksichtigt den Zeitpunkt und die Höhe aller Cashflows (Käufe, Verkäufe, Dividenden). Gelöst via Newton-Raphson-Iteration.",
    formula: "−MVB × (1+IRR)^(RD/365) − Σ CFt × (1+IRR)^(RDt/365) + MVE = 0",
    variables: [
      { name: "MVB", desc: "Marktwert zu Beginn des Messzeitraums (in CHF, als Abfluss = negativ)" },
      { name: "MVE", desc: "Marktwert am Ende des Messzeitraums (in CHF, als Zufluss = positiv)" },
      { name: "CFt", desc: "Externer Cashflow zum Zeitpunkt t: Einzahlung = negativ (Abfluss aus Sicht Investor), Auszahlung = positiv" },
      { name: "RD", desc: "Gesamtlänge des Messzeitraums in Tagen" },
      { name: "RDt", desc: "Verbleibende Tage vom Cashflow t bis zum Ende" },
    ],
    example: {
      input:
        "Einzahlung Tag 0: −CHF 10 000, Einzahlung Tag 90: −CHF 5 000, Endwert Tag 365 = CHF 17 500",
      calculation:
        "−10000×(1+IRR)^(365/365) − 5000×(1+IRR)^(275/365) + 17500 = 0\nNewton-Raphson: IRR₀ = 0.15 → iterativ konvergiert",
      result: "IRR ≈ +18.26 % p.a.",
    },
    notes: "Konvergenzkriterium: |f(IRR)| < 1e-8, max. 1000 Iterationen. IRR misst die geldgewichtete Rendite aus Investorensicht: Einzahlungen sind Abflüsse (negativ), der Endwert ist ein Zufluss (positiv).",
  },
  {
    id: "ytd",
    category: "Performance",
    title: "YTD-Performance (Year-to-Date)",
    description:
      "Rendite vom 31. Dezember des Vorjahres (YTD-Baseline) bis zum aktuellen Datum.",
    formula: "YTD = (Wert_heute − Baseline_31Dez) / Baseline_31Dez",
    variables: [
      { name: "Wert_heute", desc: "Aktueller Portfoliowert in CHF" },
      { name: "Baseline_31Dez", desc: "Portfoliowert am letzten Handelstag des Vorjahres" },
    ],
    example: {
      input: "Baseline 31.12.2024 = CHF 85 000, Wert heute (04.07.2025) = CHF 91 200",
      calculation: "YTD = (91200 − 85000) / 85000",
      result: "YTD = +7.29 %",
    },
    notes:
      "Die Baseline wird täglich gespeichert (recompute-ytd-baselines.ts) und bei Transaktionen angepasst.",
  },
  // ─── HOLDINGS ───────────────────────────────────────────────────────────────
  {
    id: "cost-basis",
    category: "Holdings",
    title: "Durchschnittliche Kostenbasis (Avg. Cost Basis)",
    description:
      "Gewichteter Durchschnittspreis aller Käufe einer Position, inklusive Transaktionsgebühren.",
    formula: "AvgCost = Σ(Kaufpreis_i × Stücke_i + Gebühren_i) / Σ Stücke_i",
    variables: [
      { name: "Kaufpreis_i", desc: "Preis pro Aktie beim i-ten Kauf (in CHF)" },
      { name: "Stücke_i", desc: "Anzahl gekaufter Aktien beim i-ten Kauf" },
      { name: "Gebühren_i", desc: "Transaktionsgebühren des i-ten Kaufs (in CHF)" },
    ],
    example: {
      input:
        "Kauf 1: 10 Aktien à CHF 100 + CHF 5 Gebühr\nKauf 2: 5 Aktien à CHF 120 + CHF 3 Gebühr",
      calculation:
        "TotalCost = (10×100 + 5) + (5×120 + 3) = 1005 + 603 = 1608\nStücke = 10 + 5 = 15\nAvgCost = 1608 / 15",
      result: "AvgCost = CHF 107.20 pro Aktie",
    },
    notes:
      "Bei Verkäufen wird die Kostenbasis proportional reduziert: TotalCost_neu = TotalCost × (1 − Verkaufsanteil).",
  },
  {
    id: "unrealized-gain",
    category: "Holdings",
    title: "Unrealisierter Gewinn / Verlust",
    description: "Differenz zwischen aktuellem Marktwert und der Kostenbasis der Position.",
    formula: "UnrealizedGain = (Kurs_aktuell − AvgCost) × Stücke\nUnrealizedGain% = (Kurs_aktuell − AvgCost) / AvgCost × 100",
    variables: [
      { name: "Kurs_aktuell", desc: "Aktueller Kurs der Aktie in CHF" },
      { name: "AvgCost", desc: "Durchschnittliche Kostenbasis pro Aktie in CHF" },
      { name: "Stücke", desc: "Anzahl gehaltener Aktien" },
    ],
    example: {
      input: "Nestlé: 15 Aktien, AvgCost = CHF 107.20, Kurs_aktuell = CHF 95.50",
      calculation:
        "UnrealizedGain = (95.50 − 107.20) × 15 = −11.70 × 15\nUnrealizedGain% = (95.50 − 107.20) / 107.20 × 100",
      result: "UnrealizedGain = −CHF 175.50 (−10.91 %)",
    },
  },
  {
    id: "day-change",
    category: "Holdings",
    title: "Tagesveränderung (Day Change)",
    description:
      "Cashflow-bereinigte Tagesveränderung des Portfolios. Nur reine Preisbewegungen werden gemessen — Käufe und Verkäufe am selben Tag verzerren das Ergebnis nicht. Berechnung symmetrisch: Nur Titel mit Schlusskursen an beiden Tagen fliessen ein.",
    formula: "DayChange_CHF = Σᵢ [ Stücke_i × (Close_i,heute − Close_i,gestern) × FX_i ]\nDayChange% = DayChange_CHF / Σᵢ [ Stücke_i × Close_i,gestern × FX_i ]",
    variables: [
      { name: "Stücke_i", desc: "Anzahl gehaltener Aktien von Titel i" },
      { name: "Close_i,heute", desc: "Schlusskurs von Titel i am letzten Handelstag (aus historicalPrices)" },
      { name: "Close_i,gestern", desc: "Schlusskurs von Titel i am vorletzten Handelstag (aus historicalPrices)" },
      { name: "FX_i", desc: "Aktueller FX-Kurs der Titelwährung → CHF (einheitlich für beide Seiten)" },
    ],
    example: {
      input: "2 Titel: AAPL (10 Stk, USD) Close gestern 210.00, heute 212.50, USDCHF=0.895; NESN (5 Stk, CHF) Close gestern 88.00, heute 88.50",
      calculation: "AAPL: 10 × (212.50 − 210.00) × 0.895 = 10 × 2.50 × 0.895 = +22.38\nNESN: 5 × (88.50 − 88.00) × 1.0 = 5 × 0.50 = +2.50\nBase: 10×210×0.895 + 5×88 = 1879.50 + 440 = 2319.50",
      result: "DayChange = +CHF 24.88 (+1.07 %)",
    },
    notes:
      "Symmetrisches Skipping (R-29): Fehlt für einen Titel einer der beiden Schlusskurse, trägt er weder zur Veränderung noch zur Basisgrösse bei. Damit werden Neu-Einbuchungen am Kauftag nicht als Tagesgewinn gewertet.",
  },
  // ─── REALISIERTE GEWINNE ─────────────────────────────────────────────────────
  {
    id: "realized-gains",
    category: "Realisierte Gewinne",
    title: "Realisierter Gewinn / Verlust",
    description:
      "Gewinn oder Verlust aus abgeschlossenen Positionen (Verkäufe). Berechnet nach der Durchschnittskostenmethode (Average Cost, AvgCost).",
    formula: "RealizedGain = Verkaufserlös − (AvgCost × Verkaufte_Stücke) − Verkaufsgebühren",
    variables: [
      { name: "Verkaufserlös", desc: "Bruttoerlös des Verkaufs in CHF" },
      { name: "AvgCost", desc: "Durchschnittliche Kostenbasis zum Zeitpunkt des Verkaufs" },
      { name: "Verkaufte_Stücke", desc: "Anzahl verkaufter Aktien" },
      { name: "Verkaufsgebühren", desc: "Transaktionsgebühren des Verkaufs in CHF" },
    ],
    example: {
      input:
        "Verkauf: 5 Nestlé-Aktien à CHF 95.50 (Erlös = CHF 477.50), AvgCost = CHF 107.20, Gebühr = CHF 3",
      calculation:
        "Kostenbasis der 5 Stücke = 107.20 × 5 = 536.00\nRealizedGain = 477.50 − 536.00 − 3.00",
      result: "RealizedGain = −CHF 61.50 (Verlust)",
    },
  },
  // ─── FX ─────────────────────────────────────────────────────────────────────
  {
    id: "fx-conversion",
    category: "Währungsumrechnung",
    title: "FX-Umrechnung (Fremdwährung → CHF)",
    description:
      "Fremdwährungspositionen werden für die Portfoliobewertung mit dem aktuellen Tageskurs in CHF umgerechnet. Für historische Transaktionen (Kauf/Verkauf) wird der Kurs am Transaktionsdatum verwendet. FX-Kurse werden von EODHD abgerufen.",
    formula: "Marktwert_CHF = Preis_Fremdwährung × Stücke × FX_Rate(heute, Paar)\nTransaktionswert_CHF = Preis_Fremdwährung × Stücke × FX_Rate(Transaktionsdatum, Paar)",
    variables: [
      { name: "Preis_Fremdwährung", desc: "Aktueller oder historischer Kurs in der Originalwährung (z.B. EUR, USD)" },
      { name: "FX_Rate(heute, Paar)", desc: "Aktueller Wechselkurs für Portfoliobewertung (z.B. USDCHF = 0.8950)" },
      { name: "FX_Rate(Transaktionsdatum, Paar)", desc: "Historischer Wechselkurs am Kauf-/Verkaufsdatum für Kostenbasis" },
    ],
    example: {
      input: "10 Apple-Aktien à USD 212.50 (aktuell), USDCHF heute = 0.8950; Kauf am 15.03.2025 à USD 185.00, USDCHF damals = 0.9120",
      calculation: "Marktwert heute: 10 × 212.50 × 0.8950 = CHF 1 901.88\nKostenbasis: 10 × 185.00 × 0.9120 = CHF 1 687.20",
      result: "Unrealized Gain = CHF 1 901.88 − CHF 1 687.20 = +CHF 214.68",
    },
    notes:
      "Kein stiller Fallback auf 1.0 mehr (R-10, R-13): fehlt ein FX-Kurs, wird ein Fehler geworfen. Für den Day Change wird ein einheitlicher FX-Kurs auf beide Seiten (heute und gestern) angewendet, damit reine FX-Bewegungen nicht als Portfoliogewinn erscheinen.",
  },
  // ─── SIGNALE ─────────────────────────────────────────────────────────────────
  {
    id: "ensemble-signal",
    category: "Signale & Scores",
    title: "Ensemble-Signal-Score",
    description:
      "Kombiniert Trend-, Mean-Reversion- und RSI-Signale zu einem gewichteten Gesamtscore zwischen −1 (starkes Verkaufssignal) und +1 (starkes Kaufsignal).",
    formula: "Score = w_trend × s_trend + w_mr × s_mr + w_rsi × s_rsi",
    variables: [
      { name: "s_trend", desc: "Trend-Signal (MA-Alignment, ADX, Slope, Golden/Death Cross): [−1, +1]" },
      { name: "s_mr", desc: "Mean-Reversion-Signal (RSI, Bollinger, Stochastik): [−1, +1]" },
      { name: "s_rsi", desc: "RSI-Signal aus TradingView-Daten: [−1, +1]" },
      { name: "w_trend / w_mr / w_rsi", desc: "Regime-abhängige Gewichte (Summe = 1)" },
    ],
    example: {
      input:
        "Nestlé: s_trend = +0.60 (Aufwärtstrend), s_mr = −0.20 (leicht überkauft), s_rsi = +0.40\nRegime: Trend → w_trend = 0.55, w_mr = 0.25, w_rsi = 0.20",
      calculation:
        "Score = 0.55×0.60 + 0.25×(−0.20) + 0.20×0.40\n     = 0.330 − 0.050 + 0.080",
      result: "Score = +0.36 → Signal: HOLD (schwach positiv)",
    },
    notes: "Score > 0.5 → BUY, Score < −0.5 → SELL, sonst HOLD.",
  },
  {
    id: "trend-signal",
    category: "Signale & Scores",
    title: "Trend-Signal (MA-Alignment)",
    description:
      "Bewertet den Aufwärts- oder Abwärtstrend anhand von gleitenden Durchschnitten (MA20, MA50, MA200), ADX und Kurssteigung.",
    formula: "s_trend = Σ(Komponente_i × Gewicht_i) / Σ Gewicht_i",
    variables: [
      { name: "MA20 > MA50", desc: "Kurzfristiger Aufwärtstrend: +0.25 Gewicht" },
      { name: "MA50 > MA200", desc: "Langfristiger Aufwärtstrend (Golden Cross): +0.35 Gewicht" },
      { name: "ADX-Komponente", desc: "Trendstärke × Richtung: ADX_norm × Richtung (+1 oder −1): +0.20 Gewicht" },
      { name: "Slope (MA50)", desc: "Steigung des 50-Tage-MA: +0.20 Gewicht" },
    ],
    example: {
      input: "Aktie X: MA20=105, MA50=100, MA200=95, ADX=30, Slope=+0.5",
      calculation:
        "MA20>MA50 ✓ → +1.0×0.25 = +0.25\nMA50>MA200 ✓ (Golden Cross) → +1.0×0.35 = +0.35\nRichtung = +1 (Aufwärtstrend), ADX_norm = 30/50 = 0.60 → +0.60×0.20 = +0.12\nSlope positiv → +0.5×0.20 = +0.10",
      result: "s_trend = (0.25+0.35+0.12+0.10)/1.0 = +0.82 (starker Aufwärtstrend)",
    },
  },
  {
    id: "mean-reversion",
    category: "Signale & Scores",
    title: "Mean-Reversion-Signal (RSI + Bollinger)",
    description:
      "Erkennt überkaufte/überverkaufte Zustände anhand von RSI-14, Bollinger-Bändern und Stochastik.",
    formula: "s_mr = 0.40×s_rsi + 0.35×s_bb + 0.25×s_stoch",
    variables: [
      { name: "s_rsi", desc: "RSI < 30 → +1.0 (überverkauft), RSI > 70 → −1.0 (überkauft)" },
      { name: "s_bb", desc: "Preis am unteren Band → +1.0, am oberen Band → −1.0" },
      { name: "s_stoch", desc: "Stochastik %K = (Close−Low14)/(High14−Low14)×100: %K<20 → +1.0 (überverkauft), %K>80 → −1.0 (überkauft)" },
    ],
    example: {
      input: "Bayer: RSI=28, Preis=28.50, BB_lower=27.80, BB_upper=31.20, BB_mid=29.50, %K=18",
      calculation:
        "s_rsi: RSI=28 < 30 → +1.0 × 0.40 = +0.40\nBB-Position = (28.50−27.80)/(31.20−27.80) = 0.21 → unteres Drittel → +1.0 × 0.35 = +0.35\n%K=18 < 20 → +1.0 × 0.25 = +0.25",
      result: "s_mr = +1.00 (stark überverkauft → starkes Kaufsignal)",
    },
  },
  {
    id: "benchmark-alpha",
    category: "Signale & Scores",
    title: "Alpha (Benchmark-Alpha)",
    description:
      "Misst die Überrendite eines Signals gegenüber dem Markt (S&P 500 / SPI) im Evaluationszeitraum.",
    formula: "Alpha = Rendite_Signal − Rendite_Benchmark",
    variables: [
      { name: "Rendite_Signal", desc: "Tatsächliche Rendite der Aktie nach Signal-Ausgabe (in %)" },
      { name: "Rendite_Benchmark", desc: "Rendite des Benchmarks (S&P 500 oder SPI) im gleichen Zeitraum" },
    ],
    example: {
      input:
        "Kaufsignal für Nestlé am 01.04.2025. Nach 30 Tagen: Nestlé +3.2 %, SPI +1.8 %",
      calculation: "Alpha = 3.2 % − 1.8 %",
      result: "Alpha = +1.4 % (Signal hat den Markt um 1.4 % übertroffen)",
    },
    notes: "Wird in signal_history.alphaPct gespeichert und in der Signal-Performance-Seite ausgewertet.",
  },
  // ─── DCF ─────────────────────────────────────────────────────────────────────
  {
    id: "dcf",
    category: "Bewertung",
    title: "DCF – Discounted Cash Flow (Fairer Wert)",
    description:
      "Schätzt den fairen Wert einer Aktie durch Diskontierung zukünftiger freier Cashflows.",
    formula: "FairerWert = Σ [FCF₀ × (1+g)^t / (1+r)^t] + TV / (1+r)^n\nTV = FCF_n × (1+g_terminal) / (r − g_terminal)",
    variables: [
      { name: "FCF₀", desc: "Aktueller freier Cashflow pro Aktie (in CHF)" },
      { name: "g", desc: "Wachstumsrate der Cashflows (z.B. 5 % p.a.)" },
      { name: "r", desc: "Diskontierungssatz / WACC (z.B. 8 % p.a.)" },
      { name: "n", desc: "Prognosehorizont (Standard: 10 Jahre)" },
      { name: "TV", desc: "Terminal Value (Endwert nach Prognosehorizont)" },
      { name: "g_terminal", desc: "Langfristige Wachstumsrate (Standard: 2.5 %)" },
    ],
    example: {
      input: "Nestlé: FCF₀ = CHF 4.50/Aktie, g = 4 %, r = 8 %, n = 10 Jahre, g_terminal = 2.5 %",
      calculation:
        "Barwerte Jahre 1-10:\nJahr 1: 4.50×1.04/1.08 = 4.33 | Jahr 2: 4.50×1.04²/1.08² = 4.16 | ... | Jahr 10: 4.50×1.04¹⁰/1.08¹⁰ = 3.06\nΣ Barwerte Jahre 1-10 ≈ 36.78\nTerminal Value: TV = (4.50×1.04¹⁰×1.025)/(0.08−0.025) = 124.14\nDiskontierter TV: 124.14/1.08¹⁰ ≈ 57.50\nFairerWert = 36.78 + 57.50",
      result: "Fairer Wert ≈ CHF 94.28 (aktueller Kurs CHF 95.50 → fair bewertet)",
    },
    notes: "Bias-Korrektur (R-31): Wachstumsrate wird auf max. 15 % begrenzt, WACC min. 6 %.",
  },
  // ─── PORTFOLIO-OPTIMIERUNG ────────────────────────────────────────────────────
  {
    id: "sharpe-ratio",
    category: "Portfolio-Optimierung",
    title: "Sharpe Ratio",
    description:
      "Misst die risikoadjustierte Rendite: Überschussrendite pro Einheit Volatilität.",
    formula: "Sharpe = (R_p − R_f) / σ_p",
    variables: [
      { name: "R_p", desc: "Annualisierte Portfolio-Rendite (TTWROR p.a.)" },
      { name: "R_f", desc: "Risikofreier Zinssatz (Standard: 2.5 % = CH-Staatsanleihe)" },
      { name: "σ_p", desc: "Annualisierte Volatilität des Portfolios (Standardabweichung der Tagesrenditen × √252)" },
    ],
    example: {
      input: "R_p = 12 % p.a., R_f = 2.5 %, σ_p = 18 % p.a.",
      calculation: "Sharpe = (0.12 − 0.025) / 0.18 = 0.095 / 0.18",
      result: "Sharpe Ratio = 0.53 (akzeptabel; > 1.0 = gut)",
    },
  },
  {
    id: "volatility",
    category: "Portfolio-Optimierung",
    title: "Volatilität (annualisiert)",
    description:
      "Standardabweichung der täglichen Portfoliorenditen, annualisiert mit dem Faktor √252.",
    formula: "σ_ann = σ_täglich × √252",
    variables: [
      { name: "σ_täglich", desc: "Standardabweichung der täglichen Renditen im Messzeitraum" },
      { name: "252", desc: "Anzahl Handelstage pro Jahr" },
    ],
    example: {
      input: "Tägliche Renditen über 90 Tage: σ_täglich = 1.13 %",
      calculation: "σ_ann = 0.0113 × √252 = 0.0113 × 15.875",
      result: "σ_ann = 17.9 % p.a.",
    },
  },
  {
    id: "max-drawdown",
    category: "Portfolio-Optimierung",
    title: "Maximum Drawdown",
    description:
      "Grösster prozentualer Wertverlust vom Höchststand bis zum nachfolgenden Tiefststand.",
    formula: "MaxDD = min_t [ (V_t − max_{s≤t} V_s) / max_{s≤t} V_s ]",
    variables: [
      { name: "V_t", desc: "Portfoliowert zum Zeitpunkt t" },
      { name: "max_{s≤t} V_s", desc: "Bisheriger Höchstwert bis zum Zeitpunkt t" },
    ],
    example: {
      input: "Portfolio-Verlauf: CHF 100 000 → CHF 115 000 → CHF 88 000 → CHF 105 000",
      calculation:
        "Höchststand = CHF 115 000\nTiefststand danach = CHF 88 000\nMaxDD = (88000 − 115000) / 115000",
      result: "MaxDD = −23.5 %",
    },
  },
  // ─── TRANSAKTIONSGEBÜHREN ─────────────────────────────────────────────────────
  {
    id: "fees",
    category: "Transaktionen",
    title: "Transaktionsgebühren-Normalisierung",
    description:
      "Gebühren werden immer als positive Zahl gespeichert und zum Kaufpreis addiert bzw. vom Verkaufserlös subtrahiert (R-01, R-02, R-05).",
    formula: "Kostenbasis_Kauf = Brutto_Kauf + |Gebühren|\nNettoerlös_Verkauf = Brutto_Verkauf − |Gebühren|",
    variables: [
      { name: "Brutto_Kauf", desc: "Kaufpreis × Stücke (in CHF, ohne Gebühren)" },
      { name: "Brutto_Verkauf", desc: "Verkaufspreis × Stücke (in CHF, ohne Gebühren)" },
      { name: "|Gebühren|", desc: "Absolute Transaktionsgebühren (immer positiv)" },
    ],
    example: {
      input:
        "Kauf: 20 MTU-Aktien à CHF 215.00 = CHF 4 300, Gebühr = CHF 8.50\nVerkauf: 20 MTU-Aktien à CHF 248.00 = CHF 4 960, Gebühr = CHF 8.50",
      calculation:
        "Kostenbasis = 4300 + 8.50 = CHF 4 308.50\nNettoerlös = 4960 − 8.50 = CHF 4 951.50\nRealizedGain = 4951.50 − 4308.50",
      result: "RealizedGain = +CHF 643.00 (+14.93 %)",
    },
  },
];

const CATEGORIES = [...new Set(FORMULAS.map((f) => f.category))];

// ─── Helper: build plain-text representation of a formula ─────────────────
function formulaToText(f: FormulaSection): string {
  const lines: string[] = [
    `═══════════════════════════════════════════════════`,
    `${f.title}  [${f.category}]`,
    `═══════════════════════════════════════════════════`,
    ``,
    `Beschreibung`,
    `────────────`,
    f.description,
    ``,
    `Formel`,
    `──────`,
    f.formula,
    ``,
    `Variablen`,
    `─────────`,
    ...f.variables.map((v) => `  ${v.name.padEnd(28)} ${v.desc}`),
    ``,
    `Konkretes Beispiel`,
    `──────────────────`,
    `Eingabe:`,
    `  ${f.example.input.replace(/\n/g, "\n  ")}`,
    ``,
    `Berechnung:`,
    `  ${f.example.calculation.replace(/\n/g, "\n  ")}`,
    ``,
    `Ergebnis:`,
    `  ${f.example.result}`,
  ];
  if (f.notes) {
    lines.push(``, `Hinweis`, `───────`, f.notes);
  }
  lines.push(``);
  return lines.join("\n");
}

// ─── Helper: build full plain-text document ───────────────────────────────
function buildFullText(formulas: FormulaSection[]): string {
  const header = [
    `PORTFOLIO ANALYSE — BERECHNUNGEN & FORMELN`,
    `Erstellt: ${new Date().toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
    ``,
    `Dieses Dokument enthält die vollständige Dokumentation aller Berechnungen`,
    `im Portfoliomanager – mit Formeln, Variablenerklärungen und Beispielen.`,
    ``,
    ``,
  ].join("\n");
  return header + formulas.map(formulaToText).join("\n");
}

// ─── CopyButton: per-formula text copy ────────────────────────────────────
function CopyButton({ formula }: { formula: FormulaSection }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formulaToText(formula));
      setCopied(true);
      toast.success("Formel kopiert");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  }, [formula]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Formel als Text kopieren"
      className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-teal-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── PDF export via browser print ─────────────────────────────────────────
function exportToPdf(formulas: FormulaSection[]) {
  const text = buildFullText(formulas);
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Berechnungen & Formeln — Portfolio Analyse</title>
<style>
  body { font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.6;
         color: #111; background: #fff; margin: 2cm; }
  pre { white-space: pre-wrap; word-break: break-word; }
  @media print { body { margin: 1.5cm; } }
</style>
</head>
<body><pre>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) { toast.error("Popup blockiert — bitte Popup-Blocker deaktivieren"); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ─── TXT download ─────────────────────────────────────────────────────────
function downloadTxt(formulas: FormulaSection[]) {
  const text = buildFullText(formulas);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `berechnungen-formeln-${new Date().toISOString().split("T")[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Textdatei heruntergeladen");
}

// ─── Main page ─────────────────────────────────────────────────────────────
export default function AdminBerechnungen() {
  const [activeCategory, setActiveCategory] = useState<string>("Alle");
  const [search, setSearch] = useState("");
  const [copiedAll, setCopiedAll] = useState(false);

  const filtered = FORMULAS.filter((f) => {
    const matchCat = activeCategory === "Alle" || f.category === activeCategory;
    const matchSearch =
      !search ||
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      f.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleCopyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildFullText(filtered));
      setCopiedAll(true);
      toast.success(`${filtered.length} Formeln kopiert`);
      setTimeout(() => setCopiedAll(false), 2500);
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  }, [filtered]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Berechnungen & Formeln</h1>
            <p className="text-zinc-400 mt-1 text-sm">
              Vollständige Dokumentation aller Berechnungen im Portfoliomanager – mit Formeln,
              Variablenerklärungen und konkreten Beispielen aus dem System.
            </p>
          </div>
          {/* Export actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyAll}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white gap-1.5"
            >
              {copiedAll ? <Check className="h-3.5 w-3.5 text-teal-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedAll ? "Kopiert!" : `Alle kopieren (${filtered.length})`}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadTxt(filtered)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              TXT
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToPdf(filtered)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              PDF
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 w-56 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <div className="flex flex-wrap gap-2">
            {["Alle", ...CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-teal-500 text-zinc-900"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Formula cards */}
        <div className="space-y-4">
          {filtered.map((f) => (
            <Card key={f.id} className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-zinc-100 text-base">{f.title}</CardTitle>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-teal-400 border-teal-800 text-xs">
                      {f.category}
                    </Badge>
                    <CopyButton formula={f} />
                  </div>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">{f.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Formula */}
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Formel</p>
                  <pre className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-teal-300 text-sm font-mono whitespace-pre-wrap leading-relaxed">
                    {f.formula}
                  </pre>
                </div>

                {/* Variables */}
                <div>
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Variablen</p>
                  <div className="grid gap-1.5">
                    {f.variables.map((v) => (
                      <div key={v.name} className="flex gap-3 text-sm">
                        <span className="font-mono text-amber-400 shrink-0 min-w-[120px]">{v.name}</span>
                        <span className="text-zinc-400">{v.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Example */}
                <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Konkretes Beispiel</p>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Eingabe</p>
                    <p className="text-sm text-zinc-300 whitespace-pre-line">{f.example.input}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Berechnung</p>
                    <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap">{f.example.calculation}</pre>
                  </div>
                  <div className="border-t border-zinc-800 pt-3">
                    <p className="text-xs text-zinc-500 mb-1">Ergebnis</p>
                    <p className="text-sm font-semibold text-teal-400">{f.example.result}</p>
                  </div>
                </div>

                {/* Notes */}
                {f.notes && (
                  <div className="flex gap-2 text-sm text-zinc-500">
                    <span className="text-zinc-600">ℹ</span>
                    <span>{f.notes}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              Keine Berechnungen gefunden für "{search}".
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
