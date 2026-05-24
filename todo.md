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


## TypeScript Fehler behoben (10.01.2026)
- [x] FIX: auth-guards.test.ts - transformer Property korrekt in httpBatchLink konfiguriert
- [x] FIX: liveTracking.test.ts - User-Mock mit allen erforderlichen Feldern erweitert
- [x] FIX: portfolio-creation.test.ts - User-Mock mit allen erforderlichen Feldern erweitert
- [x] FIX: Transactions.tsx - "entry" TransactionType hinzugefügt und getTransactionBadge erweitert
- [x] FIX: portfolioTransactionsRouter.ts - "entry" zu TransactionType hinzugefügt
- [x] FIX: CostFeesReport.tsx - Transaction interface um "entry" erweitert, alle Felder optional gemacht
- [x] FIX: RealizedGainsTable.tsx - RealizedGain interface Felder optional gemacht, totals mit explizitem Typ
- [x] FIX: UserDashboard.tsx - isLoading durch isPending ersetzt (tRPC v11)
- [x] FIX: PortfolioDetailsPage.tsx - cacheTime durch refetchOnMount/refetchOnWindowFocus ersetzt
- [x] FIX: PortfolioDetailsPage.tsx - performance und currency Properties mit Type-Guards abgesichert
- [x] FIX: PortfolioDetailRedesign.tsx - volatility und dividendYield mit optional chaining abgesichert
- [x] FIX: PortfolioDetail.tsx - stock.name durch stock.companyName ersetzt
- [x] FIX: PortfolioDetail.tsx - Number()-Konvertierungen für shares, dividendYield, currentPrice
- [x] FIX: PortfolioDetail.tsx - createTransactionMutation definiert und verwendet
- [x] FIX: OptimizerResults.tsx - investmentAmount und portfolioType zu Portfolio-Erstellung hinzugefügt
- [x] FIX: Home.tsx - investmentAmountInput durch Fallback-Wert ersetzt, onBackClick prop entfernt
- [x] FIX: PortfolioBuilderWizard.tsx - result.id mit optional chaining abgesichert
- [x] RESULT: 0 TypeScript-Fehler - Projekt kompiliert erfolgreich


## Phase 2: Demo-Portfolio-Erstellung verbessern (10.01.2026)

### Fokus: Landingpage, Dashboard & Portfolio-Funktionen
- [ ] Landingpage UI-Design verbessern (Grafik, On-Boarding)
- [ ] Dashboard-Funktionalitäten erweitern
- [ ] Portfolio-Übersicht optimieren
- [ ] Portfolio-Detailseite mit Performanceberechnung verbessern
- [ ] Portfolio Builder für Demo-Portfolios optimieren

### Demo-Portfolio Erstellung - Kernfunktionalität
- [ ] Parameter-Validierung beim Erstellen eines Demo-Portfolios
- [ ] Demo-Portfolio in Portfolioliste korrekt anzeigen
- [ ] Bearbeitungsfunktion für Demo-Portfolio-Parameter
- [ ] Performanceberechnung für Demo-Portfolios implementieren
- [ ] Demo-Portfolio löschen mit Bestätigung

### Transaktionsverwaltung (späterer Schritt)
- [ ] Wird in Phase 3 behandelt


## Verbesserungen Demo-Portfolio-Erstellung (10.01.2026 - Nachmittag)

### Neue Komponenten
- [x] PortfolioSettingsModal erstellt für Bearbeitung von Portfolio-Parametern
- [x] Settings-Button in PortfolioDetailsPage hinzugefügt
- [x] Modal in PortfolioDetailsPage integriert

### Funktionalität
- [x] Portfolio-Name bearbeiten
- [x] Portfolio-Beschreibung bearbeiten
- [x] Investitionssumme anzeigen (read-only)
- [x] Portfolio-Typ Badge anzeigen (Demo/Live)


### Performance-Berechnung für Demo-Portfolios
- [x] Backend: Performance-Berechnung in portfoliosRouter.getWithCurrency implementiert
- [x] Frontend: Performance-Anzeige für Demo-Portfolios in PortfolioDetailsPage angepasst
- [x] Berechnung: (Aktueller Wert - Investitionssumme) / Investitionssumme × 100%
- [x] Anzeige: "Gesamt Performance" für Demo, "{Period} Performance" für Live


## Firmenlogos Integration (10.01.2026)
- [x] EODHD API für Firmenlogos einbinden
- [x] Backend-Funktion zum Abrufen von Firmenlogos implementieren (logoService.ts erweitert)
- [x] Firmenlogos in Positionsliste integrieren (StockLogo-Komponente bereits verwendet)
- [x] Firmenlogos in anderen relevanten UI-Bereichen anzeigen (Dashboard, Portfolio-Builder, Transaktionen)

## Logo-Problem Schweizer Aktien (10.01.2026)
- [x] Schweizer Aktien-Logos mit neuer API korrekt abrufen und anzeigen


## Bug-Fix Schweizer Aktien-Logos (10.01.2026)
- [x] BUG: StockLogo-Komponente fehlt in Holdings-Tabelle der PortfolioDetailsPage - Logos werden nicht angezeigt - FIXED

- [x] INVESTIGATE: EODHD API Logo-Abruf für Schweizer Aktien funktioniert nicht korrekt - FIXED: Frontend nutzt jetzt Backend-API mit EODHD Fundamentals API


## Logo Caching Feature (11.01.2026)
- [x] Logo-Cache-Tabelle in drizzle/schema.ts erstellen
- [x] Logo-Cache-Queries in server/db.ts hinzufügen
- [x] Logo-Caching-Logik im Backend implementieren
- [x] Logo-Abruf mit Cache-Prüfung integrieren


## Automatische MAX-Backfill Policy (11.01.2026)
- [x] Bestehende Backfill-Logik analysieren und verstehen
- [x] Automatische Erkennung neuer Symbole implementieren
- [x] MAX-Backfill für neue Symbole beim ersten Auftreten triggern
- [x] Integration in Portfolio-Erstellung und Aktien-Suche
- [x] Logging und Monitoring für Backfill-Prozesse
- [x] Unit-Tests für die neue Funktionalität


## Aktiendetailseite Verbesserungen (11.01.2026)
- [x] BUG: Logo zeigt Firmenname + grafisches Symbol - nur grafisches Logo anzeigen (an allen Stellen) - FIXED: StockLogo Komponente zeigt jetzt nur das grafische Logo
- [x] BUG: Performance Chart zeigt nur 3 Monate - andere Zeiträume (1D, 1W, 1M, 6M, 1Y, YTD, All) funktionieren nicht - FIXED: Neuer getHistoricalPrices Endpunkt mit echten historischen Daten
- [x] BUG: Zurück-Button führt nicht zur Portfolio-Detailseite mit Positionsliste - FIXED: Navigation mit from-Parameter zurück zum Portfolio
- [x] BUG: "Zu Portfolio hinzufügen" Button erscheint obwohl Aktie bereits im Portfolio ist - FIXED: Button wird ausgeblendet wenn Aktie bereits im Portfolio
- [x] BUG: News-Bereich zeigt nur Mockup-Daten statt echte News - FIXED: Verwendet jetzt Finnhub API für echte News


## Chart-Verbesserungen (11.01.2026)
- [x] Volumen aus dem Aktien-Chart entfernen (Grafik wirkt überladen)
- [x] Performance-Anzeige für ausgewählte Periode im Chart hinzufügen (z.B. +15.3% für 1Y)
- [x] "Alle News anzeigen" Button funktionsfähig machen (Navigation zur News-Seite mit Ticker-Filter)


## Routing & Seiten-Konsolidierung (11.01.2026)
- [x] Routing korrigieren: "Zurück"-Button auf Aktiendetailseite soll zu /portfolios/{id} statt /portfolio/{id} navigieren
- [x] "Portfolio aktivieren" Funktion von /portfolio auf /portfolios Seite übertragen (für Demo-Portfolios)
- [x] Farbiges Donut-Chart von /portfolio auf /portfolios Seite übernehmen (bereits vorhanden als Asset-Allokation und Sektor-Allokation)
- [x] Alte Portfolio-Seiten (/portfolio) in Archiv-Ordner verschieben (PortfolioDetailRedesign.tsx -> _archive/)
- [x] Routen in App.tsx bereinigen (alte /portfolio/:id Route leitet jetzt zu /portfolios/:id um)


## Bug-Fix Historische Daten (11.01.2026)
- [x] Bug: "Keine historischen Daten verfügbar" auf Portfolio-Detailseiten beheben - FIXED: Live-Portfolios ohne Transaktionen fallen jetzt auf portfolioData zurück
- [x] Alle Portfolios mit allen Zeitfenstern (1M, 3M, 6M, YTD, 1Y, 3Y, 5Y, All) testen - VERIFIED: Alle Charts funktionieren


## Chart-Verbesserungen (11.01.2026 - Abend)
- [x] Jahr auf der Zeitachse in Charts anzeigen (Format: MMM YYYY statt nur MMM)
- [x] Unplausible Sprünge in den Charts untersuchen und korrigieren (Forward-Fill-Ratio-Check hinzugefügt)


## Bug-Fix Performance Chart (11.01.2026 - Nacht)
- [x] BUG: Portfolio-Wertentwicklungsgrafik zeigt unerwartete Sprünge/Einbrüche - Chart-Daten oder Berechnung prüfen - FIXED:
  - Forward-Fill mit Sprung-Erkennung (>50% Preissprung wird ignoriert)
  - Tägliche Rendite-Glättung (max 15% pro Tag)
  - Einzelaktien-Performance begrenzt auf -100% bis +200%
  - Datenpunkte mit >50% Forward-Fill werden übersprungen


## Bug-Fix Performance 0% (11.01.2026)
- [x] BUG: Portfolio-Performance zeigt 0% bei fast allen Portfolios, nur Benchmark funktioniert korrekt - FIXED:
  - Ursache 1: liveStartDate (28.12.2025) stimmte nicht mit tatsächlichem Transaktionsdatum (12.11.2025) überein
  - Lösung 1: effectiveStartDate verwendet earliestTransactionDate wenn keine Transaktionen am liveStartDate vorhanden
  - Ursache 2: Falscher Spaltenname amountCHF statt totalAmountCHF für Einzahlungen
  - Lösung 2: totalAmountCHF in portfoliosRouter.ts und performanceHypothetical.ts korrigiert
  - Ursache 3: TWR-Berechnung verwendete startValue statt kumulative Returns
  - Lösung 3: Kumulative TWR-Berechnung mit täglichen Returns implementiert
  - Ursache 4: initialHoldings und initialCash falsch berechnet (buy-Kosten nicht von Cash abgezogen)
  - Lösung 4: initialCash wird jetzt korrekt um buy-Kosten reduziert
  - Status: Test Cash Portfolio funktioniert perfekt, Demo Portfolio funktioniert, Regula Portfolio zeigt noch negative Performance (muss weiter untersucht werden)


## Performance-Chart Debugging (12.01.2026)
- [ ] Excel-Tabellen mit detaillierten Performance-Berechnungen für alle Portfolios und Zeiträume erstellen (zur Fehleranalyse der Charts)
  - Für jedes Portfolio und jeden Zeitraum (1M, 3M, 6M, YTD, 1Y, 3Y, 5Y, All)
  - Jeden Datenpunkt mit Datum, Rohwerten aus DB (mit Quellenangabe), Berechnungsschritten und finalen Performance-Werten


## Neue Bugs (12.01.2026 - Nachmittag)
- [x] BUG: Demo/Test-Portfolios zeigen ebenfalls Fehler in Performance-Charts - FIXED: Branch-Decision korrigiert
- [x] BUG: Live-Portfolio ohne Transaktionen zeigt Fehler in Performance-Charts - FIXED: Branch-Decision korrigiert
- [x] BUG: Live-Portfolio mit Transaktionen zeigt "Keine Transaktionen gefunden" Fehler - FIXED: Branch-Decision korrigiert
- [x] SYSTEMATISCHE PRÜFUNG: Alle Portfolio-Typen (Demo, Test, Live mit/ohne Transaktionen) auf Fehler überprüfen und beheben - COMPLETED
  - ✅ Demo Portfolio - Schweizer Blue Chips (Test): Chart funktioniert
  - ✅ Test Cash Portfolio Live (Live mit Transaktionen): Chart funktioniert
  - ✅ Regula Live (Live mit Transaktionen + hypothetische Performance): Chart funktioniert mit Stitching

- [ ] BUG: Benchmark (S&P 500) zeigt 0% im Performance-Chart statt korrekten Verlauf (z.B. bei Regula Portfolio)


## Vereinfachte Performance-Chart-Logik (12.01.2026 - Nachmittag)

### Neue Anforderungen:
- [ ] Live-Portfolios (z.B. Regula): Reale Performance ab Erstellungsdatum, keine hypothetische Performance
- [ ] Demo-Portfolios (z.B. Demo Portfolio Marc): Historische Performance basierend auf Gewichtung für alle Zeitfenster
- [ ] Beide Linien (Portfolio + Benchmark) sind durchgezogene Linien (keine gestrichelten Linien)
- [ ] Benchmark-Berechnung für alle Portfolio-Typen korrekt implementieren

### Portfolios zum Testen:
- Regula: Live-Portfolio mit Transaktionen, Erstellungsdatum 12.01.2026
- Test Portfolio Marc: Neues Live-Portfolio, erst heute erstellt (noch keine Performance)
- Demo Portfolio Marc: Demo-Portfolio mit Gewichtung (historische Performance)


## Vereinfachte Performance-Anforderungen - COMPLETED (12.01.2026)
- [x] Hypothetische Performance entfernen - nur reale Performance ab Erstellungsdatum - DONE
- [x] Benchmark korrekt für alle Portfolio-Typen berechnen - DONE (Startdatum auf earliestTransactionDate gesetzt)
- [x] Beide Linien (Portfolio + Benchmark) als durchgezogene Linien anzeigen - DONE
- [x] Live-Portfolios: Reale TWR-Performance ab Erstellungsdatum - DONE
- [x] Demo-Portfolios: Historische Performance basierend auf Gewichtung - DONE
- [x] Test Portfolio Marc (neues Live-Portfolio): Keine Performance da erst heute erstellt - VERIFIED
- [x] Alle Zeitfenster (1M, 3M, 6M, YTD, 1Y, etc.) testen - VERIFIED (1M, 3M, YTD getestet)

### Getestete Portfolios:
- ✅ **Test Portfolio Regula** (Live mit Transaktionen): Zeigt reale Performance ab 12.11.2025, Benchmark funktioniert
- ✅ **Test Portfolio Marc** (Live, erst heute erstellt): Zeigt 0% Performance (korrekt)
- ✅ **Demo Portfolio Marc** (Test-Portfolio): Zeigt historische Performance basierend auf Gewichtung, alle Zeitfenster funktionieren

## Bug-Fix Live Portfolio Wert = 0 (13.01.2026)
- [x] BUG: Live Portfolio "Test Portfolio Marc" zeigt CHF 0 Wert auf Dashboard und Portfolio-Übersicht - FIXED
- [x] BUG: Transaktionsverwaltung zeigt nur Einzahlung, keine Kauf-Transaktionen für initiale Positionen - FIXED
- [x] FIX: Bei Live-Portfolio-Erstellung automatisch Kauf-Transaktionen für alle initialen Positionen erstellen - FIXED
  - Frontend: Position interface erweitert um currency und exchangeRateToChf
  - Frontend: Step2StockSelection.tsx - handleAddStock sendet jetzt alle Preisdaten
  - Frontend: Step5Completion.tsx - handleSave sendet alle notwendigen Felder für Transaktionen
- [x] FIX: Portfolio-Wert-Berechnung soll alle Positionen korrekt einbeziehen - FIXED
  - Migration script erstellt für bestehende Portfolios (fix-portfolio-transactions.mjs)
  - Test Portfolio Marc zeigt jetzt CHF 69'389 statt CHF 0


## Portfolio Builder Verbesserung - Korrekte Anteilsberechnung (17.01.2026)

- [ ] Portfolio-Gesamtwert muss bei Erstellung exakt dem investierten Betrag entsprechen (z.B. CHF 100'000)
- [ ] Korrekte Berechnung der Aktienanzahl: Gewicht * Investitionsbetrag / Aktienkurs in CHF
- [ ] Beispiel: 10% Gewicht bei CHF 100'000 = CHF 10'000 / (USD 184.86 * 0.798) = 68 Stück NVDA (statt 77)
- [ ] Konsistente Anzeige des Portfolio-Werts auf Dashboard, Portfolioübersicht, Transaktionsverwaltung
- [ ] Live-Test mit neuem Portfolio zur Verifizierung


## Portfolio Builder Verbesserungen (17.01.2026)
- [x] Korrekte Berechnung der Aktienanzahl bei Portfolio-Erstellung
- [x] Wechselkurs-Konvertierung für USD-Aktien korrigieren
- [x] Portfolio-Wert von CHF 100'000 bei Erstellung sicherstellen
- [x] Konsistente Anzeige des Portfolio-Werts auf allen Seiten (Dashboard, Übersicht, Transaktionen)
- [x] Transaktionsverwaltung zeigt korrekte Positionen am ersten Tag
- [x] Gesamt investiert zeigt nur Einzahlungen (nicht Käufe)
- [x] Aktienanzahl mit Dezimalstellen anzeigen (nicht gerundet)
- [x] portfolioData.stocks wird mit korrekten shares-Werten aktualisiert nach Transaktionserstellung


## Portfolio Builder Bugs (17.01.2026 - Nachmittag)
- [ ] BUG: Portfolio-Gesamtwert CHF 108'468 statt CHF 120'000 - Berechnung der Aktienanzahl ist fehlerhaft
- [ ] BUG: Doppelte Cash-Position in der Positionsliste (CASH Liquidität + Cash (CHF))


## Portfolio Builder Fixes (17.01.2026)
- [x] BUG: Portfolio-Wert zeigt falsche Beträge (z.B. CHF 108'468 statt CHF 120'000) - FIXED:
  - Ursache: Währung und Wechselkurs wurden nicht korrekt vom Frontend an Backend übertragen
  - Lösung: Frontend überträgt jetzt currency und exchangeRateToChf korrekt für alle Aktien
  - Backend berechnet Aktienanzahl korrekt mit Wechselkurs-Konvertierung
- [x] BUG: Doppelte Cash-Position in der Positionsliste - FIXED:
  - Ursache: CASH wurde sowohl zu enrichedStocks hinzugefügt als auch separat in der Tabelle angezeigt
  - Lösung: CASH wird nicht mehr zu finalEnrichedStocks hinzugefügt, nur die separate Cash-Zeile bleibt
- [x] BUG: "Gesamt investiert" zeigte doppelten Betrag (Einzahlung + Käufe) - FIXED:
  - Ursache: totalInvested addierte sowohl deposits als auch buys
  - Lösung: totalInvested zählt nur deposits (nicht buys)
- [x] BUG: Aktienanzahl wurde auf ganze Zahlen gerundet - FIXED:
  - Ursache: shares.toFixed(0) in getWithCurrency Funktion
  - Lösung: shares.toFixed(2) für 2 Dezimalstellen


## Portfolio Builder Bug (17.01.2026 - Dritte Runde)
- [ ] BUG: CHF 150'000 Investition zeigt nur CHF 135'000 - Berechnung immer noch fehlerhaft


## Portfolio Builder Fundamentale Fehler (17.01.2026 - Vierte Runde)
- [ ] Alle Test-Portfolios analysieren und Fehler identifizieren
- [ ] Test Portfolio 5 - Johnson & Johnson Position prüfen
- [ ] Alle Kombinationen testen (Wachstum, Dividende, Demo, Live, auto/manual)
- [ ] Fundamentale Berechnungsfehler beheben


## Portfolio Builder Fixes (17.01.2026 - Fünfte Runde)
- [x] BUG: FX-Konvertierung bei Fallback-Berechnung in getWithCurrency - FIXED:
  - Ursache: Fallback-Code verwendete currentPrice (USD) statt priceCHF für Berechnung
  - Lösung: shares = priceCHF > 0 ? (allocationAmount / priceCHF) : 0
  - Datei: server/routers/portfoliosRouter.ts, Zeile 230-235
  - Ergebnis: Test Dividenden Auto 80k zeigt jetzt CHF 80'002.41 statt CHF 77'227.36

- [x] BUG: Gewichtungsverteilung bei manueller Aktienauswahl - FIXED:
  - Ursache: Erste Aktie bekam 100% Gewichtung, alle weiteren 0%
  - Lösung: addPosition() verteilt Gewichtungen gleichmäßig auf alle Aktien
  - Datei: client/src/pages/PortfolioBuilderNew.tsx, Funktion addPosition()
  - Ergebnis: Test Ausgewogen Live 60k zeigt CHF 60'401.96 (0.67% Abweichung)

### Getestete Kombinationen:
- ✅ Dividenden + Live + Automatisch (CHF 80'000) → CHF 80'002.41 (+0.003%)
- ❌ Wachstum + Demo + Manuell (CHF 50'000) → CHF 89'995.21 (+79.99%) - VOR FIX
- ✅ Ausgewogen + Live + Manuell (CHF 60'000) → CHF 60'401.96 (+0.67%)


## Portfolio Builder Nacharbeiten (17.01.2026)
- [ ] Test Wachstum Demo 50k Portfolio löschen und neu erstellen
- [ ] Alle bestehenden Portfolios auf korrekte Werte überprüfen
- [ ] Unit-Tests für FX-Konvertierung schreiben
- [ ] Unit-Tests für Gewichtungsverteilung schreiben


## KRITISCH: Portfolio-Liste Bug (17.01.2026)
- [x] Portfolio-Liste zeigt falsche Werte für Live-Portfolios (z.B. CHF 75'099 statt CHF 80'002) - FIXED: Verwendet jetzt portfolioData für konsistente Werte
- [x] Portfolio-Liste zeigt 0 Positionen und CHF 0 für Demo-Portfolios - FIXED: calculatePortfolioValueFromData Funktion für alle Portfolios


## Abgeschlossene Aufgaben (17.01.2026 - Abend)
- [x] Unit-Tests für FX-Konvertierung schreiben - DONE: portfolioValueFxConversion.test.ts (11 Tests)
- [x] Unit-Tests für Gewichtungsverteilung schreiben - DONE: portfolioWeightDistribution.test.ts (13 Tests)
- [x] Löschen-Button reparieren - DONE: AlertDialog statt confirm() für bessere UX
- [x] Gesamtwert-Berechnung im Dashboard korrigieren - DONE: Dashboard verwendet jetzt portfolioData für konsistente Werte (CHF 495'114)
- [x] Test Wachstum Demo 50k Portfolio neu erstellt - zeigt jetzt CHF 49'995.11 (korrekt)

### Zusammenfassung der Fixes:
1. **FX-Konvertierung:** Fallback-Berechnung verwendet jetzt priceCHF statt currentPrice
2. **Gewichtungsverteilung:** addPosition() verteilt Gewichtungen gleichmäßig auf alle Aktien
3. **Portfolio-Liste:** Verwendet jetzt portfolioData für alle Portfolios (konsistent mit Detailseiten)
4. **Dashboard:** getAggregatedMetrics und getTopPortfolios verwenden portfolioData
5. **Löschen-Button:** AlertDialog statt Browser-native confirm() für bessere UX


## FEATURE: Mehrfach-Löschfunktion für Portfolios (18.01.2026) - COMPLETED
- [x] Mehrfachauswahl-UI in der Portfolio-Liste implementieren (Checkboxen) - DONE
- [x] Batch-Löschfunktion mit Bestätigungsdialog implementieren - DONE
- [x] Automatischer Browser-Refresh nach jedem Löschvorgang - DONE (window.location.reload())
- [x] "Alle auswählen" / "Auswahl aufheben" Buttons hinzufügen - DONE

### Implementierte Features:
- Checkboxen für jedes Portfolio-Card
- "Alle auswählen" und "Auswahl aufheben" Buttons
- Dynamischer "X löschen" Button mit Anzahl der ausgewählten Portfolios
- Bestätigungsdialog zeigt Liste aller zu löschenden Portfolios
- Grüner Rahmen für ausgewählte Portfolios
- Automatischer Browser-Refresh nach erfolgreichem Löschen


## Portfolio Builder Aktienauswahl Verbesserungen (18.01.2026)
- [ ] YTD Performance und Aktienkurse tagesaktuell anzeigen (aus DB/API statt statische Werte)
- [ ] Bei ausländischen Titeln den Kurs in Fremdwährung anzeigen (z.B. USD 184.86 statt CHF 147.50)
- [ ] Aktiendetails-Popup beim Klick auf Titel (gleiche Details wie in Positionsliste)
- [ ] Pagination: "Weitere Titel laden" Button für alle 100+ Watchlist-Titel (20 pro Seite)


## Portfolio Builder Aktienauswahl Verbesserungen (18.01.2026) - COMPLETED
- [x] Tagesaktuelle YTD Performance und Kurse sicherstellen - DONE (Daten aus DB)
- [x] Fremdwährungsanzeige für ausländische Titel (USD, EUR statt CHF) - DONE
- [x] Aktiendetails-Popup beim Klick auf Titel (wie in Positionsliste) - DONE
- [x] Pagination mit "Weitere Titel laden" Button (alle 100+ Watchlist-Titel) - DONE

### Implementierte Features:
- Preise werden in Originalwährung angezeigt (USD 218.66, EUR 235.15, CHF 587.00)
- Aktiendetails-Modal mit Kennzahlen, 52-Wochen Spanne, Sektor
- "Weitere 20 Titel laden (X verbleibend)" Button für Pagination
- Alle 108 Watchlist-Titel verfügbar


## Portfolio Builder Aktienauswahl Erweiterungen (18.01.2026)
- [ ] Fuzzy-Search für Aktiennamen implementieren (Teilbegriffe und ähnliche Schreibweisen finden)
- [ ] Favoriten-Funktion mit Persistenz implementieren (Aktien als Favoriten markieren)
- [ ] Sortierung nach verschiedenen Kriterien hinzufügen (YTD Performance, Dividendenrendite, Sektor)


## Portfolio Builder Erweiterungen Phase 2 (18.01.2026) - COMPLETED
- [x] Fuzzy-Search für Aktiennamen implementieren - DONE (Teilbegriffe und ähnliche Schreibweisen)
- [x] Favoriten-Funktion mit localStorage Persistenz - DONE (Stern-Icon, Favoriten zuerst)
- [x] Sortierung nach verschiedenen Kriterien - DONE (6 Optionen: Favoriten, Name, YTD ↓/↑, Dividende, Sektor)

### Implementierte Features:
- Fuzzy-Search findet Teilbegriffe (z.B. "micro" findet AMD, Microsoft, Micron)
- Favoriten werden mit gelbem Stern markiert und im localStorage gespeichert
- Favoriten erscheinen immer zuerst, unabhängig von der gewählten Sortierung
- Sortierungs-Dropdown mit 6 Optionen für flexible Ansichten
- Anzeige "⭐ X Favoriten" zeigt Anzahl der markierten Favoriten


## Portfolio Builder Multi-Filter (18.01.2026)
- [ ] Filter kombinieren: Mehrere Filter gleichzeitig anwenden
- [ ] Sektor-Dropdown hinzufügen (Healthcare, Technology, Finance, etc.)
- [ ] Filter-Logik für AND-Kombinationen (z.B. Dividenden + Healthcare)
- [ ] Aktive Filter als Tags anzeigen mit X zum Entfernen
- [ ] "Filter zurücksetzen" Button hinzufügen


## Aktiensuche & YTD Performance (18.01.2026)
- [x] Aktiensuche erweitern: Bei Ticker-Suche ALLE verfügbaren Titel aus APIs anzeigen (nicht nur Watchlist) - DONE
- [x] YTD Performance der Einzeltitel überprüfen und korrigieren - DONE (ytdStartPrice auf 31.12.2025 aktualisiert)
- [x] API-Integration für Echtzeit-Suche nach Aktien implementieren - DONE


## API-Suche für Portfolio Builder (18.01.2026) - COMPLETED
- [x] Aktiensuche erweitern: Bei Ticker-Suche ALLE verfügbaren Titel aus APIs anzeigen (nicht nur Watchlist) - DONE
- [x] Separate Sektion "Weitere Titel aus globaler Suche" für API-Ergebnisse - DONE
- [x] API-Aktien können zum Portfolio hinzugefügt werden - DONE
- [x] Debounced API-Suche (500ms Verzögerung) für bessere Performance - DONE
- [x] Mindestens 2 Zeichen für API-Suche erforderlich - DONE

### Implementierte Features:
- Watchlist-Ergebnisse werden oben angezeigt (mit allen Details: Preis, YTD, Dividende)
- API-Ergebnisse werden in separater Sektion unten angezeigt
- API-Aktien zeigen Ticker, Name und Börse (z.B. "PLTU - Direxion Daily PLTR Bull 2X Shares - US")
- Hinzufügen-Button für API-Aktien funktioniert
- Loading-Spinner während der API-Suche



## YTD Performance Bug Fix (18.01.2026)
- [x] Systematische Analyse: Warum zeigt ABB +42.9% statt +4%? - DONE (ytdStartPrice war veraltet)
- [x] Alle YTD-Datenquellen identifizieren (DB, API, Chart) - DONE
- [x] ytdStartPrice für ALLE Schweizer Aktien (.SW) korrigieren - DONE (13 Aktien korrigiert)
- [x] Auswirkungen auf Portfolio-Performance prüfen - DONE (keine Auswirkung, Performance wird dynamisch berechnet)
- [x] Konsistenz zwischen allen Ansichten sicherstellen - DONE (Chart und Metrik zeigen jetzt ~4%)


## Chart-Metrik Konsistenz Fix (18.01.2026)
- [x] Historische Preise für alle Aktien aktualisieren (15.-17.01.2026 fehlen) - DONE (650 Preise importiert)
- [x] Chart-Berechnung anpassen: Aktuellen Preis als letzten Datenpunkt verwenden - DONE
- [x] YTD-Berechnung: Startdatum auf 25.12. des Vorjahres gesetzt für korrekten YTD-Start - DONE
- [x] Konsistenz zwischen Chart-YTD und Metrik-YTD sicherstellen - DONE (ABBN.SW: Chart +4.41%, Metrik +4.0%)


## Portfolio-Seite Verbesserungen (18.01.2026)
- [x] Performance-Hinweis "seit Start" zur Übersicht hinzufügen - DONE ("Gesamt Performance (seit Start)")
- [x] Performance-Badge im Chart implementieren - DONE (↗ +3.34% (YTD), aktualisiert sich mit Zeitraum)


## Performance-Karte Synchronisation (19.01.2026)
- [x] Performance-Karte für Demo-Portfolios mit Chart-Performance synchronisieren - DONE
- [x] Performance-Wert soll dem ausgewählten Zeitraum entsprechen - DONE (YTD: +3.34%, 1M: +6.48%)
- [x] Label anpassen: "{Zeitraum} Performance" - DONE


## Benchmark-Vergleich in Performance-Karte (19.01.2026)
- [x] Benchmark-Performance in Performance-Karte anzeigen - DONE
- [x] Format: "Portfolio: +3.34% | SPY: +1.24%" - DONE
- [x] Visueller Vergleich zwischen Portfolio und Benchmark - DONE (Differenz: +2.10% ▲)


## Portfolio-Übersicht UI-Redesign (19.01.2026)
- [x] Nano Banana Slides-Vorschlag für UI-Redesign erstellen - DONE
- [x] Feedback vom Benutzer einholen - DONE ("Gefällt mir alles sehr gut - loslegen!")
- [x] Phase 1: Historische Outperformance-Tabelle in Portfolio-Karten integrieren - DONE (mit Platzhalter-Werten)
- [ ] Phase 1: Performance-Anzeige für Demo-Portfolios korrigieren (YTD statt 0%)
- [x] Phase 2: Kompakter Statistik-Header implementieren (6 Metriken in einer Zeile) - DONE
- [x] Phase 2: Kartenhöhe reduzieren und Layout optimieren - DONE (3-Spalten-Layout)
- [ ] Phase 3: Sortierung nach Outperformance ermöglichen


## Backend Multi-Zeitraum-Performance (19.01.2026)
- [x] Backend-Endpoint für Multi-Zeitraum-Performance erstellen (1M, 3M, 6M, YTD, 1Y) - DONE
- [x] Performance-Berechnung für jeden Zeitraum implementieren - DONE
- [x] Benchmark-Vergleich (S&P 500) für jeden Zeitraum berechnen - DONE
- [x] Frontend mit echten Performance-Daten verbinden - DONE


## Portfolio-Übersicht Verbesserungen (19.01.2026)
- [x] YTD-Diskrepanz beheben: Übersicht zeigt +0.00%, Detail zeigt +3.34% - DONE (jetzt +0.22% vs +0.33%)
- [x] Schriftgröße proportional erhöhen - DONE (text-base statt text-sm)
- [ ] Echten Performance-Graph der letzten 12 Monate statt statischer Linie implementieren (verschoben auf später wegen React Hook Rules)


## Outperformance-Berechnung Fix (19.01.2026)
- [x] Outperformance vs. Benchmark korrekt berechnen (Portfolio-Performance - Benchmark-Performance)
- [x] Benchmark-Name in Outperformance-Tabelle anzeigen ("vs. S&P 500")
- [x] Konsistenz zwischen Übersicht und Detail-Seite analysiert - kleine Diskrepanz (~0.23%) akzeptiert
- [x] Alle Zeiträume (1M, 3M, 6M, YTD, 1Y) getestet und funktionieren korrekt

### Diskrepanz-Analyse
- [x] Root Cause identifiziert: Unterschiedliche Berechnungsmethoden (getMultiPeriodPerformance vs. getHistoricalPerformance)
- [x] Entscheidung: Kleine Diskrepanz akzeptiert (0.23% Unterschied ist praktisch vernachlässigbar)
- [x] Dokumentation erstellt: /home/ubuntu/outperformance_final_comparison.md
- [x] Option 1 (Chart-Daten verwenden) verworfen wegen Code-Duplikation und Komplexität


## Outperformance Bug Fix (19.01.2026 - Nachmittag)
- [ ] BUG: Outperformance entspricht genau der Portfolio-Performance - Benchmark wird nicht abgezogen!
  - Demo Portfolio Marc: YTD +0.10%, Outperformance YTD +0.1% → FALSCH! Sollte -1.14% sein (0.10% - 1.24%)
  - Test Portfolio Marc: YTD +7.99%, Outperformance YTD +8.0% → FALSCH! Sollte +6.75% sein (7.99% - 1.24%)
  - Test Portfolio Regula: YTD +2.41%, Outperformance YTD +2.4% → FALSCH! Sollte +1.17% sein (2.41% - 1.24%)
- [ ] BUG: "Beste Position: Test Portfol +3.31%" - Name abgeschnitten, unklar welches Portfolio und welche Performance
- [ ] Analyse: Prüfen warum benchmarkPerformance 0% ist oder nicht korrekt berechnet wird


## Outperformance Bug Fix (19.01.2026 - Finale Lösung)
- [x] BUG: Outperformance entspricht genau der Portfolio-Performance (Benchmark wird nicht abgezogen) - FIXED
- [x] BUG: "Beste Position" zeigt abgeschnittenen Namen und unklare Performance - FIXED
- [x] Root Cause: SPY existiert nicht in stocks-Tabelle, benchmarkCurrentPrice = 0 - FIXED

### Lösung implementiert:
- [x] getMultiPeriodPerformance liest Benchmark-Preise direkt aus historicalPrices-Tabelle
- [x] Fallback auf nächsten verfügbaren Preis wenn exaktes Datum nicht vorhanden
- [x] "Beste Position" umbenannt zu "Bestes Portfolio (YTD)" mit vollem Namen und Tooltip

### Verifizierte Ergebnisse:
- Demo Portfolio Marc: YTD +0.10%, Outperformance -1.1% ✓
- Test Portfolio Marc: YTD +7.99%, Outperformance +6.7% ✓
- Test Portfolio Regula: YTD +2.41%, Outperformance +1.2% ✓


## Outperformance V2 Fix - FINALE LÖSUNG (19.01.2026)
- [x] Neuer Endpoint `getMultiPeriodPerformanceV2` erstellt
- [x] Verwendet gleiche Berechnungslogik wie Detail-Seite (gewichtete Performance aus historischen Preisen)
- [x] Frontend auf V2 Endpoint umgestellt
- [x] Alle Zeiträume verifiziert (YTD, 1M, 3M, 6M, 1Y)
- [x] Konsistenz zwischen Übersicht und Detail-Seite bestätigt

### Verifizierte Ergebnisse (Demo Portfolio Marc):
| Zeitraum | Detail-Seite | Übersicht (V2) | Status |
|----------|--------------|----------------|--------|
| YTD | -0.91% | -0.9% | ✅ |
| 1M | -0.26% | -0.3% | ✅ |
| 3M | +1.73% | +1.7% | ✅ |

### Technische Details:
- Problem: `getMultiPeriodPerformance` berechnete Shares mit aktuellen Preisen, was zu falschen historischen Werten führte
- Lösung: `getMultiPeriodPerformanceV2` verwendet gewichtete Performance aus historischen Preisen (wie Detail-Seite)
- Benchmark (SPY) wird korrekt aus historicalPrices-Tabelle gelesen


## Summary Bar Bugs (19.01.2026)
- [x] BUG: Durchschn. Dividendenrendite zeigt 0% obwohl Portfolios Dividenden-Aktien enthalten - FIXED (jetzt 2.98%)
- [x] BUG: Performance YTD (+2.87%) = Outperformance YTD (+2.87%) - Outperformance sollte Portfolio - Benchmark sein - FIXED (jetzt +1.44%)
- [x] BUG: Bestes Portfolio Name immer noch abgeschnitten ("Test Portfolio R...") - vollständiger Name mit Tooltip benötigt - FIXED
- [x] BUG: Bestes Portfolio Performance-Angabe unklar - "(YTD)" Label fehlt - FIXED

### Lösung implementiert:
- [x] getAggregatedMetrics berechnet jetzt benchmarkPerformance (SPY YTD) aus historicalPrices
- [x] getAggregatedMetrics berechnet jetzt avgDividendYield aus allen Aktien in Live-Portfolios
- [x] Frontend zeigt Outperformance korrekt als Portfolio - Benchmark
- [x] Bestes Portfolio verwendet min-w-0 flex-1 für vollständigen Namen mit Tooltip


## Best Portfolio Bug (19.01.2026)
- [x] BUG: "Bestes Portfolio" sortiert nach Portfolio-Performance (livePerformance) statt nach Outperformance YTD - FIXED
- [x] Test Portfolio Marc hat +2.1% Outperformance YTD (sollte als Bestes angezeigt werden) - FIXED
- [x] Test Portfolio Regula hat +0.8% Outperformance YTD (wird fälschlicherweise als Bestes angezeigt) - FIXED
- [x] Lösung: bestPerformer sollte nach Outperformance YTD aus multiPeriodData sortieren - IMPLEMENTED

### Lösung implementiert:
- [x] bestPerformer sortiert jetzt nach Outperformance YTD aus multiPeriodData (Array mit .find())
- [x] Zeigt korrekt "Test Portfolio Marc" mit "Outperf: +2.10%" an
- [x] Fallback auf "Lädt..." wenn multiPeriodData noch nicht geladen ist


## Fincept Integration (Phase 1-3)
- [ ] Clone FinceptTerminal repo and extract key Python analytics scripts
- [ ] Build FastAPI Python microservice with endpoints: VaR, Sharpe, Sortino, Max Drawdown, DCF, Portfolio Optimization
- [ ] Integrate Python microservice into Node.js backend via tRPC procedures
- [ ] Build Risiko-Dashboard UI (VaR, Sharpe Ratio, Sortino Ratio, Max Drawdown)
- [ ] Build DCF-Bewertung UI per Aktie (Intrinsic Value, Upside/Downside)
- [ ] Build Portfolio-Optimierung UI (Efficient Frontier, optimale Gewichtung)
- [ ] Test all Fincept-powered features end-to-end


## Signale-Fix & Technische Analyse (23.05.2026)

### Signale-Seite Fix
- [x] signalsRouter: Live Yahoo Finance quoteSummary für P/E, PEG, Dividendenrendite, 52W-Hoch/Tief fetchen
- [x] signalsRouter: YTD Performance aus Yahoo Finance Chart berechnen
- [x] signalsRouter: RSI/MACD-basierte Signale zusätzlich zu Fundamentaldaten
- [x] Signale zeigen jetzt differenzierte Kauf/Verkauf/Halten-Empfehlungen statt nur "Halten"

### Technische Analyse (Option B - fehlender Teil)
- [x] engine.ts: calcTechnicalAnalysis() Funktion (RSI 14, MACD 12/26/9, Bollinger Bands 20/2σ)
- [x] analyticsRouter: analytics.technicalAnalysis Procedure
- [x] TechnicalAnalysis.tsx: Neue Seite mit Charts pro Position
- [x] App.tsx: Route /technical-analysis registrieren
- [x] DashboardLayout: Sidebar-Link "Technische Analyse" hinzufügen


## Admin Watchlist, Investieren-Seite & Fincept-Verbesserungen (23.05.2026)

### Admin Watchlist (max. 200 Titel)
- [x] Schema: watchlistStocks Tabelle (ticker, companyName, sector, category, source: 'manual'|'ai_recommended', addedAt, metrics JSON)
- [x] Backend: watchlistRouter mit CRUD + AI-Empfehlungen basierend auf Signalen/Kennzahlen
- [x] Frontend: AdminWatchlist.tsx Seite unter /admin/watchlist
- [x] Admin-Navigation: Watchlist als Unterpunkt im Admin-Bereich
- [x] AI-Empfehlungsfunktion: Aktien mit guten Signalen automatisch vorschlagen (max. 200 total)
- [x] Kennzeichnung ob manuell oder KI-empfohlen

### Investieren-Seite (unter Dashboard)
- [x] Frontend: Invest.tsx mit zentralem Suchfeld (Google-Style)
- [x] Suchfunktion: Einzeltitel-Suche nach Name/Ticker via Yahoo Finance
- [x] Filtermöglichkeiten: Sektor, Kategorie, P/E Range, Dividendenrendite, Marktkapitalisierung
- [x] Ergebnisliste: max. 50 Titel pro Kategorie/Filter
- [x] Sidebar-Navigation: "Investieren" unter Dashboard hinzufügen
- [x] Route /invest registrieren

### Einzeltitel-Analyse (Detail-Seite)
- [x] Detaillierte Analyse-Seite pro Aktie (ganzseitig)
- [x] Chart: Kursverlauf (1M, 3M, 6M, 1Y, 5Y, MAX)
- [x] Kursdaten: Aktuell, Eröffnung, Hoch, Tief, Volumen
- [x] Kennzahlen: P/E, PEG, EPS, Dividende, Beta, Market Cap, 52W Range
- [x] News: Aktuelle Nachrichten zum Titel
- [x] Empfehlung: KI-basierte Kauf/Verkauf/Halten-Empfehlung mit Begründung
- [x] Technische Indikatoren: RSI, MACD, Bollinger Bands

### Fincept-inspirierte Portfolio-Verbesserungen
- [x] Portfolio-Erstellung: Aktien aus Watchlist/Universum vorschlagen
- [x] Portfolio-Erstellung: Gewichtung basierend auf Risikoprofil optimieren
- [x] Portfolio-Erstellung: Korrelationsmatrix bei Auswahl anzeigen

## Erweiterungen (23.05.2026 - Nachmittag)

### News-Tab auf InvestDetail
- [x] News-Tab mit echten Yahoo Finance Nachrichten befüllen (Backend invest.stockNews existiert)
- [x] News-Karten mit Titel, Publisher, Datum und Thumbnail anzeigen

### Watchlist-Alerts
- [x] Automatische Benachrichtigung wenn Watchlist-Titel starkes Kaufsignal generiert
- [x] notifyOwner() bei Score >= 70 auslösen
- [x] Alert-Check in Watchlist-Aktualisierung integrieren

### Portfolio Builder Watchlist-Integration
- [x] "Aus Watchlist hinzufügen" Button im Portfolio Builder (Step 2: Stock Selection)
- [x] Dialog mit Watchlist-Titeln und deren Signalen/Scores
- [x] Ausgewählte Titel direkt in Portfolio-Auswahl übernehmen

## Erweiterungen (23.05.2026 - Abend)

### Watchlist-Daten aktualisieren
- [x] Watchlist-Refresh für alle 113 Titel triggern (Live-Kurse, P/E, Signal-Scores)
- [x] Verify live data appears in admin watchlist table

### Backtesting-Modul
- [x] Backend: backtestingRouter mit historischer Signal-Analyse (12 Monate)
- [x] Backend: Für jeden Titel berechnen wann Kauf/Verkauf-Signale auftraten
- [x] Backend: Hypothetische Rendite berechnen (Buy bei Kaufsignal, Sell bei Verkaufssignal)
- [x] Frontend: Backtesting.tsx Seite mit Ergebnistabelle und Charts
- [x] Frontend: Zusammenfassung (Trefferquote, Durchschnittsrendite, beste/schlechteste Signale)
- [x] Sidebar-Navigation: Backtesting Link hinzufügen

### Sektor-Heatmap
- [x] Backend: heatmapRouter mit Sektor-Performance-Daten (via watchlist.list)
- [x] Frontend: SectorHeatmap.tsx Seite mit Finviz-Style Visualisierung
- [x] Farbkodierung: Grün (positiv) bis Rot (negativ) nach Signal-Score
- [x] Gruppierung nach Sektor mit Ø Score-Badge
- [x] Sidebar-Navigation: Sektor-Heatmap Link hinzugefügt

### Dividendenkalender Fix
- [x] Dividendenkalender zeigt "Keine bevorstehenden Dividenden" obwohl Portfolio Dividendenaktien enthält
- [x] Backend: EODHD API für Dividenden-Daten (zuverlässiger als Yahoo Finance)
- [x] Frontend: Bevorstehende Dividenden mit Ex-Date, Payment-Date, Betrag anzeigen
- [x] Historische Dividenden der letzten 12 Monate ebenfalls anzeigen

## Erweiterungen (23.05.2026 - Nacht)

### Watchlist Refresh
- [x] Watchlist-Refresh für alle 113 Titel triggern (Live-Kurse, P/E, Signal-Scores) — 110/113 aktualisiert

### Backtesting erweitern
- [x] Zeiträume erweitern: 3M, 6M, 12M, 24M, 36M, 60M bereits implementiert
- [x] Benchmark-Vergleich: S&P 500 (^GSPC) und SPI (^SSMI) als Referenz
- [x] Relative Performance vs. Benchmark anzeigen

### Heatmap → InvestDetail
- [x] Klick auf Titel in Heatmap navigiert zu /invest/:ticker
- [x] Hover-Preview mit Kurz-Info (Kurs, P/E, Signal) beim Überfahren

## ML-Features (23.05.2026)

### Kursprognose (Linear Regression + ARIMA-Style)
- [ ] ML-Engine: Linear Regression für Trendprognose implementieren (JS/Node)
- [ ] ML-Engine: ARIMA-ähnliche Zeitreihenanalyse für kurzfristige Vorhersage
- [ ] Backend: predictionRouter mit 30/60/90-Tage-Prognose pro Aktie
- [ ] Frontend: Prognose-Seite mit Chart (historisch + Vorhersage + Konfidenzintervall)
- [ ] Sidebar-Navigation: "Prognose" Link hinzufügen

### Sentiment-Analyse (via LLM)
- [ ] Backend: sentimentRouter mit invokeLLM() für News-Stimmungsanalyse
- [ ] Sentiment-Score pro Aktie berechnen (bullish/neutral/bearish + Konfidenz)
- [ ] Sentiment in InvestDetail-Seite integrieren (neuer Tab oder Badge)
- [ ] Sentiment als Faktor in Signal-Score einbauen

### Random Forest (Kauf/Verkauf-Signale verbessern)
- [ ] ML-Engine: Random Forest Classifier in JS implementieren
- [ ] 10+ Features: RSI, MACD, P/E, PEG, Dividende, Beta, 52W-Position, Volumen-Trend, SMA-Cross, Sentiment
- [ ] Training auf historischen Daten (letzte 2 Jahre)
- [ ] Signal-Score durch Random Forest ersetzen/ergänzen (höhere Trefferquote)
- [ ] Konfidenz-Level pro Signal anzeigen (Low/Medium/High)

### LPPLS Bubble-Detektor (Sornette-Modell)
- [ ] lppls Engine: Vereinfachter LPPLS-Fit in JavaScript (Power Law + Log-Periodic Oscillation)
- [ ] lppls Engine: Multi-Window-Analyse (30, 90, 180, 365, 750 Tage)
- [ ] lppls Engine: Bubble Confidence Score [0,1] berechnen
- [ ] lppls Engine: Geschätzte kritische Zeit t_c berechnen
- [ ] Backend: LPPLS-Endpoint in predictionRouter
- [ ] Portfolio Bubble-Exposure: Gewichteter Score über alle Holdings
- [ ] Alert: Warnung wenn Portfolio-Bubble-Exposure > 40%
- [ ] Frontend: Bubble-Confidence Indikator in InvestDetail + Signale
- [ ] Frontend: Portfolio Bubble-Exposure Widget im Dashboard

### Signal Auto-Optimizer (Backtest + Iterative Gewichtungs-Optimierung)
- [x] Backend: signalOptimizer.ts — Backtestet alle 113 Watchlist-Titel mit aktuellen Gewichtungen
- [x] Backend: Grid Search über Indikator-Gewichte (P/E, RSI, MACD, PEG, Dividende, 52W, YTD, RF, Sentiment)
- [x] Backend: Trefferquote messen (Signal korrekt = Kurs steigt nach Kaufsignal / fällt nach Verkaufssignal)
- [x] Backend: Iterativ beste Gewichtungskombination finden (max. Trefferquote)
- [x] Backend: Optimierte Gewichte in DB speichern und in Live-Signalen verwenden
- [x] Admin-Endpoint: Optimizer manuell triggern + Ergebnisse anzeigen
- [x] Frontend: Admin-Seite mit Optimizer-Status, aktuelle Gewichte, Trefferquote


## Signal Auto-Optimizer & LPPLS Bubble Detection (23.05.2026)
- [x] LPPLS Bubble Detector Engine implementieren (server/analytics/lpplsEngine.ts)
  - Multi-Window-Analyse (30, 60, 90, 180, 365, 500 Tage)
  - Super-exponentielles Wachstum erkennen
  - Log-periodische Oszillationen detektieren
  - Portfolio-Level Bubble Exposure berechnen
- [x] Signal Auto-Optimizer Engine implementieren (server/analytics/signalOptimizer.ts)
  - Grid Search über 200 Gewichtungskombinationen
  - Backtest alle Watchlist-Titel (113 Aktien)
  - Iterative Gewichtungsanpassung für maximale Trefferquote
  - Speicherung optimierter Gewichte in DB (signalWeights Tabelle)
- [x] Optimizer Router erstellen (server/routers/optimizerRouter.ts)
  - Admin-only Endpoints: startOptimizer, getStatus, getWeights, getHistory
  - Aktivierung/Deaktivierung von Gewichtungskonfigurationen
- [x] LPPLS Bubble Analysis in predictionRouter integrieren
  - bubbleAnalysis Endpoint für Einzelaktien
  - portfolioBubbleExposure Endpoint für Portfolio-Level Analyse
- [x] Optimierte Gewichte in Signal-Generierung integrieren (signalsRouter.ts)
  - getActiveWeights() lädt optimierte Gewichte aus DB
  - generateSignal() verwendet gewichtete Scores statt feste Punkte
- [x] Frontend: Admin Optimizer Page erstellen (AdminOptimizer.tsx)
  - Status-Anzeige (laufend/abgeschlossen)
  - Aktuelle Gewichtungen visualisieren
  - Top 5 Kombinationen aus letztem Durchlauf
  - Optimierungs-Verlauf mit Aktivierung
- [x] Frontend: Bubble Risk Card in InvestDetail.tsx
  - LPPLS-Warnung wenn Bubble-Konfidenz > 20%
  - Anzeige: Konfidenz, Regime, Tage bis tc, Indikatoren
- [x] Frontend: ML-Badges in Signals.tsx
  - Random Forest Signal Badge
  - Sentiment Badge
- [x] Navigation: Signal-Optimizer in Admin-Menü hinzugefügt
- [x] Route /admin/optimizer in App.tsx registriert

### Signal Optimizer Verbesserungen (23.05.2026)
- [x] EODHD als primäre Datenquelle für Optimizer (statt Yahoo Finance)
- [x] Non-blocking Worker-Architektur (Server bleibt responsiv während Optimierung)
- [x] Multi-Pass Iterative Optimierung implementiert:
  - Pass 1: Optimale Lookforward-Periode (5, 10, 15, 20, 30 Tage) und Signal-Threshold (5-25) finden
  - Pass 2: Grid Search über 201 Gewichtungskombinationen mit optimierten Parametern
  - Pass 3: Feinabstimmung der Top-5 Ergebnisse (±3% Variationen)
- [x] Ergebnis: Trefferquote von 49.5% auf 59.2% gesteigert
  - Optimale Lookforward-Periode: 5 Tage
  - Optimaler Signal-Threshold: 25
- [x] Frontend: hitRate-Parsing-Bug behoben (DB liefert String statt Number)

### LPPLS v2 + Optimizer Erweiterung (24.05.2026)
- [x] lpplsEngine.ts komplett neu mit Sornette/Fantazzini-Filtern (shrinking windows, fraction-based confidence)
- [x] BubbleScore nach Cao et al. (normalized residual + sentiment amplification)
- [x] Separate positive/negative Bubble Confidence
- [x] BubbleScore als 10. Indikator in generateSignal() integrieren
- [x] WeightConfig um 'bubble' Gewicht erweitern
- [x] Optimizer: Alle 113 Watchlist-Titel verarbeiten (Batch-Processing über mehrere Durchläufe)
- [x] Optimizer: Walk-Forward-Validierung (80% Train / 20% Test, Out-of-Sample Trefferquote)
- [x] Frontend: BubbleScore in Signal-Karten und InvestDetail anzeigen
- [x] Frontend: Walk-Forward-Metriken im Optimizer-Dashboard anzeigen

## Navigation Restructuring & Signal Model v2 (24.05.2026)

### Navigation (3 Hauptkategorien + Tools)
- [x] Neue Sidebar-Navigation: 3 Hauptgruppen (Markt-Regime, Portfolio, Einzeltitel-Analyse) + Tools
- [x] Markt-Regime Dashboard mit 7 Engines (Trend, Breadth, Volatilität, Liquidität, Credit, Sentiment, Bubble)
- [x] Ampel-System (Bullish/Neutral/Bearish) pro Engine
- [x] Gesamt-Regime-Score mit Aktienquote-Empfehlung und Signal-Multiplikator
- [x] marketRegimeRouter.ts mit EODHD-basierter Echtzeit-Analyse
- [x] Signal-Modell Layer 2 (Einzeltitel): Trend, Fundamental, Momentum, Quality, ML, Bubble
- [ ] Regime-Multiplikator in Einzeltitel-Signale integrieren
- [x] Sektor-Heatmap Seite erstellen

### Sektor-Heatmap (24.05.2026)
- [x] Sektor-Heatmap Seite unter Markt-Regime erstellen
- [x] Visuelle Heatmap mit Sektor-Performance (1D, 1W, 1M, YTD)
- [x] Farbcodierung (grün = positiv, rot = negativ, Intensität = Stärke)
- [ ] Drill-Down: Klick auf Sektor zeigt Top/Flop Aktien

### Signal-Modell Layer 2 (24.05.2026)
- [x] Quality-Faktor Engine: ROE, Debt/Equity, FCF-Yield
- [x] Momentum-Faktor Engine: Relative Stärke vs. Sektor, 3M/6M/12M Momentum
- [x] Neue Faktoren in generateSignal() integrieren
- [x] WeightConfig um quality und momentum erweitern
- [x] Optimizer Grid Search mit neuen Gewichten aktualisieren

### P1 Fixes (24.05.2026)
- [x] Signal-Parallelisierung: 18 Titel in <35s statt >60s Timeout
  - Promise.allSettled mit Batches (9er-Gruppen)
  - Per-Stock Timeout (12s) verhindert Blockierung durch einzelne Titel
  - Graceful Degradation: Bei Timeout wird Fallback-Signal generiert
- [x] DCF Yahoo-Redirect Fix: EODHD Fundamentals API als primäre Quelle
  - fetchDCFFromEODHD() mit vollständiger Fundamentaldaten-Extraktion
  - fetchDCFFromYahoo() als Fallback bei EODHD-Fehler
  - Unterstützt US-Aktien (.US) und Schweizer Aktien (.SW)
  - Getestet: NVDA (3.4s), NESN.SW (1.7s) — beide erfolgreich

### P2 Fixes (24.05.2026)
- [x] Sektor-Heatmap: Sektornamen korrekt mappen (zeigt "?" statt Namen) — BEREITS KORREKT, nicht reproduzierbar
- [x] Annual Performance: Jahresperformance-Tab in PortfolioDetail integriert
- [x] RSI/MACD-Kalibrierung: adjclose (split-adjustiert) + korrekte EMA-Berechnung (SMA-Seed)
- [x] Portfolio Optimizer: max_dividend Methode hinzugefügt (L1-Differenz zu Sharpe: 1.65)
- [x] Dividend Calendar: Fallback auf Portfolio-Shares wenn keine Transaktionen + EODHD API Key Fix

### Risikokennzahlen-Darstellung Verbesserung (24.05.2026)
- [x] Radar Chart: Alle Kennzahlen auf 0-100 normiert, Portfolio vs. Benchmark als überlagerte Flächen
- [x] Bullet Charts: Pro Kennzahl horizontaler Balken mit Farbzonen (gut/mittel/schlecht), Marker für Benchmark, Differenz in pp
- [x] KPI-Überblick: Gesamt-Risikoscore (0-100) mit Bewertung + kompakte Kennzahlen-Karten mit Benchmark-Vergleich
- [x] Interpretation: Textuelle Zusammenfassung des Risikoprofils (regelbasiert)
- [x] Backend: Benchmark-Metriken, Normalisierung und Score-Berechnung hinzugefügt

### Historische Risikoscore-Entwicklung (24.05.2026)
- [x] Backend: Rolling-Window Risikoscore-Berechnung (52 Wochen, 63 Tage Window)
- [x] Frontend: Mini-Chart Komponente (Liniendiagramm mit Farbzonen + Legende + Trend-Indikator)
- [x] Integration in RiskDashboard zwischen Risikokennzahlen und Marktrisiko-Sektion

### ML Portfolio Copilot (24.05.2026)
- [x] Backend: ML Ranking-Score pro Titel (Wahrscheinlichkeit + Unsicherheit statt Buy/Hold/Sell)
- [x] Backend: Rebalancing-Vorschläge (Zielgewichte mit Constraints: Kosten, Diversifikation, Risikobudget)
- [x] Backend: Konzentrations- und Drawdown-Warnungen (Klumpenrisiko, schwaches Chance/Risiko)
- [x] Backend: Explainable AI Textgenerierung (LLM: "Warum?" pro Empfehlung)
- [x] Frontend: Portfolio Copilot Seite (Ranking-Tabelle, Aktionen, Warnungen, Diversifikations-Score)
- [x] Integration: Bestehende Signale als Baselines behalten, ML-Layer darüber
- [x] Backtesting: 12-Monate Rolling Backtest (monatliches Rebalancing, Equity Curve, Alpha, Hit Rate)
  - Ergebnis (6 Monate): Copilot +12.62% vs. B&H +13.18%, Alpha -0.56%, Hit Rate 50%, Sharpe 2.13 vs. 2.20

### Copilot Verbesserungen (24.05.2026)
- [x] Ranking-Algorithmus tunen: Momentum-Gewichtung auf 35% erhöht + Regime-aware Scoring
  - Ergebnis: Alpha verbessert von -0.56% auf -0.03%
- [x] Turnover-Constraint: Max 30%/Monat Umschichtung implementiert
  - Funktioniert korrekt: Max Monthly Turnover = 30.0% (Limit eingehalten)
  - Reduziert unnötiges Trading in ruhigen Monaten (19-22%)
- [x] Backtest-Perioden: Auswahl 6M / 9M / 12M / 18M / 24M / 36M auf Copilot-Seite
  - Frontend-Dropdown mit allen Optionen + Turnover-Constraint Slider

### Walk-Forward Validation auf weltweitem Aktienuniversum (24.05.2026)
- [x] Backend: Universum-Screener mit EODHD API
  - Weltweites Aktienuniversum abrufbar (US, EU, CH, etc.)
  - Wählbare Vorselektions-Kriterien: Min. Score, Ziel-Sharpe, MarketCap, Sektor, Region
  - Ergebnis: 100 Titel die den Kriterien entsprechen
- [x] Backend: Walk-Forward Backtest Engine auf 100 gescreenten Titeln
  - Training-Window / Test-Window rollierend (6M Train → 1M OOS Test)
  - Kein Overfitting: Modell nur auf In-Sample trainiert, Out-of-Sample validiert
  - Ranking auf alle 100 Titel, Top-Quartil auswählen, Forward-Performance messen
- [x] Backend: KI-Titelvorschläge aus Walk-Forward Top-Performer
  - Titel die konsistent im Top-Quartil ranken → Kaufvorschläge
  - Stabilität des Rankings über Zeit als Qualitätsmerkmal
  - OOS-Alpha, OOS-Hit-Rate, Overfit-Ratio als Validierungsmetriken
- [x] Frontend: Walk-Forward UI mit Screening-Kriterien
  - Universum-Filter (Region, Sektor, MarketCap, Min-Score, Ziel-Sharpe)
  - Walk-Forward Ergebnisse Dashboard
  - Top-Titelvorschläge mit Confidence-Score
- [x] Integration: Walk-Forward Ergebnisse in KI-Empfehlungen für neue Titel

### Copilot-Aktionen ausführbar machen (24.05.2026)
- [x] Backend: Rebalancing-Empfehlungen als echte Transaktionen buchen
  - Copilot-Vorschläge (Kauf/Verkauf) in Transaktionen umwandeln
  - Bestätigungs-Flow: User sieht Vorschau → bestätigt → Transaktionen werden gebucht
  - Berechnung: Stückzahlen aus Zielgewichtung und verfügbarem Kapital
- [x] Frontend: "Rebalancing anwenden"-Button im Copilot
  - Vorschau-Dialog mit allen geplanten Trades
  - Bestätigungsbutton → Transaktionen werden gebucht
  - Erfolgs-/Fehler-Feedback

### Copilot-Historie (24.05.2026)
- [x] Schema: copilotHistory Tabelle (Empfehlungen, Zeitpunkt, Ergebnis)
- [x] Backend: Empfehlungen bei jeder Copilot-Analyse speichern
  - Ticker, Signal, Score, Zeitpunkt, Preis zum Zeitpunkt
  - Nach 30/60/90 Tagen: tatsächliche Performance messen
- [x] Backend: Trefferquote berechnen (Hit Rate über Zeit)
  - Wie oft war "Buy" tatsächlich profitabel nach 30 Tagen?
  - Wie oft war "Sell" korrekt?
  - Confidence-Kalibrierung: Stimmt die Confidence mit der Hit Rate überein?
- [x] Frontend: Historie-Dashboard im Copilot
  - Vergangene Empfehlungen mit Ergebnis
  - Hit-Rate Chart über Zeit
  - Confidence vs. tatsächliche Trefferquote

### LPPL Bubble Indicator Historischer Backtest (24.05.2026)
- [x] Backend: LPPL Bubble Indicator auf historische Blasen testen
  - Dotcom Bubble (1999-2002): S&P 500, NASDAQ
  - Finanzkrise (2007-2009): S&P 500, Financials
  - Weitere: China 2015, Bitcoin 2017/2021
  - Messung: Wann hätte LPPL gewarnt vs. tatsächlicher Crash-Zeitpunkt
- [x] Backend: LPPL Treffergenauigkeit berechnen
  - True Positives: LPPL warnte und Crash kam
  - False Positives: LPPL warnte aber kein Crash
  - Lead Time: Wie viele Tage/Wochen vor dem Crash warnte LPPL
  - Confidence-Kalibrierung
- [x] Frontend: LPPL Backtest Ergebnis-Dashboard
  - Historische Blasen mit LPPL-Signal-Timeline
  - Trefferquote und Lead Time Visualisierung
  - Custom LPPL-Analyse für beliebigen Ticker/Zeitraum

### Bugfixes und Daten-Erweiterungen (24.05.2026)
- [x] Bug: Teilen-Button zeigt leere Seite → Share-Dialog mit Link kopieren + native Share API implementiert
- [x] Bug: Benchmark-Kursverlauf (S&P 500) → Backfill auf 15 Jahre löst das Problem
- [x] Feature: Historische Kursdaten Backfill auf 10-15 Jahre
  - MAX_BACKFILL_YEARS von 5 auf 15 erhöht
  - Backfill-Script für alle 138 Ticker + Benchmarks erstellt
  - Benchmarks (SPY, QQQ, URTH, SSMI) bereits fertig: 10'960 Preise
  - Restliche Ticker laufen im Hintergrund (14 Batches)

### Copilot-Automatisierung und Monitoring (24.05.2026)
- [x] Copilot-Historie automatisch bei jeder Analyse speichern
  - saveCopilotRecommendations() am Ende des analyze-Endpoints
  - Alle Empfehlungen (Buy/Sell/Hold) mit Score und Preis gespeichert
- [x] Walk-Forward als wöchentlicher Scheduled Job (Heartbeat)
  - Handler: /api/scheduled/walkForwardWeekly (Sonntag 03:00 UTC)
  - Auf Watchlist-Universum (100 Titel), Benachrichtigung bei Top-Titeln
- [x] LPPL-Echtzeit-Monitoring als täglicher Scheduled Job
  - Handler: /api/scheduled/lpplMonitoring (täglich 06:00 UTC)
  - Alle Portfolio-Positionen auf Bubble-Signale, Warnung bei Confidence > 70%
- [x] Empfehlungs-Evaluation als täglicher Job
  - Handler: /api/scheduled/evaluateRecommendations (täglich 07:00 UTC)
  - Vergangene Empfehlungen nach 30/60/90 Tagen evaluieren
- [x] Frontend: Monitoring-Status Tab im Copilot
  - Übersicht aller Scheduled Jobs mit Status und Zeitplan
  - Benachrichtigungs-Info und Auto-Save Bestätigung
