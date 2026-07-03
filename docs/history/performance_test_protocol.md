# Performance Chart Test Protocol - 12.01.2026

## KRITISCHES PROBLEM IDENTIFIZIERT:
**Die Portfolio-Performance-Linie (Regula) zeigt bei ALLEN Zeitfenstern 0% oder falsche Werte!**

## Portfolio 1: Regula Live (ID: 270001)

### YTD
- Status: ❌ **FEHLER**
- Hypothetische Performance: Sichtbar (gestrichelte Linie, ca. 0-45%)
- **Regula Performance: ZEIGT 0%** (sollte ca. 45% zeigen)
- S&P 500 Benchmark: Sichtbar (ca. 42.56%)
- Problem: Tooltip zeigt "S&P 500: 0.00%" statt "Regula: X%"

### 1M
- Status: ❌ **FEHLER**
- Chart zeigt: Hypothetische Linie (gestrichelt), Regula (grün, ca. 0-4%), S&P 500 (gestrichelt)
- **Problem: Regula zeigt nur 0-4% statt reale Performance**

### 3M
- Status: ❌ **FEHLER**  
- Chart zeigt: Hypothetische Linie im negativen Bereich (-3% bis 0%), Regula (grün, ca. -6% bis -5%), S&P 500 (gestrichelt)
- **Problem: Regula zeigt negative Performance (-6%) was nicht stimmen kann**

### 6M
- Status: ⏳ Nicht getestet

### 1Y
- Status: ❌ **FEHLER**
- Chart identisch mit 3M - zeigt negative Performance
- **Problem: Gleiche negative Performance wie 3M**

### 3Y
- Status: ⏳ Nicht getestet

### 5Y
- Status: ⏳ Nicht getestet

### All
- Status: ❌ **FEHLER**
- Chart zeigt: Hypothetische Linie (gestrichelt, ca. 0-45%), Regula (grün, ca. 45%)
- **Problem: Regula-Linie endet bei ca. 45% aber sollte aktuelle Performance zeigen**


## Portfolio 2: Test Cash Portfolio (ID: 1020002)
- Status: ⏳ Zu testen (alle Zeitfenster)


## Portfolio 3: Demo Portfolio - Schweizer Blue Chips (ID: 300001)
- Status: ⏳ Zu testen (alle Zeitfenster)


## HAUPTPROBLEME:

### 1. Portfolio-Performance wird nicht korrekt berechnet/angezeigt
- ❌ Regula-Linie zeigt 0% oder falsche Werte
- ❌ Tooltip zeigt "S&P 500: 0.00%" statt "Regula: X%"
- ❌ Bei 1M, 3M, 1Y: Negative oder zu niedrige Performance
- ❌ Bei YTD, All: Performance scheint zu enden, nicht aktuell

### 2. Mögliche Ursachen:
- Backend liefert falsche chartData (portfolio-Werte sind 0 oder falsch)
- Frontend verarbeitet chartData falsch
- Performance-Berechnung in getRealTwrSeriesFromTransactions fehlerhaft
- effectiveStartDate-Fix hat neue Probleme verursacht

### 3. Zu prüfen:
- [ ] Backend-Logs für getHistoricalPerformance analysieren
- [ ] chartData-Response im Browser-DevTools prüfen
- [ ] getRealTwrSeriesFromTransactions Schritt für Schritt debuggen
- [ ] initialHoldings und initialCash Werte prüfen
- [ ] TWR-Berechnung verifizieren
