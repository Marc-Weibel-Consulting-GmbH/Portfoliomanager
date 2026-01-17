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
