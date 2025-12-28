# Portfolio Analysis Website - Umfassende Anwendungsanalyse

## 1. Aktuelle Seitenstruktur (aus App.tsx)

### Öffentliche Seiten
- **/** - LandingPage (Haupteinstieg)
- **/register** - Registrierung
- **/login** - Login

### Hauptfunktionen
- **/dashboard** - Haupt-Dashboard
- **/home** - Home/Optimizer
- **/optimizer** - Portfolio-Optimierung

### Portfolio-Management
- **/portfolio/:id** - Portfolio-Detail-Ansicht
- **/portfolio/:id/transactions** - Transaktionshistorie
- **/portfolio/:id/realized-gains** - Realisierte Gewinne/Verluste
- **/portfolio-comparison** - Portfolio-Vergleich
- **/portfolio-builder** - Portfolio-Builder Landing
- **/portfolio-builder/wizard** - Portfolio-Wizard
- **/live-tracking** - Live Portfolio Tracking

### Marktdaten & Analyse
- **/stock/:ticker** - Aktien-Detailseite
- **/newsroom** - Nachrichtenübersicht
- **/reviews** - Bewertungen
- **/categories** - Kategorien (Dividenden, Wachstum, ETF)
- **/sectors** - Branchen/Sektoren
- **/signals** - Trading-Signale
- **/dividends** - Dividendenkalender

### Tools & Features
- **/price-alerts** - Preisalarme
- **/chat** - Chat/Support
- **/rechner** - Rechner/Kalkulatoren
- **/einstellungen** - Einstellungen
- **/kontakt** - Kontakt

### Admin-Bereich
- **/admin/secrets** - Secret-Verwaltung
- **/admin/test-secrets** - Secret-Tests
- **/admin/logs** - System-Logs
- **/admin/stocks** - Aktien-Verwaltung
- **/settings/notifications** - Benachrichtigungseinstellungen

## 2. Datenmodell (aus schema.ts)

### Kernentitäten

**users** - Benutzerverwaltung
- Authentifizierung (OAuth + Email/Password)
- Rollen (user, admin)
- Payment-Status (hasPaid, paymentDate, stripeCustomerId)
- WhatsApp-Alerts
- Onboarding-Status
- Demo-Portfolio-Flag

**stocks** - Aktien-Stammdaten
- Grunddaten (ticker, companyName, currentPrice, currency)
- Fundamentaldaten (peRatio, pegRatio, dividendYield, beta, volatility, sharpeRatio)
- Marktdaten (marketCap, week52High/Low, ytdPerformance)
- Kategorisierung (category, sector)
- Moats (3 Wettbewerbsvorteile)
- Financial Highlights (3 Kennzahlen)
- Portfolio-Gewichtung
- Chart-Daten
- Logo & Factsheet URLs
- Score (0-100)

**categories** - Kategorien-Verwaltung
- Name, Beschreibung, Farbe
- Für Dividendenaktien, Wachstumsaktien, ETFs

**news** - Nachrichtenverwaltung
- Ticker-bezogene News
- Priorität (Wichtig, Mittel, Niedrig)
- Quelle, Bild, URL

**savedPortfolios** - Gespeicherte Portfolios
- Benutzer-zugeordnet
- Name, Beschreibung
- Portfolio-Daten (JSON mit Aktien & Gewichtungen)
- Portfolio-Typ (Dividenden, Wachstum, Balanced, ETF)
- Live-Status & Performance-Tracking
- Live-Start-Datum & Performance (IRR/MWR)

**portfolioTransactions** - Portfolio-Transaktionen
- Transaktionstypen (buy, sell, dividend, deposit, withdrawal)
- Multi-Währungs-Support (currency, fxRate, totalAmountCHF)
- Gebühren-Tracking
- Notizen

**realizedGains** - Realisierte Gewinne/Verluste
- Verkaufstransaktionen
- Cost-Basis-Berechnung
- Gewinn/Verlust in CHF
- Holding-Periode

**priceAlerts** - Preisalarme
- Benutzer-spezifisch
- Trigger-Typ (above, below, change_percent)
- Benachrichtigungskanäle (email, whatsapp)
- Status-Tracking

**dividends** - Dividenden-Tracking
- Portfolio-bezogen
- Erwartete & erhaltene Dividenden
- Multi-Währungs-Support

**payments** - Zahlungsverwaltung
- Stripe-Integration
- Status-Tracking (pending, completed, failed, refunded)
- Beträge in Rappen/Cents

**newsletter** - Newsletter-Abonnenten
- Email-Verwaltung
- Aktiv/Inaktiv-Status

**research** - Research-Content
- Titel, Content
- Datei-Upload (URL, Typ, Name)

**transactions** - System-Transaktionslog
- Aktionen (add, delete, update_weight, update_data)
- Change-Tracking mit oldValue/newValue
- Kommentare

## 3. Identifizierte Funktionsbereiche

### A. Öffentlicher Bereich (Nicht-eingeloggt)
1. Landing Page mit Value Proposition
2. Registrierung (Email/Password)
3. Login
4. Möglicherweise: Teaser-Content, Pricing-Info

### B. Authentifizierter Bereich (Eingeloggt, nicht bezahlt)
1. Dashboard mit Übersicht
2. Demo-Portfolio-Zugriff
3. Eingeschränkte Features
4. Payment-Flow (Stripe)
5. Onboarding-Prozess

### C. Premium-Bereich (Bezahlt)
1. **Portfolio-Management**
   - Portfolio-Builder (Wizard-basiert)
   - Mehrere Portfolios speichern
   - Portfolio-Vergleich
   - Live-Tracking mit Performance-Berechnung
   - Transaktionsverwaltung
   - Realisierte Gewinne/Verluste

2. **Marktanalyse**
   - Aktien-Detailseiten mit Fundamentaldaten
   - Kategorien-Übersicht (Dividenden, Wachstum, ETF)
   - Sektoren-Analyse
   - Newsroom mit priorisierten Nachrichten
   - Trading-Signale
   - Dividendenkalender

3. **Tools & Alerts**
   - Preisalarme (Email & WhatsApp)
   - Rechner/Kalkulatoren
   - Chat/Support

4. **Persönlicher Bereich**
   - Einstellungen
   - Benachrichtigungspräferenzen
   - Kontakt

### D. Admin-Bereich (Owner)
1. Aktien-Verwaltung (CRUD)
2. System-Logs
3. Secret-Verwaltung
4. Benutzer-Übersicht (vermutlich)

## 4. Fehlende/Unklare Bereiche

### Identifizierte Lücken:
1. **Pricing-Seite** - Keine dedizierte Pricing-Page im Routing
2. **About/Über uns** - Keine Unternehmensinfo-Seite
3. **FAQ** - Keine FAQ-Seite
4. **Datenschutz/AGB** - Keine rechtlichen Seiten
5. **Payment-Success/Cancel** - Keine Stripe-Callback-Seiten im Routing
6. **User-Profile** - Keine dedizierte Profil-Seite
7. **Subscription-Management** - Keine Abo-Verwaltung sichtbar

### Unklare Funktionen:
1. Wie funktioniert der Onboarding-Flow genau?
2. Was ist der Unterschied zwischen /home und /optimizer?
3. Was ist der "Rechner" genau?
4. Wie funktioniert der WhatsApp-Alert-Mechanismus?
5. Wie wird die Portfolio-Performance berechnet (IRR/MWR)?
6. Gibt es verschiedene Pricing-Tiers oder nur eine Einmalzahlung?

## 5. Technologie-Stack (aus Code)

- **Frontend**: React 19 + TypeScript
- **Routing**: Wouter
- **UI**: shadcn/ui + Tailwind CSS 4
- **Theme**: Dark Mode (default)
- **Backend**: tRPC + Express
- **Database**: MySQL/TiDB (Drizzle ORM)
- **Auth**: Manus OAuth + Email/Password
- **Payment**: Stripe
- **Notifications**: Email (Resend) + WhatsApp (Twilio)
- **Storage**: S3-kompatibel

## 6. Nächste Schritte für Customer Journey Mapping

### Zu klärende Fragen:
1. Was ist das Hauptwertversprechen auf der Landing Page?
2. Welche Features sind im kostenlosen vs. bezahlten Bereich?
3. Wie sieht der Onboarding-Flow aus?
4. Was kostet die Plattform? (Einmalzahlung, Abo, Tiers?)
5. Welche Rolle spielt das Demo-Portfolio?
6. Wie werden Benutzer von kostenlos zu bezahlt konvertiert?
