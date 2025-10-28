# Portfolio BIG - TODO

## In Arbeit

## Später
- [ ] Stripe API-Keys konfigurieren (erfordert Stripe-Account)
- [ ] TWINT als Zahlungsmethode aktivieren
- [ ] Email-Service für Verifizierung konfigurieren

## Bugs

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
- [ ] Live Stripe Keys für Produktion konfigurieren (wenn bereit für Live-Betrieb)

