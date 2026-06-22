# Mockup-Index — Soll-Zustand (Claude Design)

Quelle: `Portfoliomanager_Mockup.pdf` (20 Seiten), gerendert als `page-01.jpg … page-20.jpg`.
Diese Bilder sind die **visuelle Ground-Truth** für den Ralph-Loop. Markenfarben: BG `#0a0f1a`,
Card `#0f1420`, Akzent (Teal) `#00CFC1`. Sidebar links, 6 Top-Level-Einträge.

| Seite | Screen | Tab / Inhalt | Ziel-Route | Ziel-Datei |
|------:|--------|--------------|-----------|-----------|
| 01 | Portfolio-Detail | Übersicht (WERT/YTD/GESAMT/SHARPE, Wertentwicklung, Top-Positionen, Letzte Aktivität) | `/portfolios/:id?tab=uebersicht` | `pages/PortfolioDetailsPage.tsx` |
| 02 | Portfolio-Detail | Positionen (Tabelle: Titel/Sektor/Wert/Anteil/Einstand/Rendite) | `/portfolios/:id?tab=positionen` | `components/portfolio/PositionsTab.tsx` |
| 03 | Portfolio-Detail | Transaktionen (KPIs + Tabelle + Filter Käufe/Verkäufe + Export) | `/portfolios/:id?tab=transaktionen` | `components/portfolio/TransactionsTab.tsx` |
| 04 | Portfolio-Detail | Performance (Performance vs. Benchmarks, Annualisiert, Bester/Schlechtester Monat) | `/portfolios/:id?tab=performance` | `components/portfolio/PerformanceTab.tsx` |
| 05 | Portfolio-Detail | Risiko (Risiko-Kennzahlen, Bubble-Indikator LPPL) | `/portfolios/:id?tab=risiko` | `components/portfolio/RiskTab.tsx` |
| 06 | Portfolio-Detail | Optimierung (KI-Empfehlungen, Effizienzgrenze) | `/portfolios/:id?tab=optimierung` | `components/portfolio/OptimierenTab.tsx` |
| 07 | Aktien-Detail | Übersicht (Preis, Kennzahlen, In meinen Portfolios) | `/aktien/:ticker?tab=uebersicht` | `pages/StockDetail.tsx` |
| 08 | Aktien-Detail | Signale (Gesamt-Score Gauge + 7 Einzel-Signale) | `/aktien/:ticker?tab=signale` | `components/stock-detail/SignalsTab.tsx` |
| 09 | Aktien-Detail | Chart & TA (Kurs + technische Analyse, Zeitraum-Toggle) | `/aktien/:ticker?tab=chart` | `components/stock-detail/ChartTab.tsx` |
| 10 | Aktien-Detail | Bewertung DCF (Fair Value, Annahmen, Sensitivitäts-Heatmap) | `/aktien/:ticker?tab=bewertung` | `components/stock-detail/DcfTab.tsx` |
| 11 | Aktien-Detail | KI-Prognose (30-Tage-Forecast, Median/Pro Woche) | `/aktien/:ticker?tab=prognose` | `components/stock-detail/PredictionTab.tsx` |
| 12 | Aktien-Detail | Backtest (Strategie-Vergleich Buy&Hold/MA-Cross/RSI/Benchmark) | `/aktien/:ticker?tab=backtest` | `components/stock-detail/BacktestTab.tsx` |
| 13 | Markt-Hub | Überblick (SMI/S&P/MSCI/Gold + Indizes YTD) | `/markt?tab=ueberblick` | `pages/Markt.tsx` |
| 14 | Markt-Hub | Regime (Aktuelles Regime, VIX/Yield/LPPL, Regime-Verlauf) | `/markt?tab=regime` | `components/markt/RegimeTab.tsx` |
| 15 | Markt-Hub | Heatmap (Sektor-Heatmap, Toggle 1T/1W/1M/YTD) | `/markt?tab=heatmap` | `components/markt/HeatmapTab.tsx` |
| 16 | Markt-Hub | News (kuratiert, Filter Alle/Schweiz/Europa/USA/Asien) | `/markt?tab=news` | `components/markt/NewsTab.tsx` |
| 17 | Markt-Hub | Dividenden-Kalender (nächste 30 Tage, eigene Positionen) | `/markt?tab=dividenden` | `components/markt/DividendenTab.tsx` |
| 18 | Copilot | Insights (≥3 priorisierte Karten) | `/copilot?tab=insights` | `pages/PortfolioCopilot.tsx` |
| 19 | Copilot | Chat (Streaming-Antwort) | `/copilot?tab=chat` | `components/copilot/ChatTab.tsx` |
| 20 | Copilot | History (letzte Konversationen, klickbar) | `/copilot?tab=history` | `components/copilot/HistoryTab.tsx` |

Detail-Specs je Screen: `design/handoff/03-Screens.md`. Routen-Mapping & Redirects: `design/handoff/02-IA-Routes.md`.
