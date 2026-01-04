# Portfolio Analysis Website TODO

## FEATURE - Cash-Anteil bei Portfolio-Erstellung (03.01.2026)
- [x] FEATURE: Cash-Anteil bei Portfolio-Erstellung konfigurierbar machen (Option C)
  - ✅ Frontend: Cash-Reserve Slider (0-20%) in Step1Basics hinzugefügt
  - ✅ Frontend: cashPercentage zum PortfolioBuilderState hinzugefügt
  - ✅ Frontend: Gewichtungsanzeige in Step2StockSelection angepasst (zeigt Aktien-Ziel vs. Cash-Reserve)
  - ✅ Frontend: cashPercentage wird an Backend übergeben (Step5Completion)
  - ✅ Backend: portfoliosRouter.ts liest cashPercentage und berechnet Cash-Position entsprechend
  - ✅ Frontend: Cash-Zeile in PortfolioDetailsPage.tsx implementiert
  - ✅ Frontend: Asset-Allokation erweitert um Cash-Kategorie
  - ⚠️ Hinweis: Slider-Interaktion per Browser-Automatisierung schwierig (Radix UI Drag-Verhalten)

## Bugs (29.12.2025)

- [x] CRITICAL: New portfolios are not being saved/displayed in portfolio list (01.01.2026) - RESOLVED

- [x] CRITICAL BUG: Portfolio performance chart zeigt keine historischen Daten VOR dem Erstellungsdatum - FIXES APPLIED (30.12.2025):
  - Fixed portfoliosRouter.ts line 568: use creationDate instead of earliestTransactionDate
  - Fixed portfoliosRouter.ts line 681: use creationDate for hypothetical end date calculation
  - Fixed LivePerformanceChart.tsx: calculate dayBeforeCreation for hypothetical endDate
  - Server restarted to apply changes

- [x] Fix historical data range - data should go back further than October 2024
- [ ] FEATURE: Portfolio Performance Charts sollen hypothetische historische Performance zeigen (30.12.2025) **[PAUSIERT]**
  - VOR Erstellungsdatum: Hypothetische Performance (TWR ohne Transaktionen) basierend auf aktueller Gewichtung
  - AB Erstellungsdatum: Tatsächliche Performance (TWR mit Transaktionen)
  - Problem: Historische Kursdaten reichen nicht weit genug zurück
  - Benötigt: Tägliche Kurse für ALLE Aktien im Portfolio so weit wie möglich zurück (mehrere Jahre)
  - Status: Portfolio Test 1 zeigt nur Daten ab 06.11.2025, sollte aber bis YTD (01.01.2025) oder weiter zurück gehen
  - Prüfen: EODHD API historische Daten-Abfrage und Speicherung in historical_prices Tabelle
  - **PAUSIERT** auf Benutzerwunsch - Thema wird später wieder aufgenommen

- [x] "Neues Portfolio" Button überall soll direkt zum NEUEN Portfolio Builder (/portfolio-builder/new) führen (Zwischenschritt komplett entfernen)
- [x] Navigation "Portfolios" → "Neues Portfolio" führt zum alten Builder (auf neuen Builder umstellen)
- [x] Portfolio-Detailseite erscheint unter Dashboard statt unter Portfolios in der Sidebar
- [x] Submenu in DashboardLayout einklappbar machen

## New Bugs & Features (01.01.2026)
- [x] BUG: Portfolio Holdings Table - Spaltenstruktur inkorrekt implementiert - FIXED:
  - Spalte "Wert (CHF)" hinzugefügt (Position 7: nach "Kurs CHF", berechnet als Anzahl × Kurs CHF)
  - Spalte "Gewicht" verschoben (von Position 4 nach Position 10 zwischen "Div. Rendite" und "Aktionen")
  - Spalte "Ø Kaufpreis" hinzugefügt (Position 4: nach "Anzahl", zeigt avgBuyPrice in lokaler Währung)

## New Bugs (02.01.2026)
- [x] Fix currency conversion issue - portfolio shows incorrect total value (missing deposit transactions)
- [x] Fix dashboard display showing incorrect portfolio values
- [x] Fix portfolio creation to automatically create deposit and buy transactions for live portfolios
- [x] Fix FX conversion in transaction creation - totalAmountCHF now correctly calculated with FX rate
- [x] Fix dashboard value calculation - now includes cash position in portfolio value
- [x] BUG: Kein Fortschrittsbalken beim Klick auf "Portfolio automatisch erstellen" - Pop-Up mit Fortschrittsanzeige fehlt - FIXED: Added progress dialog with animated progress bar and status messages
- [x] BUG: 100% Gewichtung wird als orange angezeigt statt grün - "Weiter" Button bleibt deaktiviert trotz korrekter Gewichtung - FIXED: Increased weight validation tolerance from 0.01% to 0.1% to handle rounding errors
- [x] BUG: Portfolio creation invests only ~95-98% of initial amount (e.g., Marc portfolio CHF 150'000 → CHF 143'000 invested) - FIXED: Cash position now tracked
- [x] FEATURE: Implement cash position tracking for uninvested funds - COMPLETED: cashBalance column already exists in schema
- [x] Update portfolio creation logic to calculate cash position (initial amount - invested amount) - COMPLETED: portfoliosRouter.ts updated
- [x] Modify database schema to store cash positions per portfolio - COMPLETED: cashBalance column already exists
- [x] Display cash position in portfolio details view (Holdings table) - COMPLETED: Cash row added to holdings table with correct weight
- [x] Ensure total portfolio value = invested positions + cash position - COMPLETED: Backend totalValue calculation includes cashBalance (frontend caching issue remains)

## New Bugs (03.01.2026)
- [x] BUG: Gesamtwert (CHF 90'949.19) muss Cash-Position (CHF 10'000) addieren - Frontend zeigt nicht den korrekten Gesamtwert inklusive Cash - FIXED: Created migration script to recalculate cashBalance for all existing portfolios (03.01.2026)

## Fixes (03.01.2026 - Afternoon)
- [x] FIX: TypeScript error in onboardingRouter.ts - Missing investmentAmount field when creating demo portfolio - FIXED: Added investmentAmount, portfolioType, and status fields to demo portfolio creation
- [x] FIX: TypeScript error in portfolioOptimizerRouter.ts - Missing investmentAmount field when creating portfolio - FIXED: Added investmentAmount, portfolioType, status, and isLive fields
- [x] FIX: TypeScript error in logoService.ts - Duplicate property "LONN.SW" (Lonza) - FIXED: Removed duplicate entry
- [x] FIX: TypeScript error in test files - Missing Context export - FIXED: Added Context type alias export in context.ts
- [x] FIX: TypeScript error in liveTracking.test.ts - Missing investmentAmount in portfolio structure - FIXED: Added required fields to test mock

## New Bugs (04.01.2026)
- [x] BUG: Gesamtwert berücksichtigt Cash-Position nicht - CHF 96'101.23 sollte CHF 100'101.23 sein (inkl. CHF 4'000 Cash) - FIXED: Frontend hotfix + backend correction applied
- [x] BUG: Backend finalEnrichedStocks bug - stringifying enrichedStocks instead of finalEnrichedStocks - FIXED: Now returns finalEnrichedStocks

## New Tasks (04.01.2026 - Backend Cleanup & Enhancements)
- [x] Backend-Cleanup: totalValueCHF im Backend korrigieren (Cash-Balance einbeziehen), dann Frontend-Hotfix entfernen
- [ ] Performance-Chart Daten: Historische Kursdaten für hypothetische Performance vor Erstellungsdatum erweitern (aktuell "Keine Daten verfügbar")
- [x] Cash-Flow Tracking: Einzahlungen/Auszahlungen als separate Transaktionstypen erfassen, um Cash-Bewegungen besser nachzuvollziehen (Schema bereits vorbereitet mit 'deposit' und 'withdrawal' Typen)

## New Issues (04.01.2026 - Afternoon)
- [x] BUG: Portfoliodetails-Frames zu schmal - alle Spalten in der Portfolioliste sollen sichtbar sein - FIXED & VERIFIED: Holdings table widened from lg:col-span-2 to lg:col-span-3 (grid changed from 3 to 4 columns)
- [ ] BUG: Doppelte Cash-Spalte in Portfolioliste - NEEDS CLARIFICATION: Only one cash row found in code
- [x] BUG: Wechselkurs beim Aktienkauf nicht berücksichtigt - Total Portfolio sollte ca. 100'000.- sein statt weniger - FIXED & VERIFIED: Now converts CHF allocation to local currency before calculating shares (allocationInLocalCurrency = allocationAmountCHF / fxRate)
- [x] BUG: Donut-Chart Tooltip-Textfarbe schwarz (nicht lesbar) - auf Weiß ändern - FIXED & VERIFIED: Added color: '#ffffff' to both pie chart tooltips
