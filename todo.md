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
- [ ] Create new hero section with gradient background
- [ ] Add animated portfolio preview mockup
- [ ] Implement feature cards (Portfolio-Builder, Live-Tracking, Preisalarme)
- [ ] Add trust indicators (SSL, Schweizer Datenschutz, Stripe Payment)
- [ ] Add user testimonials section
- [ ] Update navigation (Features, Pricing, About, Login, Get Started)
- [ ] Ensure responsive design for mobile

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
