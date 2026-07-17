# Vermarktungskonzept Portfoliomanager — Abomodelle, Pricing, Stripe

> Konzeptdokument (kein Code). Stand: 17.07.2026. Grundlage: Ist-Analyse des Codes
> (`server/routers.ts` payment-Router, `server/webhooks/stripe.ts`, `client/src/pages/Pricing.tsx`),
> Live-Verifikation der Bezahl-Pfade sowie die Befunde des externen Repo-Audits (Kimi, 17.07.2026).
> Entscheidungsfragen an den Product Owner sind am Ende markiert.

## 1. Ausgangslage (Ist-Zustand im Code)

Das heutige Modell ist eine **Einmalzahlung von CHF 10** («kein Abo», so auch die FAQ auf
`/pricing`), die per Stripe Checkout (`mode: "payment"`) abgewickelt wird. Der Webhook
(`checkout.session.completed`, signaturverifiziert) setzt `users.hasPaid = 1` und legt einen
`payments`-Eintrag an; eine Bestätigungs-E-Mail wird versendet. Das funktioniert und ist sauber
gebaut. Schwächen des Ist-Zustands:

- `payment.verifyPayment` ist ein **TODO-Platzhalter** (gibt immer «not yet implemented» zurück).
- Premium ist ein **binäres Lifetime-Flag** (`hasPaid`) — es gibt keine Laufzeit, keine Stufen,
  keine Kündigung, keinen wiederkehrenden Umsatz.
- Die Free/Premium-Grenze wird primär im Client durchgesetzt; serverseitig existieren
  **63 `publicProcedure`s**, von denen einige proprietäre Inhalte (Scores, Moats, Signale)
  ohne Login liefern (Kimi-Befund S-3). Der grösste Kostenhebel — unauthentifizierte
  EODHD-Abrufe über `stocks.fetchStockData` — ist seit heute geschlossen (A-11-Fix).
- Laufende Kosten pro aktivem Nutzer entstehen durch EODHD-API-Calls und LLM-Features
  (Copilot, Challenge-Layer, Auto-Portfolio-Begründungen). Bei CHF 10 einmalig ist jeder
  langfristig aktive Nutzer strukturell defizitär.

## 2. Positionierung und Zielgruppe

Zielgruppe laut Projektauftrag: Schweizer Privatanleger 50+, die Qualität und Verständlichkeit
über Trading-Action stellen. Die Differenzierung des Produkts ist Ehrlichkeit und Schweiz-Bezug:
CHF-konsequente Bewertung, SMI/SPI-Benchmarks, Verrechnungssteuer-Realität, deutsche Sprache
(Sie-Form), grosse Schrift. Das Marketing sollte genau diese Punkte tragen: «Ihr Depot, ehrlich
gerechnet — in Franken.» Kein «schlage den Markt»-Versprechen; das Produkt ist ein
Qualitäts- und Entscheidungswerkzeug, kein Anlageberater (Disclaimer beibehalten).

## 3. Empfohlenes Abomodell (3 Stufen + Bestandsschutz)

| Stufe | Preis (Vorschlag) | Inhalt |
|---|---|---|
| **Free** | CHF 0 | 1 Demo-Portfolio, Kurse EOD (verzögert), Basis-Signale ohne Score-Details, kein Copilot, keine Alarme. Zweck: risikofreies Kennenlernen, Conversion-Trichter. |
| **Premium** | CHF 9.90/Monat oder CHF 99/Jahr | Unbegrenzte Live-Portfolios, volle Signale/Scores/Moats, Dividendenkalender, Preisalarme, Wertentwicklung/Qualitäts-Historie, Portfolio-Vergleich. |
| **Pro** | CHF 29/Monat oder CHF 290/Jahr | Alles aus Premium plus: Auto-Portfolio & Optimizer, KI-Copilot mit Datenzugriff (Tool-Use), Algo-Backtesting-Einblick, Steuer-Reporting, PDF-Import, mehrere Familien-Depots (der real existierende Anwendungsfall: getrennte Depots für Familienmitglieder). |

**Bestandsschutz:** Bisherige CHF-10-Käufer behalten lifetime **Premium** (Grandfathering via
bestehendem `hasPaid`-Flag). Das ist fair, technisch trivial und vermeidet Support-Aufwand.

**Begründung der Preispunkte:** CHF 9.90 liegt unter der psychologischen 10er-Schwelle und im
Rahmen vergleichbarer CH-Finanz-Apps; CHF 29 für Pro deckt die LLM-/Datenkosten intensiver
Nutzer und positioniert die KI-Features als sichtbaren Mehrwert. Jahrespreise mit ~2 Gratismonaten
fördern Vorauszahlung und senken Churn. Ein 14-Tage-Pro-Trial beim Registrieren zeigt die
stärksten Features früh.

**Kostenschutz im Free-Tier:** EOD- statt Realtime-Kurse, aggressives Caching, keine
LLM-Features. Die heutigen `publicProcedure`s sind auf das zu reduzieren, was Landing/Pricing
wirklich brauchen (Inventarliste als eigener Arbeitsschritt, siehe Kimi S-3).

## 4. Stripe-Integration in Etappen

**E1 — Von Einmalzahlung auf Subscriptions (Grundgerüst):**
Stripe Products/Prices im Dashboard anlegen (statt Inline-`price_data`), Checkout auf
`mode: "subscription"` umstellen, Stripe **Billing Portal** für Kündigung/Zahlungsmittel
aktivieren (spart eigene UI). Webhook um `customer.subscription.created/updated/deleted` und
`invoice.paid` / `invoice.payment_failed` erweitern. Datenmodell: `users.hasPaid` bleibt für
Grandfathering; neu `subscriptionTier` (`free|premium|pro`) + `subscriptionValidUntil` +
`stripeSubscriptionId`. Serverseitige Gates lesen ausschliesslich diese Felder (eine zentrale
`getTier(user)`-Funktion, keine verstreuten Checks). `payment.verifyPayment` entweder echt
implementieren (Session-Status nachschlagen) oder entfernen — kein Platzhalter im Prod-Code.

**E2 — Schweiz-Spezifika:** TWINT als Zahlungsmethode über Stripe aktivieren (für die
Zielgruppe 50+ wichtiger als Apple Pay), Rechnungs-PDFs über Stripe Invoicing. MWST: aktuelle
Schweizer Sätze und die Umsatzgrenze für die MWST-Pflicht mit dem Treuhänder klären; Stripe Tax
kann die Erhebung automatisieren, ersetzt aber die Abklärung nicht.

**E3 — Nutzungsbasierte Grenzen:** Copilot-Kontingente pro Tier (z. B. Premium 50
Fragen/Monat, Pro unbegrenzt fair-use), gemessen über die bestehende Chat-Infrastruktur.
Erst nötig, wenn LLM-Kosten pro Nutzer messbar ins Gewicht fallen.

## 5. Voraussetzungen vor dem Bezahl-Launch (Blocker)

Diese Punkte stammen aus dem externen Audit und sind **vor** aktiver Vermarktung zu erledigen,
weil sie bei zahlenden Kunden Haftungs- bzw. Vertrauensrisiken sind:

1. **revDSG-Konformität** (Kimi D-1…D-4): Datenschutzerklärung konkret machen (LLM-Datenfluss
   ins Ausland, Twilio/WhatsApp, Resend, EODHD), Impressum/AGB von den DSGVO-Templates auf die
   echte Gesellschaft und revDSG umstellen, PII-Redaktion in Logs. → Durch eine Fachperson
   prüfen lassen; die App behauptet aktuell «revDSG-konform» auf Marketing-Seiten.
2. **Repo-Exposition**: Solange das Repo öffentlich ist, sind interne Auditpläne und
   Historien-Artefakte einsehbar → Repo privat stellen, historische Keys rotieren (Kimi S-1/S-2).
3. **Prozess-Gates**: CI als Required Check + Branch-Schutz auf `main` (CI-Workflow liegt seit
   heute im Repo), damit Agenten-Output nicht ungeprüft zu zahlenden Kunden deployt.
4. **Preiskommunikation bereinigen**: `/pricing` verspricht heute «Einmalzahlung, kein Abo» —
   beim Wechsel auf Abos müssen Seite, FAQ und AGB konsistent umgestellt werden (Grandfathering
   explizit kommunizieren).

## 6. Entscheidungsfragen an den Product Owner

1. **Abo vs. Einmalzahlung:** Wechsel auf das 3-Stufen-Abo wie oben — ja/nein? (Alternative:
   Einmalzahlung behalten und nur Pro als Abo einführen.)
2. **Preishöhe:** CHF 9.90/29 akzeptiert, oder bewusst höher/tiefer positionieren?
3. **Zielsegment Pro:** Reines Consumer-Pro, oder mittelfristig ein Advisor-/Treuhänder-Angebot
   (Mandantenfähigkeit, heute schon faktisch durch Familien-Depots angelegt)?
4. **MWST/Buchhaltung:** Wer klärt Registrierungspflicht und Rechnungsstellung (Treuhänder)?
