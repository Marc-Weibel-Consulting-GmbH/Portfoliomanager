# Portfolio Optimizer - Score-Berechnung

## Übersicht

Der Portfolio Optimizer verwendet ein **Scoring-System** um die besten Aktien für Ihr Portfolio auszuwählen. Der Score basiert auf Ihrem **Anlegertyp** (Konservativ/Ausgewogen/Dynamisch) und Ihren **Zielen** (Dividendenrendite, Anzahl Positionen, etc.).

---

## Neues Balanced Scoring System

### Conservative (Konservativ)

**Fokus:** Dividende 40%, Sharpe Ratio 30%, Stabilität 30%

**Scoring-Komponenten:**
- **Dividendenrendite:** 40% Gewichtung
  - Multiplikator: 40x
  - Beispiel: 3% Dividende = 120 Punkte
- **Sharpe Ratio:** 30% Gewichtung
  - Berechnung: YTD Performance / Kategorie-Volatilität
  - Multiplikator: 30x
  - Beispiel: 10% YTD / 1.0 Volatilität = 10 Sharpe × 30 = 300 Punkte
- **Stabilität:** 30% Gewichtung
  - P/E Ratio < 20: +30 Punkte
  - Defensive Sektoren (Healthcare, Consumer Staples, Utilities): +30 Punkte
  - Penalty: -20 für hohe Volatilität (>1.3)

**Kategorie-Volatilität:**
- Technology/E-Commerce: 1.5
- Fintech: 1.4
- Biotech: 1.8
- Healthcare: 1.0
- Consumer Staples: 0.8
- Utilities: 0.7
- Energy: 1.3
- Industrials: 1.1

**Beispiel:**
- Aktie: Nestlé (Dividende 3%, YTD +5%, P/E 18, Healthcare)
- Score: (3 × 40) + (5/1.0 × 30) + 30 + 30 = **340 Punkte**

---

### Balanced (Ausgewogen)

**Fokus:** Dividende 50%, Sharpe Ratio 50%

**Scoring-Komponenten:**
- **Dividendenrendite:** 50% Gewichtung
  - Multiplikator: 50x
  - Beispiel: 2% Dividende = 100 Punkte
- **Sharpe Ratio:** 50% Gewichtung
  - Berechnung: YTD Performance / Kategorie-Volatilität
  - Multiplikator: 50x
  - Beispiel: 15% YTD / 1.5 Volatilität = 10 Sharpe × 50 = 500 Punkte
- **Hybrid-Bonus:**
  - Aktien mit BEIDEN Eigenschaften (Dividende ≥2.5% UND Wachstum): +30 Punkte

**Beispiel:**
- Aktie: Microsoft (Dividende 1%, YTD +25%, Technology, Volatilität 1.5)
- Score: (1 × 50) + (25/1.5 × 50) + 30 = **913 Punkte**

---

### Dynamic (Dynamisch)

**Fokus:** Dividende 20%, Sharpe Ratio 60%, YTD 20%

**Scoring-Komponenten:**
- **Dividendenrendite:** 20% Gewichtung
  - Multiplikator: 20x (für Diversifikation)
  - Beispiel: 0.5% Dividende = 10 Punkte
- **Sharpe Ratio:** 60% Gewichtung
  - Berechnung: YTD Performance / Kategorie-Volatilität
  - Multiplikator: 60x
  - Beispiel: 50% YTD / 1.5 Volatilität = 33.3 Sharpe × 60 = 2000 Punkte
- **YTD Performance:** 20% Gewichtung
  - Multiplikator: 20x (absolute Performance)
  - Beispiel: 50% YTD = 1000 Punkte
- **Sektor-Bonus:**
  - Tech/E-Commerce/Fintech/Biotech: +40 Punkte
  - Extra Bonus: +30 für YTD >20%

**Beispiel:**
- Aktie: NVIDIA (Dividende 0.1%, YTD +150%, Technology, Volatilität 1.5)
- Score: (0.1 × 20) + (150/1.5 × 60) + (150 × 20) + 40 + 30 = **9072 Punkte**

---

## Zusätzliche Bonus-Punkte

### Ziel-Nähe-Bonus (bei Dividendenziel)

Wenn Sie ein **Dividendenziel** eingegeben haben (z.B. 3%), erhalten Aktien **nahe am Ziel** massive Bonus-Punkte:

- **Sehr nah** (Abweichung < 0.5%): **+150 Punkte**
  - Beispiel: Ziel 3%, Aktie 3.2% → Abweichung 0.2% → +150 Punkte
- **Nah** (Abweichung < 1.0%): **+80 Punkte**
  - Beispiel: Ziel 3%, Aktie 3.8% → Abweichung 0.8% → +80 Punkte
- **Etwas nah** (Abweichung < 2.0%): **+40 Punkte**
  - Beispiel: Ziel 3%, Aktie 4.5% → Abweichung 1.5% → +40 Punkte
- **Weit entfernt** (Abweichung > 2.0%): **-50 Punkte** (Penalty)
  - Beispiel: Ziel 3%, Aktie 6% → Abweichung 3% → -50 Punkte

**Dieser Bonus ist ENTSCHEIDEND** um das exakte Dividendenziel zu erreichen!

---

## Aktien-Klassifizierung

### Dividenden-Aktie
- **Kriterium:** Dividendenrendite ≥ 2.5%
- **Beispiele:** Nestlé (3.7%), Novartis (3.7%), Swisscom (5.0%)

### Wachstums-Aktie
- **Kriterium:** YTD Performance > 10% ODER Sektor = Technology/E-Commerce/Fintech/Biotech
- **Beispiele:** Meta Platforms (28.6% YTD), Alphabet (1.2% YTD aber Tech-Sektor)

### Hybrid-Aktie
- **Kriterium:** BEIDE Kriterien erfüllt (Dividende ≥ 2.5% UND Wachstum)
- **Beispiel:** Johnson & Johnson (3.1% Dividende + 2.7% YTD + Healthcare-Sektor)

---

## Sektor-Diversifikation

Nach dem Scoring wird **Sektor-Diversifikation** erzwungen:

- **Maximum 30% pro Sektor**
  - Beispiel: Bei 20 Positionen max. 6 Aktien aus "Healthcare"
- **Erste Runde:** Top-Aktien mit Sektor-Limit
- **Zweite Runde:** Auffüllen mit verbleibenden Aktien
- **Dritte Runde:** Sektor-Limit aufheben falls nötig

---

## Wachstums-Minimum (bei Dividendenziel + Ausgewogen)

Wenn Sie:
- **Dividendenziel > 0** eingegeben haben UND
- **Anlegertyp "Ausgewogen"** gewählt haben

Dann wird **mindestens 25% Wachstumsaktien** garantiert:

- Niedrig-bewertete Dividenden-Aktien werden durch Wachstums-Aktien ersetzt
- So bleibt der Mix aus Dividende + Wachstum erhalten

---

## Dynamische Gewichtung

### Standard-Gewichtung (ohne Dividendenziel)
- **Alle Aktien:** 5% Gewichtung (bei 20 Positionen)

### Dynamische Gewichtung (mit Dividendenziel)
- **Dividenden-Aktien:** 8% Gewichtung (höher!)
- **Wachstums-Aktien:** 2% Gewichtung (niedriger!)
- **Hybrid-Aktien:** 5% Gewichtung (normal)

**Beispiel:**
```
Portfolio: CHF 100'000, Dividendenziel: 3%

Dividenden-Aktien (10 Stück):
- Je CHF 8'000 (8%) = CHF 80'000 total
- Durchschnitt: 3.5% Dividende

Wachstums-Aktien (5 Stück):
- Je CHF 2'000 (2%) = CHF 10'000 total
- Durchschnitt: 0.5% Dividende

Gesamt: CHF 90'000 investiert
Portfolio-Dividende: (80'000 × 3.5% + 10'000 × 0.5%) / 90'000 = 3.17% ✅
```

**Durch diese Gewichtung erreichen wir das exakte Dividendenziel!**

---

## Limits und Constraints

### Positionsgröße
- **Minimum:** CHF 1'000 (wegen Transaktionskosten)
- **Maximum (Standard):** 5% bei Portfolio > CHF 20'000, 10% bei Portfolio < CHF 20'000
- **Maximum (Dividenden-Aktien):** 10% (höher als Standard!)

### Investment-Quote
- **Ziel:** 90% des Kapitals investiert (Minimum)
- **2-Phasen-Verteilung:**
  1. Standard-Limits (5%/10%)
  2. Flexible Limits (8%/15%) um 90% zu erreichen

### Anzahl Positionen
- **Automatische Reduktion** wenn Positionsgröße < CHF 1'000
  - Beispiel: CHF 15'000, 20 Positionen → 15'000/20 = CHF 750 → Reduziere auf 15 Positionen
- **ETF-Warnung** bei < 10 Positionen oder < CHF 1'000 pro Position

---

## Zusammenfassung

**Das neue Balanced Scoring System kombiniert:**
1. ✅ **Sharpe Ratio** - Risiko-adjustierte Performance (YTD / Volatilität)
2. ✅ **Dividendenrendite** - Stabile Erträge
3. ✅ **Anlegertyp-spezifische Gewichtung:**
   - Conservative: 40% Dividende, 30% Sharpe, 30% Stabilität
   - Balanced: 50% Dividende, 50% Sharpe
   - Dynamic: 20% Dividende, 60% Sharpe, 20% YTD
4. ✅ **Dividenden-Nähe-Bonus** (massiv bei Dividendenziel)
5. ✅ **Sektor-Diversifikation** (max 30% pro Sektor)
6. ✅ **Wachstums-Minimum** (25% bei Ausgewogen + Dividendenziel)
7. ✅ **Dynamische Gewichtung** (Dividenden-Aktien höher, Wachstums-Aktien niedriger)

**Resultat:** Portfolio das Ihre Ziele (Dividende, Wachstum, Diversifikation) optimal erfüllt! 🎯

---

## Warum Sharpe Ratio?

Die **Sharpe Ratio** misst die **risiko-adjustierte Performance**:
- Hohe Performance + niedrige Volatilität = hoher Score ✅
- Hohe Performance + hohe Volatilität = moderater Score ⚠️
- Niedrige Performance + hohe Volatilität = niedriger Score ❌

**Beispiel:**
- Aktie A: +20% YTD, Volatilität 2.0 → Sharpe = 10
- Aktie B: +15% YTD, Volatilität 0.8 → Sharpe = 18.75 ✅ (besser!)

So bevorzugt der Optimizer **stabile Performer** statt riskanter Spekulationen.

