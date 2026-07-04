# Review-Mockups — Klassifikation (Block 2a)

18 PNGs, extrahiert aus den Review-Dokumenten des Auftraggebers (Teil 1–3).
Klassifikation: **MOCKUP** = Claude-Design-Zielentwurf (zu bauen) ·
**SCREENSHOT** = Ist-Zustand der App (annotierte Problem-Illustration).

| Datei | Typ | Zeigt | Plan-Bezug |
|---|---|---|---|
| teil1-image1.png | **MOCKUP** | **Neues Dashboard** (Ziel-Design F-01): Eyebrow «DASHBOARD», «Willkommen zurück, Marc», Untertitel «Aggregiert über alle Live-Portfolios · Daten von heute, 10:37»; rechts Scope-Leiste (Aggregiert + einzelne Portfolios — laut Auftraggeber Punkt 3 als Dropdown umzusetzen); KPI-Reihe GESAMTWERT (Live-Punkt, Tagesveränderung CHF/%) · YTD (Info-Icon, darunter SMI/MSCI-Vergleich) · SHARPE (Benchmark-Zeile) · BUBBLE (x/100, Label); darunter Performance-Chart (Portfolio · SMI · MSCI World, Toggle 1T/1M/YTD/1J/Max) und Allokation-Donut (Sektor · Region, Legende mit %). Unterer Teil abgeschnitten. | **F-01** |
| teil1-image2.png | SCREENSHOT | KPI-Zeile der alten Portfolios-Übersicht: Performance YTD −9.30 % (Ø Live Portfolios) · vs. Benchmark −16.82 % (S&P 500) · Div. Rendite 2.73 % — die KPI, die laut Punkt 5 erhalten bleiben. | F-01 (KPI-Reihe behalten) |
| teil1-image3.png | SCREENSHOT | Copilot-Insights-Karte der aktuellen App (LIVE-Badge, «5 neue · AI · vor 12 Min.», Karten mit CTA-Buttons «Sektoren überprüfen», «Top-Positionen analysieren», «Liquidität prüfen», «Regionale Verteilung ansehen») — illustriert die Buttons, die statt Navigation Aktions-Pop-ups öffnen sollen. Folgt in Teil 1 direkt auf das Dashboard-Mockup → Insights gehören aufs neue Dashboard. | F-02 (Pop-ups), F-12 (Insights → Dashboard), F-01 |
| teil1-image4.png | SCREENSHOT (annotiert) | Portfolio-Detail «Test Portfolio Marc», Tab Übersicht; rote Ellipse um «Top-Positionen nach Gewicht» → Positionen sollen klickbar zur Aktien-Detailseite sein. | F-04 |
| teil1-image5.png | SCREENSHOT | Positionen-Konstellation: Bubbles unten links zusammengequetscht, HOLN-Ausreisser (39) oben rechts ausserhalb — Achsen-/Daten-Problem. | F-05 + R-30 |
| teil1-image6.png | SCREENSHOT | Risiko-Tab: Risiko-Kennzahlen + Bubble-Indikator mit leeren grünen Boxen unten («Funktion?»). | F-08 |
| teil1-image7.png | SCREENSHOT | Optimieren-Tab: KI-Empfehlungen mit Extrem-Positionen (SGKN 10.5 %→47 %, vier Titel →0 %) + Effizienzgrenze als Punktwolke ohne Kurve. | R-34 |
| teil1-image8.png | **MOCKUP** | Optimieren-Tab-Zielentwurf (Claude-Design-Prototyp-Banner): KI-Empfehlungen als Karten mit «Anwenden»-Buttons + **Effizienzgrenze** mit Kurve, Punkten «Optimum»/«Aktuell» (das «Effizienzgrenze-Mockup» am Ende von Teil 1). | R-34, F-02 |
| teil2-image1.png | SCREENSHOT | Aktien-Detail PATH, Tab Übersicht (aktuelle App): Header-Score 64/100 vs. Strategie-Scoring 40.7/100 (SELL) gleichzeitig sichtbar — Score-Verwirrung; Moats, Financial Highlights, Kennzahlen-Kacheln. | R-33, F-07, F-10 |
| teil2-image2.png | SCREENSHOT | Aktien-Detail PATH, Tab Signale (aktuelle App): «Gesamtsignal (TA) NEUTRAL Score 50/100» (Keine-Daten-Default) + Multi-Timeframe alles NEUTRAL. | R-33, F-07 |
| teil2-image3.png | **MOCKUP** | **Signale-Tab-Zielentwurf** (Prototyp-Banner, Nestlé): Gesamt-Score-Gauge 78/100 «Kaufen» aggregiert aus 7 Signalen + Einzel-Signale-Balken (Trend/Momentum/Mean Reversion/Volatilität/Value (DCF)/Quality/Sentiment) mit deutschen Labels. | F-10, F-14 |
| teil2-image4.png | SCREENSHOT | Aktien-Detail PATH, Tab Bewertung (DCF) (aktuelle App): «Bewertung & Fair Value»-Kacheln, DCF-Analyse-Button, PEG-Analyse & Qualitätsbewertung mit Quadrant. | R-32, F-10 |
| teil2-image5.png | **MOCKUP** | **Bewertung-(DCF)-Zielentwurf** (Prototyp-Banner, Nestlé): DCF-Bewertung mit Aktueller Preis vs. Fair Value (+20.6 % Upside), Annahmen-Block, Sensitivitäts-Analyse als WACC×Wachstum-Heatmap. | F-10 |
| teil2-image6.png | SCREENSHOT | Signal-Framework der aktuellen App (Signal-Dashboard PATH): Markt-Regime «Krisenregime 100 %», Empfehlung HALTEN, Engine-Vergleich (Trend/Mean Reversion/Breakout/2× Ensemble), Modelselector, Risk Overlay GESPERRT — zu technisch, soll in die Signale-Seite integriert werden. | F-09, F-14 |
| teil3-image1.png | **MOCKUP** | **Markt-Hub Überblick** (Zielentwurf): Tabs Überblick/Regime/Heatmap/News/Dividenden-Kalender; Index-Kacheln SMI · S&P 500 · MSCI World · Gold (USD) mit Tagesveränderung + YTD; Chart «Indizes Performance YTD». (Bereits weitgehend als `MarktHub.tsx` umgesetzt; Indexstände-Korrektur = R-35.) | F-11, R-35 |
| teil3-image2.png | SCREENSHOT (im Hub-Rahmen) | Regime-Tab Ist-Zustand: «Aggregierter Score: 0.36371494146529343/100» (unformatiert), Equity Allocation 80 %, Regime-Multiplikator 1.2x, 7 technische Ampel-Karten (RSP/SPY, VIX, TLT/USD, HYG/LQD, LPPLS …) — zu technisch/fehlerhaft formatiert. | F-11 |
| teil3-image3.png | **MOCKUP** | **Regime-Tab-Zielentwurf** (Prototyp-Banner): «Aktuelles Regime: Bull · Niedrige Vola, seit 14 Wochen» + nur 3 Kennzahlen (VIX, Yield Curve, LPPL Bubble) + Balken «Regime-Verlauf · 12 Monate» mit Legende. | F-11 |
| teil3-image4.png | SCREENSHOT | Portfolio-Detail «Test Portfolio Marc», Tab Übersicht (ohne Annotation): Kontext in Teil 3 für den Wunsch «Dividendenkalender mit Live-Zahlen des aktuellen Portfolios» (Dividenden-Tab im Portfolio-Detail). | F-06, R-31 |

## Notizen zur F-01-Umsetzung (Block 2a)

- **Dashboard-Mockup (teil1-image1)** ist nur bis unterhalb der ersten Chart-Reihe
  sichtbar. Unterhalb wurden gemäss Bildfolge in Teil 1 (image3 = Copilot Insights)
  und Aufgabenstellung die bestehenden Komponenten `CopilotInsights` (inkl.
  Aktions-Dialog, von der Portfolios-Seite hierher verschoben — keine
  Doppel-Anzeige, vgl. D-11/F-12) und `PositionsTreemap` («Positionen nach
  Gewicht», Datenquelle `dashboard.getAggregatedHoldings`) platziert.
- **Datenabweichungen zum Mockup:** «Daten von heute, 10:37» → Client-Uhrzeit beim
  Laden; Benchmark-Zeile unter YTD nutzt `benchmarkSmiYtd`/`benchmarkMsciYtd` aus
  `getAggregatedMetrics` (YTD-fix, unabhängig vom Chart-Zeitraum, wie im Mockup);
  Sharpe-«Benchmark»-Zeile = `sharpeBenchmark` (SMI). Der Portfolio-Chart im Mockup
  ist violett — umgesetzt in App-Primärfarbe #00CFC1 (Token-Konvention), SMI/MSCI
  als gestrichelte Linien wie im Mockup.
- **Scope-Auswahl:** Statt der Button-Reihe des Mockups gemäss Auftraggeber-Punkt 3
  ein «Aggregiert»-Button + Dropdown für einzelne Portfolios. Alle
  Dashboard-Endpoints (`getAggregatedMetrics`, `getPerformanceTimeseries`,
  `getSectorAllocation`, `getRegionAllocation`, `getRiskMetrics`,
  `getAggregatedHoldings`, `getCopilotInsights`) unterstützen `scope` bereits.
  Bubble-Indikator bleibt global (Markt-Indikator, identisch für alle Portfolios).
- **Portfolios-Übersicht übernimmt alte Dashboard-Inhalte:** TickerBar, Markt-Puls,
  KI-Analyse und Anstehende Termine wurden nach
  `components/dashboard/MarketSections.tsx` extrahiert und auf der
  Portfolios-Seite eingebunden. **Nicht** übernommen: `PortfolioCompact`
  (redundant zur Portfolio-Kachel-Übersicht derselben Seite) und `QuickActions`
  (Verweise existieren auf der Seite/Nav bereits, u. a. «Neues Portfolio»).
