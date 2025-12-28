# Kritische und Dringende Bugs - Analyse
**Datum:** 15. November 2025  
**Status:** Identifikation abgeschlossen

---

## 🔴 KATEGORIE 1: KRITISCHE BERECHNUNGSFEHLER (Höchste Priorität)

### Bug 1.1: Chart "Portfolio Wert" zeigt falschen Wert
**Status:** ❌ Offen  
**Zeile in TODO:** 1858-1859  
**Problem:**
- Chart zeigt CHF 90'946 statt CHF 91'722 (Total Invested inkl. Cash)
- Chart-Legende muss mit "Total investiert" aus Portfolio-Karte übereinstimmen

**Auswirkung:** Benutzer sieht falschen investierten Betrag im Chart → Verwirrung

**Lösung:** `getLivePerformanceHistory` muss Cash-Position korrekt einbeziehen

---

### Bug 1.2: Fehlende Spalte "Aktueller Wert (CHF)" in Portfolio-Positionen
**Status:** ❌ Offen  
**Zeile in TODO:** 1867-1870  
**Problem:**
- Spalte "Aktueller Wert (CHF)" fehlt nach "Aktueller Kurs (FW)"
- Total sollte CHF 91'023 sein (inkl. Cash CHF 1'979)
- Aktuell zeigt Total CHF 89'044 (falsch)
- Performance -0.8% sollte in "Live Perf. (CHF)" Spalte verschoben werden

**Auswirkung:** Benutzer kann aktuellen Wert pro Position nicht in CHF sehen

**Lösung:** Neue Spalte hinzufügen zwischen "Aktueller Kurs (FW)" und "Live Perf."

---

### Bug 1.3: Jahresübersicht "Total Investiert" falsch
**Status:** ❌ Offen  
**Zeile in TODO:** 1873-1875  
**Problem:**
- Zeigt CHF 89'701.016 statt CHF 91'722 (inkl. Cash)
- Muss mit Portfolio-Übersicht übereinstimmen
- "Aktueller Wert" CHF 91'023.258 ist korrekt

**Auswirkung:** Inkonsistenz zwischen verschiedenen Ansichten → Vertrauensverlust

**Lösung:** `annualPerformance` Endpoint muss Cash-Position einbeziehen

---

### Bug 1.4: NVIDIA FX Rate zeigt 1.0000 statt 0.7985
**Status:** ❌ Offen  
**Zeile in TODO:** 1686-1689, 1757-1760  
**Problem:**
- Portfolio-Positionen Tabelle zeigt FX Rate 1.0000 für NVIDIA (USD)
- Sollte 0.7985 sein
- Transaktion in DB ist korrekt (currency=USD, fxRate=0.7985)
- avgFxRate Berechnung: totalInvestedCHF / totalInvestedLocal gibt falsches Ergebnis
- NVIDIA "Aktueller Wert (CHF)" zeigt CHF 3'863 statt CHF 3'085

**Auswirkung:** Falsche Währungsumrechnung → falsche Performance-Berechnung

**Lösung:** `getHoldingsWithChfPerformance` avgFxRate Berechnung überprüfen

---

## 🟠 KATEGORIE 2: UI/UX FEHLER (Hohe Priorität)

### Bug 2.1: EOSE Verkauf zeigt grün statt rot
**Status:** ❌ Offen  
**Zeile in TODO:** 1862-1864  
**Problem:**
- EOSE Verkaufstransaktion (14.11.2025) zeigt in grün
- Sollte ROT mit MINUS-Zeichen sein
- Position wurde verkauft (entfernt)

**Auswirkung:** Verwirrende Darstellung → Benutzer denkt es ist ein Gewinn

**Lösung:** `TransactionHistory.tsx` - Verkäufe mit negativem Vorzeichen und roter Farbe

---

### Bug 2.2: Transaktionssumme falsch platziert
**Status:** ❌ Offen  
**Zeile in TODO:** 1862  
**Problem:**
- Total CHF 93'701.70 wird unten angezeigt
- Sollte unter "Netto (CHF)" Spalte sein

**Auswirkung:** Unübersichtliche Darstellung

**Lösung:** Summe in Tabellen-Footer unter korrekter Spalte platzieren

---

### Bug 2.3: Transaktionen - Fehlende Summen
**Status:** ❌ Offen  
**Zeile in TODO:** 1645-1647  
**Problem:**
- Summe bei "Betrag (CHF)" Spalte fehlt
- Summe bei "Netto (CHF)" Spalte fehlt
- Total Betrag (CHF) sollte CHF 106'884 sein

**Auswirkung:** Benutzer muss manuell summieren

**Lösung:** Footer-Zeile mit Summen hinzufügen

---

## 🟡 KATEGORIE 3: WÄHRUNGSUMRECHNUNG (Mittlere Priorität)

### Bug 3.1: Fremdwährungs-Performance verwendet Originalwährung
**Status:** ❌ Offen  
**Zeile in TODO:** 307-311, 282-285  
**Problem:**
- "Live Perf." Spalte verwendet noch Originalwährung statt CHF
- holdingsByTicker Berechnung muss auf CHF umgestellt werden
- Wechselkurse vom Live-Start-Datum und heute abrufen
- Performance = (currentValueCHF - liveStartValueCHF) / liveStartValueCHF * 100

**Auswirkung:** Performance-Vergleich zwischen verschiedenen Währungen nicht möglich

**Lösung:** Alle Performance-Berechnungen auf CHF-Basis umstellen

---

### Bug 3.2: Jahresübersicht - Währungsgewinne nicht aufgeteilt
**Status:** ❌ Offen  
**Zeile in TODO:** 288-292, 323-327  
**Problem:**
- AnnualPerformanceSummary zeigt keine separate Zeilen für:
  - Realisierte Aktiengewinne (in Originalwährung)
  - Realisierte Währungsgewinne (CHF)
  - Total realisierte Gewinne (CHF)
- Unrealisierte Gewinne nicht aufgeteilt

**Auswirkung:** Steuer-Reporting nicht korrekt möglich

**Lösung:** Separate Zeilen für Aktien- und Währungsgewinne

---

### Bug 3.3: Verkaufs-Pop-up zeigt keine Währungsaufteilung
**Status:** ❌ Offen  
**Zeile in TODO:** 295-296  
**Problem:**
- Bei Kauf/Verkauf: Wechselkurs vom Transaktionsdatum nicht gespeichert
- Verkaufs-Pop-up zeigt nicht: Aktiengewinn UND Währungsgewinn separat

**Auswirkung:** Benutzer sieht nicht, wie viel Gewinn/Verlust durch Währung entstand

**Lösung:** `RealizedGainModal` erweitern mit FX-Breakdown

---

## 🔵 KATEGORIE 4: TECHNISCHE SCHULDEN (Niedrige Priorität)

### Bug 4.1: Router-Refactoring
**Status:** ❌ Offen  
**Zeile in TODO:** 141-145  
**Problem:**
- routers.ts ist 2848 Zeilen lang
- Sollte aufgeteilt werden in: stocksRouter.ts (1049 Zeilen), portfolioPerformanceRouter.ts, savedPortfoliosRouter.ts, etc.
- Reduziert TypeScript Compilation Memory Usage

**Auswirkung:** Code-Wartbarkeit, Memory-Probleme bei Compilation

**Lösung:** Router in separate Module aufteilen

**Hinweis:** Server läuft funktional, TypeScript-Fehler beeinflussen Runtime nicht

---

### Bug 4.2: TypeScript Compilation Crashes
**Status:** ❌ Offen  
**Zeile in TODO:** 84-86  
**Problem:**
- Memory problem: TypeScript compilation crashes (exit code 137)
- Checkpoint publishing fails ("Veröffentlichen" spins indefinitely)
- Build process needs memory optimization

**Auswirkung:** Deployment-Probleme

**Lösung:** Router aufteilen, Memory-Limit erhöhen

**Hinweis:** Server ist stabil, TypeScript-Fehler sind nur Background-Warnings

---

## 🟢 KATEGORIE 5: FEATURE-REQUESTS (Keine Bugs, aber offen)

### Feature 5.1: "Laden" Button für TEST Portfolios
**Status:** ❌ Offen  
**Zeile in TODO:** 20-22  
**Problem:**
- Sollte Optimizer Results View öffnen (nicht Portfolio Tab)
- Saved Portfolio Data in Optimizer laden
- Gleiche Ansicht wie beim Erstellen

**Auswirkung:** UX-Verbesserung

**Lösung:** Navigation anpassen

---

### Feature 5.2: Realisierte Gewinne/Verluste Tabelle
**Status:** ❌ Offen  
**Zeile in TODO:** 335-336  
**Problem:**
- Sortable and filterable by date, ticker, gain/loss
- Export to CSV for tax reporting

**Auswirkung:** Steuer-Reporting vereinfachen

**Lösung:** Neue Seite mit Tabelle und Export-Funktion

---

### Feature 5.3: Dividenden-Kalender nach EODHD Migration
**Status:** ❌ Offen  
**Zeile in TODO:** 340-341, 349-350  
**Problem:**
- Dividend calendar shows no data after EODHD API migration
- Switch from EODHD to Financial Modeling Prep API for upcoming dividends
- FMP has dedicated calendar API with actual upcoming dividends (not just historical)

**Auswirkung:** Feature nicht nutzbar

**Lösung:** API-Migration zu FMP

---

## 📊 ZUSAMMENFASSUNG

### Nach Priorität:
- **🔴 Kritisch (sofort beheben):** 4 Bugs (1.1, 1.2, 1.3, 1.4)
- **🟠 Hoch (diese Woche):** 3 Bugs (2.1, 2.2, 2.3)
- **🟡 Mittel (nächste Woche):** 3 Bugs (3.1, 3.2, 3.3)
- **🔵 Niedrig (später):** 2 Bugs (4.1, 4.2)
- **🟢 Features (optional):** 3 Features (5.1, 5.2, 5.3)

### Nach Kategorie:
- **Berechnungsfehler:** 4 Bugs
- **UI/UX Fehler:** 3 Bugs
- **Währungsumrechnung:** 3 Bugs
- **Technische Schulden:** 2 Bugs
- **Feature-Requests:** 3 Features

### Geschätzte Behebungszeit:
- **Kritische Bugs:** 3-4 Stunden
- **Hohe Priorität:** 1-2 Stunden
- **Mittlere Priorität:** 2-3 Stunden
- **Niedrige Priorität:** 4-6 Stunden
- **Features:** 3-5 Stunden

**Total:** ~13-20 Stunden

---

## 🎯 EMPFOHLENE REIHENFOLGE

1. **Bug 1.4** - NVIDIA FX Rate (betrifft alle Berechnungen)
2. **Bug 1.2** - Fehlende Spalte "Aktueller Wert (CHF)"
3. **Bug 1.1** - Chart "Portfolio Wert"
4. **Bug 1.3** - Jahresübersicht "Total Investiert"
5. **Bug 2.1** - EOSE Verkauf Farbe
6. **Bug 2.2** - Transaktionssumme Platzierung
7. **Bug 2.3** - Transaktionen Summen
8. **Bug 3.1** - Fremdwährungs-Performance
9. **Bug 3.2** - Jahresübersicht Währungsaufteilung
10. **Bug 3.3** - Verkaufs-Pop-up Währungsaufteilung

---

## ✅ NÄCHSTE SCHRITTE

1. User-Feedback einholen: Welche Bugs sind am wichtigsten?
2. Mit Bug 1.4 (NVIDIA FX Rate) beginnen - betrifft alle anderen Berechnungen
3. Systematisch durch die Liste arbeiten
4. Nach jedem Fix: Testen und in TODO.md als [x] markieren
5. Checkpoint erstellen nach Kategorie 1 (Kritische Bugs)
