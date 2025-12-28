# MVP Roadmap - Portfolio Analysis Platform

## Executive Summary

Diese Roadmap folgt dem von dir vorgeschlagenen Ansatz: **Stabilität zuerst**, dann schrittweiser Feature-Ausbau. Die Priorisierung basiert auf der Analyse der vorhandenen Codebase, dem identifizierten Customer Journey und den kritischen Lücken im aktuellen System.

---

## Phase 0: Stabilität & Fundament (Woche 1-2)

**Ziel**: Sicherstellen, dass die Basis stabil ist, bevor neue Features gebaut werden.

### Kritische Stabilisierungs-Tasks

#### 0.1 Code-Audit & Cleanup
- **Alle vorhandenen Seiten testen** (43 Seiten identifiziert)
- Nicht-funktionierende oder unvollständige Seiten identifizieren
- Tote Code-Pfade entfernen
- Konsistenz-Check: Routing vs. tatsächliche Komponenten

#### 0.2 Datenbank-Schema Review
- Schema-Validierung gegen aktuelle Features
- Fehlende Indizes identifizieren (Performance)
- Datenintegrität prüfen (Foreign Keys, Constraints)
- Migration-Historie aufräumen

#### 0.3 API-Stabilität
- Alle tRPC-Procedures testen
- Error-Handling verbessern
- Rate-Limiting implementieren (für externe APIs)
- API-Response-Zeiten messen und optimieren

#### 0.4 Authentifizierung & Autorisierung
- Login/Logout-Flow testen (OAuth + Email/Password)
- Role-based Access Control (RBAC) für Admin-Bereich
- Session-Management prüfen
- Password-Reset-Flow (falls Email/Password Auth)

#### 0.5 External API Integration Review
- **Finnhub API**: Aktien-Preise, Fundamentaldaten
- **EOD Historical Data API**: Historische Daten
- **Fiscal Data API**: Weitere Fundamentaldaten
- Error-Handling bei API-Ausfällen
- Caching-Strategie (Redis?) für API-Responses
- Rate-Limit-Monitoring

#### 0.6 Payment-Flow (Stripe)
- Test-Modus vs. Live-Modus konfigurieren
- Webhook-Handling testen (payment.succeeded, payment.failed)
- Success/Cancel-Pages erstellen (aktuell fehlend!)
- Rechnung per Email nach Zahlung

#### 0.7 Notification-System
- Email-Benachrichtigungen (Resend) testen
- WhatsApp-Benachrichtigungen (Twilio) testen
- Benachrichtigungs-Präferenzen implementieren
- Notification-Queue (falls nicht vorhanden)

### Deliverables Phase 0
- ✅ Alle kritischen Bugs behoben
- ✅ Alle APIs getestet und dokumentiert
- ✅ Payment-Flow vollständig funktional
- ✅ Notification-System zuverlässig
- ✅ Performance-Baseline etabliert

---

## Phase 1: MVP Core Features (Woche 3-4)

**Ziel**: Die wichtigsten Features für einen funktionierenden MVP vervollständigen.

### 1.1 Landing Page Optimierung
**Priorität: HOCH** - Erster Eindruck entscheidet über Conversion

**Tasks**:
- Hero-Section mit klarem Value Proposition
- Feature-Übersicht (3 Hauptfeatures)
- Social Proof (Testimonials, Nutzer-Zahlen)
- Trust-Elemente (SSL, Datenschutz, Stripe)
- CTA: "Kostenlos starten"
- Mobile-Optimierung

**Mockup**: `01_landing_page.png`

### 1.2 Pricing-Seite
**Priorität: HOCH** - Aktuell komplett fehlend!

**Tasks**:
- Free vs. Premium Vergleich
- Feature-Liste mit Checkmarks
- Preis-Transparenz (CHF 10.00 einmalig?)
- FAQ-Sektion
- Trust-Badges (Stripe, TWINT, PostFinance)
- CTA: "Jetzt kaufen"

**Mockup**: `06_pricing_page.png`

**Klärungsbedarf**:
- Ist es eine Einmalzahlung oder ein Abo?
- Gibt es verschiedene Tiers (z.B. Basic, Pro, Enterprise)?
- Gibt es eine Testphase oder Geld-zurück-Garantie?

### 1.3 Onboarding-Flow
**Priorität: HOCH** - Kritisch für User-Aktivierung

**Tasks**:
- Schritt 1: Willkommen & Ziele erfassen
- Schritt 2: Demo-Portfolio erstellen (geführt)
- Schritt 3: Dashboard-Tour (interaktiv)
- Schritt 4: Premium-Teaser
- Onboarding-Status in DB speichern (hasSeenOnboarding)
- Skip-Option für erfahrene Nutzer

**Mockup**: `02_onboarding_step1.png`

### 1.4 Dashboard (Free vs. Premium)
**Priorität: HOCH** - Zentrale Anlaufstelle

**Tasks**:
- Portfolio-Übersicht (Liste mit Performance)
- KPI-Cards (Gesamtwert, Performance, Dividenden)
- Aktuelle Alerts (nur Premium)
- Top-News
- Quick-Actions (Neues Portfolio, Transaktion, Alarm)
- Klare Unterscheidung Free vs. Premium Features
- Upgrade-Prompts (nicht zu aufdringlich)

**Mockup**: `03_dashboard_premium.png`

### 1.5 Portfolio-Builder Wizard
**Priorität: HOCH** - Kern-Feature der Plattform

**Tasks**:
- Schritt 1: Portfolio-Typ wählen (Dividenden, Wachstum, Balanced, ETF)
- Schritt 2: Aktien auswählen (Suche, Filter, Empfehlungen)
- Schritt 3: Gewichtung festlegen (manuell oder automatisch)
- Schritt 4: Portfolio-Details (Name, Beschreibung, Live-Tracking)
- Schritt 5: Zusammenfassung & Speichern
- Validierung (Gewichtung muss 100% ergeben)
- Speichern in `savedPortfolios`-Tabelle

**Mockup**: `04_portfolio_builder_wizard.png`

### 1.6 Portfolio-Detail-Seite
**Priorität: HOCH** - Detaillierte Analyse

**Tasks**:
- Performance-Übersicht (Wert, Performance, Chart)
- Key-Metriken (IRR, Beta, Volatilität, Sharpe Ratio)
- Holdings-Tabelle (alle Positionen)
- Allocation-Charts (nach Aktie, Sektor, Kategorie)
- Letzte Transaktionen (Preview)
- Quick-Actions (Transaktion hinzufügen, Alarm erstellen)

**Mockup**: `05_portfolio_detail.png`

### 1.7 Payment Success/Cancel Pages
**Priorität: HOCH** - Aktuell fehlend!

**Tasks**:
- `/payment/success` - Erfolgsbestätigung, Premium freigeschaltet
- `/payment/cancel` - Abbruch-Hinweis, zurück zu Pricing
- Stripe Webhook verarbeiten (hasPaid, paymentDate setzen)
- Email-Bestätigung senden

### Deliverables Phase 1
- ✅ Landing Page live
- ✅ Pricing-Seite live
- ✅ Onboarding-Flow funktional
- ✅ Dashboard (Free & Premium) live
- ✅ Portfolio-Builder Wizard funktional
- ✅ Portfolio-Detail-Seite live
- ✅ Payment-Flow komplett

---

## Phase 2: Essential Features (Woche 5-6)

**Ziel**: Die wichtigsten Features für Premium-Nutzer ausbauen.

### 2.1 Transaktionsverwaltung
**Priorität: MITTEL-HOCH** - Wichtig für Live-Portfolios

**Tasks**:
- Transaktions-Übersicht (Filter, Suche)
- Neue Transaktion Modal (buy, sell, dividend, deposit, withdrawal)
- Multi-Währungs-Support (automatische FX-Rate)
- Gebühren-Tracking
- Transaktionen bearbeiten/löschen
- CSV-Export (für Steuererklärung)

**Mockup**: `08_transaction_management.png`

### 2.2 Realisierte Gewinne/Verluste
**Priorität: MITTEL** - Wichtig für Steuern

**Tasks**:
- Übersicht aller realisierten Gewinne/Verluste
- Berechnung: (Verkaufspreis - Durchschn. Kaufpreis) × Anzahl
- Filter nach Jahr, Ticker
- CSV-Export
- Holding-Periode anzeigen

### 2.3 Preisalarme
**Priorität: MITTEL-HOCH** - Beliebtes Feature

**Tasks**:
- Alarm-Übersicht (Filter, Status)
- Neuer Alarm Modal (Ticker, Trigger-Typ, Zielpreis, Benachrichtigung)
- Trigger-Typen: above, below, change_percent
- Benachrichtigungskanäle: Email, WhatsApp
- Alarm-Status: aktiv, ausgelöst, deaktiviert
- Cron-Job für Alarm-Prüfung (alle 5-15 Minuten)

**Mockup**: `09_price_alerts.png`

### 2.4 Aktien-Detailseite
**Priorität: MITTEL-HOCH** - Kern der Analyse

**Tasks**:
- Header mit Logo, Ticker, Preis, Score
- Preis-Chart (verschiedene Zeiträume)
- Fundamentaldaten (P/E, PEG, Dividendenrendite, etc.)
- Moats (3 Wettbewerbsvorteile)
- Financial Highlights (3 Key-Metriken)
- Kategorie & Sektor Badges
- News-Sektion
- Actions: "Zu Portfolio hinzufügen", "Preisalarm erstellen"

**Mockup**: `07_stock_detail.png`

### 2.5 Newsroom
**Priorität: MITTEL** - Content-Feature

**Tasks**:
- News-Liste (Cards mit Bild, Titel, Beschreibung)
- Filter: Ticker, Priorität, Zeitraum
- Pagination oder Infinite Scroll
- News-Import von Finnhub API (automatisiert)
- Priorität-System (Wichtig, Mittel, Niedrig)

### 2.6 Live-Tracking
**Priorität: MITTEL** - Premium-Feature

**Tasks**:
- Übersicht aller Live-Portfolios
- Performance-Berechnung (IRR/MWR)
- Tages-Performance
- Beste/Schlechteste Performer
- Aggregierte Gesamt-Performance
- Cron-Job für tägliche Performance-Berechnung

### Deliverables Phase 2
- ✅ Transaktionsverwaltung funktional
- ✅ Realisierte Gewinne/Verluste funktional
- ✅ Preisalarme funktional (mit Cron-Job)
- ✅ Aktien-Detailseite live
- ✅ Newsroom live
- ✅ Live-Tracking funktional

---

## Phase 3: Advanced Features (Woche 7-8)

**Ziel**: Erweiterte Features für Power-User.

### 3.1 Portfolio-Vergleich
**Priorität: NIEDRIG-MITTEL**

**Tasks**:
- Multi-Select (max. 3-4 Portfolios)
- Vergleichs-Tabelle (Metriken nebeneinander)
- Performance-Chart (überlagert)
- Sektor-Verteilung (nebeneinander)

### 3.2 Dividendenkalender
**Priorität: NIEDRIG-MITTEL**

**Tasks**:
- Kalender-Ansicht (monatlich)
- Listen-Ansicht (Tabelle)
- Filter: Portfolio, Jahr, Monat
- Erwartete vs. erhaltene Dividenden
- Dividenden als "erhalten" markieren

### 3.3 Kategorien & Sektoren
**Priorität: NIEDRIG**

**Tasks**:
- Kategorien-Übersicht (Dividenden, Wachstum, ETF)
- Sektoren-Übersicht (Technology, Healthcare, etc.)
- Aktien-Liste (gefiltert)
- Sektor-Performance-Vergleich

### 3.4 Trading-Signale
**Priorität: NIEDRIG** - Komplex, später

**Tasks**:
- Signal-Generierung (Kaufen, Verkaufen, Halten)
- Signal-Begründung (technisch, fundamental)
- Confidence-Score
- Signal-Historie

### 3.5 Rechner/Tools
**Priorität: NIEDRIG** - Nice-to-have

**Tasks**:
- Zinseszins-Rechner
- Dividenden-Rechner
- Steuer-Rechner
- Retirement-Rechner

### 3.6 Chat/Support
**Priorität: NIEDRIG-MITTEL**

**Tasks**:
- Chat-Interface
- Optional: AI-Chatbot für FAQ
- Optional: Live-Chat mit Support

### Deliverables Phase 3
- ✅ Portfolio-Vergleich funktional
- ✅ Dividendenkalender funktional
- ✅ Kategorien & Sektoren live
- ✅ Trading-Signale (Basic) funktional
- ✅ Rechner/Tools live
- ✅ Chat/Support funktional

---

## Phase 4: Admin & Operations (Woche 9-10)

**Ziel**: Admin-Tools für Owner-Verwaltung.

### 4.1 Admin-Dashboard
**Priorität: MITTEL** - Aktuell fehlend

**Tasks**:
- Benutzer-Statistiken (Gesamt, Neu, Premium, Conversion)
- Finanz-Statistiken (Umsatz, ARPU)
- Portfolio-Statistiken
- System-Statistiken (API-Calls, Fehlerrate, Uptime)
- Charts (Benutzer-Aktivität, Umsatz-Entwicklung)

**Mockup**: `10_admin_dashboard.png`

### 4.2 Aktien-Verwaltung (Optimierung)
**Priorität: NIEDRIG** - Bereits vorhanden

**Tasks**:
- Bulk-Update für Aktien-Daten
- Logo-Upload-Optimierung
- Score-Berechnung automatisieren
- Daten-Refresh-Scheduler

### 4.3 Benutzer-Verwaltung
**Priorität: NIEDRIG** - Für Owner

**Tasks**:
- Benutzer-Liste (Suche, Filter)
- Benutzer-Details (Portfolios, Transaktionen, Zahlungen)
- Benutzer-Rolle ändern (user → admin)
- Benutzer deaktivieren/löschen

### 4.4 System-Logs (Optimierung)
**Priorität: NIEDRIG** - Bereits vorhanden

**Tasks**:
- Log-Aggregation verbessern
- Error-Alerting (Email bei kritischen Fehlern)
- Log-Retention-Policy

### Deliverables Phase 4
- ✅ Admin-Dashboard live
- ✅ Aktien-Verwaltung optimiert
- ✅ Benutzer-Verwaltung funktional
- ✅ System-Logs optimiert

---

## Phase 5: Polish & Launch Prep (Woche 11-12)

**Ziel**: Finalisierung für öffentlichen Launch.

### 5.1 Rechtliche Seiten
**Priorität: HOCH** - Rechtlich notwendig!

**Tasks**:
- Impressum
- Datenschutzerklärung (DSGVO-konform)
- AGB (Allgemeine Geschäftsbedingungen)
- Cookie-Banner (falls Tracking)

### 5.2 Über uns / Team
**Priorität: MITTEL**

**Tasks**:
- Team-Vorstellung (Fotos, Bios)
- Mission & Vision
- Kontakt-Informationen

### 5.3 FAQ-Seite
**Priorität: MITTEL**

**Tasks**:
- Häufig gestellte Fragen
- Kategorien: Allgemein, Zahlung, Features, Technisch
- Suchfunktion

### 5.4 Performance-Optimierung
**Priorität: MITTEL**

**Tasks**:
- Lighthouse-Audit (Performance, SEO, Accessibility)
- Image-Optimierung (WebP, Lazy Loading)
- Code-Splitting
- CDN für Static Assets
- Database-Query-Optimierung

### 5.5 SEO-Optimierung
**Priorität: MITTEL**

**Tasks**:
- Meta-Tags (Title, Description) für alle Seiten
- Open Graph Tags (Social Sharing)
- Sitemap.xml
- Robots.txt
- Strukturierte Daten (Schema.org)

### 5.6 Testing & QA
**Priorität: HOCH**

**Tasks**:
- End-to-End Tests (Playwright/Cypress)
- Unit Tests (kritische Business-Logic)
- Browser-Kompatibilität (Chrome, Firefox, Safari, Edge)
- Mobile-Testing (iOS, Android)
- Accessibility-Testing (WCAG 2.1)

### 5.7 Monitoring & Analytics
**Priorität: MITTEL**

**Tasks**:
- Error-Tracking (Sentry)
- Analytics (Google Analytics oder Plausible)
- Uptime-Monitoring (UptimeRobot)
- Performance-Monitoring (New Relic oder Datadog)

### 5.8 Dokumentation
**Priorität: NIEDRIG-MITTEL**

**Tasks**:
- User-Guide (für Endnutzer)
- API-Dokumentation (für Entwickler)
- Deployment-Guide
- Troubleshooting-Guide

### Deliverables Phase 5
- ✅ Alle rechtlichen Seiten live
- ✅ Über uns / Team live
- ✅ FAQ-Seite live
- ✅ Performance optimiert (Lighthouse > 90)
- ✅ SEO optimiert
- ✅ Alle Tests grün
- ✅ Monitoring & Analytics aktiv
- ✅ Dokumentation vollständig

---

## Kritische Entscheidungen & Klärungsbedarf

### 1. Pricing-Modell
**Frage**: Einmalzahlung oder Abo?
- **Option A**: Einmalzahlung CHF 10.00 (Lifetime-Access)
- **Option B**: Monatliches Abo CHF 10.00/Monat
- **Option C**: Jahres-Abo CHF 100.00/Jahr (2 Monate gratis)
- **Option D**: Verschiedene Tiers (Basic, Pro, Enterprise)

**Empfehlung**: Monatliches Abo CHF 10.00/Monat für wiederkehrende Einnahmen. Optional: Jahres-Abo mit Rabatt.

### 2. Free-Tier Features
**Frage**: Was ist im Free-Tier enthalten?
- Demo-Portfolio (1 Portfolio, nicht editierbar)
- 3 Aktien-Analysen pro Tag (Limit)
- Newsroom (nur Top-News)
- Keine Alerts, kein Live-Tracking

**Empfehlung**: Free-Tier als "Teaser" mit klaren Limits, um Upgrade zu motivieren.

### 3. WhatsApp-Alerts Setup
**Frage**: Wie aktiviert der Benutzer WhatsApp-Alerts?
- **Option A**: Benutzer gibt Telefonnummer in Einstellungen ein
- **Option B**: Benutzer scannt QR-Code (WhatsApp Business API)
- **Option C**: Benutzer sendet Opt-In-Nachricht an WhatsApp-Nummer

**Empfehlung**: Option A (einfachste Implementierung mit Twilio).

### 4. Demo-Portfolio
**Frage**: Was ist das Demo-Portfolio genau?
- **Option A**: Vordefiniertes Portfolio (z.B. "Schweizer Dividenden")
- **Option B**: Benutzer erstellt Portfolio im Onboarding, aber kann es nicht bearbeiten
- **Option C**: Benutzer erstellt Portfolio, kann es bearbeiten, aber kein Live-Tracking

**Empfehlung**: Option C - Benutzer erstellt Portfolio, kann es bearbeiten, aber kein Live-Tracking (nur Premium).

### 5. Performance-Berechnung (IRR/MWR)
**Frage**: Wie wird die Portfolio-Performance berechnet?
- **IRR (Internal Rate of Return)**: Zeit-gewichtete Rendite (berücksichtigt Timing von Cashflows)
- **MWR (Money-Weighted Return)**: Geld-gewichtete Rendite (berücksichtigt Höhe von Cashflows)

**Empfehlung**: Beide anzeigen, da sie unterschiedliche Perspektiven bieten. IRR für Vergleich mit Benchmarks, MWR für tatsächliche Rendite.

### 6. Daten-Refresh-Strategie
**Frage**: Wie oft werden Aktien-Daten aktualisiert?
- **Echtzeit**: Zu teuer (API-Limits)
- **Alle 15 Minuten**: Guter Kompromiss (während Handelszeiten)
- **Stündlich**: Für meiste Use-Cases ausreichend
- **Täglich**: Zu langsam für Preisalarme

**Empfehlung**: Stündlich während Handelszeiten (09:00-17:30 CET), täglich außerhalb. Preisalarme: alle 15 Minuten.

---

## Ressourcen-Planung

### Entwickler-Kapazität
- **1 Full-Stack Developer**: 40h/Woche
- **Geschätzte Dauer**: 12 Wochen (3 Monate)

### Externe Kosten (monatlich)
- **Finnhub API**: $0-99/Monat (je nach Plan)
- **EOD Historical Data**: $0-80/Monat
- **Stripe**: 1.5% + CHF 0.30 pro Transaktion
- **Twilio (WhatsApp)**: $0.005 pro Nachricht
- **Resend (Email)**: $0/Monat (bis 3,000 Emails)
- **Hosting (Manus)**: Bereits inkludiert
- **Datenbank (TiDB)**: Bereits inkludiert
- **S3 Storage**: Minimal (Logos, Factsheets)

**Geschätzte monatliche Kosten**: CHF 100-200 (bei 100 Nutzern)

---

## Success Metrics (KPIs)

### Phase 1 (MVP Launch)
- ✅ 50 registrierte Benutzer (Woche 1)
- ✅ 10 Premium-Benutzer (Woche 2)
- ✅ Conversion-Rate > 20%
- ✅ Durchschn. Session-Dauer > 5 Minuten
- ✅ Bounce-Rate < 50%

### Phase 2 (Growth)
- ✅ 200 registrierte Benutzer (Monat 2)
- ✅ 50 Premium-Benutzer (Monat 2)
- ✅ Conversion-Rate > 25%
- ✅ Churn-Rate < 5%
- ✅ NPS (Net Promoter Score) > 50

### Phase 3 (Scale)
- ✅ 500 registrierte Benutzer (Monat 3)
- ✅ 150 Premium-Benutzer (Monat 3)
- ✅ MRR (Monthly Recurring Revenue) > CHF 1,500
- ✅ CAC (Customer Acquisition Cost) < CHF 20
- ✅ LTV (Lifetime Value) > CHF 100

---

## Risiken & Mitigation

### Risiko 1: API-Rate-Limits
**Impact**: Hoch | **Wahrscheinlichkeit**: Mittel
**Mitigation**: Caching-Layer (Redis), Daten-Refresh-Strategie optimieren, auf höheren API-Plan upgraden

### Risiko 2: Payment-Integration-Probleme
**Impact**: Hoch | **Wahrscheinlichkeit**: Niedrig
**Mitigation**: Umfangreiche Tests im Stripe-Test-Modus, Webhook-Monitoring, Fallback-Mechanismen

### Risiko 3: Performance-Probleme bei Skalierung
**Impact**: Mittel | **Wahrscheinlichkeit**: Mittel
**Mitigation**: Database-Indizes, Query-Optimierung, Caching, CDN, Load-Testing

### Risiko 4: Rechtliche Probleme (Datenschutz, Finanzberatung)
**Impact**: Hoch | **Wahrscheinlichkeit**: Niedrig
**Mitigation**: Disclaimer ("Keine Finanzberatung"), DSGVO-konforme Datenschutzerklärung, AGB von Anwalt prüfen lassen

### Risiko 5: Niedrige Conversion-Rate
**Impact**: Hoch | **Wahrscheinlichkeit**: Mittel
**Mitigation**: A/B-Testing (Landing Page, Pricing), User-Feedback einholen, Onboarding optimieren

---

## Nächste Schritte

1. **Klärung der offenen Fragen** (Pricing-Modell, Free-Tier, Demo-Portfolio)
2. **Phase 0 starten**: Stabilisierungs-Tasks priorisieren
3. **Wöchentliche Reviews**: Fortschritt tracken, Blockers identifizieren
4. **User-Testing**: Frühzeitig Feedback von Beta-Usern einholen
5. **Iterative Verbesserung**: Basierend auf User-Feedback anpassen

---

## Zusammenfassung

Diese Roadmap folgt einem **Stabilität-First-Ansatz** und baut dann schrittweise Features auf. Die Priorisierung basiert auf:

1. **Business-Impact**: Features, die direkt zur Conversion beitragen (Landing Page, Pricing, Onboarding)
2. **User-Value**: Features, die den Kern-Nutzen der Plattform ausmachen (Portfolio-Builder, Live-Tracking, Alerts)
3. **Technische Abhängigkeiten**: Fundament muss stabil sein, bevor komplexe Features gebaut werden

**Geschätzte Dauer bis MVP-Launch**: 6-8 Wochen (Phase 0 + Phase 1 + Phase 2)
**Geschätzte Dauer bis Full-Feature-Launch**: 12 Wochen (alle Phasen)

Der Fokus liegt auf **schnellem Launch eines funktionierenden MVPs**, gefolgt von **iterativer Verbesserung** basierend auf User-Feedback.
