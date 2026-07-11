# Konzept: Markt-Regime-Seite (Redesign)

> Freigegeben. Skala **−100…+100**, «Für mich» ans Anlageprofil koppeln, Regime-Verlauf als
> eigene spätere Stufe (R4). Visuelles Konzept: Marktampel + erklärte Signal-Dimensionen.

## Ausgangslage / Bugs

Die Seite verdichtet 7 gewichtete Signal-Engines zu einem Gesamt-Regime. Der Motor ist gut, die
Darstellung verfälscht ihn. Drei echte Fehler:

1. **Score** `overallScore` (Skala −1…+1) wird roh als Fliesskomma mit «/100» angezeigt.
2. **Balken** nehmen den Score (−1…+1) als Prozentbreite → praktisch leer.
3. **Karten-Titel** zeigen das *Niveau* (`engine.label` = Bullish/Neutral/Bearish) statt der
   *Dimension* (Trend, Volatilität, …).

## Dimensionen (echt, mit Gewicht)

| Key | Name | Was es misst | Gewicht |
|---|---|---|---|
| trend | Trend | Aktien über 200-Tage-Schnitt, Golden Cross, 12M-Momentum | 30 % |
| volatility | Volatilität | VIX-Niveau & -Trend | 20 % |
| breadth | Marktbreite | Gleich- vs. kapitalgewichtet (RSP/SPY) | 15 % |
| liquidity | Liquidität | Zinsen & USD-Impuls | 15 % |
| credit | Credit-Spreads | Ramsch- vs. Qualitätsanleihen (HYG/LQD) | 10 % |
| sentiment | Stimmung | VIX-Extreme (kontrarisch) | 5 % |
| bubble | Blasenrisiko | LPPL-Überhitzung | 5 % |

## Redesign

- **Marktampel-Gauge** (Risk-Off ↔ Risk-On, Nadel am Score −100…+100) + Klartext-Satz +
  Handlungsrahmen (empf. Aktienquote, Regime-Multiplikator) als Konsequenz gerahmt.
- **7 Dimensionen benannt/gewichtet/erklärt**: divergierender Balken (rot ↔ grün), Level-Chip,
  Schlüsselsignal, Info-Tooltip (was/warum), ehrliche Datenzustände («Ungenügend Daten»/«Fehler»).
- **«Was heisst das für mich?»**: Regime × Anlageprofil → persönliche Einordnung.
- **Transparenz**: Gewichte sichtbar, Stand + Quelle.

## Stufen

| Stufe | Inhalt |
|---|---|
| **R1–R3** | Bugfixes + Marktampel-Hero + Transparenz/Glossar (rein Client, keine neue Datenquelle). |
| **R5** | «Für mich» (Regime × Anlageprofil). |
| **R4** | Regime-Verlauf (90-Tage-Sparkline) — braucht tägliche Score-History (kleine Tabelle + Cron). |
