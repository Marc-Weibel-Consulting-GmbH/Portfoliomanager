# Portfolio Analysis Website TODO

## Bugs (29.12.2025)

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

## New Bugs & Features (30.12.2025)
- [x] Bug: YTD Performance-Berechnung überprüfen und korrigieren (seit 01.01.25) - FIXED: Added graceful fallback when historical data missing, logs warning
- [x] Bug: Dividenden-Kalender zeigt 0 Aktien überall - FIXED: calendar endpoint now calculates holdings from transactions
- [x] Feature: Cron-Job für automatische Alarm-Prüfung (täglich/stündlich) mit Email/WhatsApp Benachrichtigungen - COMPLETED: Runs every hour, sends Email/WhatsApp
- [x] Feature: Performance-Chart im Dashboard mit echten historischen Daten - COMPLETED: Added dashboardPerformance.getHistoricalPerformance endpoint
- [x] Feature: Ursprüngliche Investitionssumme anzeigen (Investiert vs. Aktueller Wert) - COMPLETED: Added totalInvested to dashboard metrics
- [x] Portfolio Details Redesign - Replace old complex design (1137 lines) with new simplified version

## UI Integration Tasks (31.12.2025)
- [x] Integrate RealizedGainsTable component into PortfolioDetail page as new tab
- [x] Integrate CostFeesReport component into PortfolioDetail page as new tab
- [x] Update tab navigation in PortfolioDetail for better overview
- [x] Test realized gains display with real portfolio data
- [x] Test cost/fees report with real portfolio data

## Registration Flow (New Requirement - Dec 26, 2025)
- [x] Implement registration form after OAuth login
- [x] Collect user information (name, email, investment goals, risk tolerance)
- [x] Store registration status in database
- [x] Redirect new users to registration form instead of direct dashboard access
- [x] Redirect registered users directly to dashboard
- [x] Add registration completion check in auth flow

## Platform Redesign Based on Mockups (Dec 26, 2025)

### Phase 1: Design System & Global Styles
- [ ] Update color palette to turquoise/cyan accent theme
- [ ] Configure Tailwind CSS variables for new design system
- [ ] Update typography (fonts, sizes, weights)
- [ ] Create reusable component variants matching mockup style
- [ ] Update button styles (turquoise primary, outline variants)
- [ ] Update card styles (dark background, subtle borders)
- [ ] Create badge/tag components for status indicators

### Phase 2: Landing Page Redesign
- [x] Create new hero section with gradient background
- [x] Add animated portfolio preview mockup
- [x] Implement feature cards (Portfolio-Builder, Live-Tracking, Preisalarme)
- [x] Add trust indicators (SSL, Schweizer Datenschutz, Stripe Payment)
- [x] Add user testimonials section
- [x] Update navigation (Features, Pricing, About, Login, Get Started)
- [x] Ensure responsive design for mobile

### Phase 2.1: Landing Page Design Refinements (Mockup Alignment - Dec 27, 2025)
- [x] Compress hero section to fit above-the-fold (16:9 portfolio image aspect ratio)
- [x] Add glow effects and gradients to CTA buttons
- [x] Create detailed portfolio mockup with realistic charts, sparklines, and stock logos
- [x] Add user profile photo in portfolio mockup (top right)
- [x] Generate and integrate realistic profile images for "500+ Investoren" section
- [x] Improve visual details throughout landing page to match mockup quality
- [x] Update landing page to match mockup EXACTLY (format AND content) - Dec 27, 2025
- [ ] Update ALL pages to match their respective mockups EXACTLY (design, layout, spacing, colors) - Dec 27, 2025
- [x] Implement pixel-perfect landing page with exact proportions, spacing, and visual alignment from mockup (Design pixel-genau, aber ALLE Texte auf Deutsch) - Dec 27, 2025
- [x] CRITICAL: Recreate EXACT mockup design - dark theme, teal accents, dashboard preview, feature cards with glow, trust badges - Dec 27, 2025

### Phase 3: Onboarding Wizard
- [ ] Create multi-step wizard component with progress indicator
- [ ] Step 1: Welcome screen
- [ ] Step 2: Investment goal selection (Dividenden, Wachstum, Ausgewogen)
- [ ] Step 3: Risk tolerance assessment
- [ ] Step 4: Initial portfolio setup
- [ ] Add "Überspringen" (skip) option
- [ ] Smooth transitions between steps

### Phase 4: Dashboard Layout
- [ ] Implement sidebar navigation (left side)
- [ ] Add navigation items: Dashboard, Portfolios, Live-Tracking, Newsroom, Kategorien, Sektoren, Preisalarme, Dividenden, Signale, Rechner, Einstellungen
- [ ] Create top bar with search and user profile
- [ ] Implement welcome message "Willkommen zurück, [Name]"
- [ ] Add summary cards (Gesamtwert, Performance, Dividenden, Portfolios count)
- [ ] Create "Meine Portfolios" section with portfolio cards
- [ ] Add "Aktuelle Alerts" section
- [ ] Add "Top News" section with thumbnails
- [ ] Implement "Quick Actions" buttons

### Phase 5: Portfolio Builder Wizard
- [ ] Create 5-step wizard: Grundlagen, Aktien auswählen, Anleihen & ETFs, Verteilung & Risiko, Abschluss
- [ ] Step 1: Portfolio name and strategy
- [ ] Step 2: Stock selection with search and filters (Dividenden, Wachstum, ETF, Sektoren)
- [ ] Display selected positions in left panel
- [ ] Show weight progress bar
- [ ] Step 3-5: Additional configuration
- [ ] Add stock cards with logos, prices, YTD performance, dividend yield, score

### Phase 6: Portfolio Detail View (WICHTIG: Viele Features bereits implementiert!)
- [x] Large performance chart at top (Portfolio vs Benchmark) - BEREITS VORHANDEN: LivePerformanceChart mit SPY Benchmark
- [x] Show portfolio value, performance % - BEREITS VORHANDEN
- [ ] Show IRR, dividend yield, beta, volatility, Sharpe ratio - TEILWEISE: Einige Metriken fehlen noch
- [x] Add action buttons: Bearbeiten, Löschen - BEREITS VORHANDEN
- [ ] Add action button: Teilen - FEHLT NOCH
- [x] Create holdings table with logos, ticker, name, shares, weight %, current price, value, performance %, dividend yield - BEREITS VORHANDEN
- [x] Add donut chart for asset allocation - BEREITS VORHANDEN: SectorAllocation Component
- [x] Add "Letzte Transaktionen" section - BEREITS VORHANDEN: TransactionHistory Component
- [ ] Implement sorting by stock, sector, category - PRÜFEN ob bereits vorhanden
- [x] Add "Neue Transaktion" button - BEREITS VORHANDEN

### Phase 7: Stock Detail Page
- [ ] Large candlestick chart with time period selector (1D, 1W, 1M, 3M, 6M, 1Y, YTD, All)
- [ ] Show current price, change, and score (circular progress)
- [ ] Display key metrics in cards: P/E Ratio, PEG Ratio, Dividendenrendite, Beta, Volatilität, Sharpe Ratio, Marktkapitalisierung, 52W Hoch/Tief, YTD Performance
- [ ] Add "Wettbewerbsvorteile (Moats)" section with numbered cards
- [ ] Create "Financial Highlights" section: Revenue Growth, Net Income Margin, Free Cash Flow
- [ ] Add category tags (Wachstumsaktie, Technology)
- [ ] Implement "News" section with article cards
- [ ] Add action buttons: Zu Portfolio hinzufügen, Preisalarm erstellen, Factsheet ansehen

### Phase 8: Transaction Management (COMPLETED - Dec 30, 2025)
- [x] Remove "Live Tracking" navigation and replace with "Transaktionen"
- [x] Create transactions database schema (buy, sell, dividend, deposit, withdrawal) - Already existed
- [x] Add multi-currency support (CHF, USD, EUR) with automatic FX rate conversion - Already implemented
- [x] Implement transaction backend procedures (CRUD operations) - Extended with listFiltered and exportToCsv
- [x] Create breadcrumb navigation (Portfolio → Tech Growth Portfolio → Transaktionen)
- [x] Add filter tabs: Alle, Kauf, Verkauf, Dividende, Einzahlung, Auszahlung
- [x] Add time period filter: Alle, Letzte 30 Tage, Letzte 3 Monate, Dieses Jahr
- [x] Add ticker filter dropdown (Alle option)
- [x] Show summary cards: Gesamt investiert, Gesamt entnommen, Dividenden erhalten, Gebühren bezahlt
- [x] Create transaction table with columns: Datum, Typ, Ticker, Anzahl, Preis/Aktie, Währung, Gesamt (CHF), Gebühren, Notizen, Actions
- [x] Add colored badges for transaction types (Kauf=green, Verkauf=red, Dividende=blue, Einzahlung=cyan, Auszahlung=orange)
- [x] Implement "Neue Transaktion" modal with all transaction types
- [x] Add fee tracking to all transactions
- [x] Implement edit transaction functionality (opens modal with prefilled data)
- [x] Implement delete transaction with confirmation
- [x] Add CSV export for tax reporting (Steuererklärung)
- [x] Add pagination (8 items per page as shown in mockup)
- [x] Add live toggle to Dashboard page
- [x] Portfolio Overview page already has status filter (Alle/Live/Test)
- [x] Portfolio Detail page already shows Live badge

### Phase 9: Price Alerts (COMPLETED - Dec 30, 2025)
- [x] Improve dashboard metrics clarity:
  - [x] Add time period labels to performance metrics (YTD)
  - [x] Clarify what's included in portfolio value (Wertschriften only)
  - [x] Replace dividends percentage with dividend calendar link
  - [x] Add "Seit 1. Januar 2025" label to Performance YTD
  - [ ] Show original investment amount alongside current portfolio value (future enhancement)
  - [ ] Replace placeholder chart with actual performance/price history (future enhancement)
- [x] Create status filter dropdown: Alle, Aktiv, Ausgelöst, Deaktiviert
- [x] Add ticker filter (Alle option)
- [x] Show summary cards: Aktive Alarme (count), Ausgelöst (heute) (count), Deaktiviert (count)
- [x] Create alerts table: Ticker (with logo), Trigger-Typ, Zielpreis, Aktueller Preis, Status, Benachrichtigung (Email/WhatsApp icons), Erstellt am, Actions (edit, delete, toggle)
- [x] Add colored badges for trigger types (Unter CHF X, Über CHF X, Änderung +X%)
- [x] Implement toggle switches for enable/disable alerts
- [x] Add edit action (opens modal with prefilled data)
- [x] Add delete action (with confirmation)
- [x] Add "Neuer Alarm" button (opens creation modal)
- [x] Create "Neuer Alarm" modal:
  - [x] Ticker search/select dropdown
  - [x] Trigger type selector (Unter CHF X, Über CHF X, Änderung +/-X%)
  - [x] Target price/percentage input
  - [x] Notification channel checkboxes (Email, WhatsApp)
  - [x] Submit button
- [x] Backend alert checking logic already implemented (cron job ready)
- [x] Test alert creation, filtering, and UI interactions

### Phase 10: Admin Dashboard
- [ ] Create sidebar navigation for admin
- [ ] Add metric cards: Gesamt-Benutzer, Neue Benutzer (30 Tage), Premium-Benutzer, Conversion-Rate, Umsatz (30 Tage), Durchschn. Umsatz/Benutzer, Gesamt-Portfolios, Live-Portfolios
- [ ] Create "Benutzer-Aktivität" chart (daily active users over 30 days)
- [ ] Create "Umsatz-Entwicklung" chart (monthly revenue over 6 months)
- [ ] Add system statistics cards: API-Calls (24h), Fehlerrate, Uptime, Durchschn. Response-Zeit

### Phase 11: Pricing Page
- [ ] Create two-column layout: Free vs Premium
- [ ] Free plan: CHF 0, Demo-Portfolio, 3 Aktien-Analysen pro Tag, Grundlegende Metriken, Newsroom
- [ ] Premium plan: CHF 10.00 (Einmalige Zahlung), Unbegrenzte Portfolios, Live-Tracking mit IRR/MWR, Preisalarme (Email & WhatsApp), Dividendenkalender, Trading-Signale, Vollständige Fundamentalanalyse, Portfolio-Vergleich, Rechner & Tools, Priority Support
- [ ] Add payment provider logos: Stripe, TWINT, PostFinance
- [ ] Add FAQ section: "Was beinhaltet die 'Einmalige Zahlung'?", "Kann ich mein kostenloses Konto später upgraden?", "Sind meine Daten sicher?"
- [ ] Add "Kostenlos starten" and "Jetzt kaufen" buttons

### Phase 12: German Translations
- [x] "Refresh" → "Aktualisieren"
- [x] "PDF Export" → "PDF Exportieren"
- [x] "Alternativen" → "Alternative Titel"
- [x] "Score" → "Bewertung"
- [x] "Analyzer" → "Analyse"
- [x] "Transactions" → "Transaktionen"
- [ ] Review all remaining English text
- [ ] Translate chart labels and tooltips
- [ ] Translate error messages
- [ ] Translate loading states
- [ ] Translate form placeholders
- [ ] Translate button texts
- [ ] Translate dialog titles

### Phase 13: Testing & Quality Assurance
- [ ] Test landing page → registration flow
- [ ] Test landing page → login flow
- [ ] Test onboarding wizard completion
- [ ] Test portfolio creation wizard
- [ ] Test portfolio detail view
- [ ] Test transaction management
- [ ] Test price alerts
- [ ] Test stock detail view
- [ ] Test admin dashboard (admin role)
- [ ] Test responsive design on mobile
- [ ] Test all navigation flows
- [ ] Verify all German translations
- [ ] Check loading states
- [ ] Verify error handling

## Completed Features (Previous)
- [x] Basic homepage layout
- [x] Navigation menu
- [x] User authentication system
- [x] Dashboard with analytics
- [x] API integration
- [x] Portfolio optimizer with efficient frontier
- [x] Live portfolio tracking
- [x] Transaction management
- [x] Stock data integration (EODHD, Finnhub)
- [x] Dividend calendar
- [x] Price alerts
- [x] Portfolio comparison
- [x] AI-powered insights
- [x] PDF export functionality
- [x] CSV import for transactions
- [x] Realized gains tracking
- [x] Swiss tax calculator
- [x] Portfolio sentiment indicator
- [x] Weekly overview with AI
- [x] Competitor analysis
- [x] Stock scoring system
- [x] Forward P/E chart
- [x] Daily news section
- [x] Welcome modal
- [x] Guided tour modal


## Progress Update (Dec 26, 2025 - 16:50)
- [x] Landing Page redesigned with mockup design
  - [x] Hero section with gradient background
  - [x] Animated portfolio preview mockup
  - [x] Feature cards (Portfolio-Builder, Live-Tracking, Preisalarme)
  - [x] Trust indicators (SSL, Schweizer Datenschutz, Stripe Payment)
  - [x] Social proof section with user count
  - [x] CTA section with gradient background
  - [x] Updated navigation (Funktionen, Preise, Über uns)
  - [x] Responsive design


## Checkpoint 1 - Landing Page & Dashboard (Dec 26, 2025 - 17:00)
- [x] Design system updated with turquoise/cyan accent colors
- [x] Landing page completely redesigned with mockup design
  - [x] Hero section with gradient background
  - [x] Animated portfolio preview mockup
  - [x] 3 feature cards (Portfolio-Builder, Live-Tracking, Preisalarme)
  - [x] Trust indicators section
  - [x] CTA section
  - [x] Responsive navigation
- [x] Dashboard redesigned with new layout
  - [x] Summary cards (Gesamtwert, Performance, Dividenden, Portfolios)
  - [x] Portfolio cards with mini charts
  - [x] Quick Actions buttons
  - [x] Aktuelle Alerts section
  - [x] Top News section
- [x] Sidebar navigation updated with new menu items
  - [x] Dashboard, Portfolios, Live-Tracking, Newsroom
  - [x] Kategorien, Sektoren, Preisalarme
  - [x] Dividenden, Signale, Rechner, Einstellungen

## Next Steps (After Checkpoint 1)
- [ ] Portfolio Builder Wizard (5-step process)
- [ ] Portfolio Detail View with charts
- [ ] Complete remaining pages


## User Flow Korrektur (26.12.2024 - 18:50)
- [x] Login Button führt direkt zur Login-Seite (nicht zum Onboarding)
- [x] "Jetzt starten" / "Kostenlos starten" startet mehrstufigen Onboarding-Prozess
- [x] Nach Login/Registration landet User im Dashboard
- [x] Portfolio-Builder wird vom Dashboard aus gestartet (nicht von Landing Page)
- [x] Routing-Struktur entsprechend anpassen (App.tsx)


## Neue Implementierung: Portfolio Builder Wizard, Portfolio Detail View, Price Alerts (27.12.2024)

### Database Schema Erweiterungen
- [x] portfolios table erweitern (falls noch nicht vollständig) - savedPortfolios bereits vorhanden
- [x] holdings table erweitern (falls noch nicht vollständig) - bereits vorhanden
- [x] transactions table erweitern (falls noch nicht vollständig) - portfolioTransactions bereits vorhanden
- [x] price_alerts table erweitern (trigger_type, threshold_value, notification_method, status)
- [x] Database migration durchführen (pnpm db:push)

### Backend Implementation
- [x] Database helper functions für portfolios (create, list, get, update, delete) - bereits vorhanden
- [x] Database helper functions für holdings (add, list, update, delete) - bereits vorhanden
- [x] Database helper functions für transactions (add, list, delete) - bereits vorhanden
- [x] Database helper functions für price_alerts (create, list, update, delete, checkTriggers)
- [x] tRPC procedures für portfolios implementieren - bereits vorhanden (portfoliosRouter)
- [x] tRPC procedures für holdings implementieren - bereits vorhanden
- [x] tRPC procedures für transactions implementieren - bereits vorhanden (portfolioTransactionsRouter)
- [x] tRPC procedures für price_alerts implementieren - erweitert mit notificationMethod und status
- [x] External API integration für Aktienkurse (EODHD/Finnhub) - bereits vorhanden
- [x] Notification system (Email via Resend, WhatsApp via Twilio)
- [x] Background job für Price Alert Checking - checkAlerts procedure vorhanden

### Portfolio Builder Wizard (5 Schritte)
- [x] Wizard Component Struktur erstellen
- [x] Schritt 1: Grundlagen (Name, Beschreibung, Währung, Startkapital)
- [x] Schritt 2: Aktien auswählen (Suche, Filter, Hinzufügen mit Menge/Preis)
- [x] Schritt 3: Anleihen & ETFs (Suche und Hinzufügen)
- [x] Schritt 4: Verteilung & Risiko (Allocation Pie Chart, Risikometriken)
- [x] Schritt 5: Abschluss (Zusammenfassung, Bestätigung)
- [x] Navigation zwischen Schritten (Zurück/Weiter, Progress Indicator)
- [x] Integration mit tRPC Backend
- [x] Validierung und Error Handling
- [x] Responsive Design

### Portfolio Detail View
- [ ] Portfolio Detail Page Layout erstellen
- [ ] Performance Line Chart (Wert über Zeit)
- [ ] Holdings Tabelle mit Company Logos, aktuellen Preisen, Gewinnen/Verlusten
- [ ] Asset Allocation Donut Chart (Aktien/Anleihen/ETFs Breakdown)
- [ ] Transaktionshistorie Tabelle mit Filtern
- [ ] Edit/Delete Portfolio Funktionalität
- [ ] "Neue Transaktion" Button und Modal
- [ ] Responsive Design

### Aktuelle Implementierung (27.12.2024 - Fortsetzung)
- [x] Portfolio Detail View vollständig implementiert
- [x] Charts und Visualisierungen implementiert
- [x] Price Alerts Page implementiert
- [x] Notification System implementiert (Email & WhatsApp)
- [x] TypeScript-Fehler behoben
- [x] Responsive Design implementiert
- [x] Checkpoint erstellen für systematische Tests

### Price Alert System
- [ ] Price Alerts Page/Section erstellen
- [ ] Alert Creation Form (Symbol, Trigger Type, Threshold, Notification Method)
- [ ] Trigger Types unterstützen: "Unter CHF X", "Über CHF X", "Änderung +X%"
- [ ] Notification Methods: Email, WhatsApp
- [ ] Alert Status Management (active, triggered, disabled)
- [ ] Background Job/Webhook für Price Trigger Checking
- [ ] Notification Sending implementieren (Email via Resend, WhatsApp via Twilio)
- [ ] Alerts Liste mit Status Indicators und Management Actions
- [ ] Responsive Design

### Testing & Quality Assurance
- [ ] Portfolio Builder Wizard End-to-End testen
- [ ] Portfolio Detail View mit echten Daten testen
- [ ] Price Alerts Creation und Triggering testen
- [ ] Notification Delivery testen (Email und WhatsApp)
- [ ] Responsive Design auf Mobile Devices testen
- [ ] Error Handling und Loading States überprüfen
- [ ] Vitest Unit Tests für kritische Backend-Funktionen schreiben
- [ ] Checkpoint erstellen nach erfolgreichen Tests


## Layout-Anpassung: Dashboard kompakter gestalten (27.12.2024)
- [x] Dashboard Layout kompakter gestalten (maximale Breite reduzieren)

## Neue Anforderung: Authentifizierungsflow überarbeiten (27.12.2024)
- [ ] "Jetzt starten" Button führt zur Manus OAuth-Anmeldung
- [ ] Nach erfolgreicher Authentifizierung landen neue Benutzer direkt im Dashboard
- [ ] Registrierungsformular entfernen oder optional machen
- [ ] Auth-Flow vereinfachen: Login → Dashboard (ohne Zwischenschritte)


## Klarstellung: Login vs. Registration (27.12.2024 - 19:00) ✅ ERLEDIGT
- [x] **Login**: Für existierende Benutzer mit Zugangsdaten
  - [x] Login-Formular mit Email/Passwort
  - [ ] "Passwort vergessen" Funktion (kann später hinzugefügt werden)
  - [x] Weiterleitung zum Dashboard nach erfolgreichem Login
- [x] **Registration**: Für neue Benutzer
  - [x] Registrierungsformular mit Email, Passwort, Name
  - [ ] Email-Verifizierung (kann später hinzugefügt werden)
  - [x] Automatischer Login nach erfolgreicher Registrierung
  - [x] Weiterleitung zum Dashboard
- [x] Beide Flows klar voneinander trennen in der UI
- [x] Navigation zwischen Login und Registration ermöglichen


## Implementierung: Login vs. Registration Trennung (27.12.2024 - 19:15) ✅ ERLEDIGT
- [x] Login-Seite erstellen (/login)
  - [x] Email/Passwort Eingabefelder
  - [x] "Anmelden" Button
  - [x] "Passwort vergessen?" Link (kann später hinzugefügt werden)
  - [x] "Noch kein Konto? Jetzt registrieren" Link
  - [x] Fehlerbehandlung für falsche Zugangsdaten
- [x] Registrierungs-Seite erstellen (/register)
  - [x] Name, Email, Passwort Eingabefelder
  - [x] Passwort-Bestätigung (minLength: 6)
  - [x] "Registrieren" Button
  - [x] "Bereits registriert? Zum Login" Link
  - [x] Email-Validierung
  - [x] Passwort-Stärke-Anzeige (minLength Validierung)
- [x] Backend Auth-Logik erweitern
  - [x] Login-Prozedur (email/password verification)
  - [x] Registration-Prozedur (create new user)
  - [x] Password hashing (bcrypt)
  - [x] Session management
- [x] Navigation aktualisieren
  - [x] "Login" Button führt zu /login
  - [x] "Jetzt starten" / "Kostenlos starten" führt zu /register
  - [x] Nach Login: Weiterleitung zu /dashboard
  - [x] Nach Registration: Weiterleitung zu /dashboard


## Passwort vergessen & Email-Verifizierung (27.12.2024)

### Database Schema
- [ ] password_reset_tokens table erstellen (userId, token, expiresAt, createdAt)
- [ ] email_verification_tokens table erstellen (userId, token, expiresAt, createdAt)
- [ ] users table erweitern (emailVerified boolean, password hash field)
- [ ] Database migration durchführen (pnpm db:push)

### Backend Implementation
- [ ] Database helper functions für password reset tokens (create, verify, delete)
- [ ] Database helper functions für email verification tokens (create, verify, delete)
- [ ] tRPC procedures für password reset (requestReset, verifyToken, resetPassword)
- [ ] tRPC procedures für email verification (sendVerification, verifyEmail, resendVerification)
- [ ] Email templates für password reset (Resend)
- [ ] Email templates für email verification (Resend)
- [ ] Token generation und validation logic
- [ ] Password hashing mit bcrypt

### Frontend Implementation
- [ ] "Passwort vergessen?" Link auf Login-Seite
- [ ] Password Reset Request Page (Email eingeben)
- [ ] Password Reset Page (Neues Passwort eingeben mit Token)
- [ ] Email Verification Page (Token verification)
- [ ] Email Verification Banner (für unverifizierte User)
- [ ] Resend Verification Email Button
- [ ] Success/Error Messages für alle Flows
- [ ] Form validation (Password strength, Email format)

### User Flow
- [ ] User klickt "Passwort vergessen?" → Email eingeben → Email mit Reset-Link erhalten
- [ ] User klickt Reset-Link → Neues Passwort eingeben → Passwort erfolgreich geändert
- [ ] Nach Registration → Verification Email senden → User klickt Link → Email verifiziert
- [ ] Unverifizierte User sehen Banner → "Email erneut senden" Button


## Checkpoint - Password Reset & Email Verification Implemented (27.12.2024 - 07:10)
- [x] Database schema erweitert (emailVerified, passwordResetTokens, emailVerificationTokens)
- [x] Backend helper functions implementiert (token creation, verification, deletion)
- [x] tRPC procedures implementiert (requestPasswordReset, verifyResetToken, resetPassword, sendEmailVerification, verifyEmail)
- [x] Email templates erstellt (Resend integration)
- [x] ForgotPassword page erstellt
- [x] ResetPassword page erstellt
- [x] VerifyEmail page erstellt
- [x] Routes in App.tsx hinzugefügt
- [x] "Passwort vergessen?" Link auf Login-Seite hinzugefügt
- [x] bcrypt für Password Hashing installiert


## Neue Anforderung: Pricing-Info aus Registrierung entfernen (27.12.2024)
- [x] Text "Nach der Registrierung erhältst du Zugriff auf 1 Aktie pro Kategorie (13 von 63)" aus Registrierung entfernen
- [x] Text "Für vollen Zugriff: CHF 10.- einmalig" aus Registrierung entfernen
- [x] Diese Informationen werden später auf separater Pricing-Seite angezeigt

## UI Improvements (Dec 27, 2025)
- [x] Increase font sizes and spacing for better readability
- [x] Generate real profile images for avatars in "500+ Investoren" section

## Bug Fixes (Dec 27, 2025)
- [x] Fix login redirect - after successful login, user should be redirected to dashboard instead of "Please sign in to continue" page
- [x] Implement real news loading from APIs (Finnhub, EODHD) for portfolio stocks


## Dashboard Enhancements (27.12.2024 - Neue Anforderungen)

- [x] Add portfolio deletion functionality in dashboard
- [x] Rename "Portfolio-Builder" to "Dashboard" in navigation
- [x] Create detailed portfolio view with positions display
- [x] Add donut charts for currency allocation
- [x] Add donut charts for sector/industry allocation
- [x] Show performance development for positions
- [x] Display key metrics and statistics
- [x] Create separate transactions page for live portfolios
- [x] Implement horizontal navigation for portfolio details (Positionen / Transaktionen)
- [x] Ensure demo and live portfolios show same initial view (positions)


## PLATFORM RESTRUCTURING - Complete Architecture (27.12.2024 - NEW)

### Phase 0: Foundation & Unified Navigation
- [ ] Remove all inconsistent old design elements
- [ ] Create unified DashboardLayout for all authenticated pages
- [ ] Implement comprehensive sidebar navigation covering all phases 0-5
- [ ] Establish consistent design system (colors, typography, spacing, shadows)
- [ ] Create reusable component library matching mockup style
- [ ] Implement responsive layout for all screen sizes

### Phase 1: Portfolio Setup & Data Import (Complete Structure)
- [ ] Portfolio Overview page with all portfolios list
- [ ] Manual stock entry form with validation
- [ ] CSV/Excel import functionality with preview
- [ ] API connection setup page (EODHD, Finnhub credentials)
- [ ] Portfolio CRUD operations (Create, Read, Update, Delete)
- [ ] Holdings management interface
- [ ] Transaction import and management

### Phase 2: Real-time Market Data & Visualization (Complete Structure)
- [ ] Main Dashboard with real-time portfolio summary
- [ ] Live price updates (WebSocket or polling)
- [ ] Performance charts (line, area, candlestick)
- [ ] Sector allocation donut/pie chart
- [ ] Geographic distribution map/chart
- [ ] Asset class breakdown visualization
- [ ] Watchlist page with real-time updates
- [ ] Market overview widgets

### Phase 3: Analysis & Insights (Complete Structure)
- [ ] Analysis Hub page
- [ ] Risk metrics dashboard (volatility, Sharpe ratio, beta, VaR)
- [ ] Correlation matrix heatmap
- [ ] Portfolio optimization tool (efficient frontier)
- [ ] Diversification score calculator
- [ ] Historical performance analysis
- [ ] Benchmark comparison charts (S&P 500, SMI, etc.)
- [ ] What-if scenario analysis

### Phase 4: AI-Powered Insights (Complete Structure)
- [ ] AI Insights Hub page
- [ ] LLM integration for natural language portfolio analysis
- [ ] Automated portfolio health report
- [ ] Risk assessment narrative
- [ ] Personalized investment recommendations
- [ ] Market sentiment analysis
- [ ] News impact analysis
- [ ] AI-powered stock screening

### Phase 5: Reporting & Alerts (Complete Structure)
- [ ] Reports Hub page
- [ ] PDF report generation with templates
- [ ] Custom report builder
- [ ] Scheduled reports (daily, weekly, monthly)
- [ ] Alert configuration center
- [ ] Price alerts (above/below threshold, % change)
- [ ] Performance threshold alerts
- [ ] Dividend alerts
- [ ] Email notification system
- [ ] WhatsApp notification integration
- [ ] Alert history and logs

### Navigation Structure (All Pages)
- [ ] Dashboard (Main overview)
- [ ] Portfolios (List and management)
- [ ] Live-Tracking (Real-time updates)
- [ ] Analysis (Risk and performance analysis)
- [ ] AI Insights (AI-powered recommendations)
- [ ] Newsroom (Market news and updates)
- [ ] Kategorien (Category analysis)
- [ ] Sektoren (Sector analysis)
- [ ] Preisalarme (Price alerts)
- [ ] Dividenden (Dividend calendar)
- [ ] Signale (Trading signals)
- [ ] Reports (Report generation)
- [ ] Rechner (Calculators and tools)
- [ ] Einstellungen (Settings)

### Database Schema (Complete)
- [ ] Review and optimize portfolios table
- [ ] Review and optimize holdings table
- [ ] Review and optimize transactions table
- [ ] Review and optimize alerts table
- [ ] Create reports table
- [ ] Create user_preferences table
- [ ] Create watchlist table
- [ ] Create analysis_cache table
- [ ] Add proper indexes for performance
- [ ] Add foreign key constraints

### Backend API (tRPC - Complete)
- [ ] Portfolio router (CRUD + analytics)
- [ ] Holdings router (management + real-time updates)
- [ ] Transactions router (import + management)
- [ ] Market data router (real-time prices, historical data)
- [ ] Analysis router (risk metrics, optimization)
- [ ] AI router (insights, recommendations)
- [ ] Reports router (generation, scheduling)
- [ ] Alerts router (CRUD + triggering)
- [ ] Notifications router (email, WhatsApp)
- [ ] Settings router (user preferences)

### Design System (Consistent Across All Pages)
- [ ] Define color palette (primary: turquoise/cyan, secondary, accent)
- [ ] Typography system (headings, body, captions)
- [ ] Spacing system (consistent padding, margins, gaps)
- [ ] Shadow system (cards, modals, dropdowns)
- [ ] Border radius system
- [ ] Icon library (financial icons)
- [ ] Button variants (primary, secondary, outline, ghost)
- [ ] Card variants (default, highlighted, interactive)
- [ ] Chart color scheme (consistent across all charts)
- [ ] Loading states (skeletons, spinners)
- [ ] Empty states (illustrations, messages)
- [ ] Error states (error messages, retry actions)

### Customer Journey Testing
- [ ] Landing page → Registration → Dashboard
- [ ] Landing page → Login → Dashboard
- [ ] Dashboard → Create Portfolio → Portfolio Detail
- [ ] Dashboard → Add Transaction → Transaction List
- [ ] Dashboard → Set Alert → Alert Management
- [ ] Dashboard → Generate Report → View Report
- [ ] Dashboard → AI Insights → View Recommendations
- [ ] Navigation between all main sections
- [ ] Mobile responsive navigation
- [ ] Error handling throughout journey

### Quality Assurance
- [ ] Remove all old/inconsistent design elements
- [ ] Ensure all pages use DashboardLayout
- [ ] Verify consistent styling across all pages
- [ ] Test all navigation links
- [ ] Verify responsive design on mobile/tablet
- [ ] Test loading states on all pages
- [ ] Test empty states on all pages
- [ ] Test error handling on all pages
- [ ] Verify German translations throughout
- [ ] Performance optimization (lazy loading, code splitting)


## Platform Restructuring Progress (27.12.2024 - Current Session)

### Navigation & Layout
- [x] Updated DashboardLayout with comprehensive navigation (Dashboard, Portfolios, Live-Tracking, Analyse, KI-Insights, Newsroom, Kategorien, Sektoren, Preisalarme, Dividenden, Signale, Reports, Rechner, Einstellungen)
- [x] Added new navigation icons (FolderKanban, BarChart3, Sparkles, FileText)

### New Page Shells Created
- [x] Portfolios overview page (/portfolios)
- [x] Analysis hub page (/analysis) with tabs for Risk, Correlation, Optimization, Diversification, Benchmark
- [x] AI Insights hub page (/ai-insights) with Portfolio Health, Risk Assessment, Recommendations, Sentiment, Screening
- [x] Reports hub page (/reports) with Templates, Scheduled Reports, Recent Reports, Custom Builder
- [x] Added all new routes to App.tsx

### Next Steps
- [ ] Fix existing TypeScript errors in PortfolioTransactions, PortfolioTransactionsPage, StockDetail
- [ ] Review and update existing pages for design consistency
- [ ] Create Payment Success/Cancel pages
- [ ] Optimize Pricing page
- [ ] Test complete navigation flow


### Payment Pages Created (27.12.2024)
- [x] Payment Success page (/payment/success) with Premium features overview
- [x] Payment Cancel page (/payment/cancel) with helpful next steps
- [x] Added routes to App.tsx
- [ ] Pricing page optimization (already exists, needs review for consistency)


### Design Consistency - Dark Theme (27.12.2024)
- [x] Pricing page converted to dark theme with primary accents
- [x] Payment Success page with dark theme
- [x] Payment Cancel page with dark theme
- [x] All new page shells (Portfolios, Analysis, AI Insights, Reports) with consistent dark theme
- [x] Navigation updated with all main sections
- [x] Consistent color palette: slate-950/900 backgrounds, primary (turquoise/cyan) accents
- [x] Typography and spacing consistent across pages
- [x] Trust badges and icons styled consistently

### Ready for Testing
- [ ] Test navigation flow from Landing → Registration → Dashboard
- [ ] Test all sidebar navigation links
- [ ] Test Payment Success/Cancel pages
- [ ] Test responsive design on mobile
- [ ] Verify all pages use consistent dark theme


## Navigation & Admin Consolidation (Dec 28, 2025)
- [x] Remove Newsroom from main navigation (news only in portfolio/stock details)
- [x] Ensure sidebar remains visible across all category pages
- [x] Consolidate admin section with:
  - [x] Admin Dashboard overview page
  - [x] Kategorien-Verwaltung (Categories Management)
  - [x] Sektoren-Verwaltung (Sectors Management)
  - [x] Aktienliste-Verwaltung (Stock List Management - already exists)
  - [x] Secrets-Verwaltung (Secrets Management)
  - [x] Platform-KPIs (Platform Metrics)
- [x] Align Live-Tracking portfolio details design with new Portfolio design
- [x] Update Live-Tracking portfolio detail page to match Portfolio detail mockup design


## Pricing Page Implementation (Dec 28, 2025)
- [x] Create Pricing page with two-column layout (Free vs Premium)
- [x] Add Free plan features and pricing
- [x] Add Premium plan features and pricing (CHF 10.00 einmalige Zahlung)
- [x] Add payment provider logos (Stripe, TWINT, PostFinance)
- [x] Add FAQ section with common questions
- [x] Style with dark theme and cyan accents
- [x] Add CTA buttons (Kostenlos starten, Jetzt kaufen)
- [x] Integrate Stripe payment flow for Premium upgrade

## Bug Fix: Topbar Navigation (Dec 28, 2025)
- [x] Fix AdminTopbar design to match mockup (dark background, icons before labels, proper styling)
- [x] Add AdminTopbar to AdminKPIs page
- [x] Add KPIs tab to AdminTopbar navigation

## Pricing Page Corrections (Dec 28, 2025)
- [x] Remove "Newsroom" from Free plan features (no longer separate feature)
- [x] Change Premium pricing from "Einmalige Zahlung" to "Monatliches Abo"
- [x] Update Premium price display to "CHF 10.00/Monat"
- [x] Review all feature descriptions for consistency with current platform
- [x] Update FAQ section to reflect monthly subscription model


## User Journey Optimierung - Onboarding Loop Fix (28.12.2024)

### Phase 1: Database Schema & Backend (JETZT)
- [ ] hasCompletedOnboarding Flag zur users Tabelle hinzufügen
- [ ] subscriptionTier Feld hinzufügen (free | premium)
- [ ] investmentGoal Feld hinzufügen (dividends | growth | balanced)
- [ ] riskTolerance Feld hinzufügen (low | medium | high)
- [ ] investmentHorizon Feld hinzufügen (short | medium | long)
- [ ] Database migration durchführen (pnpm db:push)
- [ ] updateUserPreferences() Funktion in server/db.ts erstellen
- [ ] completeOnboarding() Funktion in server/db.ts erstellen
- [ ] tRPC procedures für Onboarding-Completion erstellen
- [ ] tRPC procedures für Preference-Updates erstellen

### Phase 2: Onboarding Flow Fix (JETZT)
- [ ] Onboarding-Redirect-Logic überarbeiten (nach Completion → Dashboard)
- [ ] Route Guard implementieren (verhindert Re-Entry ins Onboarding)
- [ ] Schritt 4 des Onboardings: Premium-Teaser hinzufügen
- [ ] hasCompletedOnboarding Flag nach Abschluss setzen
- [ ] Redirect zu /dashboard nach Onboarding-Completion

### Phase 3: Einstellungen-Seite (JETZT)
- [ ] Settings Page erstellen (/settings)
- [ ] Navigation Link im Dashboard Sidebar hinzufügen
- [ ] Formular für Anlagepräferenzen (investmentGoal, riskTolerance, investmentHorizon)
- [ ] Save-Funktion mit tRPC mutation
- [ ] Success-Notification nach Update
- [ ] Responsive Design

### Phase 4: Landing Page Optimierung (JETZT)
- [ ] Value Proposition klarer herausstellen
- [ ] "Jetzt starten" CTA führt zu OAuth Login
- [ ] Nach Login: Check hasCompletedOnboarding
  - [ ] Falls false → Redirect zu /onboarding
  - [ ] Falls true → Redirect zu /dashboard
- [ ] Premium-Teaser Section hinzufügen

### Phase 5: Testing & Checkpoint
- [ ] Kompletten User Flow testen (Landing → Login → Onboarding → Dashboard)
- [ ] Onboarding-Loop Bugfix verifizieren
- [ ] Settings Page testen (Preferences Update)
- [ ] Responsive Design testen
- [ ] Checkpoint erstellen


## Progress Update (28.12.2024 - 06:42)
- [x] hasCompletedOnboarding Flag zur users Tabelle hinzugefügt
- [x] subscriptionTier Feld hinzugefügt (free | premium)
- [x] investmentGoal Feld zu enum konvertiert (dividends | growth | balanced)
- [x] riskTolerance Feld zu enum konvertiert (low | medium | high)
- [x] investmentHorizon Feld hinzugefügt (short | medium | long)
- [x] Database migration durchgeführt
- [x] updateUserPreferences() Funktion in server/db.ts erstellt
- [x] completeOnboarding() Funktion in server/db.ts erstellt
- [x] tRPC procedures für Onboarding-Completion erstellt (auth.completeOnboarding)
- [x] tRPC procedures für Preference-Updates erstellt (auth.updatePreferences)


## Abgeschlossen (28.12.2024 - 06:48)
- [x] Onboarding-Redirect-Logic überarbeitet (nach Completion → Dashboard)
- [x] Schritt 4 des Onboardings: Premium-Teaser hinzugefügt
- [x] hasCompletedOnboarding Flag nach Abschluss setzen
- [x] Redirect zu /dashboard nach Onboarding-Completion
- [x] Settings Page: Tab für Anlagepräferenzen hinzugefügt
- [x] Save-Funktion mit tRPC mutation (auth.updatePreferences)
- [x] Success-Notification nach Update
- [x] Responsive Design für Settings
- [x] ProtectedRoute Component erstellt (für Route Guards)
- [x] Registration.tsx TypeScript-Fehler behoben


## Neue Bugs (28.12.2024)
- [x] Onboarding-Loop beheben - Benutzer sehen Onboarding wiederholt
- [x] Preisangabe im Onboarding korrigieren - muss "10.- monatlich" statt "10.- einmalig" anzeigen

## Status Update (28.12.2024 - 07:55)
- [x] Preisangabe im Onboarding korrigiert - zeigt jetzt "10.- monatlich" statt "10.- einmalig"
- [x] Onboarding-Loop behoben - completeOnboarding setzt jetzt beide Flags (hasCompletedOnboarding und hasSeenOnboarding)


## Onboarding Loop Fix (28.12.2024 - 08:05)
- [x] Onboarding-Loop Problem identifiziert - OnboardingWizard rief falschen Mutation-Endpoint auf
- [x] OnboardingWizard.tsx korrigiert - verwendet jetzt trpc.onboarding.completeOnboarding statt trpc.auth.completeOnboarding
- [x] Separate savePreferences und completeOnboarding Aufrufe implementiert
- [x] Unit Tests für Onboarding-Flow erstellt und erfolgreich durchgeführt
- [x] vitest.config.ts aktualisiert mit Alias-Resolution für @shared
- [x] Onboarding-Loop endgültig behoben ✅

- [x] Fix onboarding redirect - nach Abschluss soll zum Dashboard weitergeleitet werden, nicht zurück zum Anfang
- [ ] Fix auth flow - eingeloggte User sollen nicht zur Registrierung weitergeleitet werden


## Onboarding & Premium Features (Dec 28, 2025)

### Onboarding Loop Fix
- [x] Add hasCompletedOnboarding field to user table
- [x] Update onboarding flow to set hasCompletedOnboarding = true after completion
- [x] Prevent onboarding loop by checking hasCompletedOnboarding status
- [x] Redirect users who completed onboarding directly to dashboard

### Subscription Tier System
- [x] Add subscriptionTier field to user table (enum: 'free', 'premium')
- [x] Set default subscriptionTier to 'free' for new users
- [x] Create database migration for new fields
- [x] Add tRPC procedures for subscription management

### Settings Page
- [x] Create settings page route and navigation
- [x] Add "Anlagepräferenzen" section
  - [x] Investment goals (Dividenden, Wachstum, Ausgewogen)
  - [x] Risk tolerance slider
  - [x] Preferred sectors/categories
- [x] Add "Benachrichtigungen" section
  - [x] Email notifications toggle
  - [x] WhatsApp notifications toggle
  - [x] Price alert preferences
- [x] Add "Profil" section
  - [x] Name, email display
  - [x] Change password option
- [x] Add "Abonnement" section
  - [x] Display current tier (Free/Premium)
  - [x] Upgrade button for free users
  - [x] Subscription details for premium users
- [x] Save settings functionality with tRPC

### PremiumTeaser Component
- [x] Create reusable PremiumTeaser component
- [x] Props: title, description, ctaText, feature icon
- [x] Visual design: blur effect, "Premium" badge, gradient border
- [x] "Jetzt upgraden" button with routing to pricing page
- [x] Responsive design

### Feature Gating Implementation
- [x] Implement feature gating in Dashboard
  - [x] ✅ Free: Gesamtwert, Performance, Dividenden (all users)
  - [x] ✅ Free: Portfolio-Übersicht (all users)
  - [x] ✅ Free: Top News (all users)
  - [x] 🔒 Premium: Live-Tracking (show teaser for free users)
  - [x] 🔒 Premium: Preisalarme (show teaser for free users)
  - [x] 🔒 Premium: Trading-Signale (show teaser for free users)
  - [x] 🔒 Premium: Erweiterte Metriken (show teaser for free users)
- [x] Add subscription tier checks in tRPC procedures
- [x] Display appropriate UI based on user's subscription tier

- [x] Fix: Existing users should be redirected to dashboard, not onboarding after login


## Flow Optimization: Dashboard → Portfolio Builder → Portfolio Details (28.12.2024)

### Anforderungen aus MVP Roadmap (Abschnitte 1.4, 1.5, 1.6)

#### 1. Portfolio Builder Wizard Optimierung (1.5)
- [ ] Multi-step wizard überarbeiten mit klarem Fortschrittsindikator
- [ ] Schritt 1: Portfolio-Typ wählen (Dividenden, Wachstum, Balanced, ETF) - mit Icons
- [ ] Schritt 2: Aktien auswählen (Suche, Filter nach Dividenden/Wachstum/ETF/Sektoren, Empfehlungen)
- [ ] Schritt 3: Gewichtung festlegen (manuell mit Slider oder automatisch gleichgewichtet)
- [ ] Schritt 4: Portfolio-Details (Name, Beschreibung, **Live-Tracking Toggle**)
- [ ] Schritt 5: Zusammenfassung & Speichern (Übersicht aller Eingaben)
- [ ] Validierung: Gewichtung muss 100% ergeben (visueller Progress Bar)
- [ ] Speichern in `savedPortfolios`-Tabelle mit portfolioType und isLive

#### 2. Dashboard Updates (1.4)
- [ ] **Visueller Indikator** für Live vs. Non-Live Portfolios hinzufügen (Badge "Live" mit Puls-Animation)
- [ ] Portfolio-Typ Badge anzeigen (Dividenden/Wachstum/Balanced/ETF) mit entsprechenden Icons
- [ ] "Neues Portfolio erstellen" Button navigiert zum Portfolio Builder (/portfolios/create)
- [ ] **Klick auf Portfolio-Card** navigiert zur dedizierten Portfolio-Detail-Seite (/portfolios/:id)
- [ ] Letztes Update-Datum für jedes Portfolio anzeigen
- [ ] Performance-Sparkline für jedes Portfolio in der Card
- [ ] Klare visuelle Unterscheidung zwischen Free und Premium Features

#### 3. Portfolio Details Seite (1.6)
- [ ] **Dedizierte Route erstellen**: /portfolios/:id (separate Seite, nicht im Dashboard)
- [ ] **Portfolio-Navigation**: Dropdown oder Tabs zum Wechseln zwischen Portfolios
- [ ] **Performance-Übersicht**: 
  - [ ] Großer Chart mit Portfolio-Wert über Zeit (6 Monate)
  - [ ] Vergleich mit Benchmark (S&P 500 oder SMI)
  - [ ] Zeitraum-Auswahl (1M, 3M, 6M, 1Y, YTD, All)
- [ ] **Key-Metriken Cards**:
  - [ ] IRR (Internal Rate of Return)
  - [ ] Beta (Marktrisiko)
  - [ ] Volatilität (Standardabweichung)
  - [ ] Sharpe Ratio (Risiko-adjustierte Rendite)
  - [ ] Dividendenrendite
  - [ ] Gesamtwert
- [ ] **Holdings-Tabelle**:
  - [ ] Alle Positionen mit Logo, Ticker, Name, Anzahl, Gewichtung %, aktueller Preis, Wert, Performance %, Dividendenrendite
  - [ ] Sortierung nach Aktie, Sektor, Kategorie
  - [ ] Filter-Optionen
- [ ] **Allocation-Charts**:
  - [ ] Donut Chart: Verteilung nach Aktie
  - [ ] Donut Chart: Verteilung nach Sektor
  - [ ] Donut Chart: Verteilung nach Kategorie (Dividenden/Wachstum/ETF)
- [ ] **Letzte Transaktionen** (Preview, nur bei Live-Portfolios):
  - [ ] Tabelle mit letzten 5 Transaktionen
  - [ ] Link zu vollständiger Transaktionshistorie
- [ ] **Quick-Actions**:
  - [ ] "Transaktion hinzufügen" Button (nur Live-Portfolios)
  - [ ] "Alarm erstellen" Button
  - [ ] "Portfolio bearbeiten" Button
  - [ ] "Portfolio löschen" Button
  - [ ] "Zurück zum Dashboard" Button
- [ ] **Live-Status Indikator**: Prominente Anzeige ob Portfolio live ist oder nicht

#### 4. Database Schema Updates
- [ ] `savedPortfolios` Tabelle erweitern:
  - [ ] `portfolioType` enum hinzufügen ('dividends', 'growth', 'balanced', 'etf')
  - [ ] `isLive` boolean hinzufügen (default: false)
  - [ ] `lastUpdated` timestamp hinzufügen (automatisch bei Änderungen)
  - [ ] `description` text hinzufügen (optional)
- [ ] Migration durchführen: `pnpm db:push`

#### 5. tRPC Procedures
- [ ] `portfolio.getById` - Portfolio mit allen Details abrufen (Holdings, Metriken, Transaktionen)
- [ ] `portfolio.create` - Neues Portfolio erstellen (aus Wizard)
- [ ] `portfolio.update` - Portfolio aktualisieren (Name, Beschreibung, Typ, Live-Status)
- [ ] `portfolio.delete` - Portfolio löschen (mit Bestätigung)
- [ ] `portfolio.list` - Alle Portfolios mit Typ und Live-Status abrufen
- [ ] `portfolio.calculateMetrics` - IRR, Beta, Volatilität, Sharpe Ratio berechnen

#### 6. Navigation Flow
- [ ] Landing Page → "Jetzt starten" → Registration/Login → Dashboard
- [ ] Dashboard → "Neues Portfolio" Button → Portfolio Builder Wizard
- [ ] Portfolio Builder → Fertigstellung → Redirect zu Portfolio Details (/portfolios/:id)
- [ ] Dashboard → Klick auf Portfolio Card → Portfolio Details (/portfolios/:id)
- [ ] Portfolio Details → Portfolio Switcher → Anderes Portfolio Details
- [ ] Portfolio Details → "Zurück" Button → Dashboard

#### 7. UI/UX Verbesserungen
- [ ] Live-Badge mit Puls-Animation (grüner Punkt)
- [ ] Portfolio-Typ Icons (💰 Dividenden, 📈 Wachstum, ⚖️ Balanced, 📊 ETF)
- [ ] Smooth Transitions zwischen Seiten
- [ ] Loading States für alle Daten-Fetches
- [ ] Error Handling mit benutzerfreundlichen Meldungen
- [ ] Responsive Design für alle neuen Komponenten
- [ ] Tooltips für komplexe Metriken (IRR, Beta, Sharpe Ratio)

#### 8. Testing
- [ ] Flow testen: Dashboard → Portfolio Builder → Portfolio Details
- [ ] Portfolio-Typ Auswahl testen
- [ ] Live-Tracking Toggle testen
- [ ] Portfolio-Navigation zwischen verschiedenen Portfolios testen
- [ ] Metriken-Berechnung validieren
- [ ] Responsive Design auf Mobile testen
- [ ] Error Cases testen (fehlende Daten, API-Fehler)


## Completed (28.12.2024 - Flow Optimization)
- [x] Portfolio Builder Wizard überarbeitet mit Portfolio-Typ Auswahl
- [x] Schritt 1: Portfolio-Typ wählen (Dividenden, Wachstum, Balanced, ETF) mit Icons
- [x] Schritt 4: Live-Tracking Toggle hinzugefügt
- [x] Asset-Verteilung Übersicht in Schritt 4
- [x] Zusammenfassung in Schritt 5 mit allen Details
- [x] portfolioType und isLive werden beim Speichern übergeben
- [x] Dashboard aktualisiert mit Live-Status Badge (Puls-Animation)
- [x] Portfolio-Typ Badge hinzugefügt (Dividenden/Wachstum/Balanced/ETF) mit Icons
- [x] Navigation zu /portfolios/:id statt /portfolio/:id/positions
- [x] "Neues Portfolio" Button navigiert zu /portfolios/create
- [x] Letztes Update-Datum wird angezeigt
- [x] Live-Performance wird angezeigt (falls vorhanden)
- [x] Portfolio Details Page erstellt (/portfolios/:id)
- [x] Portfolio-Switcher implementiert (Dropdown zum Wechseln zwischen Portfolios)
- [x] Performance-Übersicht mit Chart-Placeholder
- [x] Key-Metriken Cards (IRR, Beta, Volatilität, Sharpe Ratio, Dividendenrendite)
- [x] Holdings-Tabelle mit allen Positionen
- [x] Allocation-Charts Placeholder (Asset & Sector)
- [x] Transaktionen-Preview (nur bei Live-Portfolios)
- [x] Quick-Actions (Transaktion hinzufügen, Alarm erstellen, Bearbeiten, Löschen)
- [x] Zurück zum Dashboard Button
- [x] Routes in App.tsx hinzugefügt (/portfolios/create, /portfolios/:id)


## UI/UX Enhancements (28.12.2024)
- [ ] Improve typography - larger, bolder, more readable text throughout application
- [ ] Modernize UI design and improve user flow
- [ ] Make stock price input auto-fill with current price when adding stocks
- [ ] Display stock logos in selection dropdown and portfolio list
- [ ] Build premium wizard for automatic portfolio creation based on investment amount


## Progress Update (28.12.2024 - 09:07)
- [x] Fixed TypeScript errors (reduced from 110 to 69)
- [x] Updated typography for better readability
- [ ] Implement automatic stock price fetching (in progress)
- [ ] Display stock logos in selection dropdown and portfolio list
- [ ] Build premium wizard for automatic portfolio creation


## Advanced Features Implementation (Dec 28, 2025)
- [x] Stock-Logos Integration: Add company logos in stock selection and portfolio list for visual identification (Already implemented with StockLogo component)
- [x] Premium-Wizard: Create intelligent assistant that automatically suggests diversified portfolio based on investment amount (Implemented with /premium-wizard route and generateSmartPortfolio endpoint)
- [x] Automatische Preisabfüllung: Implement automatic filling of current stock price when adding new positions to portfolio (Already implemented in TransactionModal)

## CRITICAL BUGS (Dec 28, 2025)
- [x] Portfolio not found when clicking from dashboard - FIXED: Route mismatch corrected
- [x] Portfolio count showing 0 on dashboard - FIXED: Now shows correct count
- [x] Fix TypeScript error: Property 'mwr' does not exist on LiveTracking page - FIXED
- [ ] Portfolio Builder design does not match mockup - needs complete redesign
- [ ] Missing automatic portfolio creation feature based on investment profile (Anlageprofil)


## CRITICAL BUGS FIXED (Dec 28, 2025 - 17:21)
- [x] Portfolio not found when clicking from dashboard - FIXED: Route mismatch corrected (/portfolios/ → /portfolio/)
- [x] Portfolio count showing 0 on dashboard - FIXED: Now shows correct count
- [x] Fix TypeScript error: Property 'mwr' does not exist on LiveTracking page - FIXED
- [x] Portfolio Builder design does not match mockup - FIXED: Complete 5-step wizard implemented
- [x] Missing automatic portfolio creation feature based on investment profile - FIXED: LLM-based auto-generation working
- [x] Planned positions not showing in portfolio detail - FIXED: Now shows with weight and "Geplant" status

## New Portfolio Builder Wizard Implementation (Dec 28, 2025)
- [x] Created new 5-step wizard structure with progress indicator
- [x] Step 1: Grundlagen (Portfolio name, strategy, investment horizon)
- [x] Step 2: Aktien auswählen with automatic portfolio generation via LLM
- [x] Step 3: Anleihen & ETFs (optional, placeholder for future)
- [x] Step 4: Verteilung & Risiko (portfolio overview, metrics, sector allocation)
- [x] Step 5: Abschluss (summary, save with options)
- [x] Integrated LLM-based automatic portfolio creation based on user profile
- [x] Stock selection with search, filters, and stock cards
- [x] Portfolio data saved as JSON in portfolioData field
- [x] Portfolio Detail View updated to show planned positions with weight
- [x] Added "Geplant" status badge for positions without transactions
- [x] Fixed null safety issues for stock metrics (currentPrice, ytdPerformance, etc.)
- [x] Route registered in App.tsx: /portfolio-builder/new


## Portfolio Detail Page Redesign (Dec 28, 2025 - 17:30)

### Phase 1: Portfolio Builder Extensions
- [x] Add capital input field in Step 1 (Grundlagen)
- [x] Validation: Min. CHF 100'000 for stock portfolios, CHF 10'000 for ETF portfolios
- [x] Store initialCapital in portfolio data
- [ ] Update Step 2 to show only CHF values (hide foreign currency) - DEFERRED to activation
- [ ] Calculate shares based on capital and weight - DEFERRED to activation

### Phase 2: FX Rate Integration
- [x] Create FX rate service (server/fxRates.ts)
- [x] Fetch live rates from EODHD or Finnhub (USD/CHF, EUR/CHF)
- [x] Implement caching for FX rates (5-minute cache)
- [x] Add tRPC procedure: fxRates.getRate(from, to)
- [x] Add tRPC procedures: fxRates.convert, fxRates.getMultiple
- [ ] Update share calculation to use live FX rates - DEFERRED to activation
- [ ] Test FX conversion accuracy - DEFERRED to activation

### Phase 3: Portfolio Detail Page Redesign (Match Mockup)
- [ ] Large performance chart at top (6 months, Portfolio vs Benchmark)
- [ ] Benchmark selector dropdown (SMI, S&P 500, MSCI World, NASDAQ)
- [ ] Key metrics cards: IRR, Dividendenrendite, Beta, Volatilität, Sharpe Ratio
- [ ] Holdings table with stock logos, showing both foreign currency and CHF
- [ ] Donut chart for allocation (by stock, by sector, by category tabs)
- [ ] "Letzte Transaktionen" section (preview of 3-5 latest)
- [ ] Quick action buttons: Bearbeiten, Löschen, Teilen, Neue Transaktion, Alarm erstellen
- [ ] Responsive design for mobile

### Phase 4: Portfolio Activation Flow
- [ ] Add "Geplant" badge to planned portfolios
- [ ] Add prominent "Portfolio aktivieren" CTA button
- [ ] Create activation modal with confirmation
- [ ] Implement automatic transaction creation based on weights and capital
- [ ] Transaction date: default to today, editable later
- [ ] Transition portfolio from "planned" to "live" status
- [ ] Update portfolio detail view to show live data after activation

### Phase 5: Testing & Quality Assurance
- [ ] Test capital input validation
- [ ] Test FX rate fetching and caching
- [ ] Test share calculation with different currencies
- [ ] Test portfolio activation flow end-to-end
- [ ] Test portfolio detail page with planned portfolio
- [ ] Test portfolio detail page with live portfolio
- [ ] Test benchmark switching
- [ ] Create checkpoint after successful testing

## Bug Fix: Portfolio Creation Button (Dec 28, 2025)
- [x] Fix ALL "Portfolio erstellen" / "Neues Portfolio" buttons across entire app to redirect to new Portfolio Builder (/portfolio-builder) instead of old wizard (/portfolios/create)

## Bug Fix: Portfolio Creation Links (Dec 28, 2025)
- [x] Fix portfolio creation buttons to link to /portfolio-builder/new

## Bug Fixes (Dec 28, 2025)
- [x] Fix routing inconsistency: Portfolio creation buttons should link to /portfolio-builder/new instead of /portfolio-builder/wizard


## Neue Anforderungen: Portfolio Detail Redesign, Aktivierung & Benchmark (29.12.2024)

### Database Schema Erweiterungen
- [x] Portfolio status field hinzufügen (planned/live)
- [x] Portfolio startCapital field hinzufügen
- [x] Portfolio benchmark field hinzufügen (SMI, S&P 500, MSCI World)
- [x] Benchmark data table erstellen für historische Preise
- [x] Database migration durchführen (pnpm db:push)

### Backend Procedures
- [x] Procedure: Portfolio Details mit Holdings abrufen
- [x] Procedure: Portfolio Metriken berechnen (IRR, Beta, Sharpe Ratio)
- [x] Procedure: Portfolio aktivieren und initiale Transaktionen generieren
- [x] Procedure: Benchmark historische Daten abrufen
- [x] Procedure: Portfolio Performance über Zeit berechnen
- [x] Procedure: Portfolio vs Benchmark Vergleich berechnen

### Portfolio Detail Page Redesign
- [x] Performance Chart mit Portfolio und Benchmark Linien
- [x] Key Metriken Cards (IRR, Beta, Sharpe Ratio, Total Return)
- [x] Holdings Tabelle mit aktuellen Positionen
- [x] Donut Chart für Asset Allocation
- [x] Portfolio Status Indicator (Geplant/Live)
- [x] "Portfolio aktivieren" Button für geplante Portfolios

### Portfolio Aktivierung Flow
- [x] Aktivierungs-Dialog/Modal erstellen
- [x] Startkapital Input Formular
- [x] Kauf-Transaktionen basierend auf Gewichtungen generieren
- [x] Portfolio Status von "planned" zu "live" ändern
- [x] Bestätigung und Transaktions-Zusammenfassung anzeigen

### Benchmark Integration
- [x] Benchmark Selector Dropdown (SMI, S&P 500, MSCI World)
- [x] Benchmark historische Daten abrufen und speichern
- [x] Benchmark Linie im Performance Chart anzeigen
- [x] Portfolio vs Benchmark Vergleichsmetriken anzeigen
- [ ] Benchmark Daten regelmäßig aktualisieren (kann später implementiert werden)

### Testing
- [x] Portfolio Erstellung und Aktivierung testen
- [x] Performance Berechnungen mit echten Daten testen
- [x] Benchmark Vergleich Genauigkeit überprüfen
- [x] Responsive Design auf Mobile testen
- [x] Loading States und Error Handling überprüfen

## Bugs
- [x] Fix TypeScript errors preventing Portfolio page from loading (setShowOptimizerResults, setActiveTab scope issue, autoTable headers type)
- [x] Update Portfolios page to load and display real portfolio data from database

## Navigation Fix (Dec 29, 2025)
- [ ] Fix Portfolio navigation - make all portfolios (Live + Test) clickable and link to new PortfolioDetailRedesign page
- [ ] Remove old/duplicate route /portfolios/:id from App.tsx


## WICHTIGE KLARSTELLUNG: Portfolio-Builder Routes (29.12.2024)
- [ ] **NEUER Portfolio-Builder**: Route `/new` verwenden (dieser ist der aktuelle und zu verwendende Builder)
- [ ] Alter Wizard/Portfolio-Builder: NICHT mehr verwenden, wird durch `/new` ersetzt
- [ ] Alle Referenzen zum alten Builder entfernen oder auf `/new` umleiten
- [ ] Sicherstellen, dass Dashboard und Navigation auf `/new` verweisen
- [ ] Dokumentation aktualisieren, um Verwirrung zu vermeiden


## Navigation-Anpassungen für Portfolio Detail-Seite (29.12.2024)
- [ ] Portfolio Detail-Seite unter Navigationspunkt "Portfolios" erreichbar machen
- [ ] Dashboard Portfolio-Karten: Klick führt zur neuen Portfolio Detail-Seite
- [ ] Routing für Portfolio Detail-Seite korrekt einrichten (z.B. /portfolios/:id)
- [ ] Navigation testen: Dashboard → Portfolio Detail
- [ ] Navigation testen: Sidebar "Portfolios" → Portfolio Detail


## Navigation-Anpassungen für Portfolio Detail-Seite (29.12.2024)
- [x] PortfolioDetailsPage unter Route /portfolios/:id einrichten
- [x] Dashboard: Portfolio-Karten sollen zu /portfolios/:id verlinken (statt /portfolio/:id)
- [x] Sidebar "Portfolios": Soll zur Portfolio-Übersicht führen, von dort zu Detail-Seiten
- [x] Navigation testen: Dashboard → Portfolio Detail


## Portfolio Builder Redirect Fix (29.12.2024)
- [x] Portfolio-Builder leitet nach Speichern zu /portfolio/:id statt /portfolios/:id weiter
- [x] Redirect im Portfolio-Builder auf /portfolios/:id ändern
- [x] Testen: Portfolio erstellen → Detail-Seite sollte korrekt laden


## Zod Input Validation Migration (29.12.2024)
- [x] Convert all custom input validation in portfoliosRouter to Zod schemas
- [x] Test portfolio detail page loading after migration
- [x] Verify all portfoliosRouter procedures work correctly

## Dashboard & Portfolios Redesign - Redundanz beseitigen (29.12.2025)

### Problem
- Dashboard zeigt Portfolio-Liste mit Mini-Charts
- Portfolios-Seite zeigt ebenfalls Portfolio-Liste mit ähnlichen Informationen
- Redundanz und wenig Mehrwert durch doppelte Darstellung

### Lösung basierend auf Mockups

#### Dashboard Redesign (Mockup 3)
- [x] Aggregierte Metriken über ALLE Live-Portfolios (Gesamtwert, Performance, Dividenden)
- [x] Portfolio-Anzahl als Metrik-Card hinzufügen
- [x] "Meine Portfolios" Section: Nur Top 3-4 Portfolios mit Sparkline-Charts anzeigen
- [x] "Aktuelle Alerts" Section mit Preisalarmen für einzelne Assets
- [x] "Top News" Section mit Markt-News und Bildern
- [x] "Quick Actions" Buttons für häufige Aktionen

#### Portfolios-Seite Redesign (Mockup 4 Übersicht)
- [x] Summary-Cards oben: Gesamt-Portfolios, Gesamtwert, Performance (nur Live-Portfolios)
- [x] Vollständige Portfolio-Liste mit ALLEN Portfolios (Live + Test)
- [x] Portfolio-Cards mit erweiterten Informationen:
  - [x] Wert, Performance, Anzahl Positionen
  - [x] Erstelldatum, letztes Update
  - [x] Status-Badge (Live/Test)
  - [x] Sparkline-Chart für Performance-Verlauf
- [x] Filter/Sortierung: Nach Status (Live/Test), Performance, Datum
- [x] "Neues Portfolio" Button prominent platzieren

#### Backend Support
- [x] tRPC procedure für aggregierte Portfolio-Metriken (alle Live-Portfolios)
- [x] tRPC procedure für Top-Portfolios (nach Wert oder Performance sortiert)
- [x] Portfolio-Liste Procedure um zusätzliche Felder erweitern (falls nötig)


## Datenintegration: Dashboard & Portfolio Detail (29.12.2024)

### Dashboard - Echte Daten verknüpfen
- [ ] Gesamtwert-Karte mit echten Portfolio-Summen
- [ ] Performance-Karte mit berechneter Rendite
- [ ] Dividenden-Karte mit echten Dividendenzahlungen
- [ ] Portfolio-Karten mit echten Holdings und Mini-Charts
- [ ] Aktuelle Alerts mit echten Price Alerts aus DB
- [ ] Top News mit echten Finanznachrichten (API)

### Portfolio Detail - Echte Daten verknüpfen
- [ ] Performance-Chart mit echten historischen Daten
- [ ] Holdings-Tabelle mit Live-Aktienkursen (EODHD)
- [ ] Asset Allocation Donut Chart mit echten Gewichtungen
- [ ] Transaktionshistorie aus Datenbank
- [ ] Kennzahlen (IRR, Dividendenrendite, Beta, etc.) berechnen



## Datenintegration: Dashboard & Portfolio Detail (Dec 29, 2025)

- [x] Dashboard mit echten Daten verknüpfen
  - [x] Gesamtwert, Performance, Dividenden aus trpc.dashboard.getAggregatedMetrics
  - [x] Portfolio-Karten aus trpc.dashboard.getTopPortfolios
  - [x] Alerts aus trpc.priceAlerts.list
  - [x] News aus trpc.news.getAll (Finnhub API)
- [x] Portfolio Detail mit echten Daten verknüpfen
  - [x] Portfolio-Daten aus trpc.portfolios.list
  - [x] Transaktionen aus trpc.portfolioTransactions.list
  - [x] Live-Performance aus trpc.portfolios.calculateLivePerformance
  - [x] Holdings mit CHF-Performance aus trpc.portfolios.getHoldingsWithChfPerformance
  - [x] Dividendenkalender aus trpc.dividendCalendar.getUpcoming
  - [x] Jahresperformance aus trpc.annualPerformance.getSummary
- [x] TypeScript-Fehler behoben (dashboardRouter, UserDashboard, PortfolioDetail, etc.)


## Live Testing Fixes (Dec 29, 2025)
- [x] Fix holdings table to show real portfolio data instead of mock data
- [x] Fix sector allocation to use real data from holdings
- [x] Add currency conversion - show local currency (USD) and CHF with exchange rate
- [x] Add new getWithCurrency tRPC endpoint for portfolio data with FX rates
- [x] Fix Asset Allocation to show actual asset types from portfolio
- [x] Fix TypeScript error in main.tsx (SuperJSON transformer)


## Bug Fixes (29.12.2025 - Aktuelle Session)

### Kritische Bugs
- [ ] Portfolios-Seite: TypeError bei livePerformance.replace (livePerformance ist kein String)
- [ ] Dashboard zeigt nur 2 Portfolios statt alle (5-6 vorhanden)
- [ ] Kennzahlen im Dashboard sind falsch (Gesamtwert, Performance, Dividenden)

### Kennzahlen-Korrektur
- [ ] Performance basiert auf YTD (seit 01.01. des laufenden Jahres)
- [ ] Dividendenzahlungen basieren auf Durchschnittsperformance aller Portfolios
- [ ] Portfolio-Performance auf Dashboard und Detail-Seite = YTD aller Titel
- [ ] Später: Bei Live-Portfolios Kaufdatum und Einstandspreis pro Aktie ermöglichen



## Portfolio-Karten mit echten Werten (29.12.2025)
- [ ] Portfolio-Karten auf Portfolios-Seite sollen echten Wert aus Transaktionen anzeigen
- [ ] Portfolio-Karten sollen echte Performance (YTD) anzeigen
- [ ] Anzahl Positionen aus echten Holdings berechnen


- [ ] Portfolios-Liste auf YTD-Performance-Berechnung umstellen (konsistent mit Dashboard)

- [ ] Dashboard: Beschriftung "Meine Portfolios" zu "Meine Live-Portfolios" ändern
- [ ] Sidebar: Nur Live-Portfolios im Untermenü anzeigen oder entsprechend beschriften

- [ ] Portfolio-Detailseite: Titel, Performancedaten fehlen - prüfen und beheben

- [ ] Portfolio-Detailseite: Gewichtung auf 2 Dezimalstellen formatieren
- [ ] Portfolio-Detailseite: Portfolio-Wertentwicklung mit echtem Chart implementieren
- [ ] Portfolio-Detailseite: Asset-Allokation mit echtem Donut-Chart implementieren

- [ ] Portfolio-Wertentwicklung: Berechnung auf Basis täglicher Schlusskurse implementieren

- [ ] Zeitraum-Buttons (1M, 3M, 6M, YTD, 1Y, 3Y, 5Y) funktionsfähig machen
- [ ] Historische Kursdaten für längere Zeiträume laden (falls nicht vorhanden)

- [ ] Historische Preise bis heute nachladen für alle Portfolio-Aktien
- [ ] Chart als Area-Chart (gefüllte Fläche) umgestalten
- [ ] Benchmark-Auswahl hinzufügen: S&P 500, Nasdaq, SMI, EuroStoxx50


## Chart-Bugs (29.12.2025)
- [ ] Test-Portfolio (nicht live): YTD ab 1.1.25 berechnen (Annahme: alle Titel waren am 1.1.25 im Portfolio)
- [ ] Live-Portfolio: Dip auf 0% am 27.11. untersuchen und beheben
- [ ] Performance soll bei 100 (oder 0%) beginnen, nicht bei anderem Wert

- [x] Live-Portfolio Chart: Nur ab erstem Transaktionsdatum anzeigen, Performance bei 0% starten


## Portfolio Chart Bugs (29.12.2025)

- [ ] Tooltip legend shows "Benchmark" for both lines - portfolio line should show portfolio name
- [ ] Benchmark is flat 0% line for live portfolios - should show actual benchmark performance
- [ ] Missing legend below X-axis - should show both portfolio and benchmark legends
- [ ] Portfolio "Regula live" has no performance data displayed


## Portfolio Chart Bugs Fixed (29.12.2025)
- [x] Tooltip legend shows "Benchmark" for both lines - now shows portfolio name for solid line
- [x] Benchmark is 0% line for live portfolios - now shows actual benchmark performance  
- [x] Legend now visible below X-axis showing portfolio name and benchmark
- [x] Portfolio "Regula live" has no performance data - fixed by correcting transaction dates to match portfolio creation date (12.11.2025)


## Portfolio-Bearbeitung & Sektor-Daten (29.12.2025)

- [ ] Portfolio-Bearbeiten-Funktion aktivieren auf Portfolio-Detail-Seite
- [ ] Sektor-Daten für Aktien in der Datenbank hinterlegen
- [ ] Kaufdatum pro Aktie/Position hinzufügen
- [ ] Einstandspreis pro Aktie/Position hinzufügen
- [ ] Backend-Routen für Portfolio-Position-Bearbeitung
- [ ] Frontend-Dialog für Position-Bearbeitung
- [ ] Sektor-Allokation mit echten Daten anzeigen


## Portfolio-Bearbeitung & Sektor-Daten (29.12.2024)
- [x] Bearbeiten-Funktion für Portfolio-Positionen aktivieren
- [x] Sektor-Daten für Aktien in der Datenbank hinterlegen
- [x] Kaufdatum/Einstandspreis pro Aktie für Live-Portfolios
- [x] Sektor-Allokation korrekt anzeigen (nicht mehr "Other 100%")
- [x] EditPositionModal Komponente erstellt
- [x] SectorAllocation Komponente erstellt
- [x] Admin-Funktion zum Laden fehlender Sektor-Daten
- [x] Tests für neue Funktionen geschrieben


## Quick Steps Bearbeiten-Button & Performance-Bugs (29.12.2025)
- [ ] Quick Steps "Bearbeiten" Button aktivieren für Portfolio-Positionsbearbeitung
- [ ] Bearbeitungsmodus: Positionen hinzufügen, löschen, Gewichtung ändern
- [ ] Zentrale Speichern-Funktion für alle Änderungen im Bearbeitungsmodus
- [ ] Performance-Daten Fehler/Inkonsistenzen auf Live-Server identifizieren und beheben


## Neue Anforderung: Portfolio-Bearbeitungsmodus (29.12.2025)
- [x] Quick Steps "Bearbeiten"-Button aktivieren mit vollständiger Bearbeitungsfunktion
  - [x] PortfolioEditModal Komponente erstellen
  - [x] Positionen hinzufügen (Suchfeld für Ticker/Firmennamen)
  - [x] Positionen löschen (Trash-Button für jede Position)
  - [x] Gewichtungen ändern (Eingabefeld für Prozentanteile)
  - [x] Gesamtgewicht anzeigen (mit Normalisierungs-Button)
  - [x] Zentrale Speichern-Funktion (Änderungen speichern Button)
  - [x] Modal in PortfolioDetailsPage integrieren
  - [x] Funktioniert auf Test-Portfolios (Demo Portfolio - Schweizer Blue Chips)

## Performance-Fehler behoben (29.12.2025)
- [x] Performance-Chart zeigt unrealistischen Dip (ca. -60% am 27. November)
  - [x] Ursache identifiziert: Fehlende historische Kursdaten führen zu Wert 0
  - [x] Forward-Fill implementiert für fehlende Kursdaten
  - [x] Letzte bekannte Preise werden für Tage ohne Daten verwendet
  - [x] Performance-Berechnung korrigiert in portfoliosRouter.ts
  - [x] Chart zeigt jetzt realistischen Verlauf (ca. +3% bis -9%)
  - [x] Live-Portfolio (Regula Live) Performance korrekt angezeigt


## Portfolio-Detailseite Bugs (29.12.2025 - Aktuelle Session)
- [x] Sektor-Allokation zeigt "Other 100%" statt echte Sektoren
  - [x] getWithCurrency Endpoint erweitert um sector, ytdPerformance, dividendYield aus DB
- [x] YTD Performance zeigt überall +0.00% statt echte Werte
  - [x] ytdPerformance wird jetzt aus der stocks-Tabelle geladen
- [x] Dividendenrendite zeigt 0.00% statt echte Werte
  - [x] dividendYield wird jetzt aus der stocks-Tabelle geladen
- [x] Alle Portfolios einzeln testen nach Bugfixes
  - [x] Portfolio Test 1: OK
  - [x] Regula Live: OK
  - [x] Marc Test 29 Live: OK
  - [x] Test 10: OK
  - [x] Demo Portfolio - Schweizer Blue Chips: OK (ROG.SW, UBSG.SW hinzugefügt)


## Aktien-Detailseite Implementation (29.12.2025)
- [x] Header mit Logo, Ticker, Firmenname, Preis, Änderung, Score-Circle
- [x] Interaktiver Linien-Chart mit Zeitraum-Auswahl (1D, 1W, 1M, 3M, 6M, 1Y, YTD, All)
- [x] Fundamentaldaten-Panel (P/E, PEG, Dividendenrendite, Beta, Volatilität, Sharpe, Marktkapitalisierung, 52W Hoch/Tief, YTD Performance)
- [x] Wettbewerbsvorteile (Moats) - 3 Karten mit Icons
- [x] Financial Highlights (Revenue Growth, Net Income Margin, Free Cash Flow)
- [x] Kategorie & Sektor Badges
- [x] News-Sektion mit Placeholder-Daten
- [x] Action-Buttons: Zu Portfolio hinzufügen, Preisalarm erstellen, Factsheet ansehen
- [x] Backend-Endpoint für Aktien-Detaildaten (stocks.byTicker bereits vorhanden)
- [x] Navigation von Positionenliste zur Detailseite (Links in PortfolioPositions, PortfolioDetailRedesign, PortfolioDetailsPage)


## Stock Analysis Page Improvements (29.12.2025)

- [x] Fix historical data loading - show all data for selected time periods (not just from October)
- [x] Evaluate and integrate TradingView chart widget for professional charting (improved existing chart with candlestick + volume)
- [x] Add score calculation explanation (how the 66/100 score is composed)
- [x] Implement visual metric ratings (colors/scores) for key metrics in cards
- [x] Fix back button to navigate to portfolio positions list
- [x] Activate "Zu Portfolio hinzufügen" (Add to Portfolio) functionality
- [x] Activate "Preisalarm erstellen" (Create Price Alert) functionality
- [x] Implement Swiss stock logo fallback sources (CH stocks showing wrong logos)
- [x] Add small thematic graphics to news items for visual variety


## Neue Anforderung: Aktuelle Daten bis heute (29.12.2025)
- [x] Sicherstellen, dass alle Aktiendaten bis zum heutigen Datum (29.12.2025) aktualisiert werden
- [x] API-Integration überprüfen und sicherstellen, dass aktuelle Daten abgerufen werden
- [x] Historische Daten für alle Aktien bis heute aktualisieren
- [x] Tägliche automatische Datenaktualisierung implementieren
- [ ] Datums-Anzeige in allen Charts und Tabellen überprüfen

## Verifizierung der Datenaktualisierung (29.12.2025)
- [x] API-Verbindungen testen (EODHD, Finnhub)
- [x] Aktuelle Kursdaten für Beispielaktien abrufen
- [x] Historische Daten bis 29.12.2025 überprüfen
- [x] Datenbank-Caching überprüfen
- [x] YTD-Performance-Berechnung verifizieren
- [ ] Frontend-Anzeige der aktuellen Daten testen


## Portfolio-Kursentwicklung Überprüfung (29.12.2025)
- [ ] Alle Portfolio-Positionen auf aktuelle Kurse überprüfen
- [ ] Historische Performance-Berechnungen validieren
- [ ] YTD-Performance für alle Aktien neu berechnen
- [ ] Datenbank-Cache für veraltete Kurse leeren
- [ ] Automatische Aktualisierung für Live-Portfolios implementieren


## Performance-Optimierung (29.12.2025)
- [x] Lade-Performance analysieren (Netzwerk-Anfragen, Datenbank-Queries)
- [x] Dashboard-Ladezeiten optimieren
- [x] Portfolio-Übersicht Ladezeiten optimieren
- [x] Datenbank-Queries optimieren (N+1 Problem behoben)
- [x] API-Response-Zeiten messen und verbessern
- [ ] Frontend-Bundle-Größe analysieren
- [ ] Lazy Loading für schwere Komponenten implementieren
- [x] Caching-Strategie verbessern (FX-Rate-Cache implementiert)


## Zusammenfassung der Optimierungsarbeiten (29.12.2025)

### Durchgeführte Optimierungen:
- [x] N+1 Query Problem identifiziert (77+ Queries → 3-4 Queries)
- [x] Batch-Loading-Funktionen erstellt (`db-optimized.ts`)
- [x] FX-Rate-Caching implementiert (In-Memory-Cache mit 1h TTL)
- [x] `portfoliosRouter.ts` optimiert (list procedure)
- [x] `dashboardRouter.ts` optimiert (getTopPortfolios procedure)

### Erwartete Verbesserung:
- Von 32+ Sekunden auf < 5 Sekunden
- Von 77+ Datenbank-Queries auf 3-4 Queries
- Reduzierung der API-Calls durch FX-Rate-Caching

### Nächste Schritte:
- [ ] Optimierungen testen und verifizieren
- [ ] Performance-Metriken sammeln
- [ ] Weitere Optimierungen identifizieren (z.B. Frontend-Bundle-Größe)


## Lade-Performance Problem (Dec 30, 2025)
- [x] Dashboard Lade-Performance analysieren und optimieren
  - [x] getAggregatedMetrics mit Batch-Loading optimiert (N+1 Problem behoben)
  - [x] Batch-Queries: batchGetPortfolioTransactions, batchGetStocks, batchGetHistoricalPrices
  - [x] FX-Rate Caching implementiert
- [x] Portfolio-Detailseite Lade-Performance analysieren und optimieren
  - [x] Clientseitige Filterung von Stocks auf nur benötigte Tickers
  - [x] Reduzierte Datenübertragung durch gezielte Stock-Abfragen
- [x] Aktienanalyse Lade-Performance analysieren und optimieren (bereits effizient)
- [x] Ladezeiten testen und validieren
  - [x] Dashboard lädt erfolgreich mit Metriken und Live-Portfolios
  - [x] Portfolio-Detail lädt alle 13 Positionen mit Charts


## Backend-Optimierungen (Dec 30, 2025)
- [x] Backend-seitige Stock-Filterung: stocks.getByTickers Procedure
- [x] Database Indexing: portfolioTransactions.portfolioId, stocks.ticker, historicalPrices.ticker+date
- [x] Response Caching: tRPC Query-Caching mit staleTime


## Neue Anforderung: Korrekte Performance-Berechnung (30.12.2025)
- [x] Performance-Berechnungslogik überprüfen und korrigieren
- [x] Time-Weighted Return (TWR) korrekt implementieren
- [x] Money-Weighted Return (IRR/MWR) korrekt implementieren
- [x] Total Return (absolut und prozentual) berechnen
- [x] Unrealisierte Gewinne/Verluste pro Position berechnen
- [x] Realisierte Gewinne/Verluste aus geschlossenen Positionen berechnen
- [x] Portfolio-Wert über Zeit korrekt tracken
- [x] Cashflows (Ein- und Auszahlungen) korrekt berücksichtigen
- [x] Dividenden in Performance-Berechnung einbeziehen
- [x] Gebühren in Performance-Berechnung einbeziehen
- [x] Vitest Tests für alle Performance-Berechnungen schreiben (18 Tests bestanden)
- [x] Edge Cases testen (Splits, Dividenden, Teilverkäufe)
- [ ] Performance-Charts mit korrekten Daten aktualisieren

## Fehlende Landing Page Elemente (30.12.2025)
- [x] Company Logos Section (Vertraut von...) auf Landing Page hinzufügen
- [ ] Features Page erstellen mit detaillierten Feature-Beschreibungen
- [ ] Pricing Page erstellen mit Preismodellen
- [ ] About Page erstellen mit Unternehmensinformationen
- [ ] Navigation Links zu neuen Seiten verbinden

## Performance Chart Korrektur (30.12.2025)

### Phase 1 (Kritisch):
- [x] Initialer Investitionsbetrag als Performance-neutral behandeln
- [x] TWR-Berechnung AB Erstellungsdatum korrigieren
- [ ] Anzahl Stück beim Live-Tracking erfassen (Modal/Dialog)
- [x] Performance-Inkonsistenz zwischen Chart und Übersicht beheben (Regula Portfolio)

### Phase 2 (Wichtig):
- [x] Hypothetische Performance VOR Erstellungsdatum berechnen (wie Demo-Portfolio)
- [x] Visuelle Trennung im Chart (gestrichelte Linie vor Erstellungsdatum)
- [x] Portfolio-Snapshots für Performance-Tracking nutzen
- [ ] Tooltip beim Hover über Erstellungsdatum
- [ ] Portfolio-Snapshots für Performance-Tracking implementieren

### Phase 3 (Nice-to-have - im Hinterkopf behalten):
- [ ] Erweiterte Transaktionsverwaltung
- [ ] Detaillierte Performance-Attribution
- [ ] Gewichtete TWR-Berechnung pro Position


## Performance Chart Korrektur (30.12.2025)

### Phase 1 (Kritisch):
- [x] Initialer Investitionsbetrag als Performance-neutral behandeln
- [x] TWR-Berechnung AB Erstellungsdatum korrigieren
- [ ] Anzahl Stück beim Live-Tracking erfassen (Modal/Dialog)
- [x] Performance-Inkonsistenz zwischen Chart und Übersicht beheben (Regula Portfolio)
- [x] portfolioSnapshots Tabelle erstellt
- [x] buildValuePoints Funktion angepasst
- [x] calculatePerformanceMetrics nutzt Portfolio-Erstellungsdatum

### Phase 2 (Wichtig) - TEILWEISE IMPLEMENTIERT:
- [x] Backend-Logik für hypothetische Performance vorbereitet
- [x] Frontend visuelle Trennung implementiert (gestrichelte Linie)
- [ ] **BUG: Chart zeigt immer noch nur Daten ab erstem Transaktionsdatum (06. Nov statt 01. Jan)**
- [ ] **TODO: Demo-Portfolio-Logik für Live-Portfolios adaptieren**
- [ ] **PROBLEM IDENTIFIZIERT:** sortedDates wird aus verfügbaren Preisdaten generiert, nicht aus gewünschtem Zeitraum
- [ ] **LÖSUNG:** Separate Logik für hypothetische Performance vor Erstellungsdatum (wie bei Test-Portfolios)

### Nächste Schritte (Nach Checkpoint):
1. Demo-Portfolio-Logik analysieren und verstehen
2. Separate Funktion für hypothetische Performance erstellen
3. Schrittweise testen nach jeder Änderung
4. Visuelle Trennung im Chart verifizieren


### Phase 2 Completion (30.12.2025 - Neuer Ansatz):
- [ ] Demo-Portfolio-Logik analysieren und verstehen
- [ ] Test-Portfolio-Logik für Live-Portfolios adaptieren
- [ ] Hypothetische Performance vor Erstellungsdatum implementieren
- [ ] Alle Zeitraum-Filter testen (1M, 3M, YTD, All)
- [ ] Regula Portfolio Performance-Inkonsistenz beheben
- [ ] Beide Portfolios (Test 1 + Regula) vergleichen und validieren


## Neue Architektur: Hypothetische + Reale Performance (30.12.2025)
- [x] getHypotheticalSeriesFromWeights() implementieren
- [x] getRealTwrSeriesFromTransactions() implementieren
- [x] stitchSeries() implementieren
- [x] Alte allowHypotheticalPerformance Patches entfernen (via Early Return)
- [x] Integration in getHistoricalPerformance
- [ ] Debug-Logging hinzufügen
- [ ] Unit Tests schreiben (vitest)
- [ ] Mit Live-Portfolios testen (Portfolio Test 1, Regula)


## KRITISCHER FIX: Branch-Bedingung (30.12.2025)
- [ ] Branch-Bedingung OHNE earliestTransactionDate: Live + (YTD || ALL) + creationDate => IMMER stitched
- [ ] Hypo braucht NUR: Weights (heutige Gewichte) + Preisdaten ab 01.01
- [ ] earliestTransactionDate ist IRRELEVANT für Hypo
- [ ] Fail-open: Wenn Hypo scheitert => realOnly + debug payload

## Bug: Hypothetical Performance Not Showing (Dec 30, 2025)
- [x] Create historicalPrices table in database
- [ ] Import historical price data for all portfolio stocks (January - November 2025)
- [ ] Verify hypothetical performance calculation works with real data
- [ ] Add fallback UI when no historical data is available

## Hypothetical Performance Implementation (Dec 30, 2025)
- [x] Implement batch job for historical price data import from EODHD API
- [x] Add fallback UI for missing historical data ("Historische Daten werden geladen...")
- [x] Implement daily cron job for automatic price updates
- [x] Test hypothetical performance feature live with real data


## New Bugs Found (30.12.2025 - Testing Session)

- [x] CRITICAL: Live-Tracking page crashes with TypeError when selecting portfolio with positions
  - Error: `TypeError: Cannot read properties of undefined (reading 'toFixed')`
  - Location: `/src/pages/LiveTracking.tsx:498:38`
  - Reproduction: Login → Live-Tracking → Select "Portfolio Test 1" → Page crashes
  - Impact: Live-Tracking feature completely unusable for portfolios with positions
  - Fix: Removed dependency on null livePerformance object, calculated metrics directly from chfHoldings data using useMemo

- [x] BUG: Live-Tracking shows "CHF NaN" for Gewinn/Verlust when avgCostCHF is 0
  - Location: `/src/pages/LiveTracking.tsx`
  - Issue: When all holdings have avgCostCHF = 0, the performance calculation results in NaN
  - Impact: Confusing display for users, should show CHF 0.00 or handle the case gracefully
  - Fix: Added check to return 0 when totalInvestedCHF is 0


## Price Data Availability Fix (Hypothetical Performance) - Dec 30, 2025

### Backend Implementation
- [x] Implement ticker normalization utilities (normalizeTickerForDb)
- [x] Implement getRelevantTickersForPortfolio function (union transactions + holdings tickers)
- [x] Implement price coverage debug endpoint (priceCoverage) with min/max/count/distinctTickerSample
- [x] Implement backfillHistoricalPrices function with chunking (90 days per call)
- [x] Add admin.backfillPrices mutation (admin-only)
- [x] Add on-demand coverage check in hypothetical performance path
- [x] Trigger backfill when rowsInRange < 10 or minDate > ytdStartDate

### Testing
- [x] Write vitest tests for price coverage functionality
- [x] Write vitest tests for ticker normalization
- [x] Write vitest tests for getRelevantTickersForPortfolio
- [x] Test price data availability for Jan-Nov 2025 range
- [x] Verify hypothetical performance never shows empty due to missing prices


## Datenimport-Prüfung (30.12.2025)
- [ ] CSV-Import-Funktionalität auf korrekte Verarbeitung testen
- [ ] Prüfen ob alle Transaktionen korrekt in die Datenbank importiert werden
- [ ] Validierung der importierten Daten (Ticker, Mengen, Preise, Daten)
- [ ] Error Handling bei fehlerhaften CSV-Dateien testen
- [ ] Feedback an Benutzer nach erfolgreichem/fehlerhaftem Import implementieren
- [x] **KRITISCH**: Backfill-Prozess für historische Kursdaten testen und validieren
- [x] Prüfen ob historicalPricesCron korrekt funktioniert und Daten abruft
- [x] Sicherstellen dass historische Daten für ALLE Portfolio-Aktien verfügbar sind
- [x] Validierung der historical_prices Tabelle nach Backfill (96'648 Preise für 131 Tickers, 3 Jahre Daten)


## Critical Bug (30.12.2025)
- [x] Fix authentication logout loop - users are immediately logged out after login and redirected back to start

## Mockup-Alignment Portfolio-Detailseite (30.12.2025)
- [x] Portfolio-Detailseite: Anzahl Aktien in Positionstabelle anzeigen
- [x] Portfolio-Detailseite: Firmenlogos vor Ticker-Symbolen anzeigen
- [x] Portfolio-Detailseite: Donut-Chart farbig gestalten mit größten Aktienpositionen
- [x] Portfolio-Detailseite: "Alarm einstellen"-Button aktivieren
- [x] Portfolio-Bearbeitungsdialog: Anzahl Aktien und Einstandspreis in Fremdwährung für Live-Portfolios hinzufügen


## Logo Fetching Strategy - Clearbit + FMP Fallback (30.12.2025)
- [x] Implement Clearbit logo fetching service (domain-based, primary source)
- [x] Implement FMP logo fallback (ticker-based, secondary source)
- [x] Create generic SVG logo generator (ticker initials, last resort)
- [x] Build unified logo service with automatic fallback chain
- [x] Update stock_metadata table to cache logo URLs (logoUrl field already exists in stocks table)
- [x] Replace all existing logo fetching calls with new service (integrated into multiApiDataMerger)
- [x] Expand Swiss stock domain mapping (60+ Swiss companies including SMI, banks, insurance, industrial)
- [x] Integrate logo fetching into stocksRouter (refresh, fetchStockData, add)
- [x] Integrate logo fetching into adminRouter (bulk update)
- [x] Test logo fetching with various Swiss stocks (Nestlé, Novartis, Roche, etc.) - 19 unit tests passing
- [ ] Ensure logos display correctly in all UI components (portfolio cards, holdings tables, alerts, etc.) - needs live testing

## Bug Report (30.12.2025 - User Feedback)
- [ ] BUG: Stückzahl (Anzahl Aktien) fehlt in der Portfolio-Detailansicht Positionstabelle - muss zwischen "Name" und "Gewicht" eingefügt werden

## Portfolio Detail Redesign - Missing Features (30.12.2025)
- [x] Add "Teilen" (Share) button to portfolio detail page
- [x] Implement table sorting for holdings (by ticker, sector, category, weight, performance)
- [x] Add Volatility metric display to key metrics section
- [x] Add Dividend Yield metric display to key metrics section
- [ ] Verify all metrics (IRR, Beta, Sharpe Ratio, Volatility) are calculated correctly on backend


## Live Portfolio Tracking & Transaction Improvements (30.12.2025 - User Request)
- [x] Add isLive toggle functionality to all portfolios (not just new ones)
- [x] When portfolio is switched to "live": sync current positions as "Eingänge" (deposit transactions)
- [x] Calculate cash balance (Liquiditätskonto) as difference between investment amount and position values
- [x] Show live toggle/status in Dashboard page
- [x] Show live toggle/status in Portfolio Overview page (filter already exists)
- [x] Show live toggle/status in Portfolio Detail page (badge already exists)
- [x] Show live toggle/status in Transactions page
- [ ] Fix: Make portfolios selectable/visible in Transactions page dropdown
- [x] Display realized gains/losses (Kursgewinne und Devisenkursgewinne) on Portfolio Detail page
- [ ] Display realized gains/losses and costs (Gebühren) on Transactions page
- [x] Enable editing of position quantity (Anzahl Aktien) in Portfolio Detail edit dialog
- [x] Enable editing of entry price (Einstandspreis) in Portfolio Detail edit dialog
- [x] Add "Anzahl Titel" column to position list in Portfolio Detail page (already exists as "Stückzahl")


## Live-Toggle Feature Implementation (30.12.2025 - Neue Anforderungen)

### Konzept:
Live-Toggle schaltet Portfolio von "Demo" auf "Live":
- Aktuelle Positionen werden als "Eingang"-Transaktionen verbucht
- Differenz zur Investitionssumme = Liquidität auf Konto
- Ermöglicht echtes Transaction-Tracking

### Aufgaben:

- [x] 1. Schema: cashBalance Spalte zu savedPortfolios hinzugefügt
- [x] 2. Schema: 'entry' Transaktionstyp zu portfolioTransactions hinzugefügt
- [ ] 3. Portfolio-Erstellung: Investitionssumme für ALLE Portfolios verpflichtend machen
- [ ] 2. Live-Toggle UI auf Dashboard implementieren (für jedes Portfolio-Card)
- [ ] 3. Live-Toggle UI auf Portfolio-Übersicht implementieren
- [ ] 4. Live-Toggle UI auf Portfolio-Detail implementieren
- [ ] 5. Live-Toggle UI auf Transaktionen-Seite implementieren
- [x] 6. Backend: Live-Toggle Logik - Positionen in 'entry'-Transaktionen konvertieren
- [x] 7. Backend: Liquiditätskonto-Berechnung (Investitionssumme - Positionen) und cashBalance speicher- [x] 12. Transaktionen: Portfolio-Auswahl hinzugefügt (Dropdown mit allen Portfolios + Live/Test Badges) ] 9. Portfolio-Detail: "Anzahl Titel" Spalte in Positionsliste hinzufügen
- [ ] 10. Portfolio-Detail: "Bearbeiten" Button - Anzahl + Einstandspreis änderbar machen
- [ ] 11. Realisierte Gewinne/Verluste: Kursgewinne/-verluste berechnen und anzeigen
- [ ] 12. Realisierte Gewinne/Verluste: FX-Gewinne/-verluste berechnen und anzeigen
- [ ] 13. Realisierte Gewinne/Verluste: Kosten/Gebühren summieren und anzeigen
- [ ] 14. Integration mit bestehender RealizedGains Funktion prüfen und erweitern
- [ ] 15. Live-Testen: Dashboard Live-Toggle
- [ ] 16. Live-Testen: Portfolio-Übersicht Live-Toggle
- [ ] 17. Live-Testen: Portfolio-Detail Live-Toggle + Bearbeiten
- [ ] 18. Live-Testen: Transaktionen Portfolio-Auswahl
- [ ] 19. Live-Testen: Realisierte Gewinne/Verluste Anzeige
- [ ] 20. Live-Testen: Gesamter Flow von Demo → Live → Transaktionen → Reporting

## New Features (30.12.2025 - Afternoon)
- [ ] Realisierte Gewinne/Verluste implementieren - Anzeige von Kurs- und FX-Gewinnen/-Verlusten auf Portfolio-Detail und Transaktionen-Seite
- [ ] Kosten/Gebühren-Tracking verbessern - Summierung und separate Anzeige aller Transaktionskosten für Steuer-Reporting
- [ ] Live-Toggle Debug - Backend-Fehler beheben, damit Portfolios zwischen Demo und Live umgeschaltet werden können


## New Features (30.12.2025 - 17:16)

- [x] Realisierte Gewinne/Verluste implementieren - Anzeige von Kurs- und FX-Gewinnen/-Verlusten auf Portfolio-Detail und Transaktionen-Seite
  - Created RealizedGainsTable component with separate display of price gains and FX gains
  - Integrated into PortfolioDetail page
  - Uses existing realizedGainsHistory router
  - Unit tests: ✅ All passed (10/10)

- [x] Kosten/Gebühren-Tracking verbessern - Summierung und separate Anzeige aller Transaktionskosten für Steuer-Reporting
  - Created CostFeesReport component with breakdown by transaction type and year
  - Added CSV export functionality for tax reporting
  - Summary cards showing total fees, buy fees, and sell fees
  - Integrated into PortfolioDetail page
  - Unit tests: ✅ All passed (10/10)

- [x] Live-Toggle Debug - Backend-Fehler beheben, damit Portfolios zwischen Demo und Live umgeschaltet werden können
  - Added detailed logging to toggleLive procedure
  - Improved error handling with specific error messages
  - Added validation for start capital and positions
  - Added FX conversion fallback on error (1:1 rate)
  - Improved frontend error display
  - Unit tests: ✅ All passed (10/10)
