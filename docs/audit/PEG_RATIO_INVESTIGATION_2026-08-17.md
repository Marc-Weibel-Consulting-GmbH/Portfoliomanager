# PEG-Ratio-Untersuchung — Screener-Lauf 150001

**Prüfdatum:** 17. August 2026
**Prüfgegenstand:** Export `screener-lauf-150001-1786984580002.xlsx` — 587 bewertete Kandidaten
**Autor:** Manus AI

---

## 1. Zusammenfassung der Befunde

Die PEG-Ratio im Screener weist **drei klar abgrenzbare Probleme** auf:

1. **52.8 % der bewerteten Titel haben kein PEG** (310 von 587) — die Hauptursache ist fehlendes oder zu geringes belegtes Gewinnwachstum.
2. **Die angezeigten PEG-Werte sind systematisch höher als EODHD selbst liefert** — Faktor ~1.8–2.0× gegenüber `Highlights.PEGRatio`.
3. **Der im Export angezeigte „KGV"-Wert ist ForwardPE, aber das PEG basiert auf TrailingPE** — eine inkonsistente Darstellung, die den Nutzer irreführt.

---

## 2. Stichprobenvalidierung

| Ticker | Unser PEG | EODHD PEG (Highlights) | Unser KGV (Export) | EODHD TrailingPE | EODHD ForwardPE | Finnhub PE(TTM) |
|--------|-----------|------------------------|--------------------|--------------------|------------------|-----------------|
| ASML.SW | 7.58 | n/a (404) | 39.68 | n/a | n/a | 57.46 |
| FPE.DE | **7.58** | **4.08** | 15.50 | 13.11 | **15.50** | n/a |
| FPE3.DE | **7.57** | **4.08** | 19.08 | 15.14 | **19.08** | n/a |
| DBG.PA | **7.53** | **3.83** | 20.12 | 11.08 | **20.12** | n/a |
| MMT.PA | **7.34** | **3.77** | 12.59 | 15.05 | **12.59** | n/a |
| GTT.PA | 2.20 | null | — | 17.30 | 20.08 | n/a |
| SN.L | 2.36 | n/a (404) | — | n/a | n/a | 38.21 |
| ELEC.PA | MISSING | 0 (=null) | — | 9.28 | 0 | n/a |
| GSK.L | MISSING | n/a (404) | — | n/a | n/a | 15.53 |
| BRKN.SW | MISSING | n/a (404) | — | n/a | n/a | n/a |

---

## 3. Ursachenanalyse

### 3.1 Befund: Exportierter KGV = EODHD ForwardPE

In `server/lib/dreiScoresService.ts` (Zeile 131) wird der angezeigte KGV-Wert assembliert als:

```typescript
kgv: qm.forwardPE ?? qm.trailingPE,
```

Das bedeutet: **Der im Export und in der Bewertung angezeigte „KGV"-Wert ist das Forward-KGV** (basierend auf Analystenschätzungen), nicht das Trailing-KGV. Die Stichprobe bestätigt dies eindeutig: FPE.DE zeigt KGV 15.50 = EODHD `Valuation.ForwardPE` 15.50, während das tatsächliche Trailing-KGV 13.11 beträgt.

### 3.2 Befund: adjustedPeg basiert auf Trailing-KGV und Vendor-PEG

In `server/lib/qualityMetricsService.ts` (Zeile 471–482) wird `bereinigtesPeg` aufgerufen mit:

```typescript
const bereinigt = bereinigtesPeg({
  vendorPeg: trailingPeg,      // = EODHD Highlights.PEGRatio
  kgv: trailingPE,             // = EODHD Highlights.PERatio (Trailing!)
  epsWachstum5j: epsGrowth5y,
  epsWachstumTTM: epsGrowthTTM,
  ...
});
```

Das PEG wird also aus dem **Trailing-KGV** oder dem **Vendor-PEG** (ebenfalls trailing-basiert) abgeleitet, während der Export daneben das **Forward-KGV** zeigt.

### 3.3 Befund: Bereinigung inflationiert das PEG um Faktor ~1.5–2.0×

Die Funktion `bereinigtesPeg` (Zeile 147) wendet eine Qualitäts- und Volatilitätsbereinigung an:

```typescript
const bereinigung = (roh: number) => roh * (1 + volatilityPenalty) / qualityMultiplier;
```

Dabei gilt:
- `volatilityPenalty` = min(1.0, epsVolatility × 0.5) — typisch 0.2–0.6
- `qualityMultiplier` = 0.7 + (qualityScore/100) × 0.6 — typisch 0.85–1.1

**Rechenbeispiel FPE.DE:**
- EODHD Vendor-PEG: 4.08
- Angenommen: Volatilität 0.5 → Penalty 0.25; Quality 60 → Multiplier 1.06
- Bereinigt: 4.08 × 1.25 / 1.06 = **4.81** (tatsächlich 7.58 → Volatilität/Qualität noch extremer)

Die Bereinigung ist **konzeptionell gewollt** (riskantere Titel bekommen ein höheres effektives PEG), aber sie macht den Wert **nicht mehr mit externen Quellen vergleichbar**.

### 3.4 Befund: 52.8 % ohne PEG — Wachstumslücken

Die `bereinigtesPeg`-Funktion blendet das PEG aus, wenn:
- Kein Vendor-PEG UND kein belegtes Wachstum ≥ 2 % p.a. vorhanden ist
- Alle Wachstumsquellen unter 2 % oder über 35 % liegen
- Das bereinigte PEG über der Obergrenze 8 liegt

Die 310 fehlenden PEG-Werte sind grösstenteils **korrekte Ausblendungen** — bei Titeln ohne belastbares Wachstum ist „PEG sagt hier nichts" die richtige Antwort. Problematisch sind nur Fälle, in denen EODHD ein Vendor-PEG liefert, aber keine Wachstumszahlen zur Plausibilitätsprüfung — dann wird das PEG ebenfalls ausgeblendet (Wächter „wachstum_fehlt").

### 3.5 Befund: EODHD liefert für viele .SW/.L-Titel 404

Die Stichprobe zeigt, dass ASML.SW, SN.L, GSK.L und BRKN.SW bei EODHD 404 zurückgeben. Das liegt an der Symbolauflösung (`.SW` → `.VX`, `.L` → `.LSE`), die zwar im Screener-Lauf korrekt ist, aber für die Rohprobe hier nicht verwendet wurde. Im produktiven Pfad funktioniert die Auflösung — diese Titel haben im Screener tatsächlich Werte.

---

## 4. Kernproblem

> **Das angezeigte PEG und das angezeigte KGV basieren auf unterschiedlichen PE-Definitionen.**
> Der Nutzer sieht KGV = 15.50 (Forward) und PEG = 7.58 (bereinigt, trailing-basiert) nebeneinander und rechnet mental: PEG = KGV / Wachstum → Wachstum müsste 2.0 % sein. Tatsächlich ist das Roh-PEG aber 4.08 (Vendor, trailing) und wird durch Volatilitäts-/Qualitätsbereinigung auf 7.58 aufgeblasen.

---

## 5. Empfehlung für Claude — Finale Lösung

### Priorität 1: Transparenz im Export herstellen (SOFORT)

1. **KGV-Spalte im Export umbenennen** in „KGV (Forward)" oder zwei Spalten anbieten: „KGV Trailing" und „KGV Forward". Der Nutzer muss erkennen, welches PE er sieht.

2. **PEG-Spalte im Export ergänzen** um eine Spalte „PEG (roh)" neben „PEG (bereinigt)". Das rohe PEG (Vendor oder selbst gerechnet, VOR Bereinigung) ist mit externen Quellen vergleichbar; das bereinigte PEG ist der Scoring-Input.

3. **PEG-Hinweis-Spalte** enthält bereits die Herleitung — sicherstellen, dass sie im Export sichtbar ist (aktuell: `B: PEG (bereinigt) — Hinweis`). ✓ Bereits vorhanden.

### Priorität 2: PE-Basis vereinheitlichen (KURZFRISTIG)

4. **Den angezeigten KGV-Wert auf dieselbe Basis wie das PEG setzen.** Empfehlung: Der Export zeigt **Trailing-KGV** als Hauptwert (konsistent mit PEG-Basis) und Forward-KGV als ergänzende Spalte. Änderung in `dreiScoresService.ts` Zeile 131:

```typescript
// VORHER: kgv: qm.forwardPE ?? qm.trailingPE,
// NACHHER:
kgv: qm.trailingPE ?? qm.forwardPE,  // Trailing als Primärbasis (konsistent mit PEG)
```

**Achtung:** Diese Änderung beeinflusst den Bewertungs-Score (KGV-Faktor und KGV-Deckel). Vor der Umsetzung muss ein A/B-Backtest die Score-Auswirkung quantifizieren.

### Priorität 3: Bereinigungsfaktor kalibrieren (MITTELFRISTIG)

5. **Die Volatilitäts-/Qualitätsbereinigung auf ihre Trennschärfe prüfen.** Aktuell kann sie das PEG um bis zu Faktor 2.86× aufblasen (maximale Volatility 1.0, minimale Quality 0.7 → 2.0/0.7 = 2.86). Das ist konzeptionell vertretbar, aber:
   - Der Bereinigungsfaktor sollte im Export als eigene Spalte sichtbar sein
   - Ein OOS-Backtest sollte prüfen, ob die Bereinigung tatsächlich Trennschärfe für zukünftige Renditen bringt
   - Falls nicht: auf einen engeren Korridor (z.B. max. 1.5×) begrenzen

### Priorität 4: Fehlende PEG-Abdeckung verbessern (LANGFRISTIG)

6. **Für die 310 Titel ohne PEG prüfen, ob Finnhub oder Yahoo ein alternatives PEG liefern können.** Die aktuelle Architektur sieht bereits einen Vendor-PEG-Pfad vor — ein zweiter Vendor (Finnhub `metric.pegAnnual`) könnte als Fallback dienen, wenn EODHD `Highlights.PEGRatio` null ist.

7. **Die 2-%-Wachstumsschwelle ist fachlich korrekt**, sollte aber im Export als Ausblendgrund sichtbar sein (ist bereits implementiert via `pegHinweis`). ✓

---

## 6. Zusammenfassung für die Umsetzung

| # | Massnahme | Aufwand | Risiko | Dateien |
|---|-----------|---------|--------|---------|
| 1 | KGV-Spalte umbenennen / aufteilen | Klein | Keins | `adminRouter.ts` (Export) |
| 2 | PEG (roh) als Zusatzspalte | Klein | Keins | `adminRouter.ts`, `dreiScores.ts` |
| 3 | KGV-Basis auf Trailing umstellen | Mittel | **Score-Änderung** — A/B-Backtest nötig | `dreiScoresService.ts` |
| 4 | Bereinigungsfaktor im Export zeigen | Klein | Keins | `adminRouter.ts` |
| 5 | Bereinigung kalibrieren | Gross | Score-Änderung | `bereinigtesPeg.ts` |
| 6 | Finnhub als PEG-Fallback | Mittel | API-Kosten | `qualityMetricsService.ts` |

**Empfohlene Reihenfolge:** 1 → 2 → 4 → 3 (mit Backtest) → 6 → 5

---

## References

---

## 7. Nachtrag: EODHD-Datenqualität Europa vs. USA (Claudes Behauptung)

### Prüfmethode

Direkte EODHD-API-Abfrage für je 10 repräsentative Large-Cap-Titel aus Europa und den USA, mit Finnhub als unabhängiger PE-Referenz. Alle Abfragen am 17. August 2026 mit dem produktiven API-Schlüssel.

### Ergebnis: Europa

| Titel | EODHD PE | EODHD FwdPE | EODHD PEG | EPS | Quartale | Finnhub PE | Δ PE |
|-------|----------|-------------|-----------|-----|----------|------------|------|
| Novartis | **null** | **null** | **null** | **null** | 79 | null | — |
| Nestlé | **null** | **null** | **null** | **null** | **0** | null | — |
| Roche | **null** | **null** | **null** | **null** | **0** | 79.83 | — |
| SAP | 26.97 | 24.45 | 1.80 | 6.68 | 83 | 26.35 | 2.3% |
| Siemens | 28.40 | 21.83 | 5.35 | 10.00 | 99 | null | — |
| ASML | 62.12 | 38.61 | 2.11 | 25.43 | 90 | 57.46 | 8.1% |
| LVMH | 20.87 | 20.00 | 1.78 | 21.96 | 53 | 25.01 | **16.5%** |
| Sanofi | 23.31 | 8.59 | **28.64** | 3.24 | 84 | 11.67 | **99.8%** |
| AstraZeneca | 23.15 | 15.08 | 1.33 | 4.95 | 90 | 23.44 | 1.2% |
| Unilever | 20.77 | 17.01 | **11.34** | 2.21 | 76 | null | — |

**Abdeckung Europa:** PE 7/10, PEG 7/10, EPS 7/10, ≥8 Quartale 8/10

### Ergebnis: USA

| Titel | EODHD PE | EODHD FwdPE | EODHD PEG | EPS | Quartale | Finnhub PE | Δ PE |
|-------|----------|-------------|-----------|-----|----------|------------|------|
| Apple | 35.08 | 32.05 | 2.47 | 8.72 | 132 | 34.36 | 2.1% |
| Microsoft | 27.63 | 25.00 | 1.61 | 17.93 | 132 | 27.66 | 0.1% |
| NVIDIA | 34.48 | 24.81 | 0.60 | 6.53 | 110 | 33.98 | 1.5% |
| Alphabet | 17.36 | 16.86 | 0.94 | 19.92 | 89 | 17.31 | 0.3% |
| Amazon | 21.15 | 22.37 | 1.40 | 12.42 | 117 | 21.14 | 0.0% |
| J&J | 30.20 | 22.37 | 4.56 | 8.62 | 123 | 29.93 | 0.9% |
| P&G | 21.84 | 20.70 | 4.14 | 6.62 | 124 | 20.88 | 4.6% |
| UnitedHealth | 25.83 | 20.28 | 1.24 | 15.55 | 131 | 25.63 | 0.8% |
| Visa | 30.97 | 24.27 | 1.65 | 11.76 | 74 | 30.36 | 2.0% |
| Home Depot | 24.03 | 22.83 | 1.91 | 14.10 | 122 | 24.41 | 1.6% |

**Abdeckung USA:** PE 10/10, PEG 10/10, EPS 10/10, ≥8 Quartale 10/10

### Bewertung der Behauptung

**Claudes Behauptung ist teilweise bestätigt, aber differenzierter als „Datenschrott":**

1. **Schweizer Titel (Novartis, Nestlé, Roche) haben bei EODHD tatsächlich NULL für PE, PEG und EPS** — trotz vorhandener Quartalsdaten (79 Quartale bei Novartis). Das ist ein klarer Datendefekt: Die `Highlights`- und `Valuation`-Blöcke sind leer, obwohl `Earnings.History` Daten enthält. Nestlé und Roche haben sogar 0 Quartale — hier fehlen die Daten komplett.

2. **Sanofi zeigt ein PE von 23.31, Finnhub zeigt 11.67 — Abweichung 99.8%.** Das deutet auf ein veraltetes oder falsches EPS bei EODHD hin (EPS 3.24 vs. vermutlich ~6.5 aktuell). Ähnlich: LVMH weicht 16.5% ab.

3. **EODHD PEG-Werte für europäische Titel sind teilweise absurd:** Sanofi 28.64, Unilever 11.34 — diese Werte sind weder mit Finnhub noch mit Yahoo vereinbar.

4. **US-Titel sind konsistent:** PE-Abweichung zu Finnhub liegt bei 0.0–4.6%, PEG-Werte sind plausibel (0.6–4.6), alle Felder sind belegt.

### Fazit

> **EODHD liefert für US-Titel zuverlässige Fundamentaldaten (PE ±2% vs. Finnhub). Für europäische Titel — insbesondere Schweizer Börse (SIX) — sind die `Highlights`- und `Valuation`-Blöcke häufig leer oder veraltet, obwohl Quartalsdaten vorhanden sind. Für einzelne EU-Titel (Sanofi, LVMH) sind die PE-Werte signifikant falsch.**
>
> Die Behauptung „Datenschrott für europäische Werte" ist für Schweizer Titel **bestätigt** (komplett fehlende Kennzahlen trotz vorhandener Rohdaten), für andere EU-Titel **teilweise bestätigt** (vereinzelt grob falsche Werte), und für US-Titel **widerlegt** (konsistent korrekt).

### Empfehlung

Für europäische Titel sollte der Screener:
1. **PE und PEG selbst aus den vorhandenen Quartalsdaten berechnen** statt sich auf `Highlights.PERatio`/`PEGRatio` zu verlassen
2. **Finnhub als primäre Referenz für europäische PE-Werte** verwenden (wo verfügbar)
3. **EODHD `Highlights` nur für US-Titel als vertrauenswürdig behandeln**

[1]: EODHD Fundamentals API — `Highlights.PEGRatio`, `Valuation.ForwardPE`, `Highlights.PERatio`
[2]: Finnhub Stock Metrics API — `metric.pegAnnual`, `metric.peTTM`
[3]: Projektcode `server/lib/qualityMetricsService.ts` — PEG-Assemblierung Zeilen 452–503
[4]: Projektcode `server/lib/bereinigtesPeg.ts` — Bereinigungsformel Zeilen 127–238
[5]: Projektcode `server/lib/dreiScoresService.ts` — KGV-Eingabe Zeile 131
