# Portfolio Analysis Website TODO

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

### Phase 6: Portfolio Detail View
- [ ] Large performance chart at top (Portfolio vs Benchmark)
- [ ] Show portfolio value, performance %, IRR, dividend yield, beta, volatility, Sharpe ratio
- [ ] Add action buttons: Bearbeiten, Löschen, Teilen
- [ ] Create holdings table with logos, ticker, name, shares, weight %, current price, value, performance %, dividend yield
- [ ] Add donut chart for asset allocation
- [ ] Add "Letzte Transaktionen" section
- [ ] Implement sorting by stock, sector, category
- [ ] Add "Neue Transaktion" button

### Phase 7: Stock Detail Page
- [ ] Large candlestick chart with time period selector (1D, 1W, 1M, 3M, 6M, 1Y, YTD, All)
- [ ] Show current price, change, and score (circular progress)
- [ ] Display key metrics in cards: P/E Ratio, PEG Ratio, Dividendenrendite, Beta, Volatilität, Sharpe Ratio, Marktkapitalisierung, 52W Hoch/Tief, YTD Performance
- [ ] Add "Wettbewerbsvorteile (Moats)" section with numbered cards
- [ ] Create "Financial Highlights" section: Revenue Growth, Net Income Margin, Free Cash Flow
- [ ] Add category tags (Wachstumsaktie, Technology)
- [ ] Implement "News" section with article cards
- [ ] Add action buttons: Zu Portfolio hinzufügen, Preisalarm erstellen, Factsheet ansehen

### Phase 8: Transaction Management
- [ ] Create breadcrumb navigation
- [ ] Add filter tabs: Alle, Kauf, Verkauf, Dividende, Einzahlung, Auszahlung
- [ ] Add time period filter: Alle, Letzte 30 Tage, Letzte 3 Monate, Dieses Jahr
- [ ] Add ticker filter dropdown
- [ ] Show summary cards: Gesamt investiert, Gesamt entnommen, Dividenden erhalten, Gebühren bezahlt
- [ ] Create transaction table with columns: Datum, Typ, Ticker, Anzahl, Preis/Aktie, Währung, Gesamt (CHF), Gebühren, Notizen, Actions
- [ ] Add colored badges for transaction types
- [ ] Implement edit and delete actions
- [ ] Add pagination
- [ ] Add "Neue Transaktion" button

### Phase 9: Price Alerts
- [ ] Create status filter dropdown: Alle, Aktiv, Ausgelöst, Deaktiviert
- [ ] Add ticker filter
- [ ] Show summary cards: Aktive Alarme, Ausgelöst (heute), Deaktiviert
- [ ] Create alerts table: Ticker, Trigger-Typ, Zielpreis, Aktueller Preis, Status, Benachrichtigung (Email/WhatsApp), Erstellt am, Actions
- [ ] Add colored badges for trigger types (Unter CHF X, Über CHF X, Änderung +X%)
- [ ] Implement toggle switches for enable/disable
- [ ] Add edit and delete actions
- [ ] Add "Neuer Alarm" button

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
- [ ] Navigation testen: Dashboard → Portfolio Detail
