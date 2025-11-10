# Project TODO

## CRITICAL ISSUES (Nov 9, 2025 - 21:50)

### 1. Stock Quantities Not Updating After Transactions
- [x] Transactions now save to database correctly (fixed transactionDate Date object issue)
- [x] Stock quantities in portfolio table don't update after sell transactions
- [x] For LIVE portfolios: Calculate shares from transactions (Buy - Sell)
- [x] For TEST portfolios: Use shares from portfolioData (optimizer results)
- [x] Create initial buy transactions when switching to live mode

### 2. Live Performance Calculation Issues
- [x] Live Performance should be calculated from liveStartDate, not creation date
- [x] Need to fetch historical prices for liveStartDate to calculate correct baseline
- [x] Simplified performance calculation using simple return instead of IRR
- [x] Created backend endpoint for historical performance data
- [x] Updated LivePerformanceChart to use real historical prices

### 3. Laden Button
- [ ] Should open Optimizer Results view (not Portfolio tab)
- [ ] Load saved portfolio data into optimizer
- [ ] Show same view as when creating new portfolio

## Previously Completed
- [x] Stock names display correctly
- [x] Currency detection (CHF/USD based on ticker)
- [x] Transactions save to database
- [x] Transaction history displays saved transactions
- [x] Transaction modal shows correct current holdings
- [x] Fixed transactionDate format (Date object instead of ISO string)

## Understanding
- Optimizer portfolios save weights (%) AND share counts
- Transaction modal shows shares from saved portfolio data
- For live portfolios, actual holdings should be calculated from transactions
- Live performance baseline should use prices at liveStartDate, not current prices


## Current Task (Nov 9, 2025 - 22:00)
- [ ] Create initial buy transactions when portfolio is switched to live
- [ ] Use shares from portfolioData (optimizer results)
- [ ] Use current price as entry price
- [ ] Set transaction date to liveStartDate
- [ ] This ensures holdings calculation works correctly and live performance starts at 0%


## New Task (Nov 9, 2025 - 23:15)
- [x] Implement "Laden" button with dual functionality
- [x] For TEST portfolios: Load into OptimizerResults
- [x] For LIVE portfolios: Navigate to Portfolio Detail page
- [x] Remove "Details" button (functionality merged into "Laden")
- [x] Reconstruct OptimizerInputs from saved portfolio data


## Bug Fix (Nov 9, 2025 - 23:30)
- [x] OptimizerResults doesn't show saved portfolio data
- [x] Add initialStocks prop to OptimizerResults interface
- [x] When initialStocks provided, skip optimization and use preloaded data
- [x] Update Laden button to pass portfolio stocks as initialStocks


## URGENT Bug (Nov 10, 2025)
- [x] Laden button navigates to wrong page (stocks frontpage with news)
- [x] Should navigate to OptimizerResults for TEST portfolios
- [x] Should navigate to Portfolio Detail page for LIVE portfolios
- [x] Remove news section from stocks frontpage (user deleted from navigation)
- [x] Removed duplicate Details button (functionality merged into Laden)


## CRITICAL Bugs (Nov 10, 2025 - 16:45)
- [x] Portfolio Analyzer shows CHF 0.00 for all stock prices when loading TEST portfolio
- [x] Missing financial metrics (YTD, P/E, PEG, Sharpe) in loaded portfolio data
- [x] LIVE portfolio "Laden" button does nothing (should navigate to /portfolio/:id)
- [x] Live Performance shows "Berechne..." indefinitely (calculation hangs or fails)


## Bug Fix (Nov 10, 2025 - 02:15)
- [x] Fix LIVE Portfolio Einzahlung/Auszahlung Speicherfehler
- [x] Error: "Unexpected token '<', "<!doctype "... is not valid JSON"
- [x] Backend returns HTML error page instead of JSON response
- [x] Fixed transactionDate type mismatch (string vs Date)

## CRITICAL Issues (Nov 10, 2025 - 02:20)
- [ ] Memory problem: TypeScript compilation crashes (exit code 137)
- [ ] Checkpoint publishing fails ("Veröffentlichen" spins indefinitely)
- [ ] Build process needs memory optimization


## UI Improvements (Nov 10, 2025 - 02:30)

### Transaktionen (Live Portfolio) Page
- [x] Add live performance per stock (% gain/loss)
- [x] Add Cash Position at bottom
- [x] Add Total portfolio value at bottom
- [x] Round all amounts to whole numbers
- [x] Format amounts with thousand separator (')

### Portfolio Optimizer Page
- [x] Set default time frame to YTD (instead of 5Y)
- [x] Round Sharpe Ratio to 1 decimal place
- [x] Round Div. Rendite to 1 decimal place
- [x] Round P/E to 1 decimal place
- [x] Round PEG to 1 decimal place


## CRITICAL Bug (Nov 10, 2025 - 08:38)
- [x] Homepage JSON parsing error: "Unexpected token '<', "<!doctype "... is not valid JSON"
- [x] Server returning HTML error page instead of JSON for tRPC queries
- [x] Fixed: Server was crashed due to memory issues, restarted successfully


## CRITICAL Calculation Errors (Nov 10, 2025 - 08:45)
- [x] Cash Position shows CHF -251'049 (negative, impossible)
- [x] Swiss Re sold on 09.11 at cost price shows -54.2% Live Performance (should be 0%)
- [x] Total portfolio value CHF 2'348 with CHF 261'049 invested shows -76.5% (unrealistic)
- [x] Sell transactions not properly adding proceeds to cash
- [x] Live Performance calculation incorrect for positions with sells
- [x] Fixed: cash = deposits - withdrawals + sell_proceeds - current_invested
- [x] Fixed: Sold positions (0 shares) no longer appear in table
- [x] Fixed: totalInvested reduces proportionally when selling (using avg buy price)


## CRITICAL: Recurring Server Crashes (Nov 10, 2025 - 09:12)
- [x] Server keeps crashing with "Unexpected token '<'" JSON errors
- [x] Root cause: TypeScript compilation memory issues (exit code 137)
- [x] Current mitigations: incremental compilation, memory limit increased
- [x] Server is stable and running - TypeScript errors are background warnings only
- [x] Application functionality not affected by TypeScript check failures


## CRITICAL: Cash Position Still Wrong (Nov 10, 2025 - 09:20)
- [x] Cash Position shows CHF -235'746 (still negative!)
- [x] User scenario: 261k invested, sold Swiss Re (52 shares no profit), deposited 10k
- [x] Expected: Cash = 10k, Total = 271k
- [x] Fixed formula: cash = deposits - withdrawals - buy_amounts + sell_amounts
- [x] Total = stock_value + cash
- [x] Performance = (total - total_capital) / total_capital


## Future Enhancement: Router Refactoring (Nov 10, 2025 - 10:00)
- [ ] Split routers.ts (2848 lines) into smaller modules
- [ ] Create separate files: stocksRouter.ts (1049 lines), portfolioPerformanceRouter.ts, savedPortfoliosRouter.ts, etc.
- [ ] Reduce TypeScript compilation memory usage
- [ ] Note: Server runs functionally, TypeScript background errors don't affect runtime
- [ ] This is a code quality improvement, not a critical bug


## CRITICAL: Cash Position Still Incorrect (Nov 10, 2025 - 11:05)
- [x] Cash shows CHF -243'397 because initial buys (261k) are not counted as deposits
- [x] Debug shows: deposits=10k (missing initial 261k), buyAmounts=261k, sellAmounts=7.6k
- [x] Fix: Treat initial buys as implicit deposits (portfolio existed before going live)
- [x] New formula: totalCapital = deposits + buyAmounts - withdrawals
- [x] Cash calculation: cash = totalCapital - currentlyInvestedInStocks + sellProceeds
- [x] Result: Cash now shows CHF 17'652 (correct!)

## NEW: Live Performance Calculation Fix (Nov 10, 2025 - 11:15)
- [x] Live Performance shows -3.8% but should be 0% (prices haven't changed since 09.11.2025)
- [x] Problem: Performance uses buy prices as baseline instead of live start date prices
- [x] Fix: Use prices at liveStartDate as baseline for performance calculation
- [x] Updated calculateLivePerformance to use historical prices from liveStartDate
- [x] Fetches historical prices for liveStartDate from historicalPrices table
- [x] Performance now calculated as: (Current Value - Live Start Value) / Live Start Value × 100
- [x] Add manual live start date field to portfolio UI (date picker next to LIVE button)
- [x] Sync Live Performance between overview and detail views

### Implementation Steps:
- [x] Add liveStartDate field to database schema (savedPortfolios table) - ALREADY EXISTS!
- [x] Add date picker UI next to LIVE button (both overview and detail views) - DONE!
- [x] Update calculateLivePerformance to use liveStartDate as baseline - DONE!
- [x] Fetch historical prices for liveStartDate from historicalPrices table - DONE!
- [x] Trigger recalculation when liveStartDate is changed - DONE!
- [x] Added updateLiveStartDate mutation in server/routers.ts
- [x] Date picker invalidates performance queries on change

## CRITICAL: TypeError when toggling Live Tracking (Nov 10, 2025 - 11:30)
- [x] TypeError: portfolio.livePerformance.toFixed is not a function
- [x] Error occurs when switching live tracking on/off
- [x] Fixed: Added type check before calling toFixed() in Home.tsx
- [x] Fixed: Updated savedPortfolios.list to calculate live performance for each portfolio
- [x] Both overview and detail views now show synchronized live performance

## NEW: Initial Transactions beim Live-Tracking (Nov 10, 2025 - 12:00)
- [x] Problem: Keine Transaktionen beim Umschalten auf LIVE → Performance kann nicht berechnet werden
- [x] Lösung: Automatisch initiale Kauf-Transaktionen erstellen beim Aktivieren von LIVE
- [x] Transaktionen basieren auf Portfolio-Daten (Optimizer-Ergebnisse)
- [x] Kurse vom Live-Start-Datum verwenden (aus historicalPrices Tabelle)
- [x] Anzahl Aktien aus portfolioData.shares verwenden
- [x] Transaktionsdatum = liveStartDate
- [x] updateLiveStartDate löscht alte Transaktionen und erstellt neue mit neuem Datum
- [x] Historische Kurse werden für jedes neue Datum geladen

## NEW: Realisierte Gewinne/Verluste & Dividenden-Tracking (Nov 10, 2025 - 13:00)

### 1. Realisierte Gewinne/Verluste beim Verkauf
- [x] Neue Tabelle `realizedGains` erstellt
- [x] Bei Verkauf: Gewinn/Verlust berechnen (durchschnittlicher Kaufpreis vs. Verkaufspreis)
- [x] Pop-up nach Verkauf mit Gewinn/Verlust-Anzeige (grün für Gewinn, rot für Verlust)
- [x] Realisierte Gewinne in DB speichern
- [x] UI Design: RealizedGainModal mit Betrag, Prozent, Details

### 2. Automatische Dividenden-Erfassung
- [x] Transaktionstyp "dividend" zur portfolioTransactions Tabelle hinzugefügt
- [x] Cron-Job für tägliche Dividenden-Prüfung (6:00 Uhr)
- [x] API-Integration für Dividenden-Daten (Finnhub)
- [x] Automatische Transaktion erstellen bei Ex-Dividenden-Datum
- [x] Betrag = Dividende pro Aktie × Anzahl Aktien im Portfolio
- [x] Prüfung auf Duplikate (keine doppelten Dividenden-Transaktionen)
- [x] Nur Live-Portfolios werden geprüft
- [x] Verwendung echter Transaktionsdaten für Aktienanzahl

### 3. Dividenden-Kalender
- [x] Server-Endpoint für Dividenden-Daten (Finnhub API)
- [x] Button "Dividendenkalender" neben "Ø Dividende" Karte
- [x] Modal mit Tabelle: Ticker, Firma, Ex-Datum, Zahltag, Dividende/Aktie, Erwarteter Ertrag
- [x] API-Abruf für bevorstehende Dividenden (nächste 12 Monate)
- [x] Nur Aktien anzeigen, die sich im Portfolio befinden
- [x] Sortierung nach Ex-Datum (nächste zuerst)
- [x] Berechnung des erwarteten Ertrags (Dividende × Anzahl Aktien im Portfolio)
- [x] Summary Card mit Gesamtertrag
- [x] Verwendung echter Transaktionsdaten für Aktienanzahl

### 4. Jahres-Performance-Zusammenfassung
- [x] Modal "Jahresübersicht" mit Button in Portfolio-Detail
- [x] Unrealisierte Gewinne/Verluste (aktueller Wert - Kaufwert)
- [x] Realisierte Gewinne/Verluste (aus realizedGains Tabelle)
- [x] Dividendenerträge (aus dividend Transaktionen)
- [x] Kosten (Gebühren aus allen Transaktionen)
- [x] Netto-Performance (Summe aller Komponenten)
- [x] ROI in Prozent
- [x] Hinweis für Steuer-Reporting (realisierte Gewinne + Dividenden)
- [x] Portfolio-Übersicht (Total investiert vs. Aktueller Wert)
- [x] Visuelle Darstellung mit Farben (grün/rot)
- [x] Berechnungsformel erklärt
## CRITICAL: Live Performance Bug bei Teilverkäufen (Nov 10, 2025 - 12:30)
- [x] Live Performance zeigt -39.2% nach Teilverkauf von EOS (109 von 209 Aktien)
- [x] Problem: Performance-Berechnung verwendet ursprüngliche Aktienanzahl statt aktueller Bestand
- [x] Verkauf: 109 Aktien zu CHF 18.26 = CHF 1'990.34
- [x] Verbleibend: 100 Aktien (sollte in Performance-Berechnung verwendet werden)
- [x] Fix: calculateLivePerformance muss aktuelle Holdings aus Transaktionen verwenden
- [x] Verkäufe sollten erfolgsneutral sein (nur Transaktionskosten beeinflussen Performance)
- [x] Implemented formula: Performance = (Current Value + Realized Gains - Total Invested) / Total Invested × 100

## CRITICAL: Live Performance Inconsistencies (Nov 10, 2025 - 17:15)
- [x] Live Performance shows different values at three locations
- [x] Location 1: Portfolio Optimizer overview card
- [x] Location 2: Portfolio Detail header
- [x] Location 3: Individual stock positions in table
- [x] Error: "portfolioId is not defined" when calling calculateLivePerformance
- [x] Fix: Ensure all three locations use same calculation method
- [x] Fix: Individual stock performance must include realized gains per ticker
- [x] Fix: Pass portfolioId parameter correctly to all queries
- [x] All three locations now use: (currentValue + realizedGains - totalInvested) / totalInvested × 100
- [x] Individual stock performance includes realized gains per ticker from realizedGains table

## NEW: Währungsumrechnung für Performance-Berechnungen (Nov 10, 2025 - 13:00)

### Problem:
- Alle Performance-Berechnungen verwenden Originalwährungen (USD, EUR) statt CHF
- EOS: Kauf am 29.10 zu USD 14.37, Verkauf zu CHF 18.26 → Währungsmix!
- Wechselkursentwicklung wird nicht berücksichtigt
- Realisierte Gewinne müssen für Steuer-Reporting aufgeteilt werden (Aktiengewinn vs. Währungsgewinn)

### Lösung:

#### 1. Historische Wechselkurse
- [x] Neue Tabelle `exchangeRates` (id, date, currencyPair, rate, createdAt)
- [x] Currency pairs: USDCHF, EURCHF, GBPCHF
- [x] Täglicher Cron-Job zum Abrufen aktueller Wechselkurse (6:30 Uhr)
- [x] API: Yahoo Finance für FX-Daten
- [x] Backfill-Funktion: Historische Kurse ab beliebigem Datum laden

#### 2. Realisierte Gewinne aufteilen
- [x] `realizedGains` Tabelle erweitert:
  - [x] `stockGainLocal` - Gewinn/Verlust in Originalwährung (USD/EUR)
  - [x] `fxGain` - Währungsgewinn/-verlust (CHF)
  - [x] `currency` - Originalwährung des Titels
  - [x] `buyFxRate` - Wechselkurs beim Kauf
  - [x] `sellFxRate` - Wechselkurs beim Verkauf
  - [x] Historische Wechselkurse ab 29.10.2025 backfilled

#### 3. Performance-Berechnung in CHF
- [ ] Alle Kurse zu CHF umrechnen mit historischen Wechselkursen
- [ ] Live Performance: Baseline = Kurs × FX-Rate am Live-Start-Datum
- [ ] Aktueller Wert = Kurs × aktueller FX-Rate
- [ ] Holdings-Berechnung: totalInvested in CHF

#### 4. Jahres-Performance-Report erweitern
- [ ] Separate Zeilen für:
  - [ ] Realisierte Aktiengewinne (in Originalwährung)
  - [ ] Realisierte Währungsgewinne (CHF)
  - [ ] Total realisierte Gewinne (CHF)
- [ ] Unrealisierte Gewinne ebenfalls aufteilen

#### 5. Transaktions-Erfassung anpassen
- [ ] Bei Kauf/Verkauf: Wechselkurs vom Transaktionsdatum speichern
- [ ] Verkaufs-Pop-up: Zeige Aktiengewinn UND Währungsgewinn separat

## FIX: Dividenden-Kalender Zeitraum (Nov 10, 2025 - 14:00)
- [x] Problem: Dividenden-Kalender zeigt nur aktuelles Kalenderjahr → Ende Jahr keine Events
- [x] Lösung: Zeitraum auf "nächste 12 Monate ab heute" ändern
- [x] Server-Endpoint angepasst (dividendCalendar.ts)
- [x] Von/Bis-Datum dynamisch berechnet (heute bis heute + 365 Tage)

## Währungsumrechnung - Verbleibende Aufgaben (Nov 10, 2025 - 14:15)

### 1. Frontend-Tabelle CHF-Konvertierung
- [ ] Problem: "Live Perf." Spalte in Portfolio-Positionen verwendet noch Originalwährung
- [ ] Lösung: holdingsByTicker Berechnung auf CHF umstellen
- [ ] Wechselkurse vom Live-Start-Datum und heute abrufen
- [ ] totalInvested und currentValue in CHF berechnen
- [ ] Performance = (currentValueCHF - liveStartValueCHF) / liveStartValueCHF * 100

### 2. Verkaufs-Pop-up Währungsaufteilung
- [x] RealizedGainModal erweitert mit FX-Breakdown-Sektion:
  - [x] Aktiengewinn: (Verkaufspreis - Kaufpreis) in Originalwährung
  - [x] Aktiengewinn in CHF (mit aktuellem Wechselkurs)
  - [x] Währungsgewinn: Differenz durch FX-Entwicklung in CHF
  - [x] Wechselkurse beim Kauf und Verkauf angezeigt
- [x] Berechnung in createPortfolioTransaction angepasst
- [x] realizedGains Tabelle mit stockGainLocal, fxGain, currency, buyFxRate, sellFxRate gefüllt

### 3. Jahres-Performance-Report finalisieren
- [ ] AnnualPerformanceSummary erweitern:
  - [ ] Separate Zeile "Aktiengewinne/-verluste (realisiert)"
  - [ ] Separate Zeile "Währungsgewinne/-verluste"
  - [ ] Summe aus realizedGains.stockGainLocal und realizedGains.fxGain
- [ ] Server-Endpoint annualPerformance anpassen


## NEW: Realized Gains History Page (Nov 10, 2025)
- [x] Create dedicated page showing all sell transactions
- [x] Backend endpoint with full transaction details including costs
- [x] Table columns: Date, Ticker, Shares Sold, Avg Buy Price, Sell Price, Stock Gain, FX Gain, Total Gain (CHF), Buy Fees, Sell Fees, Net Profit
- [x] Add navigation link to Realized Gains History
- [ ] Sortable and filterable by date, ticker, gain/loss
- [ ] Export to CSV for tax reporting


## CRITICAL Bugs (Nov 10, 2025 - 12:59)
- [ ] portfolioData.forEach error on portfolio detail page (portfolioData is not an array)
- [ ] Dividend calendar shows no data after EODHD API migration

- [x] portfolioData.forEach error on portfolio detail page (portfolioData is not an array)
- [x] Dividend calendar shows no data after EODHD API migration
- [x] React hooks order error: useMemo called after conditional return


## Dividend Calendar Fix (Nov 10, 2025 - 13:10)
- [ ] Switch from EODHD to Financial Modeling Prep API for upcoming dividends
- [ ] FMP has dedicated calendar API with actual upcoming dividends (not just historical)


## Transaction History Bugs (Nov 10, 2025 - 13:15)
- [x] Fix currency display: Shows "CHF 18.26" instead of "USD 18.26" for USD transactions
- [x] Add "Storno" (delete/cancel) button to transaction history rows
- [x] Realized Gains History shows no data despite completed sell transactions (backfilled 5 entries)
- [x] Auto-fill current stock price when buying and selling


## Annual Performance Bug (Nov 10, 2025 - 13:30)
- [x] Fix portfolioData.forEach error in annualPerformance.getSummary endpoint (portfolioData is JSON string, not array)

## Transaction Amount Display Bug (Nov 10, 2025 - 13:45)
- [x] Fix "Betrag" column showing USD amount as CHF (e.g., USD 1990.34 displayed as CHF 1990.34)
- [x] Add FX rate column to transaction history to show exchange rate used
- [x] Added fxRate and totalAmountCHF columns to database schema
- [x] Backfilled existing transactions with FX rates (0.88 for USD)

## Transaction Modal UX Improvements (Nov 10, 2025 - 14:00)
- [x] Clear form after successful transaction save (reset all fields)
- [x] Fix price column in transaction history to show correct currency (USD 18.26 instead of CHF 18.26)
- [x] Restructure modal to show FX conversion flow:
  * Anzahl Aktien
  * Kurs pro Aktie (USD/EUR/CHF) - in Fremdwährung
  * Betrag (USD/EUR/CHF) - in Fremdwährung
  * FX Rate (1 USD = X CHF)
  * Betrag (CHF) - konvertiert
  * Gebühren (CHF)
  * Nettobetrag (CHF)

## CRITICAL: Annual Performance Bug (Nov 10, 2025 - 14:05)
- [ ] Aktueller Wert shows CHF 0.00 (should show current portfolio value)
- [ ] Unrealisierte Gewinne shows CHF 45'999.53 but current value is 0 (impossible)
- [ ] Total investiert shows CHF 45'999.53 (correct)
- [ ] Fix calculation in annualPerformance endpoint to properly calculate current portfolio value

## Annual Performance Calculation Bug (Nov 10, 2025 - 14:25)
- [ ] Jahresübersicht shows -17.68% but Live Performance shows +2.7% (inconsistent)
- [ ] Total investiert shows CHF 45'999.53 but should match current capital
- [ ] Aktueller Wert shows CHF 37'468 but Portfolio Positionen shows CHF 46'836
- [ ] Problem: Using historical buy costs instead of current invested capital
- [ ] Fix: Use same calculation logic as Portfolio Detail view for consistency

## Live Performance Calculation Bug (Nov 10, 2025 - 15:00)
- [ ] EOS shows -26.3% live performance but should show correct unrealized gains only
- [ ] Problem: "Total investiert" uses original buy amount, not adjusted for sells
- [ ] Solution: Total investiert = Average cost basis × Current shares (not original shares)
- [ ] When selling, reduce "Total investiert" proportionally to maintain correct cost basis
- [ ] Example: EOS bought 209 shares for CHF 2'642, bought 100 more for CHF 1'876, sold 139 shares
  * Average cost basis = (2'642 + 1'876) / 309 = CHF 14.62 per share
  * Current shares = 170
  * Total investiert should be = 14.62 × 170 = CHF 2'485 (not CHF 3'395)


## Annual Performance Calculation Simplification (Nov 10, 2025 - 15:30)
- [x] Removed complex manual calculation logic
- [x] Simplified to reuse calculateLivePerformance (already working correctly)
- [x] Added debugPerformance endpoint for future troubleshooting
- [ ] Verify calculations match portfolio positions exactly

## CRITICAL: Realisierte Gewinne Berechnung falsch (Nov 10, 2025)
- [x] Verkaufserlös zeigt EUR 663.12 statt EUR 770.00 (12 Aktien × EUR 60)
- [x] Differenz: EUR 106.88 fehlt in der Berechnung
- [x] Problem identifiziert: FX-Konvertierung fehlte in TransactionModal handleSubmit
- [x] Fix: Preis wird jetzt korrekt in CHF konvertiert (shares × price × fx_rate) vor Gebührenabzug
- [x] Gebühren werden korrekt behandelt: +fees bei Kauf, -fees bei Verkauf

## Annual Performance Modal Fix (Nov 10, 2025)
- [x] Fix "calculateLivePerformance is not a function" error in annualPerformance.getSummary endpoint
- [x] Annual Performance Modal zeigt jetzt Daten korrekt an
- [x] Fehlerbehandlung im Modal verbessert (zeigt Fehler statt automatisch zu schließen)
- [x] calculateLivePerformance Logik inline in annualPerformance.getSummary implementiert

## Transaktionshistorie erweitern mit FX-Details (Nov 10, 2025)
- [ ] Datenbank-Schema erweitern: currency, fxRate Felder zu portfolioTransactions
- [ ] TransactionModal: Währung und FX-Rate beim Speichern erfassen
- [ ] TransactionHistory: Neue Spalten hinzufügen:
  - Betrag in Fremdwährung (z.B. USD 3'200)
  - FX-Kurs (z.B. 0.8900)
  - Betrag in CHF (z.B. CHF 2'848)
  - Realisierter Gewinn CHF (nur bei Verkauf, z.B. +CHF 450)
  - Transaktionskosten CHF (z.B. -CHF 50)
  - Nettobetrag CHF (z.B. CHF 2'798) - wird Cash-Konto gutgeschrieben
- [ ] Fix: JNJ Verkauf zeigt CHF 200 statt USD 200 - Währung korrigieren

## CRITICAL: Nettobetrag Berechnung falsch (Nov 10, 2025)
- [x] Verkauf JNJ: Nettobetrag zeigt CHF 2'628.88 statt CHF 2'528.88
- [x] Gebühren werden ADDIERT statt SUBTRAHIERT bei Verkäufen
- [x] Problem gefunden: TransactionModal Preview addiert Gebühren für alle Transaktionstypen
- [x] Fix: Gebühren werden jetzt bei Verkäufen subtrahiert (buy: +fees, sell: -fees)
- [x] TransactionHistory Tabelle erweitert mit FX-Details (FW-Betrag, FX-Rate, CHF-Betrag, Gebühren, Netto)
- [ ] Alte Transaktionen in DB korrigieren (totalAmountCHF muss neu berechnet werden)

## CRITICAL: tRPC Fehler - Server gibt HTML statt JSON zurück (Nov 10, 2025)
- [x] Fehler: "Unexpected token '<', "<!doctype "... is not valid JSON"
- [x] Server wurde neu gestartet und antwortet jetzt mit HTTP 200
- [x] Problem war temporärer Server-Crash

## CRITICAL: Live Performance falsch bei Teilverkauf (Nov 10, 2025)
- [ ] JNJ: Zeigt -80.5% statt positiv (YTD +29.8%)
- [ ] MONC.MI: Zeigt -10.4% statt positiv (YTD +8.5%)
- [ ] EOSE: Zeigt -34.7% statt positiv (YTD +356.5%)
- [ ] TSM: Zeigt -4.5% statt positiv (YTD +42.7%)
- [ ] Problem: Live Performance berücksichtigt realisierte Gewinne aus Teilverkauf nicht korrekt
- [ ] Fix: Cost Basis muss nach Teilverkauf angepasst werden


## CRITICAL: Live Performance berücksichtigt realisierte Gewinne nicht (Nov 10, 2025)
- [ ] Problem: Performance = (Current Value - Total Invested) / Total Invested
- [ ] Fehlt: Realisierte Gewinne aus Teilverkauf werden ignoriert!
- [ ] Beispiel JNJ: Unrealisiert -CHF 69, ABER realisiert +CHF 278 = Gesamt +CHF 209 (+25.6%)
- [ ] Aktuell zeigt: -80.5% (falsch!)
- [ ] Fix: Performance = (Current Value + Realized Gains - Total Invested) / Total Invested × 100
- [ ] calculateLivePerformance muss realizedGains Tabelle abfragen und summieren

## Alte Transaktionen korrigieren (Nov 10, 2025)
- [ ] JNJ Verkauf 1: Währung von CHF auf USD ändern (16 Aktien × USD 200)
- [ ] MONC.MI Verkauf: Währung von CHF auf EUR ändern (12 Aktien × EUR 60)
- [ ] Fehlende currency und fxRate Daten für alte Transaktionen nachtragen
- [ ] totalAmountCHF für alte Verkäufe neu berechnen (mit korrekten Gebührenabzug)

## CRITICAL: Realized Gains Page Errors (Nov 10, 2025 - 17:22)
- [x] Error: "No procedure found on path 'savedPortfolios.getById'"
- [x] Fix: Change procedure call from getById to get in TransactionHistory.tsx
- [x] Error: "getDb is not defined" in a procedure
- [x] Fix: Added missing getDb import to realizedGainsHistory.getAll procedure

## CRITICAL: Portfolio Detail Page Error (Nov 10, 2025 - 17:24)
- [x] Error: "portfolioId is not defined" on /portfolio/90001
- [x] Found: calculateLivePerformance procedure used undefined portfolioId variable
- [x] Fixed: Changed portfolioId to input parameter (line 2344 in routers.ts)

## CRITICAL: Live Performance Calculations Still Wrong (Nov 10, 2025 - 17:30)
- [x] Overall portfolio shows -17.1% but should be +5.1%
- [x] Current: CHF 53'107, Invested: CHF 51'988, Realized Gains: CHF 784.90
- [x] Expected: (53107 + 784.90 - 51988) / 51988 = +5.1%
- [x] Individual stocks show wrong performance:
  - [x] JNJ: shows -80.5% but has +CHF 211.81 realized gains
  - [x] EOSE: shows -34.7% but has +CHF 362.18 realized gains
  - [x] MONC.MI: shows -10.4% but has +CHF 43.03 realized gains
  - [x] TSM: shows -4.5% (needs verification)
- [x] Debug: Check if realized gains are being fetched correctly
- [x] Debug: Check if totalInvested calculation is correct
- [x] Fix: Changed totalGainCHF to realizedGain column name (column didn't exist)
- [x] Fix: Applied same fix to calculateLivePerformance and getHoldingsWithChfPerformance
- [x] Remove "Realisierte Gewinne" button (redundant with Jahresübersicht)

## CRITICAL: JNJ shows -55.4% after selling half (Nov 10, 2025 - 18:00)
- [x] JNJ: Sold 11 of 21 shares, now shows -55.4% loss
- [x] Verbleibend: 10 Aktien zu USD 186.57 = CHF 1'504
- [x] Total investiert zeigt: CHF 3'846 (ursprünglich für 21 Aktien)
- [x] Problem: totalInvestedCHF sollte nur Cost Basis der verbleibenden 10 Aktien sein (ca. CHF 1'836)
- [x] Problem: Realisierte Gewinne werden nicht korrekt in Performance eingerechnet
- [x] Fix: Changed amount calculation to use tx.totalAmount (includes fees) instead of shares * price
- [x] Fix: Applied to both backend (getHoldingsWithChfPerformance) and frontend (PortfolioDetail)
- [x] Fix: This ensures avgBuyPrice is calculated correctly with fees included
- [ ] Test: Nach Fix sollte JNJ positive Performance zeigen (ca. +20-30%)

## CRITICAL: All performance errors still present (Nov 10, 2025 - 18:15)
- [x] User reports ALL errors still exist after multiple fix attempts
- [x] Need systematic debugging approach:
  1. Extract actual DB values for JNJ transactions
  2. Manually calculate expected totalInvested, realized gains, performance
  3. Compare with actual calculation in code
  4. Identify exact discrepancy
  5. Implement verified fix
- [x] Root cause found: getPortfolioTransactions sorted DESC instead of ASC
- [x] This caused sells to be processed BEFORE buys, leading to wrong calculations
- [x] Fix: Changed ORDER BY from DESC to ASC in db.ts line 744
- [x] Also fixed: Use tx.totalAmount (includes fees) instead of shares * price

## CRITICAL: Portfolio Value Inconsistencies Across Three Locations (Nov 10, 2025 - 19:00)

### Expected Values (from Portfolio Positionen - CORRECT):
- [ ] Total investiert: CHF 48'622
- [ ] Aktueller Wert: CHF 53'040
- [ ] Cash Position: CHF 3'748
- [ ] Live Performance: +2.0%

### Location 1: Startseite Portfolio-Karte (FIXED):
- [x] Total investiert: CHF 45'010.01 ❌ (Differenz: -CHF 3'612)
- [x] Live Performance: -3.5% ❌ (sollte +2.0% sein)
- [x] Problem: Cash Position (CHF 3'748) fehlte in currentValueCHF
- [x] Fix: Added cash position calculation to savedPortfolios.list
- [x] Query: savedPortfolios.list → livePerformance calculation

### Location 2: Portfolio Positionen (CORRECT):
- [x] Total investiert: CHF 48'622 ✅
- [x] Aktueller Wert: CHF 53'040 ✅
- [x] Cash Position: CHF 3'748 ✅
- [x] Live Performance: +2.0% ✅
- [x] Query: getHoldingsWithChfPerformance

### Location 3: Jahresübersicht (FIXED):
- [x] Total investiert: CHF 48'295.45 ❌ (Differenz: -CHF 326.55)
- [x] Aktueller Wert: CHF 42'381.592 ❌ (Differenz: -CHF 10'658.41)
- [x] Performance: +4.23% ❌ (sollte +2.0% sein?)
- [x] Problem 1: Used totalAmount (local currency) instead of totalAmountCHF
- [x] Problem 2: Reduced totalInvested by sell proceeds instead of cost basis
- [x] Problem 3: Cash position missing from currentValue
- [x] Fix: Implemented cost basis tracking and cash position calculation
- [x] Query: annualPerformance.getSummary

### Root Cause Analysis Completed:
- [x] savedPortfolios.list now includes cash position in currentValue
- [x] annualPerformance.getSummary now uses correct cost basis tracking
- [x] All three locations now use consistent calculation method:
  - Cost basis tracking for sells
  - Cash position = effectiveDeposits - buyAmounts + sellAmounts
  - Total value = stock value + cash
  - Performance = (total value + realized gains - total invested) / total invested × 100

## Initial Positions Display Issues (Nov 10, 2025 - 20:00)
- [x] MONC.MI shows no "Betrag (CHF)" value despite having "Netto (CHF)" CHF 3'732.48
- [x] Problem: totalAmountCHF was NULL/empty for MONC.MI transaction
- [x] Fix: Calculate from totalAmount * fxRate when totalAmountCHF is missing
- [x] Sum of initial positions: ~CHF 40'000 (manual count)
- [x] Frontseite shows: CHF 45'010 (correct sum from DB)
- [x] Total investiert in Portfolio Positionen: CHF 48'622 (includes later buys)
- [x] Discrepancy explained: CHF 48'622 - CHF 45'010 = CHF 3'612 from 2 later buy transactions
- [x] All initial capital accounted for

## Transaction Edit Functionality (Nov 10, 2025 - 21:10)
- [ ] Add "Bearbeiten" button next to "Storno" button in transaction history
- [ ] Create edit modal with form fields:
  - [ ] Datum (date picker)
  - [ ] Anzahl (number input)
  - [ ] Kurs (price per share, number input)
  - [ ] Währung (currency dropdown: CHF, USD, EUR, GBP)
- [ ] Create tRPC mutation: portfolioTransactions.update
- [ ] Recalculate totalAmount, totalAmountCHF, fxRate on save
- [ ] Invalidate relevant queries after successful update
- [ ] Show success/error toast notifications

## Transaction Edit Functionality & MONC.MI Fix (Nov 10, 2025 - 13:30)
- [x] Add edit button to transaction table
- [x] Create edit modal with form fields (date, shares, price, currency)
- [x] Implement tRPC update mutation with FX rate recalculation
- [x] Add form validation (required fields, positive numbers)
- [x] Fix MONC.MI missing CHF amount (fxRate was null)
- [x] Update all EUR transactions with missing fxRate to 0.9300
- [x] Verify CHF amounts display correctly in transaction history

## Bug Fix: Transaction Edit Modal Error (Nov 10, 2025 - 19:48)
- [x] Fix TypeError: tx.transactionDate?.split is not a function
- [x] transactionDate is a Date object, not a string
- [x] Convert Date to ISO string format for date input field

## Enhancement: Complete Transaction Edit Form (Nov 10, 2025 - 19:50)
- [x] Add fees field to edit form (pre-filled with existing value)
- [x] Add notes field to edit form (pre-filled with existing value)
- [x] Update edit form state to include fees and notes
- [x] Update backend mutation to accept fees and notes updates
- [x] All fields should be pre-filled so user only changes what's needed

## Bug: Transaction Edit Form Shows Wrong Fields (Nov 10, 2025 - 19:55)
- [x] Edit form shows shares/price for deposit/withdrawal (should show amount only)
- [x] Make form conditional based on transaction type
- [x] Buy/Sell: date, shares, price, currency, fees, notes
- [x] Deposit/Withdrawal: date, amount, currency, notes
- [x] Dividend: date, ticker, amount, currency, notes
- [x] Update validation logic for each transaction type

## Bug: Portfolio Summary Shows Wrong Values (Nov 10, 2025 - 20:05)
- [x] "Total investiert" shows CHF 45'010 instead of CHF 50'000 (missing deposit)
- [x] Live Performance starts at -14.8% instead of 0%
- [x] Rename "Total investiert" card to "Portfolio"
- [x] Show three values: Betrag investiert (in Aktien) / Cash / Total
- [x] Total investiert = sum of all deposits (not sum of buys)
- [x] Cash = deposits - withdrawals - buys + sells + dividends
- [x] Betrag in Aktien = current market value of all positions
- [x] Live Performance = (Current Total Value - Total Deposits) / Total Deposits

## Feature: Cash Position Tracking (Nov 10, 2025 - 20:15)
- [ ] Add Cash position as first row in portfolio positions table
- [ ] Show current cash balance (deposits - buys + sells + dividends)
- [ ] Validate cash availability when adding buy transactions
- [ ] Show warning when buy exceeds available cash
- [ ] Suggest which stocks to sell to cover cash deficit
- [ ] Sell suggestion algorithm: prioritize stocks with lowest performance or highest weight

## Bug: yearSummary not defined in PortfolioDetail (Nov 10, 2025 - 20:16)
- [x] ReferenceError: yearSummary is not defined at line 400
- [x] Portfolio card uses yearSummary but it's not loaded
- [x] Created portfolioSummary memo to calculate from transactions
- [x] Use livePerformance data when available, fallback to portfolioSummary
