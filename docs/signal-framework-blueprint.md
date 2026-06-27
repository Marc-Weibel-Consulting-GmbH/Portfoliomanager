# Signal Framework Blueprint — Regime-basiertes Signal-Orchestrierungssystem

**Version:** 1.0 | **Datum:** 27.06.2026 | **Status:** Implementierungsbereit

---

## 1. Ist-Analyse

### Bestehende relevante Module

| Modul | Pfad | Funktion | Wiederverwendung |
|---|---|---|---|
| `marketRegimeRouter` | `server/routers/marketRegimeRouter.ts` | Trend-, Breadth-, Volatility-Engines für Markt-Regime (3-stufig: bullish/neutral/bearish) | **Erweitern** → 6-stufige Regime-Klassifikation |
| `lpplsEngine` | `server/analytics/lpplsEngine.ts` | LPPLS Bubble-Detection, gibt `bubbleScore [-1,1]`, `regime`, `posBubbleConfidence` zurück | **Direkt nutzen** als `lpplRisk` Feature im regimeEngine |
| `qualityMomentumEngine` | `server/analytics/qualityMomentumEngine.ts` | Quality-Score (ROE, D/E, Margen) + Momentum-Score (1M/3M/6M/12M Returns) | **Direkt nutzen** in ensembleSignalEngine |
| `riskStats` | `server/analytics/riskStats.ts` | Sharpe, Sortino, Calmar, MaxDrawdown, Volatilität (pure functions) | **Direkt nutzen** im modelSelector |
| `signalFeatures` | `server/analytics/signalFeatures.ts` | 7 technische Features (RSI, Returns, Volatilität, SMA50) | **Erweitern** um ADX, ATR, Bollinger |
| `signalService` | `server/analytics/signalService.ts` | GB/RF Signal-Serving mit source-Transparenz | **Beibehalten** (unverändert) |
| `signalsRouter` | `server/routers/signalsRouter.ts` | Bestehende Signal-Generierung (Yahoo Finance + Quality + Momentum + LPPL) | **Erweitern** um orchestriertes Signal |
| `backtestRouter` | `server/routers/backtestRouter.ts` | Signal-Backtest mit Entry/Exit, Stop-Loss, Transaktionskosten | **Beibehalten** (unverändert) |
| `scoring.ts` | `server/scoring.ts` | Dividend/Growth Stock Scoring (Fundamental) | **Beibehalten** (unverändert, andere Domäne) |

### Identifizierte Konflikte / Risiken

1. **Doppelte Regime-Logik**: `marketRegimeRouter` hat bereits eine 3-stufige Regime-Klassifikation. Das neue `regimeEngine` muss diese **ersetzen**, nicht duplizieren. Der Router wird auf `regimeEngine` umgestellt.
2. **Score-Quellen**: `scoring.ts` (Fundamental), `qualityMomentumEngine` (QM), `tradingview.stockScoring` (Momentum+Quality+LPPL) und das neue Framework dürfen nicht als "vierte Wahrheit" erscheinen. Das neue Framework **integriert** QM und LPPL, ersetzt aber nicht `scoring.ts`.
3. **Fehlende historische Preise für ADX/ATR**: Diese Features benötigen 14+ Tage Daten. `fetchHistoricalPrices` liefert diese bereits.
4. **Annahme**: `meanReversionSignalEngine` und `breakoutSignalEngine` werden als **Stub** implementiert (Struktur vorhanden, Logik minimal) — vollständige Implementierung in Phase 2.

---

## 2. Zielarchitektur

### Datenfluss

```
[EODHD Historical Prices]
         │
         ▼
  [regimeEngine]  ←── lpplsEngine (bubbleScore)
         │
    RegimeSnapshot
    {regime, confidence, features}
         │
         ├──► [trendSignalEngine]      → SignalOutput
         ├──► [meanReversionEngine]    → SignalOutput (stub)
         ├──► [breakoutSignalEngine]   → SignalOutput (stub)
         └──► [ensembleSignalEngine]   → SignalOutput (QM + Momentum + LPPL)
                    │
                    ▼
             [modelSelector]
             (wählt beste Engine je Regime)
                    │
                    ▼
            [riskOverlayEngine]  ←── lpplRisk, volatility, drawdown
                    │
                    ▼
            [signalOrchestrator]
                    │
               PortfolioAction
    {action, conviction, rationale, regime, selectedModel, ...}
```

### Neue Dateien

| Datei | Verantwortlichkeit |
|---|---|
| `server/lib/signals/types.ts` | Alle TypeScript-Interfaces (MarketRegime, SignalOutput, PortfolioAction, etc.) |
| `server/lib/signals/regimeEngine.ts` | 6-stufige Regime-Klassifikation (transparent, regelbasiert) |
| `server/lib/signals/trendSignalEngine.ts` | MA-Alignment, ADX, Slope-basiertes Trend-Signal |
| `server/lib/signals/ensembleSignalEngine.ts` | Composite aus Trend + QM + LPPL + Oscillatoren |
| `server/lib/signals/meanReversionSignalEngine.ts` | RSI/Stoch Mean-Reversion (Stub für V1) |
| `server/lib/signals/breakoutSignalEngine.ts` | Range-Breakout, Donchian (Stub für V1) |
| `server/lib/signals/modelSelector.ts` | Multi-Metrik Modellauswahl je Regime |
| `server/lib/signals/riskOverlayEngine.ts` | LPPL + Volatilität + Drawdown Risk-Filter |
| `server/lib/signals/signalOrchestrator.ts` | Zentrale Koordination aller Module |
| `server/lib/signals/index.ts` | Public API Export |
| `server/routers/signalOrchestratorRouter.ts` | tRPC Procedure: `signals.orchestrate` |
| `server/__tests__/signalFramework.test.ts` | Unit-Tests für alle Engines |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `server/routers/marketRegimeRouter.ts` | `getRegime` Procedure nutzt `regimeEngine` statt eigener Logik |
| `server/routers/signalsRouter.ts` | `generate` Procedure ergänzt `orchestratedSignal` Feld |
| `client/src/pages/Invest.tsx` | Zeigt `orchestratedSignal.action` + `conviction` |
| `client/src/components/stock/PredictionTab.tsx` | Zeigt `PortfolioAction` mit Rationale |

### Gewichtungsformel modelSelector (zentral dokumentiert)

```
totalScore =
  0.20 × sharpe
+ 0.15 × sortino
+ 0.15 × calmar
+ 0.10 × profitFactor
+ 0.10 × stabilityScore   // Std der Sharpe über 3 Subperioden
+ 0.10 × walkForwardScore // OOS/IS Ratio (1.0 = kein Overfitting)
+ 0.10 × costResilience   // Sharpe nach 0.5% Transaktionskosten
- 0.10 × turnoverPenalty  // Normiert auf [0,1], 1 = täglicher Wechsel
```

**Annahmen / Risiken:**
- Für V1 hat der modelSelector keine historischen Backtest-Daten pro Regime → er wählt basierend auf dem aktuellen Signal-Konfidenz-Score. Walk-Forward-Daten werden in Phase 2 ergänzt.
- `meanReversionSignalEngine` und `breakoutSignalEngine` geben in V1 immer `direction: 0` zurück (Stub).

---

## 3. Implementierungsreihenfolge (Phase 3)

1. `types.ts` — Interfaces definieren
2. `regimeEngine.ts` — Kern-Logik, nutzt bestehende `fetchHistoricalPrices`
3. `trendSignalEngine.ts` — MA, ADX, Slope
4. `ensembleSignalEngine.ts` — QM + LPPL + Oscillatoren
5. `meanReversionSignalEngine.ts` + `breakoutSignalEngine.ts` — Stubs
6. `modelSelector.ts` — Multi-Metrik Auswahl
7. `riskOverlayEngine.ts` — LPPL + Volatilität Filter
8. `signalOrchestrator.ts` — Koordination
9. Router + Frontend
10. Tests
