# Portfolio BIG - TODO

## In Arbeit
- [ ] Sharpe-optimiert: Alle Aktien etwa gleichgewichtet (Monte Carlo findet keine Optimierung)
- [ ] Sharpe-optimiert: Aktie mit 0% Gewicht wird angezeigt (sollte gefiltert werden)
- [x] Durchschnittliche Dividendenrendite optimiert (iterativer Algorithmus mit ±0.1% Toleranz)
- [x] Warnung wenn maximale Div.rendite nicht erreichbar (>0.5% Abweichung)
- [x] Button-Text bei Varianten-Switcher dunkel (nicht-aktiver Button soll weiß sein)
- [x] Aktien mit 0% Gewicht werden nicht mehr angezeigt (gefiltert)
- [x] Investitionsbetrag Schriftgröße im Optimizer wesentlich vergrößert (text-7xl/8xl, h-32/40, responsive)

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

