# Customer Journey Map - Portfolio Analysis Platform

## Übersicht der User-Personas

### Persona 1: Der Einsteiger-Investor
**Max, 28 Jahre, Junior Consultant**
- Hat erstes Geld zum Investieren
- Wenig Erfahrung mit Aktienanalyse
- Sucht nach strukturierter Anleitung
- Budget-bewusst

### Persona 2: Der Erfahrene Anleger
**Sandra, 42 Jahre, Unternehmerin**
- Hat bereits mehrere Portfolios
- Sucht nach Optimierung und Tracking
- Möchte Performance-Vergleiche
- Bereit für Premium-Tools

### Persona 3: Der Profi-Trader
**Thomas, 35 Jahre, Finanzanalyst**
- Professioneller Hintergrund
- Braucht detaillierte Fundamentaldaten
- Nutzt Signale und Alerts
- Hohe Anforderungen an Datenqualität

---

## Customer Journey Stages

## Stage 1: Awareness & Discovery (Nicht-registriert)

### Touchpoint 1.1: Landing Page (/)
**Ziel**: Wertversprechen kommunizieren und zur Registrierung bewegen

**User-Bedürfnisse**:
- Schnell verstehen, was die Plattform bietet
- Vertrauen aufbauen (Testimonials, Daten, Expertise)
- Pricing-Transparenz
- Unterschied zu Konkurrenz erkennen

**Kritische Elemente**:
- Hero-Section mit klarem Value Proposition
- Feature-Übersicht (Portfolio-Builder, Live-Tracking, Alerts)
- Social Proof (Anzahl Nutzer, Performance-Beispiele)
- Pricing-Teaser
- CTA: "Kostenlos starten" / "Demo-Portfolio testen"
- Trust-Elemente (Sicherheit, Datenschutz)

**Erwartete Aktionen**:
- Zur Registrierung navigieren
- Mehr über Features erfahren
- Pricing ansehen

### Touchpoint 1.2: Feature-Seiten (fehlend im aktuellen System)
**Vorschlag für MVP**:
- Über uns / Team
- Features im Detail
- Pricing-Seite
- FAQ
- Blog/Resources (optional für später)

---

## Stage 2: Registration & Onboarding (Neu-registriert, nicht bezahlt)

### Touchpoint 2.1: Registrierung (/register)
**Ziel**: Reibungslose Anmeldung mit minimalem Aufwand

**User-Bedürfnisse**:
- Schnelle Registrierung (Email + Passwort)
- Klare Datenschutz-Information
- Optional: Social Login (Google, Apple)

**Kritische Elemente**:
- Email + Passwort Felder
- Passwort-Stärke-Indikator
- Checkbox: AGB & Datenschutz akzeptieren
- CTA: "Konto erstellen"
- Alternative: "Mit Google anmelden"

**Erwartete Aktionen**:
- Konto erstellen
- Email-Verifizierung (falls implementiert)
- Weiterleitung zum Onboarding

### Touchpoint 2.2: Onboarding-Flow (hasSeenOnboarding = 0)
**Ziel**: Benutzer mit Plattform vertraut machen und erstes Demo-Portfolio erstellen

**Schritt 1: Willkommen**
- Begrüßung
- Kurze Erklärung der Plattform
- "Was möchtest du erreichen?" (Ziele erfassen)

**Schritt 2: Demo-Portfolio erstellen**
- "Lass uns dein erstes Portfolio erstellen"
- Geführter Portfolio-Builder
- Vorschläge basierend auf Zielen
- Erklärung der Kategorien (Dividenden, Wachstum, ETF)

**Schritt 3: Dashboard-Tour**
- Interaktive Tour durch Dashboard
- Erklärung der wichtigsten Features
- "Hier siehst du deine Performance"
- "Hier kannst du Aktien analysieren"

**Schritt 4: Premium-Teaser**
- "Mit Premium erhältst du..."
- Live-Tracking, Alerts, unbegrenzte Portfolios
- CTA: "Jetzt upgraden" oder "Später"

**Erwartete Aktionen**:
- Onboarding abschließen (hasSeenOnboarding = 1)
- Demo-Portfolio erstellt (hasDemoPortfolio = 1)
- Optional: Direkt zu Premium upgraden

### Touchpoint 2.3: Dashboard (Free-Tier) (/dashboard)
**Ziel**: Wert demonstrieren und zur Zahlung motivieren

**Verfügbare Features (Free)**:
- Demo-Portfolio ansehen
- Grundlegende Performance-Metriken
- Eingeschränkte Aktien-Detailseiten (z.B. nur 3 pro Tag)
- Newsroom (nur Top-News)
- Kein Live-Tracking
- Keine Alerts

**Eingeschränkte Features (mit Upgrade-Prompt)**:
- "Live-Tracking aktivieren" → Premium-Modal
- "Preisalarm erstellen" → Premium-Modal
- "Weiteres Portfolio erstellen" → Premium-Modal

**Kritische Elemente**:
- Klare Kennzeichnung von Free vs. Premium Features
- Upgrade-Banner (nicht zu aufdringlich)
- Demo-Portfolio mit Performance-Simulation
- CTA: "Jetzt Premium freischalten"

**Erwartete Aktionen**:
- Plattform erkunden
- Demo-Portfolio analysieren
- Upgrade-Entscheidung treffen

---

## Stage 3: Conversion (Payment)

### Touchpoint 3.1: Pricing-Seite (/pricing - aktuell fehlend)
**Ziel**: Transparente Preisgestaltung und einfacher Kaufprozess

**User-Bedürfnisse**:
- Klare Preis-Information
- Feature-Vergleich (Free vs. Premium)
- Zahlungsmethoden (TWINT, Kreditkarte)
- Geld-zurück-Garantie oder Testphase?

**Kritische Elemente**:
- Pricing-Tabelle (Free vs. Premium)
- Feature-Liste mit Checkmarks
- Preis in CHF (z.B. CHF 10.00 einmalig oder monatlich?)
- CTA: "Jetzt kaufen"
- FAQ zu Payment
- Trust-Badges (Stripe, SSL, Datenschutz)

**Erwartete Aktionen**:
- Pricing-Option wählen
- Zum Checkout navigieren

### Touchpoint 3.2: Checkout (Stripe Integration)
**Ziel**: Reibungsloser Zahlungsprozess

**User-Bedürfnisse**:
- Sichere Zahlung
- Mehrere Zahlungsmethoden
- Sofortige Freischaltung

**Kritische Elemente**:
- Stripe Checkout Embed
- Zahlungsmethoden: TWINT, Kreditkarte, PostFinance
- Zusammenfassung: "Du erhältst..."
- Rechnung/Quittung per Email

**Erwartete Aktionen**:
- Zahlung abschließen
- Weiterleitung zu Success-Page

### Touchpoint 3.3: Payment Success (/payment/success - aktuell fehlend)
**Ziel**: Erfolg bestätigen und Benutzer aktivieren

**Kritische Elemente**:
- "Zahlung erfolgreich!"
- "Dein Account wurde freigeschaltet"
- Zusammenfassung der Premium-Features
- CTA: "Zum Dashboard" oder "Erstes Live-Portfolio erstellen"
- Email-Bestätigung erwähnen

**Erwartete Aktionen**:
- Zum Dashboard navigieren
- Premium-Features nutzen

---

## Stage 4: Active Usage (Premium-Nutzer)

### Touchpoint 4.1: Premium Dashboard (/dashboard)
**Ziel**: Zentrale Übersicht über alle Portfolios und Performance

**User-Bedürfnisse**:
- Schneller Überblick über alle Portfolios
- Aktuelle Performance-Metriken
- Wichtige Alerts und News
- Zugriff zu allen Tools

**Kritische Elemente**:
- Portfolio-Übersicht (Liste mit Performance)
- Gesamt-Performance (aggregiert)
- Aktuelle Alerts (Preisalarme, Dividenden)
- Top-News
- Quick-Actions: "Neues Portfolio", "Transaktion hinzufügen"
- Navigation zu allen Features

**Erwartete Aktionen**:
- Portfolio auswählen
- Neue Transaktionen erfassen
- Alerts prüfen
- News lesen

### Touchpoint 4.2: Portfolio-Builder Wizard (/portfolio-builder/wizard)
**Ziel**: Neues Portfolio erstellen mit geführtem Prozess

**Schritt 1: Portfolio-Typ wählen**
- Dividenden-Portfolio
- Wachstums-Portfolio
- Balanced-Portfolio
- ETF-Portfolio
- Custom

**Schritt 2: Aktien auswählen**
- Suche nach Ticker/Name
- Kategorien durchsuchen
- Sektoren filtern
- Empfohlene Aktien basierend auf Typ
- Aktien-Details ansehen (Fundamentaldaten, Score)

**Schritt 3: Gewichtung festlegen**
- Manuelle Gewichtung oder
- Automatische Optimierung (gleichgewichtet, nach Marktkapitalisierung, nach Score)
- Visualisierung (Pie-Chart)
- Summe muss 100% ergeben

**Schritt 4: Portfolio-Details**
- Name vergeben
- Beschreibung (optional)
- Live-Tracking aktivieren? (Ja/Nein)
- Wenn Ja: Start-Datum wählen

**Schritt 5: Zusammenfassung & Speichern**
- Portfolio-Übersicht
- Erwartete Metriken (Dividendenrendite, Beta, Volatilität)
- CTA: "Portfolio erstellen"

**Erwartete Aktionen**:
- Portfolio speichern
- Weiterleitung zu Portfolio-Detail

### Touchpoint 4.3: Portfolio-Detail (/portfolio/:id)
**Ziel**: Detaillierte Ansicht eines spezifischen Portfolios

**Kritische Elemente**:

**Header-Bereich**:
- Portfolio-Name & Beschreibung
- Portfolio-Typ (Badge)
- Live-Status (Badge: "Live" oder "Test")
- Actions: "Bearbeiten", "Löschen", "Teilen"

**Performance-Bereich**:
- Aktueller Wert (in CHF)
- Performance seit Start (% und CHF)
- Performance-Chart (Zeitreihe)
- Vergleich mit Benchmark (z.B. SMI, S&P 500)
- Key-Metriken:
  - IRR / MWR
  - Dividendenrendite
  - Beta
  - Volatilität
  - Sharpe Ratio

**Holdings-Bereich**:
- Tabelle mit allen Positionen:
  - Ticker, Name
  - Anzahl Aktien (bei Live-Portfolios)
  - Gewichtung (%)
  - Aktueller Preis
  - Wert
  - Performance (% und CHF)
  - Dividendenrendite
- Pie-Chart: Gewichtung nach Aktie
- Pie-Chart: Gewichtung nach Sektor
- Pie-Chart: Gewichtung nach Kategorie

**Transaktionen-Bereich** (nur bei Live-Portfolios):
- Letzte Transaktionen (Liste)
- CTA: "Alle Transaktionen ansehen" → /portfolio/:id/transactions
- Quick-Action: "Neue Transaktion"

**Dividenden-Bereich**:
- Erwartete Dividenden (Kalender)
- Erhaltene Dividenden (Historie)
- Dividendenrendite (gesamt)

**Alerts-Bereich**:
- Aktive Preisalarme für dieses Portfolio
- CTA: "Neuer Alarm"

**Erwartete Aktionen**:
- Transaktionen hinzufügen
- Portfolio bearbeiten
- Alerts erstellen
- Zu Aktien-Details navigieren

### Touchpoint 4.4: Transaktionsverwaltung (/portfolio/:id/transactions)
**Ziel**: Alle Käufe, Verkäufe und Dividenden verwalten

**Kritische Elemente**:
- Filter: Typ (buy, sell, dividend, deposit, withdrawal), Zeitraum, Ticker
- Tabelle mit allen Transaktionen:
  - Datum
  - Typ (Badge mit Farbe)
  - Ticker
  - Anzahl Aktien
  - Preis pro Aktie
  - Währung
  - Gesamt (in CHF)
  - Gebühren
  - Notizen
  - Actions: "Bearbeiten", "Löschen"
- Zusammenfassung:
  - Gesamt investiert
  - Gesamt entnommen
  - Dividenden erhalten
  - Gebühren bezahlt
- CTA: "Neue Transaktion"

**Neue Transaktion Modal**:
- Typ wählen (buy, sell, dividend, deposit, withdrawal)
- Datum
- Ticker (für buy/sell)
- Anzahl Aktien
- Preis pro Aktie
- Währung (mit automatischer FX-Rate)
- Gebühren
- Notizen
- CTA: "Speichern"

**Erwartete Aktionen**:
- Transaktionen erfassen
- Transaktionen bearbeiten/löschen
- Zurück zu Portfolio-Detail

### Touchpoint 4.5: Realisierte Gewinne/Verluste (/portfolio/:id/realized-gains)
**Ziel**: Übersicht über realisierte Gewinne und Verluste für Steuerzwecke

**Kritische Elemente**:
- Filter: Jahr, Ticker
- Tabelle mit realisierten Gewinnen:
  - Datum (Verkaufsdatum)
  - Ticker
  - Anzahl Aktien
  - Kaufpreis (Durchschnitt)
  - Verkaufspreis
  - Gewinn/Verlust (CHF)
  - Gewinn/Verlust (%)
  - Holding-Periode (Tage)
- Zusammenfassung:
  - Gesamt realisierte Gewinne
  - Gesamt realisierte Verluste
  - Netto (Gewinne - Verluste)
- Export: "Als CSV exportieren" (für Steuererklärung)

**Erwartete Aktionen**:
- Gewinne/Verluste einsehen
- CSV exportieren
- Zurück zu Portfolio-Detail

### Touchpoint 4.6: Portfolio-Vergleich (/portfolio-comparison)
**Ziel**: Mehrere Portfolios nebeneinander vergleichen

**Kritische Elemente**:
- Portfolio-Auswahl (Multi-Select, max. 3-4)
- Vergleichs-Tabelle:
  - Portfolio-Name
  - Typ
  - Anzahl Positionen
  - Gesamtwert
  - Performance (% und CHF)
  - IRR / MWR
  - Dividendenrendite
  - Beta
  - Volatilität
  - Sharpe Ratio
- Performance-Chart (alle Portfolios überlagert)
- Sektor-Verteilung (nebeneinander)
- Kategorie-Verteilung (nebeneinander)

**Erwartete Aktionen**:
- Portfolios auswählen
- Metriken vergleichen
- Zu einzelnen Portfolios navigieren

### Touchpoint 4.7: Live-Tracking (/live-tracking)
**Ziel**: Echtzeit-Übersicht über alle Live-Portfolios

**Kritische Elemente**:
- Liste aller Live-Portfolios
- Für jedes Portfolio:
  - Name
  - Start-Datum
  - Laufzeit (Tage)
  - Aktueller Wert
  - Performance seit Start (% und CHF)
  - Heute's Performance (% und CHF)
  - Chart (Mini-Sparkline)
- Gesamt-Performance (aggregiert über alle Live-Portfolios)
- Gesamt-Wert
- Beste/Schlechteste Performer (heute, diese Woche, diesen Monat)

**Erwartete Aktionen**:
- Live-Portfolio auswählen
- Performance überwachen
- Zu Portfolio-Detail navigieren

### Touchpoint 4.8: Aktien-Detail (/stock/:ticker)
**Ziel**: Umfassende Analyse einer einzelnen Aktie

**Kritische Elemente**:

**Header-Bereich**:
- Logo
- Ticker & Company Name
- Aktueller Preis (mit Währung)
- Heute's Change (% und absolut)
- Score (0-100) mit Badge

**Chart-Bereich**:
- Preis-Chart (1D, 1W, 1M, 3M, 6M, 1Y, YTD, All)
- Volumen-Chart

**Fundamentaldaten**:
- P/E Ratio
- PEG Ratio
- Dividendenrendite
- Beta
- Volatilität
- Sharpe Ratio
- Marktkapitalisierung
- 52-Wochen Hoch/Tief
- YTD Performance

**Moats (Wettbewerbsvorteile)**:
- 3 Moats mit Beschreibung

**Financial Highlights**:
- 3 Key-Metriken mit Beschreibung

**Kategorie & Sektor**:
- Badges

**News**:
- Letzte News zu diesem Ticker
- CTA: "Alle News ansehen"

**Actions**:
- "Zu Portfolio hinzufügen"
- "Preisalarm erstellen"
- "Factsheet ansehen" (für ETFs)

**Erwartete Aktionen**:
- Aktie analysieren
- Zu Portfolio hinzufügen
- Preisalarm erstellen
- News lesen

### Touchpoint 4.9: Newsroom (/newsroom)
**Ziel**: Aktuelle Nachrichten zu allen relevanten Aktien

**Kritische Elemente**:
- Filter: Ticker, Priorität (Wichtig, Mittel, Niedrig), Zeitraum
- News-Liste (Cards):
  - Bild
  - Titel
  - Beschreibung (Teaser)
  - Ticker (Badge)
  - Priorität (Badge mit Farbe)
  - Quelle
  - Datum
  - CTA: "Mehr lesen" (öffnet URL)
- Pagination oder Infinite Scroll

**Erwartete Aktionen**:
- News lesen
- Nach Ticker filtern
- Zu Aktien-Detail navigieren

### Touchpoint 4.10: Kategorien (/categories)
**Ziel**: Aktien nach Investmenttyp durchsuchen

**Kritische Elemente**:
- Kategorie-Cards:
  - Dividendenaktien
  - Wachstumsaktien
  - ETFs
- Für jede Kategorie:
  - Beschreibung
  - Anzahl Aktien
  - Durchschnittliche Dividendenrendite (für Dividendenaktien)
  - Durchschnittliche Performance (für Wachstumsaktien)
  - CTA: "Aktien ansehen"
- Aktien-Liste (gefiltert nach Kategorie):
  - Ticker, Name
  - Aktueller Preis
  - Performance (YTD)
  - Dividendenrendite
  - Score
  - CTA: "Details ansehen"

**Erwartete Aktionen**:
- Kategorie wählen
- Aktien durchsuchen
- Zu Aktien-Detail navigieren

### Touchpoint 4.11: Sektoren (/sectors)
**Ziel**: Aktien nach Branche durchsuchen

**Kritische Elemente**:
- Sektor-Cards:
  - Technology
  - Healthcare
  - Finance
  - Automotive
  - Energy
  - Consumer Goods
  - etc.
- Für jeden Sektor:
  - Beschreibung
  - Anzahl Aktien
  - Durchschnittliche Performance
  - CTA: "Aktien ansehen"
- Aktien-Liste (gefiltert nach Sektor)
- Sektor-Performance-Vergleich (Chart)

**Erwartete Aktionen**:
- Sektor wählen
- Aktien durchsuchen
- Sektor-Performance vergleichen

### Touchpoint 4.12: Preisalarme (/price-alerts)
**Ziel**: Alle Preisalarme verwalten

**Kritische Elemente**:
- Filter: Status (aktiv, ausgelöst, deaktiviert), Ticker
- Alarm-Liste (Tabelle):
  - Ticker
  - Trigger-Typ (above, below, change_percent)
  - Zielpreis / Prozentsatz
  - Aktueller Preis
  - Status (Badge)
  - Benachrichtigungskanal (Email, WhatsApp)
  - Erstellt am
  - Actions: "Bearbeiten", "Löschen", "Deaktivieren"
- CTA: "Neuer Alarm"

**Neuer Alarm Modal**:
- Ticker wählen
- Trigger-Typ wählen
- Zielpreis / Prozentsatz eingeben
- Benachrichtigungskanal wählen (Email, WhatsApp)
- CTA: "Alarm erstellen"

**Erwartete Aktionen**:
- Alarme erstellen
- Alarme verwalten
- Benachrichtigungen erhalten

### Touchpoint 4.13: Dividendenkalender (/dividends)
**Ziel**: Übersicht über erwartete und erhaltene Dividenden

**Kritische Elemente**:
- Filter: Portfolio, Jahr, Monat
- Kalender-Ansicht:
  - Monatliche Übersicht
  - Dividenden-Termine (Ex-Date, Payment-Date)
  - Erwarteter Betrag
  - Status (erwartet, erhalten)
- Listen-Ansicht (Tabelle):
  - Datum
  - Ticker
  - Portfolio
  - Dividende pro Aktie
  - Anzahl Aktien
  - Gesamt-Dividende (CHF)
  - Status
- Zusammenfassung:
  - Erwartete Dividenden (dieses Jahr)
  - Erhaltene Dividenden (dieses Jahr)
  - Durchschnittliche Dividendenrendite

**Erwartete Aktionen**:
- Dividenden-Termine einsehen
- Dividenden als "erhalten" markieren
- Zu Portfolio-Detail navigieren

### Touchpoint 4.14: Signale (/signals)
**Ziel**: Trading-Signale basierend auf technischer und fundamentaler Analyse

**Kritische Elemente**:
- Filter: Signal-Typ (Kaufen, Verkaufen, Halten), Ticker, Sektor
- Signal-Liste (Cards):
  - Ticker & Name
  - Signal-Typ (Badge mit Farbe: Grün = Kaufen, Rot = Verkaufen, Gelb = Halten)
  - Grund (z.B. "Unterbewertung", "Technischer Breakout", "Dividendenerhöhung")
  - Confidence (0-100%)
  - Erstellt am
  - CTA: "Details ansehen"
- Signal-Detail:
  - Ausführliche Begründung
  - Chart mit Signal-Markierung
  - Fundamentaldaten
  - CTA: "Zu Portfolio hinzufügen"

**Erwartete Aktionen**:
- Signale durchsuchen
- Signal-Details lesen
- Aktien zu Portfolio hinzufügen

### Touchpoint 4.15: Chat/Support (/chat)
**Ziel**: Direkter Support und Feedback-Kanal

**Kritische Elemente**:
- Chat-Interface (ähnlich wie Messenger)
- Nachrichtenverlauf
- Eingabefeld
- Optional: AI-Chatbot für FAQ
- Optional: Live-Chat mit Support-Team

**Erwartete Aktionen**:
- Fragen stellen
- Feedback geben
- Support erhalten

### Touchpoint 4.16: Rechner (/rechner)
**Ziel**: Finanzrechner für verschiedene Szenarien

**Mögliche Rechner**:
1. **Zinseszins-Rechner**
   - Startkapital
   - Monatliche Sparrate
   - Erwartete Rendite
   - Zeitraum
   - Ergebnis: Endkapital

2. **Dividenden-Rechner**
   - Portfolio-Wert
   - Durchschnittliche Dividendenrendite
   - Reinvestition (Ja/Nein)
   - Zeitraum
   - Ergebnis: Dividenden-Einkommen

3. **Steuer-Rechner**
   - Realisierte Gewinne
   - Kanton
   - Ergebnis: Geschätzte Steuerlast

4. **Retirement-Rechner**
   - Aktuelles Alter
   - Ziel-Alter (Rente)
   - Aktuelles Vermögen
   - Monatliche Sparrate
   - Erwartete Rendite
   - Ergebnis: Vermögen bei Rente

**Erwartete Aktionen**:
- Rechner nutzen
- Szenarien durchspielen
- Ergebnisse speichern/teilen

### Touchpoint 4.17: Einstellungen (/einstellungen)
**Ziel**: Persönliche Einstellungen verwalten

**Kritische Bereiche**:

**Profil**:
- Name
- Email
- Telefonnummer
- Passwort ändern

**Benachrichtigungen** (/settings/notifications):
- Email-Benachrichtigungen (An/Aus)
- WhatsApp-Benachrichtigungen (An/Aus)
- Benachrichtigungs-Typen:
  - Preisalarme
  - Dividenden-Zahlungen
  - Portfolio-Updates
  - News (wichtige)
  - Newsletter

**Abonnement**:
- Aktueller Plan (Premium)
- Zahlung am (Datum)
- Zahlungsmethode
- CTA: "Abonnement kündigen" (falls Abo-Modell)
- Rechnungen herunterladen

**Datenschutz**:
- Daten exportieren
- Account löschen

**Erwartete Aktionen**:
- Profil aktualisieren
- Benachrichtigungen anpassen
- Abonnement verwalten

### Touchpoint 4.18: Kontakt (/kontakt)
**Ziel**: Kontaktmöglichkeiten anbieten

**Kritische Elemente**:
- Kontaktformular:
  - Name
  - Email
  - Betreff
  - Nachricht
  - CTA: "Senden"
- Alternative Kontaktmöglichkeiten:
  - Email-Adresse
  - Telefonnummer (optional)
  - Social Media Links

**Erwartete Aktionen**:
- Nachricht senden
- Support kontaktieren

---

## Stage 5: Retention & Engagement

### Touchpoint 5.1: Email-Benachrichtigungen
**Typen**:
- Willkommens-Email (nach Registrierung)
- Onboarding-Tipps (Serie)
- Preisalarm ausgelöst
- Dividende erhalten
- Portfolio-Performance-Update (wöchentlich/monatlich)
- Wichtige News zu gehaltenen Aktien
- Newsletter (optional)

**Erwartete Aktionen**:
- Email öffnen
- Zurück zur Plattform navigieren
- Features nutzen

### Touchpoint 5.2: WhatsApp-Benachrichtigungen
**Typen**:
- Preisalarm ausgelöst (sofort)
- Dividende erhalten
- Wichtige News

**Erwartete Aktionen**:
- Nachricht lesen
- Zur Plattform navigieren

### Touchpoint 5.3: Push-Benachrichtigungen (optional für später)
**Typen**:
- Preisalarme
- Portfolio-Updates
- News

---

## Stage 6: Admin-Bereich (Owner)

### Touchpoint 6.1: Admin-Dashboard (fehlend, aber benötigt)
**Ziel**: Übersicht über Plattform-Metriken

**Kritische Elemente**:
- Benutzer-Statistiken:
  - Gesamt-Benutzer
  - Neue Benutzer (heute, diese Woche, diesen Monat)
  - Aktive Benutzer
  - Premium-Benutzer
  - Conversion-Rate
- Finanz-Statistiken:
  - Umsatz (heute, diese Woche, diesen Monat)
  - Durchschnittlicher Umsatz pro Benutzer
- Portfolio-Statistiken:
  - Gesamt-Portfolios
  - Live-Portfolios
  - Durchschnittliche Portfolios pro Benutzer
- System-Statistiken:
  - API-Calls
  - Fehlerrate
  - Uptime

### Touchpoint 6.2: Aktien-Verwaltung (/admin/stocks)
**Ziel**: Aktien-Stammdaten verwalten

**Kritische Elemente**:
- Aktien-Liste (Tabelle) mit Suche & Filter
- Actions: "Neue Aktie", "Bearbeiten", "Löschen", "Daten aktualisieren"
- Bulk-Actions: "Alle Daten aktualisieren"
- Aktien-Detail-Modal:
  - Alle Felder bearbeitbar
  - Logo-Upload
  - Factsheet-Upload (für ETFs)
  - Moats bearbeiten
  - Financial Highlights bearbeiten
  - Score manuell setzen oder automatisch berechnen

**Erwartete Aktionen**:
- Aktien hinzufügen
- Aktien bearbeiten
- Daten aktualisieren

### Touchpoint 6.3: System-Logs (/admin/logs)
**Ziel**: Fehler und System-Events überwachen

**Kritische Elemente**:
- Log-Liste (Tabelle):
  - Zeitstempel
  - Level (Error, Warning, Info)
  - Nachricht
  - User (falls relevant)
  - Stack-Trace
- Filter: Level, Zeitraum, User
- Suche

**Erwartete Aktionen**:
- Logs überwachen
- Fehler debuggen

### Touchpoint 6.4: Secret-Verwaltung (/admin/secrets)
**Ziel**: API-Keys und Secrets verwalten

**Kritische Elemente**:
- Secret-Liste:
  - Name (z.B. FINNHUB_API_KEY)
  - Wert (maskiert)
  - Zuletzt aktualisiert
  - Actions: "Bearbeiten", "Löschen"
- CTA: "Neues Secret"

**Erwartete Aktionen**:
- Secrets hinzufügen
- Secrets aktualisieren

---

## Kritische Lücken im aktuellen System

### Fehlende Seiten (MVP-kritisch):
1. **Pricing-Seite** - Benutzer wissen nicht, was die Plattform kostet
2. **Payment Success/Cancel** - Kein Feedback nach Zahlung
3. **Über uns / Team** - Kein Vertrauen ohne Gesichter
4. **FAQ** - Keine Antworten auf häufige Fragen
5. **AGB & Datenschutz** - Rechtlich notwendig
6. **Admin-Dashboard** - Keine Übersicht über Plattform-Metriken

### Unklare Flows:
1. **Onboarding** - Wie sieht der Onboarding-Flow genau aus?
2. **Free vs. Premium** - Welche Features sind kostenlos, welche Premium?
3. **Demo-Portfolio** - Was ist das Demo-Portfolio genau?
4. **Pricing-Modell** - Einmalzahlung oder Abo? Verschiedene Tiers?
5. **WhatsApp-Setup** - Wie aktiviert der Benutzer WhatsApp-Alerts?

### Fehlende Features (Nice-to-have für später):
1. **Portfolio-Sharing** - Portfolios mit anderen teilen
2. **Social Features** - Community, Kommentare, Likes
3. **Watchlist** - Aktien beobachten ohne zu kaufen
4. **Backtesting** - Historische Performance simulieren
5. **AI-Empfehlungen** - Personalisierte Aktien-Empfehlungen
6. **Mobile App** - Native iOS/Android App

---

## Nächste Schritte

1. **Klärung der offenen Fragen** (mit Owner)
2. **UI-Mockups erstellen** für alle kritischen Touchpoints
3. **MVP-Priorisierung** - Was muss sofort, was kann später?
4. **Roadmap entwickeln** - Stabilität → Features → Wachstum
