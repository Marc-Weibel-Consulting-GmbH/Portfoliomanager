# Vermarktungskonzept — Portfoliomanager

Stand: 2026-07-17 · Status: **Konzept zur Entscheidung** · Markt: Schweiz, Privatanleger 50+

Dieses Dokument beschreibt Abomodelle, Pricing, die Stripe-Integration und den Weg zur Vermarktung.
Grundlage ist der heutige Ist-Zustand (Audit 2026-07-B) und die Positionierung des Produkts.

---

## 1. Ausgangslage (Ist-Zustand)

| Aspekt | Heute | Bewertung |
|---|---|---|
| Modell | Free (CHF 0) vs. Premium **CHF 10 einmalig** (Lifetime) | ❌ keine wiederkehrenden Einnahmen |
| Paywall | **Nicht im Code durchgesetzt** (Audit K-A1) | ❌ «Premium» ist heute wirkungslos |
| Stripe | Checkout (`mode: "payment"`) + Webhook vorhanden | ⚠️ nur Einmalzahlung, keine Subscriptions |
| DB | `users.hasPaid / paymentDate / stripeCustomerId / stripePaymentId` | ✅ Basis vorhanden, muss auf Abo erweitert werden |
| Zahlarten | Stripe (nur `card`) beworben mit TWINT/PostFinance | ⚠️ TWINT/PostFinance im Checkout noch nicht aktiviert |

**Kernproblem:** CHF 10 einmalig für ein Tool mit laufenden Kosten (EODHD-Marktdaten, LLM-Aufrufe,
Railway-Services, ML-Training) ist **nicht kostendeckend** und schon gar nicht profitabel. Bei
laufenden Datenkosten von geschätzt CHF 2–5 pro aktivem Nutzer und Monat verliert jedes verkaufte
Lifetime-Abo ab Monat 3 Geld. Der erste strategische Schritt ist der Wechsel zu einem
**wiederkehrenden Abomodell**.

---

## 2. Zielgruppe & Zahlungsbereitschaft

- **Primär:** Schweizer Privatanleger 50+, Vermögen typ. CHF 100k–1 Mio., Selbstentscheider, die
  keine Vermögensverwaltung zu 0.8–1.2 % p.a. wollen, aber mehr als ein Excel.
- **Anker für Zahlungsbereitschaft:** Eine Vermögensverwaltung kostet bei CHF 300k rund
  **CHF 3'000/Jahr**. Ein Tool für CHF 120–240/Jahr ist dagegen ein Bruchteil — die Zahlungsbereitschaft
  für ein seriöses, CHF-first, datenehrliches Werkzeug ist deutlich höher als die heutigen CHF 10.
- **Vergleichswerte Markt:** Sharesight (Portfolio-Tracking) ~CHF 15–30/Monat, Parqet (DACH)
  ~EUR 8–20/Monat, justETF Plus ~EUR 6/Monat. Der Portfoliomanager bietet mit KI-Optimierung,
  Markt-Hub und Copilot **mehr** als reines Tracking → oberes Drittel dieser Spanne ist verteidigbar.

---

## 3. Empfohlenes Abomodell (3 Stufen)

Bewusst schlank — 50+ Zielgruppe will klare Wahl, nicht 5 Tarife.

| | **Free** | **Plus** ⭐ | **Pro** |
|---|---|---|---|
| Preis | CHF 0 | **CHF 12/Mt.** oder **CHF 120/Jahr** (−17 %) | **CHF 25/Mt.** oder **CHF 240/Jahr** |
| Portfolios | 1 (Demo/Read-only) | 3 Live-Portfolios | Unbegrenzt |
| Positionen | bis 10 | unbegrenzt | unbegrenzt |
| Kursdaten | 15-Min-verzögert | Echtzeit (EODHD) | Echtzeit |
| Performance (TTWROR/IRR) | – | ✅ | ✅ |
| Portfolio-Optimierung | 3 Läufe/Monat | ✅ unbegrenzt (Max-Sharpe/Min-Var/HRP) | ✅ + exakt (PyPortfolioOpt) + Sektor-Caps |
| Auto-Portfolio-Vorschlag (KI) | – | ✅ | ✅ + Multi-Agent-Challenge-Report |
| Markt-Hub / KI-Tagesbericht | Überblick | ✅ voll | ✅ voll + Faktor-/Regime-Tilts |
| Copilot (KI-Chat) | 5 Fragen/Monat | 100 Fragen/Monat | unbegrenzt* |
| Preisalarme | 3 | 25 | unbegrenzt |
| Steuer-Reporting (CH, Jahresübersicht) | – | ✅ | ✅ + Export |
| Dividenden-Kalender & -Tracking | – | ✅ | ✅ |
| Support | – | E-Mail | E-Mail + Priorität |

\* «unbegrenzt» mit Fair-Use-Deckel gegen Kosten-Missbrauch (LLM), technisch über die bereits
vorhandenen Rate-Limit-Bausteine.

**Warum diese Stufung:**
- **Free** ist ein echtes Schaufenster (Demo-Portfolio + verzögerte Kurse + Markt-Hub-Überblick),
  nicht bloss eine Sackgasse — es demonstriert die Datenqualität und macht Lust auf Live-Tracking.
- **Plus** ist das Volumenprodukt: alles, was ein Selbstentscheider für sein reales Depot braucht.
  Der Jahrespreis CHF 120 liegt bewusst unter der psychologischen 150er-Schwelle.
- **Pro** ist für aktive/vermögende Anleger mit mehreren Depots, die den exakten Optimierer, den
  Challenge-Report und unbegrenzten Copilot wollen — höhere Marge, trägt die LLM-Kosten der Heavy-User.

**Lifetime-Bestand:** Alle heutigen «CHF 10 einmalig»-Käufer erhalten **Plus dauerhaft geschenkt**
(Grandfathering) — fair, erzeugt Goodwill, und die Zahl ist klein genug, um verkraftbar zu sein.

---

## 4. Feature-Gating (technische Umsetzung — behebt Audit K-A1)

Das Modell wirkt nur, wenn der Code es durchsetzt. Vorgeschlagene Architektur:

1. **Schema:** `users` erweitern um `plan` (`free|plus|pro`), `planStatus` (`active|past_due|canceled`),
   `planRenewsAt`, `stripeSubscriptionId`. `hasPaid` bleibt für Grandfathering-Migration.
2. **Zentrale Autorisierung:** neues `server/lib/entitlements.ts` mit
   `getEntitlements(userId) → { plan, limits, features }` (5-Min-Cache wie riskFreeRate) und
   `requireFeature(ctx, "optimizer_exact")` / `checkLimit(ctx, "portfolios", currentCount)`.
   → **Eine Wahrheit pro Berechtigung**, statt verstreuter `if (hasPaid)`-Checks.
3. **Durchsetzung an den tRPC-Prozeduren:** `autoPortfolioRouter.buildProposal`,
   `analyticsRouter.optimize` (exakt), `chatRouter.sendMessage` (Copilot-Kontingent),
   `portfoliosRouter.create` (Anzahl-Limit), `priceAlertsRouter.create` (Anzahl), Steuer-Report,
   Echtzeit-Kurse. Bei Überschreitung: klarer `TRPCError` mit `code: "FORBIDDEN"` + Upgrade-Hinweis.
4. **Client:** Upgrade-Prompts statt harter Blocker («Diese Funktion ist Teil von Plus — jetzt
   upgraden»), Plan-Badge im Nutzer-Menü (heute schon «FREE»-Badge sichtbar → nur verdrahten).
5. **Kosten-DoS-Schutz:** LLM-Prozeduren (Copilot, buildProposal) zusätzlich pro Nutzer/Tag
   rate-limiten — schützt Marge unabhängig vom Plan.

---

## 5. Stripe-Integration (Ausbau auf Subscriptions)

Der vorhandene Einmalzahlungs-Flow wird auf wiederkehrende Abos umgestellt:

1. **Produkte/Preise in Stripe anlegen:** 4 Prices (Plus monatlich/jährlich, Pro monatlich/jährlich)
   in CHF. Preis-IDs als Env-Variablen, nicht hartkodiert.
2. **Checkout:** `stripe.checkout.sessions.create({ mode: "subscription", line_items: [{ price: PRICE_ID, quantity: 1 }], … })`
   statt heute `mode: "payment"`. `customer_email` + `client_reference_id: userId` mitgeben.
3. **Zahlarten aktivieren:** `payment_method_types` um **TWINT** und **PostFinance** erweitern (in der
   Schweiz erwartet; heute nur `card`) — im Stripe-Dashboard freischalten. So wird das Pricing-Versprechen
   («TWINT und PostFinance») eingelöst.
4. **Customer Portal:** Stripe Billing Customer Portal einbinden (Kündigung, Zahlungsmittel, Rechnungen
   im Self-Service) → «Abo verwalten»-Button in den Einstellungen. Reduziert Support-Last massiv.
5. **Webhook erweitern** (`server/webhooks/stripe.ts`) um die Abo-Events:
   `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed` →
   `plan`/`planStatus`/`planRenewsAt` pflegen. Signatur-Prüfung (`stripe.webhooks.constructEvent`)
   ist Pflicht (Webhook-Secret).
6. **Dunning:** bei `payment_failed` → `planStatus="past_due"`, Kulanzfrist (z. B. 7 Tage voller
   Zugriff), dann Downgrade auf Free. E-Mail-Erinnerungen über den bestehenden Resend-Versand.
7. **MwSt.:** Stripe Tax für die Schweiz aktivieren (8.1 % MwSt. auf digitale Dienstleistungen an
   CH-Privatkunden) — sonst drohen Nachzahlungen. Rechtlich vorab mit Treuhänder klären.

---

## 6. Go-to-Market

**Positionierung (ein Satz):** *«Der ehrliche Schweizer Portfolio-Manager — Echtzeit-Tracking,
KI-Optimierung und ein persönlicher Analyse-Copilot, CHF-first und ohne verstecktes Datentheater.»*
Die Datenehrlichkeit (keine erfundenen Zahlen, ehrliche Leerzustände) ist ein echtes
Differenzierungsmerkmal gegenüber vielen Fintech-Tools — das gehört ins Marketing.

**Kanäle (kosteneffizient, für die Zielgruppe):**
- **Content/SEO:** deutschsprachige Ratgeber («Wie berechne ich die echte Rendite meines Depots
  (TTWROR)?», «Klumpenrisiko im Schweizer Depot erkennen») — die Zielgruppe googelt Fachfragen.
- **Kooperationen:** Schweizer Finanzblogs (z. B. Mustachian-Community, The Poor Swiss),
  unabhängige Honorarberater (die das Tool ihren Kunden empfehlen können).
- **Referral:** «30 Tage Plus für Sie und einen Freund» — die bestehende `stripeCustomerId` erlaubt
  einfache Gutschrift-Codes.
- **Bestandsaktivierung:** die Free-Nutzer und Lifetime-Käufer sind der erste Upgrade-Trichter.

**Conversion-Hebel:**
- **14-Tage-Plus-Trial ohne Karte** (Stripe Trial) — die 50+ Zielgruppe testet lieber ohne
  sofortige Zahlungsverpflichtung.
- **Onboarding-zu-Aktivierung fixen** (Audit M-A1): Der neue-Nutzer-Erststart muss den Wert sofort
  zeigen, sonst versickert der Trial. Import des echten Depots (PDF/CSV — existiert) als erster Schritt.
- **Jährlich vor monatlich** bewerben (−17 %): bessere Bindung, weniger Zahlungsausfälle.

---

## 7. Grobe Wirtschaftlichkeit (illustrativ)

| Szenario | Zahlende | Ø Erlös/Jahr | Bruttoerlös/Jahr |
|---|---|---|---|
| Konservativ | 100 (80 Plus / 20 Pro) | ~CHF 145 | ~CHF 14'500 |
| Mittel | 500 (400 Plus / 100 Pro) | ~CHF 145 | ~CHF 72'500 |
| Optimistisch | 2'000 (1'500 Plus / 500 Pro) | ~CHF 150 | ~CHF 300'000 |

Dagegen laufende Kosten (EODHD, LLM, Railway, Stripe-Gebühren ~3 %): grob CHF 3–6/zahlendem
Nutzer/Monat. **Ab ~150 zahlenden Nutzern** trägt sich der Betrieb; darüber skaliert die Marge, weil
die Fixkosten (Datenlizenzen) geteilt werden. Der Wechsel weg von «CHF 10 Lifetime» ist damit nicht
nur ein Erlös-, sondern ein Überlebensthema.

---

## 8. Umsetzungsreihenfolge

| Phase | Inhalt | Voraussetzung |
|---|---|---|
| **P1 (Blocker)** | Entitlements-Layer + Feature-Gating (Audit K-A1); Fake-Trustpilot entfernen (H-A1) | — |
| **P2** | Stripe auf `mode:"subscription"` umstellen, 3-Stufen-Preise, Customer Portal, Webhook-Events, TWINT/PostFinance, Stripe Tax | P1 |
| **P3** | Pricing-Seite auf 3 Stufen + Abo neu; Upgrade-Prompts im Client; Plan-Badge verdrahten | P2 |
| **P4** | Trial-Flow, Referral, Grandfathering-Migration der Lifetime-Käufer | P2 |
| **P5** | Erststart-/Aktivierungs-UX (Audit M-A1/M-A2), Import als Onboarding-Schritt | parallel |

**Offene Entscheide (Product Owner):**
1. Genaue Preispunkte (Vorschlag: Plus 12/120, Pro 25/240) — final?
2. Trial mit oder ohne Kreditkarte?
3. Grandfathering: Lifetime-Käufer → dauerhaft Plus (empfohlen) oder zeitlich begrenzt?
4. Rechtsprüfung MwSt./AGB/Widerruf mit Schweizer Treuhänder vor Launch.
