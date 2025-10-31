# Portfolio Optimizer - Score-Berechnung

## Übersicht

Der Portfolio Optimizer verwendet ein **Scoring-System** um die besten Aktien für Ihr Portfolio auszuwählen. Der Score basiert auf Ihrem **Anlegertyp** (Konservativ/Ausgewogen/Dynamisch) und Ihren **Zielen** (Dividendenrendite, Anzahl Positionen, etc.).

---

## Anlegertyp-spezifisches Scoring

### 1. Konservativ (Conservative)

**Fokus:** Dividenden und Stabilität (70% Dividende, 30% Wachstum)

**Scoring-Faktoren:**
- **Dividendenrendite:** `dividendYield × 50` (bei Dividendenziel) oder `dividendYield × 20`
  - Beispiel: 4% Dividende = 200 Punkte (mit Ziel) oder 80 Punkte (ohne Ziel)
- **Dividenden-Aktien Bonus:** +100 Punkte (mit Ziel) oder +50 Punkte (ohne Ziel)
  - Kriterium: Dividende ≥ 2.5%
- **P/E Ratio:** +15 Punkte wenn P/E < 20 (günstige Bewertung)
- **Sektor-Bonus:** +20 Punkte für Healthcare, Consumer Staples, Utilities
- **Wachstums-Bonus:** `ytdPerformance × 0.3` (kleine Diversifikation)
- **Performance-Penalty:** `-|ytdPerformance| × 2` wenn YTD < -5%

**Beispiel-Rechnung:**
```
Nestlé SA (NESN.SW):
- Dividende: 3.7% → 3.7 × 50 = 185 Punkte
- Dividenden-Aktien: +100 Punkte
- P/E: 20.3 → 0 Punkte (nicht < 20)
- Sektor: Consumer Staples → +20 Punkte
- YTD: 1.0% → 1.0 × 0.3 = 0.3 Punkte
= 305.3 Punkte
```

---

### 2. Ausgewogen (Balanced)

**Fokus:** Mix aus Dividende und Wachstum (50% Dividende, 50% Wachstum)

**Scoring-Faktoren:**
- **Dividendenrendite:** `dividendYield × 12`
  - Beispiel: 3% Dividende = 36 Punkte
- **Dividenden-Aktien Bonus:** +30 Punkte (Dividende ≥ 2.5%)
- **Wachstums-Performance:** `ytdPerformance × 1.2`
  - Beispiel: 15% YTD = 18 Punkte
- **Wachstums-Aktien Bonus:** +30 Punkte
  - Kriterium: YTD > 10% ODER Sektor = Technology/E-Commerce/Fintech/Biotech
- **P/E Ratio:** +10 Punkte wenn P/E < 30
- **Hybrid-Bonus:** +20 Punkte wenn BEIDE (Dividende UND Wachstum)

**Beispiel-Rechnung:**
```
Microsoft Corp (MSFT):
- Dividende: 0.7% → 0.7 × 12 = 8.4 Punkte
- Dividenden-Aktien: 0 Punkte (< 2.5%)
- YTD: 2.4% → 2.4 × 1.2 = 2.9 Punkte
- Wachstums-Aktien: 0 Punkte (YTD < 10%, kein Tech-Sektor)
- P/E: 35.0 → 0 Punkte (nicht < 30)
- Hybrid: 0 Punkte
= 11.3 Punkte
```

---

### 3. Dynamisch (Dynamic)

**Fokus:** Wachstum und Performance (70% Wachstum, 30% Dividende)

**Scoring-Faktoren:**
- **Wachstums-Performance:** `ytdPerformance × 2`
  - Beispiel: 20% YTD = 40 Punkte
- **Wachstums-Aktien Bonus:** +50 Punkte
  - Kriterium: YTD > 10% ODER Sektor = Technology/E-Commerce/Fintech/Biotech
- **Sektor-Bonus:** +30 Punkte für Technology, E-Commerce, Fintech, Biotech
- **High-Performance Bonus:** +25 Punkte wenn YTD > 20%
- **Dividenden-Bonus:** `dividendYield × 8` (kleine Diversifikation)

**Beispiel-Rechnung:**
```
NVIDIA Corp (NVDA):
- YTD: 1.6% → 1.6 × 2 = 3.2 Punkte
- Wachstums-Aktien: 0 Punkte (YTD < 10%, kein Tech-Sektor in Daten)
- Sektor: Diversified/Healthcare → 0 Punkte
- High-Performance: 0 Punkte (YTD < 20%)
- Dividende: 0.3% → 0.3 × 8 = 2.4 Punkte
= 5.6 Punkte
```

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

**Der Score kombiniert:**
1. ✅ Anlegertyp-spezifische Gewichtung (Conservative/Balanced/Dynamic)
2. ✅ Dividenden-Nähe-Bonus (massiv bei Dividendenziel)
3. ✅ Sektor-Diversifikation (max 30% pro Sektor)
4. ✅ Wachstums-Minimum (25% bei Ausgewogen + Dividendenziel)
5. ✅ Dynamische Gewichtung (Dividenden-Aktien höher, Wachstums-Aktien niedriger)

**Resultat:** Portfolio das Ihre Ziele (Dividende, Wachstum, Diversifikation) optimal erfüllt! 🎯

