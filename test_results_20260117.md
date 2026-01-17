# Portfolio Builder Test Results - 17.01.2026

## Summary

| Test | Strategie | Typ | Auswahl | Betrag | Gesamtwert | Abweichung | Status |
|------|-----------|-----|---------|--------|------------|------------|--------|
| 1 | Dividenden | Live | Automatisch | CHF 80'000 | CHF 80'002.41 | +0.003% | ✅ PASS (nach Fix) |
| 2 | Wachstum | Demo | Manuell | CHF 50'000 | CHF 89'995.21 | +79.99% | ❌ FAIL (vor Fix) |
| 3 | Ausgewogen | Live | Manuell | CHF 60'000 | CHF 60'401.96 | +0.67% | ✅ PASS |

## Bugs Found & Fixed

### Bug 1: FX-Konvertierung bei Fallback-Berechnung
**File:** `server/routers/portfoliosRouter.ts`
**Line:** 230-235

**Problem:**
Wenn keine Shares im portfolioData gespeichert waren, wurde ein Fallback-Code verwendet, der:
1. `allocationAmount` in CHF berechnete
2. Durch `currentPrice` in USD teilte (ohne FX-Konvertierung)
3. Das Ergebnis auf ganze Zahlen rundete

**Fix:**
```typescript
// Vorher:
shares = currentPrice > 0 ? Math.round((allocationAmount / currentPrice)) : 0;

// Nachher:
shares = priceCHF > 0 ? (allocationAmount / priceCHF) : 0;
```

### Bug 2: Gewichtungsverteilung bei manueller Aktienauswahl
**File:** `client/src/pages/PortfolioBuilderNew.tsx`
**Function:** `addPosition()`

**Problem:**
Bei manueller Aktienauswahl bekam die erste Aktie 100% Gewichtung, alle weiteren 0%.

**Ursache:**
```typescript
const suggestedWeight = remainingWeight > 0 ? Math.min(remainingWeight, 100 / numPositions) : 0;
```
- Erste Aktie: remainingWeight=100, suggestedWeight=100%
- Zweite Aktie: remainingWeight=0 (weil erste schon 100% hat), suggestedWeight=0%

**Fix:**
Bei jeder neuen Aktie werden alle Gewichtungen gleichmäßig auf alle Aktien verteilt.

## Test Details

### Test 1: Dividenden + Live + Automatisch (CHF 80'000)
- **Portfolio:** Test Dividenden Auto 80k Live
- **Positionen:** 10 Aktien (automatisch generiert)
- **USD-Aktien:** NEE (124.35 Aktien), JNJ (28.53 Aktien)
- **Gesamtwert nach Fix:** CHF 80'002.41
- **Status:** ✅ PASS

### Test 2: Wachstum + Demo + Manuell (CHF 50'000)
- **Portfolio:** Test Wachstum Demo 50k
- **Problem:** Gewichtung nicht korrekt verteilt
- **NVDA:** 100% statt 20%
- **Andere 4 Aktien:** 0% statt je 20%
- **Status:** ❌ FAIL (vor Fix)

### Test 3: Ausgewogen + Live + Manuell (CHF 60'000)
- **Portfolio:** Test Ausgewogen Live 60k
- **Positionen:** 3 Aktien (SGKN.SW, NVDA, JNJ)
- **Gewichtung:** Je 33.33%
- **Gesamtwert:** CHF 60'401.96
- **Status:** ✅ PASS

## Conclusion

Beide Bugs wurden erfolgreich behoben:
1. FX-Konvertierung funktioniert jetzt korrekt für USD-Aktien
2. Gewichtungsverteilung bei manueller Auswahl funktioniert jetzt automatisch
