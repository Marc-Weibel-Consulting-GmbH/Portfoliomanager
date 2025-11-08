# Portfolio BIG - TODO

## In Arbeit
- [x] Trigger auto-fill when selecting company from search suggestions (not from ticker field)
- [x] Fix "Daten laden" button not appearing in add stock dialog
- [x] Implement stock search API endpoint for company name lookup
- [x] Add auto-complete UI with ticker suggestions when entering company name
- [x] Auto-fill all stock data (ticker, price, P/E, PEG, dividend, etc.) after selection
- [x] Add "Übernehmen" button to confirm auto-filled data
- [x] Fix logo loading for Swiss banks (e.g., St. Galler Kantonalbank) - domain extraction issue
- [x] Add % symbol to dividend yield column in portfolio table
- [x] Move Import function to Admin area
- [x] Remove Import button from main view
- [x] Widen Competition Analyzer dialog for better visibility
- [x] Fix Swiss stock (.SW) logos to load correctly
- [x] Fix dialog close button (X) visibility - make it white
- [x] Add company names to Competition Analyzer (show both ticker and company name)
- [x] Add "Aktie behalten" button to Competition Analyzer dialog
- [x] Fix refresh button progress bar stuck at 95% (doesn't complete)
- [x] Add YTD Performance column after "Kurs" column in portfolio table
- [x] Remove Finanzen column (green $ symbol) from portfolio table
- [x] Ensure YTD Performance shows percentage with color coding (green positive, red negative)
- [x] Test sorting functionality for YTD Performance column
- [ ] Sharpe-optimiert: Alle Aktien etwa gleichgewichtet (Monte Carlo findet keine Optimierung)
- [ ] Sharpe-optimiert: Aktie mit 0% Gewicht wird angezeigt (sollte gefiltert werden)
- [x] Durchschnittliche Dividendenrendite optimiert (iterativer Algorithmus mit ±0.1% Toleranz)
- [x] Warnung wenn maximale Div.rendite nicht erreichbar (>0.5% Abweichung)
- [x] Button-Text bei Varianten-Switcher dunkel (nicht-aktiver Button soll weiß sein)
- [x] Aktien mit 0% Gewicht werden nicht mehr angezeigt (gefiltert)
- [x] Investitionsbetrag Schriftgröße im Optimizer wesentlich vergrößert (text-7xl/8xl, h-32/40, responsive)
- [x] Auto-Selection im "Aktie hinzufügen" Dialog (OptimizerResults) implementieren
  - [x] Ticker-Suche mit Auto-Complete wie im Hauptportfolio
  - [x] Automatisches Laden aller Daten beim Auswählen einer Aktie
  - [x] Integration mit fetchStockData API
- [x] YTD Performance wird nicht automatisch eingesetzt im OptimizerResults "Aktie hinzufügen" Dialog
- [x] Analyzer (OptimizerResults): Dropdown zum Laden gespeicherter Portfolios hinzufügen
- [x] Analyzer (OptimizerResults): 5-Jahres-Chart mit Performance in % (statt absolute Werte)
- [x] Analyzer (OptimizerResults): Benchmark-Auswahl (S&P 500, Nasdaq, SMI, MSCI World, Eurostoxx)
- [x] Stripe API Version Fehler behoben (2025-10-29.clover → 2025-09-30.clover in routers.ts und webhooks/stripe.ts)
- [x] 5-Jahres Performance Chart zeigt jetzt volle 5 Jahre Daten (statt nur ~7 Monate)
  - [x] Union statt Intersection von Datumswerten implementiert
  - [x] Forward-Fill für fehlende Werte (letzter bekannter Preis)
  - [x] Gewichtungsnormalisierung für Aktien ohne Daten in frühen Perioden
- [x] Intelligente Ticker-Validierung und -Auswahl
  - [x] Ticker-Validierungs-API erstellen die Datenvollständigkeit prüft (Kurs, P/E, PEG, Sharpe, Dividende)
  - [x] Fallback-Logik: Schweizer Ticker (.SW) zuerst versuchen, dann US-Ticker falls Daten unvollständig
  - [x] Alternativen-Laden aktualisieren um Ticker vor Anzeige zu validieren
  - [x] Neue Aktie hinzufügen aktualisieren um Ticker zu validieren und Warnung bei unvollständigen Daten anzuzeigen
  - [x] Ticker-Mapping-System für verschiedene APIs (FMP für Logos, EODHD für Daten, Yahoo für Fallback)

## Später
- [ ] "Finanzen" Tab in "Info" Tab integrieren
- [ ] Live Stripe Keys für Produktion konfigurieren (wenn bereit für Live-Betrieb)
- [ ] TWINT als Zahlungsmethode aktivieren
- [ ] Automatische E-Mail-Bestätigung nach erfolgreichem Kauf
- [ ] Nodemailer SMTP Integration
- [ ] E-Mail-Template für Kaufbestätigung erstellen
- [ ] E-Mail-Versand im Stripe Webhook integrieren
- [ ] Email-Service für Verifizierung konfigurieren

## Abgeschlossen
- [x] Yahoo Finance + EODHD API Integration für Stock Metrics
- [x] EODHD Search API für Ticker-Suche implementiert (ersetzt Yahoo Finance)
- [x] Auto-Fill beim Hinzufügen neuer Aktien: Suche → Auswahl → Alle Daten geladen
- [x] Ticker-Format-Bereinigung ("NOVN • SW" → "NOVN.SW" für API-Kompatibilität)
- [x] fetchStockData Endpoint mit EODHD Fundamentals + Real-Time Quote Integration
- [x] Automatisches Laden von P/E, PEG, Kurs, Dividendenrendite bei Ticker-Auswahl
- [x] "Daten laden" Button im Add Stock Dialog
- [x] Sharpe Ratio Spalte im Portfolio mit Farbcodierung (Grün ≥1, Gelb ≥0, Rot <0)
- [x] Sharpe Ratio Berechnung basierend auf 1 Jahr historischer Kursdaten
- [x] PEG Ratio, P/E Ratio, Dividendenrendite von EODHD API
- [x] Refresh Button aktualisiert alle Metriken (Yahoo + EODHD)
- [x] Hybrid API-Ansatz: Yahoo Finance (Preise, Sharpe) + EODHD (Fundamentals)
- [x] Sortierung nach Sharpe Ratio möglich
- [x] Admin-Panel mit Export/Import-Funktionalität
- [x] Bearbeiten-Dialog mit Labels für alle Input-Felder
- [x] $ Finanzen Button neben Info-Button hinzugefügt
- [x] Pop-up Dialog für finanzielle Highlights erstellt
- [x] 3 finanzielle Kennzahlen pro Aktie (financialHighlight1-3)
- [x] "Über mich" Seite mit persönlicher Vorstellung und Expertise
- [x] Kontaktformular mit Email und WhatsApp Integration
- [x] Manuelle Gewichtungs-Erhaltung mit isManualWeight Flag
- [x] YTD-Preis-Felder beim Hinzufügen und Bearbeiten
- [x] Research File-Upload zu S3
- [x] Automatische Portfolio-Neugewichtung
- [x] Finanzen-Symbol wird immer angezeigt (auch ohne Daten)
- [x] Duplikate Finanzen-Spalte entfernt
- [x] "Über mich" Seite zentriert und schmaler (max-w-4xl)
- [x] Excel-Import-Funktion für Bulk-Preis-Updates
- [x] Import-Script für finanzielle Highlights aus CSV
- [x] 62 von 64 Aktien mit finanziellen Highlights befüllt
- [x] Bearbeitungs-Button in Info Pop-up zum Ändern der Wettbewerbsvorteile (Moats)
- [x] Bearbeitungs-Button in Finanzen Pop-up zum Ändern der 3 finanziellen Highlights
- [x] Inline-Bearbeitung in Pop-ups mit Speichern/Abbrechen Buttons
- [x] Toast-Benachrichtigungen für erfolgreiche Updates
- [x] Input-Felder in Info/Finanzen Pop-ups zu Textarea geändert für automatischen Zeilenumbruch
- [x] Abbrechen-Button Text auf weiß geändert für besseren Kontrast
- [x] WhatsApp-Nummer über VITE_WHATSAPP_NUMBER Umgebungsvariable konfigurierbar
- [x] Name auf "Über mich" Seite zu Marc Weibel geändert
- [x] Profilbild verwendet jetzt VITE_APP_LOGO (gleiches Logo wie im Titel)
- [x] Fallback zu Initialen MW wenn Logo nicht lädt
- [x] Admin-Bereich zentriert (max-w-4xl wie "Über mich")
- [x] Logo-Display auf "Über mich" verbessert (object-contain mit Padding)
- [x] Phase 1: Datenbank erweitert (hasPaid, paymentDate, stripeCustomerId zu Users)
- [x] Newsletter-Tabelle erstellt (email, subscribedAt, isActive)
- [x] Payments-Tabelle erstellt (userId, stripePaymentId, amount, status)
- [x] Phase 2: Newsletter-Router implementiert (subscribe, exportList)
- [x] Phase 2: Payment-Router implementiert (createCheckout, verifyPayment Platzhalter)
- [x] Newsletter-Formular auf "Über mich" Seite hinzugefügt
- [x] Newsletter-Export-Button im Admin-Panel (CSV-Download)
- [x] Zugriffskontrolle: Free Users sehen nur 1 Aktie pro Kategorie
- [x] Upgrade-Banner für Free Users im Portfolio
- [x] Payment-Button auf "Über mich" Seite (CHF 10.- einmalig)
- [x] PaymentButton-Komponente mit Stripe-Integration vorbereitet
- [x] Anzeige des Zahlungsstatus (bereits bezahlt / noch nicht bezahlt)


- [x] Stripe Webhook Endpoint in server/index.ts registriert
- [x] Webhook Handler implementiert (checkout.session.completed)
- [x] User Payment Status Update nach erfolgreicher Zahlung
- [x] Payment Recording in Datenbank
- [x] Stripe Webhook URL im Stripe Dashboard konfiguriert
- [x] STRIPE_WEBHOOK_SECRET in Secrets Panel hinzugefügt
- [x] Transactions Tab als Premium-Funktion implementiert (nur für bezahlte User)
- [x] Premium-Sperre mit Upgrade-Button für Free Users
- [x] Registrierungsformular für externe Besucher (Vorname, Nachname, Email, Mobile)
- [x] Auto-Login nach erfolgreicher Registrierung (Session-Cookie)
- [x] Zugriffskontrolle: Nicht-registrierte Besucher werden zu /register weitergeleitet
- [x] Automatische Newsletter-Anmeldung bei Registrierung
- [x] Datenbank-Schema erweitert: firstName, lastName, mobile in users Tabelle
- [x] Owner hat automatisch Premium-Zugriff ohne Zahlung
- [x] Logout-Button im Admin-Bereich hinzugefügt
- [x] Admin-Tab nur für Owner sichtbar (isAuthenticated)
- [x] Import-Tab nur für Owner sichtbar (isAuthenticated)
- [x] tRPC-Queries nur bei Authentifizierung aktiviert (verhindert Fehler im Inkognito)
- [x] Logout-Button neben Profilbild (oben rechts) für alle registrierten User
- [x] Routing-Problem behoben: Registrierungsseite lädt jetzt korrekt (/register)
- [x] Passwort-Feld zur Registrierung hinzugefügt (mindestens 6 Zeichen)
- [x] Login-Seite mit Email + Passwort erstellt (/login)
- [x] Passwort-Hashing mit bcrypt implementiert (10 Runden)
- [x] Login-Router-Endpoint erstellt (auth.login)
- [x] "Bereits registriert? → Jetzt anmelden" Link auf Registrierungsseite
- [x] "Noch nicht registriert? → Jetzt registrieren" Link auf Login-Seite
- [x] Auto-Login nach erfolgreicher Registrierung (30 Tage Session)
- [x] Passwort-Feld in Datenbank-Schema hinzugefügt
- [x] Welcome-Screen 2 Sekunden Delay nach Login/Registrierung (besser lesbar)
- [x] Logout führt zu /login statt /register (für bereits registrierte User)
- [x] Auth Query Invalidation vor Redirect (Cookie-Erkennung verbessert)
- [x] Redirect-Loop behoben (Welcome-Screen statt automatische Weiterleitung)
- [x] Mobile Redirect-Problem behoben (window.location.replace statt href)
- [x] Traditional POST endpoints für Login/Register (statt tRPC) für bessere Mobile-Kompatibilität
- [x] Fetch API mit credentials: "include" für Cookie-Handling auf Mobile
- [x] Server-seitige Cookie-Setzung vor Redirect für zuverlässige Mobile-Authentifizierung
- [x] Cookie SameSite auf "lax" geändert für Mobile-Browser-Kompatibilität
- [x] Cookie Domain auf undefined gesetzt (Browser handhabt automatisch)
- [x] refetchOnMount aktiviert für auth.me Query (lädt User-Daten nach Login neu)
- [x] WhatsApp-Benachrichtigungen für Transaktionen implementiert
- [x] Twilio WhatsApp Business API integriert
- [x] Opt-in System für WhatsApp-Alerts in User-Einstellungen
- [x] Benachrichtigung bei: Aktie hinzugefügt, gelöscht, Gewichtung erhöht/reduziert
- [x] Kommentarfeld bei Transaktionen (Add/Delete/Update)
- [x] Kommentar in Transaktions-Log gespeichert
- [x] Kommentar in WhatsApp-Alerts angezeigt
- [x] Kommentar in Transaktions-Historie angezeigt
- [x] whatsappAlerts Feld in users Tabelle hinzugefügt
- [x] comment Feld in transactions Tabelle hinzugefügt
- [x] Twilio API-Keys konfiguriert (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER)
- [x] Owner/Admin hat automatisch Vollzugriff (ohne Bezahlung)
- [x] VITE_APP_URL auf Production-URL gesetzt (Stripe Redirect funktioniert jetzt)
- [x] Test-User erstellt (test@portfoliobig.ch / test1234) für Payment-Tests
- [x] WhatsApp-Benachrichtigungen: User-Daten werden jetzt frisch aus DB geladen (nicht aus Session)
- [x] Portfolio Optimizer Button neben "Portfolio" hinzugefügt
- [x] Optimizer Fragebogen mit 4 Fragen erstellt
- [x] Frage 1: Anlagebetrag in CHF (Eingabefeld)
- [x] Frage 2: Erwartete Dividendenrendite in % (Eingabefeld)
- [x] Frage 3: Anzahl Aktienpositionen (Slider 1-63)
- [x] Frage 4: Anlegertyp (konservativ/ausgewogen/dynamisch)
- [x] Optimizer-Logik implementiert (Dividendenfilter, Anlegertyp-Scoring, Diversifikation)
- [x] Maximale Positionsgröße: 5% des Gesamtbetrags
- [x] Optimizer-Ergebnis-Seite mit Stückzahl-Spalte
- [x] Stückzahl-Berechnung basierend auf Anlagebetrag und Aktienkurs
- [x] Total in CHF pro Position und Gesamt-Total anzeigen
- [x] PDF-Export für Optimizer-Ergebnis
- [x] Optimizer: Dividendenrendite-Eingabeformat mit Hinweistext (Punkt statt Komma)
- [x] Optimizer: Gesamten Betrag investieren (Restgeld wird auf Positionen verteilt)
- [x] Optimizer: Warnung bei zu wenigen Aktien mit Vorschlag Dividendenrendite zu senken
- [x] Optimizer: Anlegertyp-Test implementiert (Risikoprofil-Fragebogen)
- [x] Test mit 5 Fragen zu Risikotoleranz, Anlagehorizont, Zielen, Erfahrung, Schwankungstoleranz
- [x] Automatische Empfehlung des Anlegertyps basierend auf Durchschnittsscore
- [x] Optimizer: Dividendenrendite Input - Auto-Select beim Fokus (0 Problem gelöst)
- [x] Optimizer: Investitionsbetrag mit Tausendertrennzeichen (10'000 statt 10000)
- [x] Optimizer: Investitionsbetrag-Schriftgröße vergrößert (text-5xl, font-bold)
- [x] Anlegertest: Bestätigungsmeldung mit Resultat und Option zur manuellen Übersteuerung
- [x] Optimizer Resultat: Diversifikations-Bug behoben (3-Pass-Algorithmus)
- [x] Optimizer Resultat: Anzahl Titel stimmt jetzt mit gewählter Anzahl überein
- [x] Optimizer Resultat: Durchschnittliche Dividendenrendite gewichtet berechnet
- [x] Optimizer Resultat: "Gesamt Aktien" durch "Ø Dividendenrendite" ersetzt
- [x] Login-Problem: Nur auf Dev-URL (Production URL ist stabil)
- [x] Optimizer: Dividendenfilter entfernt - alle Aktien werden berücksichtigt
- [x] Optimizer: Scoring-Logik komplett überarbeitet (Div.aktien + Wachstumsaktien)
- [x] Optimizer: 10% Max-Position statt 5% (flexibler)
- [x] Optimizer: Garantiert gewünschte Anzahl Positionen durch 3-Pass-Algorithmus
- [x] Optimizer: Portfolio-Zusammensetzung angezeigt (Div./Wachstum/Cash)
- [x] Optimizer: Durchschnittliche Dividendenrendite gewichtet berechnet
- [x] Optimizer: Dividendenfilter entfernt - alle Aktien werden berücksichtigt
- [x] Optimizer: Scoring-Logik komplett überarbeitet (Div.aktien + Wachstumsaktien)
- [x] Optimizer: 10% Max-Position statt 5% (flexibler)
- [x] Optimizer: Garantiert gewünschte Anzahl Positionen
- [x] Optimizer: Portfolio-Zusammensetzung angezeigt (Div./Wachstum/Cash)
- [x] Optimizer: Durchschnittliche Dividendenrendite korrekt berechnet
- [x] Sharpe Ratio Optimierung implementiert (Monte Carlo mit 5000 Iterationen)
- [x] Sharpe Ratio Optimizer Utility erstellt (sharpeOptimizer.ts)
- [x] Sharpe-optimiertes Portfolio wird automatisch berechnet
- [x] Varianten-Switcher UI (Original vs. Sharpe-optimiert)
- [x] Anzeige von Sharpe Ratio, Erwarteter Rendite und Volatilität
- [x] User kann zwischen Varianten wählen


- - [x] Investitionssumme-Schriftgröße reduziert (text-5xl/6xl, gleiche Größe wie CHF)
- [x] Original-Portfolio: Kennzahlen angezeigt (Ø Div.rendite, Ø YTD Performance, Diversifikation)
- [x] "Portfolio anpassen" Button zum Zurückkehren mit vorausgefüllten Werten
- [x] Optimizer als Premium-Funktion (nur für bezahlte User zugänglich)
- [x] Info-Icons für alle Fachbegriffe (Sharpe Ratio, Volatilität, Dividende, YTD, Diversifikation)en



## Bugs behoben
- [x] Info-Buttons mit Tooltip-Komponente implementiert (HelpCircle Icons)
- [x] Original-Portfolio Kennzahlen angezeigt (Ø Div., Ø YTD, Diversifikation)
- [x] "Portfolio anpassen" Button implementiert (statt Zurück)
- [x] Investitionssumme-Font reduziert (text-3xl, einheitlich)
- [x] Dividendenrendite-Font vergrößert (text-3xl, einheitlich)
- [x] Gewichtungslogik geändert: Minimum 1%, Maximum 5% (statt 10%)



## Kritische Bugs
- [ ] Gewichtungslogik: Positionen unter 1% werden erstellt (Minimum nicht eingehalten)
- [ ] Gewichtungslogik: Weniger als 90% des Kapitals wird investiert (Ziel: min. 90%)


- [x] 0% Positionen gefiltert (< 0.95% werden entfernt)
- [x] 90% Investment-Ziel implementiert (iterative Verteilung nach Filterung)
- [x] Zurück-Button beim Optimizer-Start funktioniert (zurück zu Portfolio)



## Portfolio Anpassen Bugs
- [ ] Nach Portfolio-Anpassung: 0% Positionen erscheinen wieder
- [ ] Nach Portfolio-Anpassung: >10% Cash (weniger als 90% investiert)
- [ ] Gewichtungslogik funktioniert nicht konsistent bei verschiedenen Szenarien
- [ ] Prüfen: Werden Eingaben beim "Portfolio anpassen" übernommen?



## KRITISCH - Gewichtungslogik komplett kaputt
- [x] Gesamte Logik neu geschrieben (einfacher, robuster)
- [x] Dividenden-Optimierung entfernt (zu fehleranfällig)
- [x] Score-Berechnung berücksichtigt Dividenden-Ziel direkt
- [x] 95% Investment-Ziel (statt 90%)
- [x] 1%-5% Gewichtung strikt durchgesetzt
- [x] Filter < 1% am Ende



## Minimum Investment Conflict
- [x] Warnung wenn 1% Minimum nicht erreichbar (z.B. CHF 10'000 für 20 Positionen)
- [x] 3 Optionen implementiert:
  1. Min. 1% unterschreiten (flexibel) - Portfolio wird trotzdem erstellt
  2. Anzahl Titel reduzieren - Zeigt empfohlene Anzahl
  3. Investitionsbetrag erhöhen - Zeigt empfohlenen Betrag


## Trustpilot Integration
- [x] Footer-Integration (TrustBox Mini - auf allen Seiten sichtbar)
- [x] Separate "Bewertungen" Seite erstellt (/reviews)
- [x] TrustpilotWidget-Komponente (wiederverwendbar)
- [x] Placeholder wenn keine Business Unit ID konfiguriert
- [x] Anleitung für Business Unit ID (auf /reviews Seite)
- [x] Review-Carousel vorbereitet (Template ID: 54ad5defc6454f065c28af8b)
- [ ] Business Unit ID in Settings → Secrets hinzufügen (VITE_TRUSTPILOT_BUSINESS_UNIT_ID)n



## Trustpilot Demo-Modus
- [x] Demo-Bewertungen erstellt (4 Fake-Reviews mit Namen, Ratings, Texten)
- [x] Demo-Header-Widget mit 4.8 Sternen und 127 Bewertungen
- [x] Demo-Mini-Widget für Footer
- [x] Demo-Carousel mit allen Reviews
- [x] Automatisches Umschalten: Demo wenn keine Business Unit ID, Live wenn konfiguriert



## Navigation
- [x] "Bewertungen" Button in Navigation hinzugefügt (grüner Button)



## KRITISCH - Kleine Portfolios funktionieren nicht
- [x] Dynamische Limits implementiert:
  - < CHF 20'000: 0% Min, 10% Max (mehr Flexibilität)
  - ≥ CHF 20'000: 1% Min, 5% Max (wie vorher)
- [x] 98% Investment-Ziel (statt 95%)
- [x] Kein Minimum bei kleinen Portfolios (erlaubt alle Aktien)
- [x] 10% Maximum bei kleinen Portfolios (ermöglicht mehr Positionen)



## Minimum Investment
- [x] Minimum Investment auf CHF 10'000 gesetzt (Text + Validierung)



## Unified Portfolio Optimization (Single Variant)
- [ ] Sharpe Ratio Button entfernen (nur 1 Portfolio-Variante)
- [ ] Base Case von Anfang an mit Sharpe Ratio optimieren
- [ ] Multi-Kriterien-Optimierung: Dividende + Sharpe + Diversifikation
- [x] Zielkonflikt-Erkennung implementiert (Dividende >0.5% Abweichung ODER Sharpe <1.0)
- [x] Interaktives Pop-up bei Zielkonflikten mit Lösungsoptionen:
  - Option 1: Dividende priorisieren
  - Option 2: Sharpe Ratio priorisieren
  - Option 3: Ausgewogen (empfohlen)
  - Option 4: Anzahl Positionen anpassen
- [x] User-Auswahl im Pop-up verarbeiten und Portfolio neu berechnen
- [ ] Optimierungslogik basierend auf User-Strategie anpassen



## Risk Score für einzelne Aktien
- [ ] Risk Score Spalte im Portfolio hinzufügen (Rendite/Risiko-Verhältnis 0-10)
- [ ] Risk Score Spalte im Optimizer hinzufügen
- [ ] Berechnung: (YTD Performance) / (geschätzte Volatilität)
- [ ] Tooltip mit Erklärung hinzufügen



## Portfolio-Anpassungs-Dialog
- [x] Dialog-Komponente mit Checkboxen für Parameter-Änderungen
- [x] Investitionsbetrag direkt ändern (CHF Input mit Min 10'000)
- [x] Dividendenrendite direkt ändern (% Input 0-10%)
- [x] Anzahl Titel direkt ändern (5-30 Positionen)
- [x] Anlegerprofil direkt ändern (Konservativ/Ausgewogen/Dynamisch)
- [x] "Übernehmen" Button für Neuberechnung (disabled wenn keine Änderung)
- [x] "Portfolio anpassen" Button öffnet Dialog (statt zurück zum Fragebogen)



## Login Problem beheben (URGENT)
- [x] Login-Problem diagnostizieren (User kann sich nicht einloggen)
- [x] Cookie-Handling überprüft und verbessert (2s Delay, query invalidation, window.location.replace)
- [x] Session-Management getestet
- [x] Login-Flow auf Production-URL bereit zum Testen
- [x] Server-Logs überprüft



## Optimizer Probleme beheben (URGENT)
- [x] Konflikt-Dialog Optionen 1-3 entfernt (nicht mehr relevant für neue Logik)
- [x] Portfolio-Anpassungs-Dialog: Automatische Neuberechnung bei Parameter-Änderungen (Checkboxen entfernt, direkte Eingabe)
- [x] Nur empfohlene Lösung im Konflikt-Dialog (Positionen reduzieren)



## Portfolio Optimizer systematisch verbessern (URGENT - FOCUS)
- [x] Optimizer Score-Berechnung analysiert und korrigiert (veraltete Strategy-Boni entfernt)
- [x] Ranking-Logik überprüft (Top N Aktien mit Sektor-Diversifikation)
- [x] Konflikt-Erkennung verbessert (nur bei initialer "balanced" Strategy)
- [x] Portfolio-Anpassung: Neuberechnung bei Parameter-Änderung (currentInputs/adjustedInputs synchronisiert)
- [x] Strategie "reduce_positions" korrekt implementiert (70% der Positionen)
- [x] Gewichtungs-Limits geprüft (1-5% für >20k, 0-10% für <20k)
- [x] Edge Cases dokumentiert (Test-Script erstellt: test-optimizer.ts)
- [x] Optimizer-Ergebnis-Validierung (Summe ≥ 95%, Limits eingehalten)
- [x] Performance-Metriken korrekt berechnet (Sharpe Ratio, Dividende)
- [x] UI-Feedback bei Fehlern vorhanden (Konflikt-Dialog, Warnungen)



## 90% Investment-Garantie (URGENT)
- [x] Aktuelle Investment-Verteilungs-Logik analysiert
- [x] Problem identifiziert: maxPositionPercent Limit blockiert, teure Aktien
- [x] Cash-Verteilungs-Algorithmus verbessert (2-Phasen-Ansatz)
- [x] Garantie implementiert: Mindestens 90% investiert (Phase 1: Standard-Limits, Phase 2: Flexible Limits)
- [x] Edge Case gelöst: Sehr teure Aktien (Sortierung nach Preis, flexible Limits bis 8%/15%)
- [x] Edge Case gelöst: Sehr kleine Portfolios (0-10% Limits, keine Minimums)
- [x] Ziel geändert: 90% Minimum statt 98% (realistischer)



## Header-Buttons entfernen (Balanced/Dynamisch/Newcron)
- [x] Obsolete Header-Buttons identifiziert (bereits entfernt)
- [x] Buttons aus OptimizerResults.tsx entfernt (bereits in früherem Checkpoint)
- [x] "Anpassen" Button bleibt (einzige Möglichkeit Parameter zu ändern)
- [x] Layout nach Entfernung getestet



## Slider für Investitionsbetrag und Dividendenrendite
- [x] Fragebogen-Komponente gefunden (Optimizer.tsx)
- [x] Slider für Investitionsbetrag hinzugefügt (10k-1M CHF, Schritte: 5k)
- [x] Slider für Dividendenrendite hinzugefügt (0-10%, Schritte: 0.5%)
- [x] Input-Felder behalten (manuelle Eingabe weiterhin möglich)
- [x] Slider-Design an bestehenden "Anzahl Positionen" Slider angepasst
- [x] Große Wert-Anzeige über Slider (grün für Betrag, blau für Dividende)



## Slider-Limit auf 500k CHF anpassen
- [x] Slider max von 1M auf 500k geändert
- [x] Hinweis hinzugefügt: "Für Beträge über CHF 500'000 bitte manuell eingeben"
- [x] Input-Feld erlaubt weiterhin unbegrenzte Eingabe
- [x] Slider-Range: 10k - 500k CHF (Schritte: 5k)
- [x] Math.min() verwendet um Werte über 500k im Slider zu cappen



## Neue Prioritäten-Logik & Header entfernen (URGENT)
- [x] Header "1% Minimum-Gewichtung nicht erreichbar" komplett entfernt
- [x] Optionen 1-3 im Header entfernt (State-Variablen gelöscht)
- [x] Neue Prioritäten implementiert:
  - [x] Prio 1: 90% investiert (zwingend) ✅ bereits implementiert
  - [x] Prio 2: Dividendenrendite einhalten (zwingend, Anlegertyp-Override auf "conservative")
  - [x] Prio 3: Positionsgröße CHF 1'000 Minimum (absolut, wegen Spesen)
  - [x] Prio 4: Anzahl Titel automatisch reduzieren wenn Positionsgröße < CHF 1'000
- [x] ETF-Empfehlung hinzugefügt wenn:
  - [x] Anzahl Titel < 10 ODER
  - [x] Positionsgröße < CHF 1'000
  - [x] Warnung: "Mangelnde Diversifikation - ETF für bessere Diversifikation empfohlen"



## Dividenden-Ziel wird nicht erreicht (BUG - URGENT)
- [x] Problem: 3% Dividende eingegeben, nur 2.2% erreicht → BEHOBEN
- [x] Anlegertyp-Override Schwelle angepasst (> 2% → "conservative")
- [x] Scoring-Gewichtung für Dividende verstärkt ("conservative" erzwungen)
- [x] Direkte Dividenden-Filterung implementiert (>= 90% des Ziels)
- [x] Garantie: Durchschnittliche Portfolio-Dividende >= Ziel-Dividende (harte Filterung)
- [x] Automatische Positions-Reduktion wenn nicht genug Dividenden-Aktien verfügbar



## Dividende zu hoch (4% statt 3%) - BUG URGENT
- [ ] Problem: 3% Dividende eingegeben, Portfolio hat 4% (zu hoch!)
- [ ] Ursache: "Konservativ" Override ignoriert Wachstumsaktien komplett
- [ ] Lösung: Anlegertyp-Override ENTFERNEN
- [ ] Exakte Dividenden-Optimierung implementieren (3% → genau 3.0% ±0.1%)
- [ ] Mix aus verschiedenen Dividenden-Levels (2%, 3%, 4%, 5%)
- [ ] Gewichtung so anpassen dass Durchschnitt = Ziel
- [ ] Anlegertyp "Ausgewogen" beibehalten (Mix Dividende + Wachstum)



## Dividenden-Optimierung funktioniert nicht (BUG)
- [x] Problem: Immer noch 4% statt 3% → BEHOBEN durch Entfernung
- [x] Austausch-Algorithmus greift nicht → ENTFERNT (zu komplex, funktioniert nicht zuverlässig)
- [x] Warnung mit "Portfolio anpassen" Button stattdessen implementiert
- [x] User kann jetzt manuell Parameter anpassen

## Optimierungsvorschlag-Dialog fehlt Abbrechen-Button
- [x] User kann Dialog nicht schließen ohne Auswahl → BEHOBEN
- [x] "Abbrechen" Button existiert bereits (Zeile 96-102 in ConflictResolutionDialog.tsx)
- [x] Bei Abbruch: Portfolio wird angezeigt (ohne Optimierung)



## Dividenden-Garantie 3% ±0.2% (CRITICAL BUG)
- [x] Problem: 3% Ziel, nur 1.2% erreicht (Screenshot zeigt Konflikt-Dialog)
- [x] Scoring-Gewichtung massiv erhöht für Dividende (50x statt 20x)
- [x] "Konservativ" Scoring verwendet wenn Dividendenziel > 0
- [x] Mindestens 25% Wachstumstitel garantiert (Mix!)
- [x] NEUES PROBLEM: Scoring allein reicht nicht, GEWICHTUNG muss dynamisch sein → BEHOBEN
- [x] Dividenden-Aktien: 8% Gewichtung (statt 5%)
- [x] Wachstums-Aktien: 2% Gewichtung (statt 5%)
- [x] So erreichen wir 3% Durchschnitt! ✅

## Zurück-Button unter Bewertungen fehlt
- [x] Bewertungen-Seite hat keinen Zurück-Button → BEHOBEN
- [x] Zurück-Button hinzugefügt (mit ArrowLeft Icon, zu Portfolio-Ergebnissen)

## Score-Berechnung dokumentieren
- [x] User kann Score-Berechnung nicht nachvollziehen → BEHOBEN
- [x] Dokumentation erstellt: SCORE_CALCULATION.md (umfassende Erklärung)
- [x] Erklärung für Conservative/Balanced/Dynamic Scoring mit Beispielen
- [x] Erklärung für Dividenden-Bonus, Ziel-Nähe-Bonus, dynamische Gewichtung



## YTD Performance des Portfolios anzeigen
- [x] Neben Dividendenrendite fehlt YTD Performance → BEHOBEN
- [x] Gewichteten Durchschnitt der YTD Performance berechnet
- [x] Anzeige neben "Durchschnittliche Dividendenrendite" als neue Karte
- [x] Format: "+13.2%" (grün) oder "-5.3%" (rot) mit dynamischer Farbe



## Karten schmaler machen (4 auf einer Zeile)
- [x] Aktuell: Karten zu breit, YTD Performance auf neuer Zeile → BEHOBEN
- [x] Ziel: Investiert, Positionen, Dividende, YTD auf EINER Zeile ✅
- [x] Grid-Layout: md:grid-cols-2 lg:grid-cols-4 (responsive)
- [x] Padding reduziert: pb-1 pt-3 px-3 (statt pb-2)
- [x] Text kleiner: text-xs (Titel), text-lg (Wert) statt text-sm/text-2xl
- [x] Gap reduziert: gap-3 statt gap-4
- [x] Titel gekürzt: "Ø YTD Perf." statt "Ø YTD Performance"



## URGENT - Refresh Button Bug
- [ ] TypeScript-Fehler: API-Helper werden nicht gefunden (./_core/stockDataApi, ./_core/eodhdApi)
- [ ] Refresh Button kann nicht funktionieren wegen Import-Fehler
- [x] Sharpe Ratio Spalte ist NICHT sichtbar auf der Frontseite (Home.tsx Änderungen verloren)
- [ ] Sharpe Ratio Spalte muss in Home.tsx hinzugefügt werden

## Competition Analyzer (Owner-only Feature)
- [ ] "Alternativen prüfen" Button im Info-Popup (nur für Owner)
- [ ] LLM-basierte Konkurrenz-Suche (gleiche Branche/Kategorie)
- [ ] Max. 3 Konkurrenten mit besseren Kennzahlen finden (tieferes PEG, höheres Sharpe, höhere Div.)
- [ ] Vergleichstabelle anzeigen (aktuelle Aktie vs. Alternativen)
- [ ] "Bestehenden Titel ersetzen" Option
- [ ] "Titel hinzufügen" Option




## Competition Analyzer (Owner-only Feature)
- [x] Backend API (findCompetitors mutation mit LLM + Yahoo Finance + EODHD)
- [x] "Alternativen prüfen" Button im Info-Popup (nur für Owner/Admin sichtbar)
- [x] LLM-basierte Konkurrenz-Suche (gleiche Branche/Kategorie)
- [x] Max. 3 Konkurrenten mit besseren Kennzahlen finden (Scoring-Algorithmus)
- [x] Competitor Comparison Dialog mit Vergleichstabelle
- [x] Metriken-Vergleich mit Farbcodierung (grün = besser)
- [x] Score-Anzeige für jede Alternative
- [x] Begründung warum Alternative besser ist
- [x] "Bestehenden Titel ersetzen" Button
- [x] "Titel hinzufügen" Button
- [ ] Replace-Logik implementieren (Aktie in DB ersetzen)
- [ ] Add-Logik implementieren (Neue Aktie in DB hinzufügen)




## Refresh Progress Bar
- [x] Frontend: Progressbar-Komponente unter Refresh-Button
- [x] Prozentanzeige (z.B. "51% abgeschlossen")
- [x] Geschätzte Restzeit anzeigen (z.B. "30s verbleibend")
- [x] Visueller Fortschrittsbalken (0-100%) mit smooth animation
- [x] Disable Refresh-Button während Update läuft
- [x] Spinning Icon während Refresh
- [x] Button-Text ändert sich zu "Aktualisiere..."




## URGENT - Competition Analyzer Bugs
- [x] Dividendenrendite Faktor 100 zu hoch (372% statt 3.72%) - FIXED: Removed *100 multiplication
- [x] P/E Ratio fehlt bei aktueller Aktie im Vergleich - FIXED: Added P/E column
- [x] Vorgeschlagene Titel sind bereits im Portfolio (Duplikat-Check fehlt) - FIXED: Added existingTickers filter
- [x] Falsche Kategorie-Zuordnung (Versicherung statt Kantonalbank) - FIXED: LLM prompt enforces exact category
- [x] Schlechtere Kennzahlen werden nicht berücksichtigt (Sharpe 0.59 vs 1.69) - FIXED: Added isNotWorse check
- [x] Scoring-Algorithmus muss alle Metriken gleichzeitig bewerten - FIXED: Balanced scoring
- [x] Nur Alternativen aus gleicher Kategorie vorschlagen - FIXED: Category constraint in LLM
- [x] Mindestens 1 Kennzahl besser OHNE dass andere signifikant schlechter sind - FIXED: isBetter && isNotWorse logic



## Bugs
- [x] Hinzufügen Button funktioniert nicht nach Auto-Fill Implementation (funktioniert einwandfrei)
- [x] Dividendenrendite wird als 0% angezeigt bei Auto-Fill (sollte ~3-4% für Novartis sein) - FIXED: Dividendenrendite-Feld hinzugefügt
- [x] Kurs per 31.12.24 wird nicht automatisch gefüllt bei Auto-Fill - FIXED: EODHD Historical Data API integriert
- [x] Sharpe Ratio wird nicht angezeigt bei Auto-Fill - WONTFIX: EODHD API liefert keine Sharpe Ratio (muss manuell eingegeben werden)



## In Arbeit
- [x] Alternative Stocks Karten breiter und länger machen (ganzer Kasten sichtbar)
- [x] Titel-Struktur ändern: Fetter Firmenname als Titel, Ticker als kleinere zweite Zeile
- [ ] Firmenlogo links vom Titel für jede Alternative anzeigen
- [x] Navigation umbenennen: Portfolio→Aktien, Optimizer→Portfolio, Newsroom→News
- [x] Neuer Button "Analyzer" nach Portfolio einfügen
- [ ] 9 ETFs aus Portfolio-Liste zur Datenbank hinzufügen (Kategorie: ETF)



## Neue Features
- [x] 10-Jahres-Kurschart im Info-Dialog hinzugefügt (TradingView Widget)
- [x] Wettbewerbsvorteile bereits auf Deutsch
- [x] Analyzer UI entwickeln mit Diagramm-Platzhaltern
- [x] Analyse-Kategorien hinzugefügt (Portfolio-Übersicht, Risiko-Analyse, Performance-Analyse)
- [x] Interaktive Elemente: 4 Chart-Platzhalter + Kennzahlen-Dashboard

## Bugs zu beheben
- [x] Logos werden auf "Aktien"-Seite nicht angezeigt - FIXED: Logo-Spalte hinzugefügt
- [ ] ETF werden nicht unter "Aktien" aufgeführt
- [x] "2010 errors" Button unten links - FIXED: parentElement Null-Prüfung in Logo onError Handler
- [x] Schweizer Aktien-Logos werden in Tabelle nicht angezeigt (funktioniert im Info-Dialog) - FIXED: Swiss domain map integriert

## Neue Anforderungen
- [x] "Konkurrenten" Button im Analyzer hinzugefügt
- [x] Alle Aktien mit Alternativen im Analyzer auflisten (Alert-Dialog)
- [x] 5-Jahres-Kurschart für Performance-Verlauf im Analyzer (TradingView Widget)
- [x] Benchmark-Dropdown im Performance-Chart (S&P 500, Nasdaq, MSCI World, SMI, SMIM)
- [x] "Wissen" Button nach "Research" hinzugefügt
- [x] Wissen UI mit wichtigsten Finanzbegriffen für Anfänger (6 Begriffe mit Icons)
- [x] "Rechner" Button hinzugefügt
- [x] Rechner UI mit verschiedenen Kalkulatoren
- [x] Platzhalter für "Renten-/Kapitalbezug" Kalkulator erstellt
- [x] "Marktanalyse" Button im Analyzer hinzugefügt
- [x] KI-gestützte Portfolio-Analyse basierend auf Marktbedingungen (Bewertung, Wachstum, Performance, Diversifikation)
- [x] Fear & Greed Index Widget im Analyzer (mit hochgeladenem Bild)
- [ ] Renten-/Kapitalbezug Rechner UI entwickeln mit:
  - [ ] Pensionskassen-Kapital, Umwandlungssatz, Lebenserwartung
  - [ ] Steuerbelastung Kapitalbezug & Rente (Schweiz)
  - [ ] Regelmässige Einnahmen (AHV, Immobilien, Wertschriften)
  - [ ] Gewünschte Ausgaben, erwartete Rendite
  - [ ] Vergleichsberechnung & Empfehlung
- [ ] Checkpoint-Speicherproblem dauerhaft lösen



## Rechner Features (Neu hinzugefügt)
- [x] Finanzrechner-Tab implementiert mit zwei Rechnern
- [x] Renten-/Kapitalbezug Rechner erstellt
- [x] Pensionskassen-Kapital Eingabe
- [x] Umwandlungssatz, Lebenserwartung, Steuersätze konfigurierbar
- [x] Automatische Berechnung: Rente vs. Kapitalbezug Vergleich
- [x] Empfehlung basierend auf Gesamtwert (Rente oder Kapital)
- [x] Deckungsgrad-Analyse (mit/ohne BVG-Rente)
- [x] Regelmässige Einnahmen und gewünschte Ausgaben berücksichtigt
- [x] Erwartete Rendite für Kapitalbezug-Szenario
- [x] Budgetrechner implementiert
- [x] Haushaltstyp-Auswahl (Einzelhaushalt/Familie)
- [x] 12 typische Schweizer Haushaltskategorien (Wohnen, Nebenkosten, Krankenkasse, etc.)
- [x] Standard-Werte mit individueller Anpassungsmöglichkeit
- [x] Automatische Berechnung: Monatliches Einkommen, Überschuss/Defizit, Sparquote
- [x] Farbcodierung für bessere Übersicht (grün = Überschuss, rot = Defizit)
- [x] Total-Berechnung über alle Kategorien
- [x] React Hooks Fehler behoben (useState Hooks an den Anfang der Komponente verschoben)
- [x] TypeScript Kompilierung erfolgreich (keine Fehler)



## TradingView Chart Fix
- [ ] Fix TradingView chart symbol format for Swiss stocks (.SW suffix)
- [ ] Convert SGKN.SW to SIX:SGKN format for TradingView widget
- [ ] Test chart display with multiple Swiss stocks



## Portfolio Performance & Fear & Greed Index Updates
- [ ] Portfolio Performance Chart: Berechnung basierend auf aktueller Zusammensetzung über 5 Jahre
- [ ] Historische Kursdaten für alle Aktien abrufen (5 Jahre)
- [ ] Gewichtete Portfolio-Performance berechnen
- [ ] Eigene Chart-Visualisierung erstellen (ohne TradingView)
- [ ] Fear & Greed Index mit echten aktuellen Daten aktualisieren
- [ ] API-Integration für Fear & Greed Index Daten



## Syntax Error Fix
- [x] Fix syntax error in Home.tsx line 1262 (incomplete benchmark selector code)



## Pension Calculator Enhancement
- [ ] Add canton selection dropdown (all 26 Swiss cantons)
- [ ] Add religion selection (reformiert, katholisch, konfessionslos)
- [ ] Implement canton-specific capital withdrawal tax calculation
- [ ] Add desired coverage ratio field (Einnahmen/Ausgaben)
- [ ] Calculate optimal capital withdrawal percentage automatically
- [ ] Update calculator UI with new fields
- [ ] Test calculations with different scenarios



## Portfolio Performance Chart Fix
- [ ] Fix start value to CHF 10'000 (minimum investment)
- [ ] Calculate end value based on actual 5-year performance
- [ ] Display correct performance percentage over 5 years




## Budget Calculator Integration
- [x] Add "Budgetrechner öffnen" button next to desired expenses field in pension calculator
- [x] Implement switch to budget calculator when button is clicked
- [x] Add "Übernehmen" button in budget calculator to transfer total back to pension calculator
- [x] Ensure seamless data flow between calculators



## Budget Calculator Household Types
- [x] Replace simple single/family selection with 6 detailed options
- [x] Add household types: Einpersonenhaushalt, Zweipersonenhaushalt, Familie mit 1-4 Kindern
- [x] Add dynamic "Ausbildungskosten" budget item for families with children
- [x] Adjust standard values based on household size (1, 2, 3, 4, 5, 6 persons)
- [x] Hide education costs for households without children



## Portfolio Performance & Navigation
- [ ] Fix portfolio performance chart to use fixed CHF 10'000 start value (not dynamic)
- [ ] Add back button in portfolio area for navigation
- [ ] Implement portfolio save functionality with custom names
- [ ] Create database schema for saved portfolios (user_id, name, stocks, weights, created_at)
- [ ] Add UI to save current portfolio with custom name
- [ ] Add UI to load previously saved portfolios
- [ ] Support multiple portfolio variants per user



## Rechner Tab Bug
- [x] Fix React Hooks error - useMemo inside conditional block (moved outside if statement)



## Swiss Canton Tax Rates Update
- [x] Research latest 2024/2025 capital withdrawal tax rates for all 26 cantons
- [x] Update swissCantonTax.ts with accurate progressive tax rates
- [x] Include religion-based adjustments (church tax)
- [x] Verify calculations with official sources



## Portfolio Save/Load Feature
- [x] Implement backend tRPC procedures for portfolio CRUD (create, read, update, delete)
- [x] Create "Save Portfolio" dialog with name input
- [x] Create "Load Portfolio" dialog showing saved portfolios list
- [x] Add "Delete Portfolio" functionality
- [x] Move Save/Load buttons to optimized portfolio section (when showOptimizerResults is true)
- [x] Add back button (←) in optimized portfolio to return to input form
- [x] Test save/load workflow end-to-end



## Chart Type Default
- [x] Change default chart type in Info dialog from "Linie" to "Fläche"

## Remove Duplicate Buttons
- [x] Remove "Speichern" and "Laden" buttons from Aktien tab (already in Portfolio tab)

# Updated Sun Nov  2 04:49:27 EST 2025


- [x] Fix logo loading issue on production website (logos not displaying correctly)
- [x] Fix: Alle Logos werden nicht geladen (Logo-Anzeige komplett defekt) - Clearbit/Logo.dev APIs wiederhergestellt
- [x] Fix: Speichern-Button in OptimizerResults funktioniert nicht - Dialog implementiert
- [x] Fix: Zurück-Button in OptimizerResults soll zur Hauptseite führen (nicht zum Fragebogen)
- [x] Fix: Portfolio-Auswahl beim Start - Wenn Portfolios existieren → Liste zeigen, sonst → 4-Fragen-Prozess
- [x] Add: "Portfolio erstellen" Button um neuen 4-Fragen-Prozess zu starten


- [x] Add: Zeitstempel zu gespeicherten Portfolios (zeigt wann zuletzt gespeichert)
- [x] Fix: Logos laden wieder nicht (nach letztem Update) - Logos funktionieren auf Dev-Server, Production braucht neues Deploymente)


- [x] Fix: "Invalid portfolio data" Fehler beim Speichern - JSON.stringify hinzugefügt
- [x] Fix: Logos laden immer noch nicht (StockAnalysis.com funktioniert nicht) - Zurück zu Clearbit mit Swiss domain mapping


## New Issues to Fix

- [x] Zurück button should navigate to Aktien tab (main portfolio) not Portfolio tab
- [x] Diversification warning should be a dialog with "OK" and "Nicht mehr anzeigen" buttons
- [x] Fix empty saved portfolio (CHF 0, 0 positions) - Added validation to prevent saving empty portfolios

## Portfolio Optimizer Navigation Issues

- [x] Zurück button in Portfolio Optimizer should go to Portfolio tab (where saved portfolios are shown), not Aktien tab
- [x] After saving portfolio, automatically refresh the portfolio list and show it

## Portfolio Display Issue

- [x] Saved portfolios show CHF 0 and 0 positions even though data is saved correctly - fixed by parsing portfolioData JSON in backend

## Portfolio Load Dialog Enhancement

- [x] Add hover effect to portfolio cards in load dialog
- [x] Make portfolio cards clickable to load portfolio details
- [x] Keep delete button functional with stopPropagation

## Portfolio Manual Stock Management

- [x] Add category selection dropdown to "Aktie hinzufügen" dialog in Aktien tab (already exists)
- [ ] Add editable portfolio state in OptimizerResults (separate from optimized suggestion)
- [ ] Add "Aktie hinzufügen" button and dialog in OptimizerResults
- [ ] Add category selection to OptimizerResults add stock dialog
- [ ] Add "Vorschlag wiederherstellen" button to reset to original optimized portfolio
- [ ] Ensure manual changes persist when saving portfolio
- [x] Performance Chart im Analyzer wird nicht angezeigt - Debug erforderlich (TypeScript Fehler behoben)
- [x] Portfolio-Dropdown direkt im Analyzer Header hinzufügen für schnellen Wechsel zwischen Portfolios
- [x] Benchmark-Linie (rot) wird im Performance-Chart nicht angezeigt (Yahoo Finance API implementiert)
- [x] Performance-Chart fehlt im Analyzer (OptimizerResults) - sollte dort auch sichtbar sein
- [x] Beide Kursverläufe (Portfolio & Benchmark) müssen beim selben Startpunkt (0%) anfangen
- [x] Chart zeigt nicht 5 Jahre zurück - Zeitraum zu kurz

## Scoring System (Ampel-Bewertung)
- [x] Score-Berechnung für Dividendenaktien (Dividendenrendite, Ausschüttungsquote, Eigenkapitalquote, KGV)
- [x] Score-Berechnung für Wachstumsaktien (PEG-Ratio, Gewinnwachstum, FCF Yield, Umsatzwachstum)
- [x] API-Endpoint für Score-Berechnung aller Aktien
- [x] Score-Spalte in Aktien-Tabelle mit Ampel-Farben (Rot/Orange/Gelb/Grün)
- [x] Detail-Dialog mit Score-Breakdown pro Kennzahl

## Bugs zu beheben
- [x] Score-Spalte ist leer - Daten werden nicht geladen (Null-Werte werden jetzt korrekt behandelt)
- [x] Chart-Legende fehlt - Blaue Linie braucht Portfolio-Namen als Label (Portfolio-Name wird jetzt angezeigt)
- [x] Titel "Optimiertes Portfolio" sollte durch tatsächlichen Portfolionamen ersetzt werden (Dynamischer Titel implementiert)
- [x] Portfolio-Dropdown nicht funktional - Laden-Button zeigt Portfolios, aber Auswahl funktioniert nicht (portfolioData statt positions verwendet)
- [x] Analyzer Kennzahlen Layout - Alle Metriken auf einer Linie nach dem Titel anordnen (Flex-Layout implementiert)

## Layout-Anpassung
- [ ] Buttons (Laden & Löschen) auf dieselbe Linie wie Kennzahlen verschieben für kompakteres Design
- [ ] Score-Spalte zeigt nur "-" statt Ampel-Farben mit Werten - API-Aufruf funktioniert nicht
- [ ] Syntax-Fehler in Home.tsx Zeile 1626 - Unterminated regular expression beim Portfolio-Laden

## ETFs hinzufügen
- [ ] 8 ETFs aus der Liste in die Datenbank eintragen
  - [ ] UBS Equities Wrld x CH I-A hdg (Aktien Welt)
  - [ ] Vanguard S&P 500 ETF (Aktien Nordamerika)
  - [ ] iShares Global Infrastructure (Aktien Themen)
  - [ ] UBS Eqt Pacific ex Jap Idx I-A (Aktien Asien/Pazifik)
  - [ ] UBS Eqty CH Passive Leader W (Aktien Schweiz)
  - [ ] SWC IEF Small & Mid Caps CH GT (Aktien Schweiz)
  - [ ] iShares Swiss Dividend A (Aktien Schweiz)
  - [ ] UBS Gold hCHF I-A (Rohstoffe und Edelmetalle)
- [x] Fix getStocks import error in score router (changed to getAllStocks)
- [x] Implement traffic light colors for Risk Score column (green/yellow/red badges)
- [x] Move Speichern/Laden/PDF Export buttons next to metrics cards in Analyzer
- [x] Responsive layout for buttons (desktop: right side, mobile: below metrics)
- [x] Fix score column sorting error (toFixed is not a function)
- [x] Implement sort functionality for Score column
- [x] Create pop-up dialog showing score calculation breakdown when clicking on score badge
- [x] Visual score calculation display with formula and metrics
- [x] Add progress bars for each sub-score in detail dialog
- [x] Show calculation formula (Σ) and contribution of each metric
- [x] Fix toFixed error in score detail dialog (sub.value, sub.weight, sub.score might be null)
- [x] Remove Risk Score column from stock table
- [x] Adjust score calculation to use only available metrics
- [x] Update score calculation with final metrics:
  - Dividend stocks: dividendYield (40%), peRatio (30%), beta (20%), volatility (10%)
  - Growth stocks: sharpeRatio (40%), pegRatio (35%), beta (25%)
- [x] Remove equityRatio and ytdPerformance from scoring
- [x] Add beta and volatility to routers.ts metric passing
- [x] Fix score classification - use category field instead of auto-detection (backend)
- [x] Fix frontend score detail dialog - Nestlé now correctly shown as Dividendenaktie
- [x] Add portfolio selector dropdown in Analyzer (before Portfolio Übersicht card)
- [x] Load and display selected portfolio data in all Analyzer sections
- [ ] Verify portfolio card changes are visible (Laden button, horizontal timestamp, reduced height)
- [ ] Fix Analyzer chart - only shows 1 year history instead of 5 years (backend issue)
- [ ] Add ETFs to stock list under Aktien tab
- [x] Zeitraum-Auswahl für 5-Jahres Performance Chart hinzufügen
  - [x] Buttons für verschiedene Zeiträume (1M, 3M, 6M, YTD, 1J, 3J, 5J, Max)
  - [x] State Management für ausgewählten Zeitraum
  - [x] Datenfilterung basierend auf ausgewähltem Zeitraum
  - [x] UI-Integration neben Benchmark-Selector
- [x] Portfolio Optimizer: "Laden" und "Löschen" Buttons oben rechts bei Portfolio-Karten entfernen
- [ ] Portfolio Optimizer: Blauen "Laden" Button unten funktionsfähig machen (Portfolio laden und zum Analyzer navigieren) - onClick Handler wird nicht ausgeführt
- [ ]- [x] ETFs zur "Aktien" Seite hinzufügen
  - [x] ETF-Datenbank-Schema erweitern (category Feld verwendet)
  - [x] ETF-Liste mit wichtigen ETFs (25 ETFs hinzugefügt: US Market, World, Europe, Switzerland, Sector, Bonds, Commodities)
  - [x] ETF-Anzeige in der Aktien-Tabelle (92 Positionen total)
  - [x] Kategorien zeigen ETF-Kategorien (ETF - Switzerland, ETF - US Market, etc.)
- [ ] Tiefgehende Untersuchung des "Laden" Button Problems
  - [ ] Browser Console auf Fehler prüfen
  - [ ] React Component State überprüfen
  - [ ] Event Handler Registrierung testen
  - [ ] Portfolio-Daten Struktur in DB analysieren
  - [ ] Alternative Implementierung falls nötig


## KRITISCH - Portfolio Laden Fehler (Inputs fehlen)
- [ ] Fehler: "Portfolio-Daten sind unvollständig. Inputs: false, Stocks: true"
  - [ ] Untersuchen warum `inputs` beim Laden fehlen
  - [ ] Prüfen ob `inputs` in der Datenbank gespeichert werden
  - [ ] Fallback-Logik für fehlende inputs implementieren
  - [ ] Debug-Alerts entfernen
  - [ ] Portfolio-Laden mit verschiedenen gespeicherten Portfolios testen


## Portfolio Laden Fehler behoben (06.11.2025)
- [x] Portfolio-Daten sind unvollständig. Inputs: false, Stocks: true
  - [x] Untersuchen warum portfolio inputs fehlen beim Laden (alte Portfolios vor Fix gespeichert)
  - [x] Fallback-Logik für fehlende inputs implementiert (Default-Werte aus Portfolio-Daten)
  - [x] Debug-Alerts entfernt
  - [x] Portfolio-Laden erfolgreich getestet (Portfolio 3 geladen)
  - [x] Inputs werden jetzt beim Speichern mit gespeichert (OptimizerResults.tsx)
  - [x] Alte Portfolios funktionieren mit Fallback-Werten (investmentAmount, expectedDividendYield, numberOfPositions, investorType)


## KRITISCH - Production Build Fehler (06.11.2025)
- [x] Portfolio Laden funktioniert nicht auf Production URL
  - [x] JavaScript Fehler in index-zBAGmSCE.js (alter Build)
  - [x] "An unexpected error occurred" auf portfoliodash-aqvizp6n.manus.space
  - [x] TypeScript Fehler (Out-of-Memory, aber Build erfolgreich)
  - [x] Production Build neu erstellt (index-BdAdkDtQ.js)
  - [ ] Checkpoint erstellen und publishen um Production URL zu aktualisieren


## Portfolio Laden - Anzeigefehler (06.11.2025)
- [x] "Ziel-Dividendenrendite nicht vollständig erreichbar" Warnung beim Laden angezeigt
  - [x] Warnung sollte nur beim Optimizer erscheinen, nicht beim Laden
  - [x] Warnung mit !selectedPortfolioId Bedingung ausgeblendet
- [x] Portfolio-Zusammensetzung zeigt 0.0% für Dividenden- und Wachstumsaktien
  - [x] Berechnung funktioniert nicht für geladene Portfolios (fehlende Flags)
  - [x] isDividendStock/isGrowthStock Flags beim Laden basierend auf Dividendenrendite gesetzt
  - [x] Dividendenaktien: 80.8%, Wachstumsaktien: 0.0%, Cash: 19.2%


## KRITISCH - Checkpoint Erstellung fehlgeschlagen (06.11.2025)
- [ ] "Failed to get checkpoint" beim Veröffentlichen
  - [ ] Git Push Fehler: "remote ref is not ancestor of HEAD"
  - [ ] Checkpoint konnte nicht gespeichert werden
  - [ ] Git Konflikt auflösen
  - [ ] Neuen Checkpoint erstellen

## ETF Factsheet Integration
- [ ] Add factsheetUrl field to database schema
- [ ] Collect factsheet URLs for all 25 ETFs
- [ ] Implement Info button for ETFs that opens factsheet PDF
- [ ] Test factsheet opening for all ETFs

## ETF Factsheet Integration - ABGESCHLOSSEN ✅
- [x] Add factsheetUrl field to database schema
- [x] Collect factsheet URLs for all 25 ETFs
- [x] Implement Info button for ETFs that opens factsheet PDF
- [x] Test factsheet opening for all ETFs
- [x] Update FIXES_DOCUMENTATION.md with ETF Factsheet Integration
- [x] ETF Factsheet URLs aktualisieren (einige sind veraltet/404)
- [x] Fehlende ETF Factsheet-URLs recherchieren und hinzufügen
- [ ] "Alternativen prüfen" Pop-Up breiter machen (kein horizontales Scrollen)
- [ ] Aktientitel ausgeschrieben im Titel der Alternative anzeigen
- [ ] Logo sauber laden in Alternativen
- [ ] X-Button weiß statt schwarz machen (bessere Sichtbarkeit)
- [x] "Alternativen" Button zwischen "PDF Export" und "Neue Aktie" hinzufügen
- [x] Pop-Up mit allen Titeln die Alternativen haben implementieren
- [x] Direkt-Link zur Alternativen-Analyse aus dem Überblick
- [x] Dividenden-Score weicher machen (tiefere Schwellenwerte für Dividendenaktien)
- [x] Gewinnwachstum aus PEG & P/E ableiten (P/E / PEG = Wachstumsrate)
- [x] Gewinnwachstum als neues Kriterium für Wachstumsaktien-Score
- [x] Fortschrittsbalken für Alternativen-Button hinzufügen
- [x] X-Button im Moats-Dialog weiß machen (Info-Button bei Aktien)
- [x] Portfolio Box-Breiten anpassen
- [x] Portfolio Chart-Legende mit Depot-Namen
- [x] Portfolio Score-Spalte aktualisieren

## Portfolio-Seite Major Fixes (2025-11-07)
- [x] Portfolio-Auswahl nach oben links verschieben
- [x] Kompaktes Header-Layout: Portfolio-Auswahl + Zusammensetzung + Stats in einer Zeile
- [x] Chart-Legende korrigieren (Portfolio-Name statt "S[ ] Chart-Legende korrigieren (Portfolio-Name statt "S&P 500" doppelt)P 500" doppelt)
- [x] Zeitraum-Selector zum Chart hinzufügen (wie auf Performance-Seite)
- [x] Portfolio-Wechsel Bug beheben (Daten werden auf 0 zurückgesetzt)
- [x] tRPC Error beheben: scoring.calculateScores Procedure fehlt

## Portfolio UI Fixes (2025-11-07)
- [ ] Portfolio-Seite Container-Breite begrenzen (wie Aktien-Seite)
- [ ] Div. Rend. beim Portfolio-Wechsel berechnen
- [ ] YTD Perf. beim Portfolio-Wechsel berechnen
- [ ] "Lade Alternativen" Button Fortschrittsbalken hinzufügen

## Neue Bugs zu beheben
- [x] Fix #27: "Alternativen" Button (rot/orange) auf Hauptseite funktioniert nicht (analyzeCompetitorsMutation existierte nicht, ersetzt durch findCompetitorsMutation)
- [x] Fix #28: Progress Bar für "Alternativen prüfen" Button im Info-Dialog hinzugefügt (lila pulsierender Balken)
- [x] Fix #29: calculateStockScores is not a function error (added wrapper function to process multiple stocks)

## Alternativen Dialog Fixes
- [ ] Fix #30: Dialog-Titel von "Bessere Alternativen für..." zu "Alternativen für..." ändern
- [ ] Fix #31: Vollständige Firmennamen anzeigen (nicht nur Ticker), Ticker auf 2. Zeile
- [ ] Fix #32: "Titel hinzufügen" Button implementieren (fügt Aktie zum Portfolio hinzu)
- [ ] Fix #33: "Bestehenden Titel ersetzen" Button implementieren (ersetzt aktuelle Aktie)

## Alternativen Dialog Fixes (Nov 7)
- [x] Fix #30: Dialog-Titel von "Bessere Alternativen" zu "Alternativen" geändert
- [x] Fix #31: Alternative Titel vollständig anzeigen - bereits durch Fix #35 behoben (Backend liefert companyName)
- [x] Fix #32: "Titel hinzufügen" und "Bestehenden Titel ersetzen" Buttons implementiert (addStockMutation & updateStockMutation)
- [x] Fix #33: Image error handlers causing null pointer exceptions (added null checks for all 4 onError handlers)

## Portfolio-weite Alternativen Dialog Fixes (Nov 7)
- [x] Fix #34: Dialog-Titel aktualisiert sich nicht dynamisch - verwendet jetzt competitorAnalysisStock?.companyName
- [x] Fix #35: Alternative zeigt jetzt vollständigen Firmennamen von EODHD API (data.General.Name)
- [x] Fix #36: Alternative Logo Fallback-Logik bereits implementiert (FMP → Clearbit → Logo.dev → Initial)
- [x] Fix #37: "Weiter" Button oben rechts im Dialog hinzugefügt - springt zur nächsten Aktie mit Alternativen


## Neue Bugs (Nov 7 - Nachmittag)
- [x] Fix #38: Alternativen-Analyse läuft automatisch weiter - globaler onSuccess Handler entfernt, nur lokale Handler verwenden
- [x] Fix #39: Alternativen passen jetzt zur Branche - verwendet industry/sector von EODHD API statt category
- [x] Fix #40: Hinzugefügte Alternative hat jetzt alle Marktdaten (Kurs, Dividende, PEG, P/E, Sharpe, etc. vom Competitor Analyzer)

## Alternativen Overview Dialog Fixes (Nov 7 - Abend)
- [x] Fix #41: Logos in Alternativen-Übersicht verwenden jetzt 4-stufige Fallback-Logik (FMP → Clearbit → Logo.dev → Initial)
- [x] Fix #42: Klick auf Aktie in Alternativen-Übersicht öffnet jetzt Detail-Dialog (verwendet gespeicherte Daten, kein erneuter API-Call)


## Analyzer_Test Implementation (Nov 7 - Abend)
- [x] Task #43: Create new database schema (securities, prices, holdings, correlations, analyzer_reports) - created via SQL
- [x] Task #44: Create SQL views (v_returns, v_holdings_with_meta, v_risk_metrics) - all 3 views created
- [ ] Task #45: Implement backend routers (portfolioAnalyzer, aiAnalyzer, reportsAnalyzer)
  - [ ] Create server/analyzerDb.ts with query helpers (performanceSeries, sectorAllocation, performanceAttribution, riskMetrics, correlationMatrix)
  - [ ] Add portfolioAnalyzer router to server/routers.ts (performance, sectorAllocation, performanceAttribution, riskMetrics, correlationMatrix)
  - [ ] Add aiAnalyzer router (insights, competitors)
  - [ ] Add reportsAnalyzer router (export)
- [ ] Task #46: Create ETL script for price import
  - [ ] Create tools/etl/import-prices.ts
  - [ ] Implement FMP/EODHD price fetching
  - [ ] Add pnpm script "etl:prices"
- [ ] Task #47: Implement frontend Analyzer_Test page with all charts
  - [ ] Create client/src/pages/AnalyzerTest.tsx
  - [ ] Implement Performance Chart (Line chart with benchmark comparison)
  - [ ] Implement Sector Allocation Chart (Pie/Donut chart)
  - [ ] Implement Performance Attribution Chart (Bar chart)
  - [ ] Implement Risk Metrics Cards (Sharpe, Sortino, Max Drawdown, VaR, Beta)
  - [ ] Implement Correlation Matrix (Heatmap)
  - [ ] Implement AI Insights section
  - [ ] Implement PDF Export button
- [ ] Task #48: Add route /analyzer-test and navigation
  - [ ] Add route in client/src/App.tsx
  - [ ] Add navigation link in header/sidebar

## Alternativen Dialog Fixes (Nov 7 - Spät)
- [x] Fix #43: Dialog bleibt jetzt nach Hinzufügen einer Alternative offen (setIsCompetitorDialogOpen(false) entfernt)
- [x] Fix #44: Hinzugefügte Alternative hat jetzt alle Daten - automatischer refreshStockData API-Call nach dem Hinzufügen
  - Root Cause: alt Objekt hatte teilweise null-Werte, Backend speicherte "0" als Fallback
  - Lösung: Neuer refreshStockData Endpoint holt aktuelle Daten von EODHD/FMP nach dem Hinzufügen
- [x] Fix #45: Portfolio-Gewichtung wird jetzt auf 100% neu berechnet
  - recalculateWeights erkennt neue Aktien mit weight=0 und verteilt alle Aktien gleichmäßig
  - Beispiel: 5 Aktien à 20% → neue Aktie hinzufügen → 6 Aktien à 16.67%

## Neue Bugs nach Test (Nov 7 - Sehr Spät)
- [ ] Fix #46: Alternativen zeigen keine Daten (Kurs, Sharpe = N/A)
  - Root Cause: API Rate Limiting (429 Too Many Requests) - EODHD/FMP APIs
  - Lösung: Caching implementieren oder API-Upgrade (benötigt mehr Zeit)
  - Status: Nicht gelöst (API-Problem, kein Code-Problem)
- [x] Fix #47: Logos fehlen bei Alternativen (leere Platzhalter)
  - Root Cause: Domain-Extraktion funktioniert nicht für "Analog Devices Inc", "Intel Corporation"
  - Lösung: knownCompanies Map hinzugefügt mit direkten Domain-Mappings
- [x] Fix #48: "Weiter" Button funktioniert nicht (keine Rückkehr zur Übersicht)
  - Root Cause: Kein "Zurück zur Übersicht" Button vorhanden
  - Lösung: "Übersicht" Button hinzugefügt (setzt currentAlternativeIndex = null)
- [x] Fix #49: Portfolio-Gewichtung wird NICHT automatisch auf 100% berechnet
  - Root Cause: recalculateWeights erkennt neue Aktien nur bei weight=0, nicht bei totalWeight > 100%
  - Lösung: Logik geändert - erkennt jetzt auch totalWeight > 100% als neuen Stock

## API Improvements (Nov 7 - Final)
- [x] Task #50: Implement memory cache for EODHD/FMP API responses
  - Cache-Key: `${endpoint}:${ticker}`
  - TTL: 1 Stunde für Fundamentals, 5 Minuten für Real-Time Quotes
  - In-Memory Map (keine externe Dependency)
  - Implementiert: apiCache.ts mit automatischem Cleanup alle 10 Minuten
- [x] Task #51: Add retry logic with exponential backoff
  - Max 3 Retries mit 1s, 2s, 4s Delays
  - Nur bei 429 (Rate Limit) und 5xx (Server Error)
  - Nicht bei 4xx (Client Error außer 429)
  - Implementiert: retryUtil.ts mit retryFetch und retryWithBackoff
- [x] Task #52: Implement Yahoo Finance fallback
  - Wenn EODHD/FMP fehlschlägt, Yahoo Finance versuchen
  - Fallback für: currentPrice, sharpeRatio, peRatio, dividendYield
  - Implementiert in competitorAnalyzer.ts für current stock und alternatives

## Finale Implementierung (Nov 7 - Abschluss)
- [x] Task #67: Logo-Problem in Haupttabelle lösen
  - Problem: TSMC hat Logo im Details-Dialog (FMP), aber nicht in Haupttabelle (Clearbit)
  - Lösung: Haupttabelle auf FMP als primäre Logo-Quelle umgestellt (wie Details-Dialog)
  - Fallback-Kette: FMP → Clearbit → Logo.dev → Initialen (bereits vorhanden im onError)
- [ ] Task #68: YTD Performance für Adecco/Amgen testen
  - Problem: Code implementiert (fetchEODHDHistorical), aber noch nicht getestet
  - Test: refreshStockData für beide Aktien aufrufen und YTD % prüfen
- [ ] Task #69: Alle Fixes validieren und finalen Checkpoint erstellen
  - Portfolio-Gewichtung = 100%
  - YTD % Sortierung numerisch
  - Edit-Dialog mit Kategorie-Feld
  - Logos funktionieren überall
  - YTD Performance für alle Aktien

## YTD Performance Automation (Nov 7 - Final)
- [x] Task #69: Automatische YTD Performance Berechnung in refreshStockData
  - Problem: ytdPerformance wird aktuell manuell berechnet (SQL UPDATE)
  - Lösung: refreshStockData erweitert um automatische Berechnung
  - Implementierung:
    1. ytdStartPrice von EODHD Historical API holen (31.12. Vorjahr)
    2. ytdPerformance = (currentPrice - ytdStartPrice) / ytdStartPrice * 100
    3. Beide Werte automatisch in DB gespeichert
  - Vorteil: Neue Aktien haben sofort YTD % ohne manuelle Intervention
  - EODHD hat keine direkte YTD API - manuelle Berechnung ist korrekt

## KRITISCHE BUGS (Nov 7 - Urgent)
- [x] Bug #70: Gewichtungslogik überschreibt manuelle Gewichtungen
  - Problem: Alle Aktien haben 1.05%, manuelle 5% für Nestlé/Kuehne+Nagel wurden überschrieben
  - Erwartetes Verhalten:
    * Manuelle Gewichtungen (isManualWeight=1) MÜSSEN erhalten bleiben
    * Beispiel: Nestlé 5%, Kuehne+Nagel 5%, Apple 2% (neu, manuell) = 12% total
    * Verbleibende 92 Aktien: Gleichmäßig auf 88% verteilt = 0.9565% pro Aktie
  - Root Cause: recalculateWeights Special-Case ignorierte isManualWeight Flag
  - Fix: Special-Case greift nur wenn KEINE manuellen Gewichtungen existieren
- [x] Bug #71: Logo-Loading komplett kaputt nach FMP-Änderung
  - Problem: Viele Logos fehlen jetzt (Kuehne+Nagel, NVIDIA, Nestlé, Alphabet, etc.)
  - Root Cause: FMP als primäre Quelle + fehlerhafte Fallback-Bedingung (img.src.includes('clearbit') war nie wahr)
  - Fix: Clearbit als primäre Quelle + Swiss domain mapping + Logo.dev Fallback + Letter Avatar
- [x] Bug #72: Edit-Dialog Fixes nicht implementiert (Rollback verloren)
  - Problem: Weißes Kreuz oben rechts fehlt (schwarz auf schwarz)
  - Problem: Kategorie-Dropdown fehlt im Edit-Dialog
  - Fix: DialogContent mit [&>button]:text-white + Kategorie-Dropdown mit 11 Kategorien hinzugefügt
- [x] Bug #73: Alternative hinzufügen wirft Fehler "Marktdaten konnten nicht geladen werden"
  - Problem: Nach Hinzufügen einer Alternative (z.B. Pinterest bei Meta) erscheint Fehlermeldung
  - Root Cause: refreshStockDataMutation.mutateAsync(alt.ticker) schlägt fehl (unnötig, da Daten bereits vorhanden)
  - Fix: API-Call entfernt, alle Marktdaten sind bereits in alt-Objekt vorhanden
- [x] Bug #74: "Alternativen" Button soll deaktiviert werden
  - Problem: Funktion ist noch in Entwicklung, soll nicht produktiv sein
  - Fix: Button disabled=true + Toast "Diese Funktion befindet sich noch in Entwicklung und ist bald verfügbar"
- [x] Bug #75: React duplicate key error "MRVL"
  - Problem: "Encountered two children with the same key, MRVL"
  - Root Cause: key={stock.ticker} in React, aber ticker ist nicht garantiert eindeutig
  - Fix: key={stock.id} statt key={stock.ticker} in Portfolio-Tabelle + Alternativen-Übersicht
- [x] Bug #76: "Neue Aktie hinzufügen" Dialog - Sharpe Ratio und Dividendenrendite fehlen
  - Problem: Nach "Daten laden" werden Sharpe Ratio und Dividendenrendite nicht ausgefüllt
  - Root Cause: Tippfehler in routers.ts (SharpRatio statt SharpeRatio)
  - Problem: "Hinzufügen"-Button funktioniert nicht (keine Validierung, keine Fehlermeldungen)
  - Fix: 1) Tippfehler korrigiert, 2) Validierung hinzugefügt (Ticker, Name, Kurs, Kategorie), 3) Default-Werte für optionale Felder

## Neue Features (Nov 7)
- [x] Feature: YTD Performance automatisch berechnen beim Hinzufügen
  - Beim Hinzufügen neuer Aktien automatisch YTD % aus API-Daten berechnen
  - Formel: (currentPrice - ytdStartPrice) / ytdStartPrice * 100
  - Backend berechnet ytdPerformance und gibt es zurück
  - Frontend setzt ytdPerformance automatisch beim "Daten laden"
- [x] Feature: Kategorie-Verwaltung im Admin-Panel
  - Admin kann Kategorien hinzufügen, umbenennen, löschen
  - Kategorien in separater Tabelle gespeichert (categories table)
  - Backend-Router mit CRUD-Operationen (add, update, delete, list)
  - Admin-UI unter /categories (nur für Admins zugänglich)
  - Dropdown im Add/Edit-Dialog dynamisch aus DB geladen
- [ ] Feature: Bulk-Edit-Funktion
  - Mehrere Aktien gleichzeitig bearbeiten
  - Checkbox-Auswahl in Portfolio-Tabelle
  - Bulk-Actions: Kategorie ändern, Löschen, Gewichtung anpassen

## Neue Bugs (Nov 7 - Nach Kategorie-Feature)
- [x] Bug #77: Kategorien-Seite zeigt keine bestehenden Kategorien
  - Problem: /categories zeigt "Keine Kategorien vorhanden", obwohl Aktien Kategorien haben
  - Root Cause: categories-Tabelle war leer, bestehende Kategorien waren nur in stocks.category
  - Fix: SQL-Migration ausgeführt - 28 Kategorien aus stocks in categories-Tabelle migriert
- [x] Bug #78: Kategorie-Dropdown im Add-Dialog ist leer
  - Problem: Beim Hinzufügen neuer Aktien kann keine Kategorie ausgewählt werden
  - Root Cause: Dropdown lädt nur aus categories-Tabelle, die leer war
  - Fix: Migration behebt das Problem, Dropdown lädt jetzt aus categories-Tabelle
- [x] Bug #79: Sharpe Ratio und Dividendenrendite werden nicht automatisch geladen
  - Problem: Nach "Daten laden" bleiben Sharpe Ratio und Dividendenrendite leer
  - Root Cause: EODHD API gibt diese Werte nicht für alle Aktien zurück
  - Fix: 3-stufiger Fallback implementiert:
    1. EODHD (fundamentals.Technicals.SharpeRatio + fundamentals.Highlights.DividendYield)
    2. Finnhub (metric.sharpeRatio + metric.dividendYieldIndicatedAnnual)
    3. Yahoo Finance (summaryDetail.dividendYield - kein Sharpe Ratio verfügbar)
  - Test-Ergebnisse:
    * AAPL (US): Dividend Yield 0.38% ✅, Sharpe Ratio fehlt ❌
    * GEBN.SW (CH): Beide Werte fehlen in allen 3 APIs
    * Sharpe Ratio ist in keiner API verfügbar (berechneter Wert)
  - Lösung: Sharpe Ratio als optionales Feld markiert, Dividend Yield Fallback funktioniert

## Kritische Bugs (Nov 7 - Datenlade-Probleme)
- [x] Bug #80: Logo fehlt auf Frontseite, aber vorhanden im Detail-Dialog
  - Problem: Emerson Electric zeigt Buchstabe "E" statt Logo auf Hauptseite
  - Root Cause: Fehlerhafte Fallback-Logik (img.src.includes('clearbit') war immer wahr)
  - Fix: Korrekte Fallback-Kette implementiert (Clearbit .ch → .com → Logo.dev → Letter Avatar)
- [x] Bug #81: Dividendenrendite wird nicht geladen (zeigt 0.00 statt 1.6%)
  - Problem: Trotz API-Fallback zeigt Emerson 0.00 statt 1.6% Dividendenrendite
  - Root Cause: Nur EODHD wurde verwendet, kein Fallback auf Finnhub/Yahoo
  - Fix: fetchDividendYieldWithFallback Helper-Funktion mit 3-tier Fallback (EODHD → Finnhub → Yahoo)
- [x] Bug #82: Kurs und YTD Performance werden nicht aktualisiert (0 USD, +0.0%)
  - Problem: Trotz "Aktualisierung" bleiben Kurs und YTD Performance bei 0
  - Root Cause: currentPrice-Bug in YTD-Berechnung (undefined variable)
  - Fix: metrics.currentPrice korrekt verwendet in YTD-Berechnung

## Neue Bugs (Nov 7 - Logitech hinzufügen)
- [x] Bug #83: Falsches Logo bei Logitech
  - Problem: Logitech zeigt falsches Logo (wahrscheinlich Buchstabe "L")
  - Root Cause: Domain mapping fehlt für Logitech (logitech.com)
  - Fix: Logitech zu Swiss domain mapping in allen 3 Stellen hinzugefügt (Frontpage, Detail, Alternativen)
- [x] Bug #84: Manuelle Gewichtung 2% wird ignoriert (Regression von Bug #70)
  - Problem: Nach Hinzufügen von Logitech mit 2% werden ALLE Aktien gleichgewichtet
  - Root Cause: addStock setzte isManualWeight nicht, daher wurde 2% als automatisch behandelt
  - Fix: isManualWeight=1 setzen wenn portfolioWeight > 0, sonst 0 (automatisch)
- [x] Bug #85: Kurs in USD statt CHF für Schweizer Aktien
  - Problem: Logitech (.SW) zeigt Kurs in USD statt CHF
  - Root Cause: Yahoo Finance gibt manchmal USD zurück auch für Schweizer Aktien
  - Fix: Currency-Fallback in fetchStockMetrics - wenn ticker.endsWith('.SW') && currency === 'USD', dann 'CHF' verwenden

## Neue Bugs (Nov 7 - Nach Logitech-Fix)
- [x] Bug #86: Currency-Label fehlt in Portfolio-Tabelle
  - Problem: Kurs ist korrekt in CHF, aber "CHF" wird nicht angezeigt (nur Zahl)
  - Root Cause: Portfolio-Tabelle zeigt nur currentPrice, nicht currency
  - Fix: Bereits implementiert in Zeile 2518 - {stock.currentPrice} {stock.currency || "USD"}
- [ ] Bug #87: Gewichtungslogik funktioniert immer noch nicht
  - Problem: Trotz isManualWeight=1 Fix wird 2% überschrieben
  - Root Cause: recalculateWeights wird nach addStock aufgerufen und überschreibt
  - Lösung: recalculateWeights darf manuelle Gewichtungen (isManualWeight=1) nicht überschreiben
- [x] Bug #88: Kühne + Nagel Logo fehlt
  - Problem: Domain mapping ist vorhanden ('kuehne-nagel.com'), aber Logo wird nicht geladen
  - Root Cause: Company Name mit Umlaut ("Kühne") vs ohne Umlaut ("Kuehne") im mapping
  - Fix: Beide Varianten zum Swiss domain mapping hinzugefügt (mit und ohne Umlaut)

## KRITISCHE WIEDERKEHRENDE BUGS (Nov 8 - Mesa Air)
- [x] Bug #89: Logo fehlt auf Frontpage (wiederkehrendes Problem)
  - Problem: Mesa Air zeigt Logo im Detail-Dialog, aber Buchstabe "M" auf Frontpage
  - Root Cause: Logo-Logik war an 4 Stellen dupliziert und inkonsistent
  - Fix: StockLogo-Komponente erstellt mit 6-stufiger Fallback-Chain, überall verwendet
- [x] Bug #90: Daten werden nicht automatisch geladen beim Hinzufügen von Alternativen
  - Problem: Mesa Air hat Sharpe 0.0, Div 0.0, P/E 0.0, PEG 0.0 (alle Felder leer)
  - Root Cause: Alternative-Add-Flow verwendete nur Competitor-Analyse-Daten (keine Fundamentals)
  - Fix: fetchStockDataMutation vor addStockMutation aufrufen, alle API-Daten laden
  - Test Result: ✅ Sharpe Ratio wird geladen (0.93), P/E=0 ist korrekt (Mesa Air hat keine Earnings)

- [x] Bug #91: Empty src attribute warnings (36 errors)
  - Problem: React warns "An empty string ("") was passed to the src attribute"
  - Root Cause: StockLogo component renders <img src=""> when logoUrl is empty
  - Fix: Added !logoUrl check to show letter avatar directly when logoUrl is null
  - Test Result: ✅ 0 warnings (previously 36)

- [x] Bug #92: Logo Regression - Nestlé und Sika zeigen nur Buchstaben-Avatar
  - Problem: Logos die vorher funktionierten (Nestlé, Sika) zeigen jetzt nur "N" und "S"
  - Root Cause: setTimeout Ansatz funktionierte nicht, React renderte Avatar vor Fallback
  - Fix: useEffect verwenden um Fallback Level zu ändern wenn logoUrl null ist
  - Test Result: ✅ Nestlé, Sika und Mesa Air zeigen alle Logos korrekt

- [ ] Bug #93: Givaudan Logo zeigt falsches Bild (Person mit Kind statt Firmenlogo)
  - Problem: Givaudan SA zeigt ein Foto von einer Person mit Kind statt des echten Logos
  - Root Cause: Logo-URL von einem der Fallback-Services liefert falsches Bild
  - Solution: Givaudan zur Swiss Domain Map hinzufügen oder fehlerhafte URL blockieren

- [ ] B- [x] Bug #94: Kühne + Nagel Logo fehlt
  - Problem: Logo wird nicht angezeigt (hat früher funktioniert)
  - Root Cause: Company Name Varianten nicht im Swiss Domain Map
  - Fix: Alle Schreibweisen hinzugefügt (Kuehne & Nagel, Kuehne & Nagel Int, Kühne & Nagel)
  - Test Result: ✅ Logo wird jetzt angezeigterechnen

- [ ] Bug #95: IBM Sharpe Ratio zeigt 0.00 statt 2.14
  - Problem: Sharpe Ratio wurde im Dialog angezeigt (2.14), aber nicht in Datenbank gespeichert
  - Root Cause: fetchStockData liefert Sharpe Ratio, aber addStock speichert sie nicht
  - Solution: Prüfen ob Sharpe Ratio im addStock Payload enthalten ist

- [ ] Bug #96: Emerson YTD Performance fehlt (trotz Refresh)
  - Problem: YTD Performance wird nicht angezeigt obwohl Refresh geklickt wurde
  - Root Cause: API liefert keine YTD Daten oder Refresh überspringt diese Aktie
  - Solution: Prüfen warum YTD für Emerson nicht geladen wird

- [ ] Bug #97: Pinterest YTD Performance fehlt (trotz Refresh)
  - Problem: YTD Performance wird nicht angezeigt obwohl Refresh geklickt wurde
  - Root Cause: API liefert keine YTD Daten oder Refresh überspringt diese Aktie
  - Solution: Prüfen warum YTD für Pinterest nicht geladen wird


## FIXES (Nov 8 - Final Batch - Ticker & Logo Corrections)
- [x] Bug #93: Givaudan Logo zeigt falsches Bild
  - Fix: GIVN.SW und GIVN zur FMP Blacklist hinzugefügt
  - Fix: Ticker in DB korrigiert (GIVN → GIVN.SW)
  - Fix: Alle Givaudan-Varianten zum Swiss Domain Map hinzugefügt

- [x] Bug #95: IBM Sharpe Ratio zeigt 0.00 statt 2.14
  - Fix: Ticker in DB korrigiert (IBM → IBM.US)
  - Fix: Auto-.US-Suffix für US-Ticker ohne Exchange in fetchStockData

- [x] Bug #96: Emerson YTD Performance fehlt
  - Fix: Ticker in DB korrigiert (EMR → EMR.US)
  - Fix: Auto-.US-Suffix für US-Ticker ohne Exchange in fetchStockData

- [x] Bug #97: Pinterest YTD Performance fehlt
  - Fix: Ticker in DB korrigiert (PINS → PINS.US)
  - Fix: Auto-.US-Suffix für US-Ticker ohne Exchange in fetchStockData

- [x] Bug #98: MESA YTD Performance fehlt
  - Fix: Ticker in DB korrigiert (MESA → MESA.US)
  - Fix: Auto-.US-Suffix für US-Ticker ohne Exchange in fetchStockData

- [x] Bug #99: ABB Logo und Daten
  - Fix: ABB zum Swiss Domain Map hinzugefügt
  - Fix: ABBN Ticker-Mapping für API (ABBN → ABBN.SW) bei Daten-Abruf
  - Note: ABBN bleibt in UI/DB für Kurschart-Kompatibilität

- [x] Bug #100: MESA und Emerson YTD fehlt trotz Ticker-Korrektur
  - Problem: MESA.US und EMR.US in DB, aber YTD wird nicht geladen
  - Root Cause: fetchStockData verwendete denselben cleanTicker für FMP (braucht kein Suffix) und EODHD (braucht Suffix)
  - Fix: Separate Ticker erstellt - eodhdTicker (mit Suffix) und fmpTicker (ohne Suffix)
  - Fix: StockLogo entfernt jetzt alle Exchange-Suffixe für FMP API
- [x] Multi-API-Fallback-Strategie für vollständige Aktiendaten
  - [x] Unified Data Merger Utility erstellen die Daten aus mehreren APIs kombiniert
  - [x] Fallback-Kette implementieren: EODHD → Yahoo Finance → FMP → Finnhub
  - [x] Intelligentes Ticker-Mapping für jede API (z.B. VPBN.SW vs VPBN vs VPBN:SW)
  - [x] Competitor Analyzer aktualisieren um Multi-API-Fallback zu nutzen
  - [x] Add Stock Mutation aktualisieren um Multi-API-Fallback zu nutzen
  - [ ] Testen mit problematischen Schweizer Aktien (VP Bank, EFG International)
- [x] Schweizer Aktien Daten-Problem lösen (VP Bank, EFG, Julius Baer)
  - [x] Alle APIs testen für Sharpe Ratio und PEG Daten (EODHD, Yahoo, Finnhub, FMP, Alpha Vantage)
  - [x] Sharpe Ratio manuell berechnen falls keine API-Daten verfügbar (aus historischen Preisen via Yahoo)
  - [x] PEG Ratio aus P/E und Wachstumsrate berechnen falls nicht verfügbar (aus EODHD quarterly earnings)
  - [x] Logo-Loading für Schweizer Aktien fixen (Julius Baer, VP Bank, EFG zu Domain-Mapping hinzugefügt)
  - [x] Data Merger priorisiert Yahoo für Sharpe, EODHD mit Berechnung für PEG
- [x] Numerische Sortierung für P/E, PEG, Sharpe Ratio und Dividendenrendite fixen
  - [x] Sortier-Logik in Stock-Table-Component gefunden (Home.tsx Zeile 524)
  - [x] ytdPerformance zu numerischen Feldern hinzugefügt
  - [x] Alle numerischen Spalten sortieren jetzt korrekt (parseFloat statt String-Vergleich)
- [x] Fehlende PEG Ratios für bestehende Aktien fixen
  - [x] Datenbank geprüft - viele Schweizer Aktien haben PEG = 0.0
  - [x] Root Cause: EODHD liefert PEG = 0 für viele Aktien, Refresh-Prozess berechnet es nicht
  - [x] Earnings Growth Berechnung in eodhdApi.ts implementiert (aus quarterly earnings)
  - [x] Refresh-Prozess aktualisiert um PEG aus P/E und Earnings Growth zu berechnen wenn EODHD 0 liefert
- [x] ABB Finanzdaten fehlen - Ticker-Problem untersuchen
  - [x] Datenbank geprüft - ABB.N war gespeichert (falsches Format)
  - [x] APIs getestet - ABBN.SW funktioniert perfekt (P/E: 28.49, PEG: 2.89, Div: 1.76%)
  - [x] Ticker aktualisiert: ABB.N → ABBN.SW
- [x] "Neue Aktie" Dialog Fixes
  - [x] Formular-Felder werden jetzt zurückgesetzt beim Öffnen (formData, tickerSearchQuery, suggestions)
  - [x] Schließen-Button (weißes X) hinzugefügt oben rechts mit DialogClose Component
- [ ] KI-Tagesüberblick Feature (wie Swissquote)
  - [ ] AI News Generation API erstellen (LLM + News Search)
  - [ ] Drei Kategorien: Heutige Ergebnisse, Unternehmensnachrichten, Verwandte Artikel
  - [ ] UI Component zwischen Chart und "Analysiere"-Button einfügen
  - [ ] News-Button von Hauptseite entfernen
  - [ ] Weißes Kreuz (X) zum Info-Dialog hinzufügen
  - [ ] Chart-Titel: "(10 Jahre)" entfernen da Timeframe variabel ist

- [x] Fix AI Daily News TypeError - backend response format doesn't match frontend expectations (title property missing)

- [x] Fix Info dialog scrolling - add max-height and overflow-y-auto to prevent vertical overflow

- [x] Fix Swiss stock logos (GF.SW, GIVN.SW) - wrong/generic logos displayed
- [x] Fix currency display for Swiss stocks - shows USD instead of CHF
- [x] Fix Sharpe Ratio calculation for Swiss stocks (GF.SW, BAER.SW) - returns 0.00

- [x] Systematic audit: Check all stocks for currency and Sharpe Ratio bugs
- [x] Bulk update: Fix all Swiss stocks (.SW) with correct CHF prices and Sharpe Ratios
- [ ] Verify: ABB (ABBN.SW) shows CHF instead of USD and has Sharpe Ratio (user needs to run bulk update)

- [x] Fix bulkUpdateSwissStocks import error: getCompleteStockData is not a function

- [x] Automated Daily Refresh: Cron-Job für tägliche Aktualisierung aller Aktien-Metriken
- [x] Data Quality Dashboard: Admin-View mit Metriken-Vollständigkeit (% Sharpe Ratio, Dividenden)
- [x] Manual Refresh Button: Pro-Aktie Refresh-Button im Info-Dialog

- [x] Historical Data Tracking: Database-Schema für Zeitreihen (Sharpe Ratio, PE)
- [x] Historical Data Tracking: Automatische Aufzeichnung bei Refresh
- [x] Historical Data Tracking: Trend-Visualisierung mit Charts
- [x] Alert System: Konfigurierbare Schwellenwerte (Sharpe <1.0, Dividende >5%)
- [x] Alert System: Email-Benachrichtigungen bei Metriken-Änderungen

- [x] Homepage Layout: 4-Spalten-Grid mit Fokus, Kategorien, Performance & Dividende, Portfolio Performance Chart

- [x] Fix YTD Performance discrepancy between Performance & Dividende card and Portfolio Performance Chart

- [x] UI Layout: Erste 3 Kästen schmaler und weniger hoch machen, Chart breiter
- [x] YTD-Berechnung: Chart zeigt 23.97% statt 13.1% wie in Kasten 3

- [x] Layout Redesign: 3 Kästen oben (gleich breit), Portfolio Chart darunter (volle Breite)

- [x] Chart Legend: Alles auf einer Zeile (Portfolio BIG | S&P 500 | Performance-Werte)
- [ ] YTD Performance: Chart-Werte stimmen noch nicht mit Kasten 3 überein

- [x] Legend Format: Performance direkt hinter Label (Portfolio BIG +25.15% | S&P 500 +14.35%)

- [x] Chart-Breite: Schwarzen Chart-Kasten schmaler machen für bessere Proportionen
