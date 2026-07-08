# Externe Formel-Prüfung – 8. Juli 2026

## Zusammenfassung der Befunde

| Bereich | Status | Befund |
|---------|--------|--------|
| TTWROR | ⚠️ teilweise falsch | Tagesrendite ignoriert Cashflows; Beispiel: +3.50%, nicht +3.48% |
| IRR | ❌ falsch | Vorzeichenlogik inkonsistent; korrekt: ~18.26% p.a., nicht 16.2% |
| YTD | ⚠️ nur ohne Cashflows korrekt | Für echte Performance: TTWROR-Logik ab Jahresbeginn |
| Avg. Cost Basis | ✅ korrekt | Formel stimmt |
| Realized Gain / FIFO | ❌ Widerspruch | Beschreibung sagt FIFO, Formel nutzt AvgCost |
| Day Change | ⚠️ nur ohne heutige Cashflows korrekt | Cashflows herausrechnen für echte Tagesperformance |
| FX-Umrechnung | ✅/⚠️ grundsätzlich korrekt | Bewertungsdatum-FX für Marktwerte, nicht Transaktionsdatum |
| DCF | ❌ Zahlenbeispiel falsch | Korrekt: CHF 94.28, nicht CHF 82.40 |
| Sharpe, Volatilität, Max Drawdown, Gebühren | ✅ korrekt | Stimmt |
| Trend-/Mean-Reversion-Signale | ⚠️ methodisch unsauber | ADX falsch als positives Signal; Stochastik unklar definiert |

## Kritische Korrekturen (Priorität)

### 1. IRR – Vorzeichen und Beispiel
- Korrekte Formel: `-10000(1+r)^1 - 5000(1+r)^(275/365) + 17500 = 0`
- Korrekt: IRR ≈ 18.26% p.a. (nicht 16.2%)
- Hinweis: Auf Portfolioebene = externe Cashflows (Ein-/Auszahlungen), nicht Käufe/Verkäufe

### 2. FIFO vs. AvgCost entscheiden
- Aktuell: Beschreibung sagt FIFO, Code nutzt AvgCost → Widerspruch
- Entscheidung nötig: Variante A (AvgCost, Beschreibung anpassen) oder Variante B (FIFO, Lots ausbuchen)

### 3. TTWROR cashflow-bereinigt
- Korrekte Formel: `(1+r_i) = (MVE_i + CF_out,i) / (MVB_i + CF_in,i)`
- Beispiel: 10350/10000 - 1 = 3.50% (nicht 3.48%)

### 4. DCF-Beispiel
- Barwerte Jahre 1-10: ~36.78
- Terminal Value Jahr 10: 4.50 × 1.04^10 × 1.025 / (0.08 - 0.025) ≈ 124.14
- Diskontierter TV: 124.14 / 1.08^10 ≈ 57.50
- Fairer Wert: 36.78 + 57.50 = **CHF 94.28** (nicht 82.40)

### 5. Trend-Signal (ADX)
- Problem: ADX misst Stärke, nicht Richtung
- Falsch: `ADX > 25 → +0.20`
- Besser: `ADX_Komponente = Trendrichtung × ADX_Stärke`
- Trendrichtung aus MA-Struktur: MA20 > MA50 > MA200 = positiv

### 6. Mean-Reversion / Stochastik
- s_stoch ist eigentlich Abweichung vom Mittelwert, nicht echte Stochastik
- Echte Stochastik: `%K = (Close - Low14) / (High14 - Low14) × 100`
- Oder Komponente umbenennen: s_deviation oder s_zscore

## Korrekte Formeln (zur Referenz)

### TTWROR (cashflow-bereinigt)
```
(1+r_i) = (MVE_i + CF_out,i) / (MVB_i + CF_in,i)
TTWROR = ∏(1+r_i) - 1
```

### YTD (korrekt für echte Performance)
```
YTD = ∏(1+r_i) - 1  [ab Jahresbeginn]
```

### IRR (korrekte Vorzeichenlogik)
```
-MVB × (1+r)^(RD/365) - ΣCF_t × (1+r)^(RDt/365) + MVE = 0
```

### DCF (korrekt)
```
TV_n = FCF_0 × (1+g)^n × (1+g_terminal) / (r - g_terminal)
FairValue = Σ[FCF_0×(1+g)^t / (1+r)^t] + TV_n/(1+r)^n
```
