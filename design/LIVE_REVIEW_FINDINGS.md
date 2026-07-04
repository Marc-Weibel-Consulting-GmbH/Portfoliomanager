# Live-Screenshot-Review (60 Seiten, Stand 04.07.2026)

## Seiten 1–10 (Landing, Pricing, Dashboard)

### L-01 Landing-Seite durchgehend Du-Form (U-15-Lücke)
- «Optimiere dein Aktienportfolio», «Verfolge die Performance deines gesamten Portfolios»,
  «Erstelle und optimiere dein Portfolio», «Setze individuelle Alarme»
- Landing.tsx war im Phase-4.4-Sprachpass NICHT erfasst → Sie-Form nachziehen. [S]

### L-02 Pricing: Widerspruch einmalig vs. monatlich
- Karte: «CHF 10 einmalig» / «Lebenslanger Zugriff für eine einmalige Zahlung»
- FAQ: «Mit dem monatlichen Abo für CHF 10.00 ... jederzeit kündigen, keine Mindestlaufzeit»
- Inhaltlicher Selbstwiderspruch — Pricing.tsx FAQ vs. Karten-Copy angleichen. [S]

### L-03 Markt-Puls: alle Sektoren 0.0%
- Dashboard «Markt-Puls · Sektoren heute»: Technologie/Finanzen/Gesundheit/... alle 0.0%
- widerspricht direkt der KI-Analyse darunter (Gesundheit +2.63%, Versorger +2.21%)
- TOP-GEWINNER «AAPL +0.0%» ebenfalls null → Sektor-Performance-Datenpfad defekt. [M]

### L-04 Kaputtes Logo auf Pricing-Header
- leeres schwarzes Quadrat neben «Interaktive Aktien Portfolio Analyse» [S]

### L-05 Produktname inkonsistent
- Landing «Portfolio Analyzer» / Pricing «Interaktive Aktien Portfolio Analyse» / Dashboard «Portfoliomanager»
- einen Namen festlegen (APP_TITLE) [S]

### L-06 DSGVO statt revDSG (C-02, Rechtstext)
- Pricing-FAQ «halten uns strikt an die DSGVO»; Footer «© 2025»
- DSGVO→revDSG-Wording; Jahr dynamisch. [S] (juristische Inhalte separat, C-02)

### L-07 Landing: englische/gemischte Trust-Badges
- «SSL verschlüsselt» ok, «Stripe Payment» englisch; Investoren-Logos wirken kaputt (Text «Investhvesth...» überlappt) [S]

## Seiten 11–20 (Portfolios, Aktien, Signale, Copilot, Builder)

### L-08 Portfolio-Karten: Wert und YTD überlappen (Layout-Bug) [M] KRITISCH-UX
- «CHF 105'535.95%» — Wert «CHF 105'535» und YTD «3.95%» kollidieren; ebenso «CHF 474'998.70%», «CHF 679'350.50%»
- Wert-Spalte zu breit / YTD ohne Abstand → in den Portfolio-Cards der Übersicht

### L-09 Strategie-Scoring-Widget ohne Tickernamen [M]
- «Top 5»: 5 Zeilen nur «- BUY», kein Titel/Ticker sichtbar → Datenbindung fehlt

### L-10 F-12 NICHT umgesetzt: Copilot hat weiterhin 5 Tabs [M]
- Live: Insights | Chat | History | Signal-Feed | Deep-Dive
- Vorgabe war: Copilot = NUR Chat + History; Insights→Dashboard, Signale→Signale-Seite, Deepdive→Portfolios
- F-12 wurde nur im Plan dokumentiert, nie implementiert → nachholen

### L-11 Portfolios-Übersicht: grosse leere Fläche in der Mitte [S]
- unterhalb der 3 Portfolio-Cards weiter schwarzer Leerraum, während rechte Spalte lang ist

### L-12 Bubble 0/100 & Sharpe 0.00 in Portfolios-KPI [M]
- getRiskMetrics/Bubble liefert Nullwerte (F-08-Datenpfad; ggf. noch nicht deployt oder Datenlücke)

### L-13 Preisalarm «BAER.SW Über CHF 0.00» [S]
- Alarm-Schwelle 0.00 wirkt wie Datenfehler (Alarm ohne gültige Schwelle)

### Positiv bestätigt (bereits umgesetzt & live)
- Aktien: Tabs «Titel | Signale» (F-10a) ✓
- Signale-Tab mit Empfehlungs-Historie inkl. Benchmark (SMI) + Alpha (F-14) ✓ (alle «Auswertung ausstehend» — erwartbar)
- Signal-Semantik Halten/Erhöhen/Kaufen/Verkaufen ✓
- Builder «Wählen Sie Ihren Pfad» mit Abbrechen + Import «aus Swissquote-PDF» (U-02/U-09) ✓
- Sie-Form im App-Kern ✓

## Seiten 21–30 (Portfolios, Markt-Dividenden, Preisalarme, Rechner, Einstellungen, Admin)

### L-13 bestätigt+präzisiert: Prozent-Alarme falsch dargestellt [S]
- Preisalarme-Seite: BAER.SW = «Änderung 20%», Zielpreis «20%» (korrekt dort)
- ABER Portfolios-Sidebar «Aktive Alarme» rendert denselben Alarm als «Über CHF 0.00»
- Widget behandelt Alarmtyp «Änderung %» nicht → CHF-0.00-Fehlanzeige. Auch APPLE «Aktueller Preis: -»

### L-14 Extreme YTD-Werte in Stammdaten [S, prüfen]
- Admin-Stammdaten: BE +211.8%, DELL +213.3% YTD — auffällig hoch, evtl. R-30-Klasse (roher Close/Corporate Action)
- gegen echte Kurshistorie prüfen; ggf. recompute-ytd-baselines nötig

### Positiv bestätigt (live)
- F-06 Markt-Hub «Dividenden-Kalender» (eigene Positionen, Erwartet 12M CHF) ✓
- F-13 Admin «Stammdaten (Nur-Lese)» + Hinweis/Button «Zur Aktienliste & Watchlist» ✓
- F-15 Admin-Card «Wikifolio Portfolio ... in die Watchlist importieren» ✓
- F-14 Admin-Card «Signal-Performance: Trefferquote, Rendite, Kalibrierung je Signal-Engine» ✓
- Gebühren-Tab in Einstellungen (U-20) ✓; Rechner (Pension/Budget/Steuer) ✓
- Preisalarme-Tabelle mit Toggle/Edit/Delete sauber ✓

## Seiten 31–42 (Admin Stammdaten, Watchlist F-13, Wikifolio F-15, KPIs)

### L-15 NaN-Preise in Admin-Stammdaten [S] KRITISCH-Darstellung
- ROG.SW «NaN CHF», HELN.SW «NaN CHF», MESA.US «NaN USD» → Preisabruf fehlgeschlagen
- muss «—» statt «NaN» rendern (safeParseFloat/Anzeige-Guard); auch prüfen warum Roche/Helvetia keinen Kurs haben

### L-16 133 Wikifolio-Alt-Importe mit ISIN als Ticker [M, Datenbereinigung]
- Watchlist «Alle (164)»: 133 «Manuell»-Zeilen mit ISIN im Ticker-Feld (US02079K1079 = Alphabet, ...), Score 0, kein Sektor/PE, «Halten»
- das sind Importe VOR dem F-15-ISIN-Fix; neue Importe lösen ISIN→Ticker auf
- Empfehlung: Alt-Zeilen bereinigen/neu importieren; ggf. Backfill ISIN→Ticker für Bestand

### L-17 Empfehlungen (0) — Kuratierung ausstehend [Betrieb]
- F-13-Tab «Empfehlungen (0)» → Nutzer hat noch nichts als Empfehlung markiert
- /aktien greift dank Fallback auf alle aktiven Titel; Bulk-Button «Alle aktiven als Empfehlung markieren» klicken

### L-18 Platform-KPIs alle 0 + «coming soon» [S]
- Gesamt-Benutzer/Neue/Premium/Portfolios = 0; «Detaillierte Statistiken: Diese Funktion wird in Kürze verfügbar sein»
- KPI-Datenpfad nicht verdrahtet (Admin-intern, niedrige Prio)

### L-19 Extreme YTD-Werte (R-30-Klasse) [M]
- LRCX +386.5%, MU +241.8%, DELL +213.3%, BE +211.8%, ARM +188.4%, MRVL +188.6%
- gegen echte Historie prüfen; scripts/recompute-ytd-baselines.ts gegen Prod-DB laufen lassen (adjustedClose)

### Positiv bestätigt (live)
- F-13 «Aktienliste & Watchlist» mit Tabs Empfehlungen/Watchlist/Alle, Zähler, Signal/Score/Quelle-Spalten ✓
- F-15 Wikifolio «Erfolgreiche Trader suchen» (Kriterium 12-Monats-Performance), Symbol-Abruf, Positionen mit ISIN, «In Watchlist importieren» ✓

## Seiten 43–60 (Admin: Secrets, Berechnungen, Logs, Signal-Performance, Settings)

### L-20 Server-Logs decken die Wurzel-Ursachen von L-03/L-13/L-15/L-16 auf [M] — WICHTIG
81 Log-Einträge, 35 Fehler / 46 Warnungen. Cluster:
- `[watchlistAlertsCron] Error checking US02079K1079 … Quote not found for symbol: US…` — Dutzende.
  → **derselbe Defekt wie L-16**: watchlistAlertsCron versucht, für die 133 ISIN-als-Ticker-Zeilen
    Quotes zu holen und scheitert bei jedem Cron-Lauf. Das ist kein reiner Kosmetik-Bug, sondern
    erzeugt dauerhaft Log-Spam. **Code-Fix:** ISIN-Einträge im Cron überspringen/auflösen statt Fehler werfen.
- `[getPortfolioCompact] Yvonne: ticker LVMUY not found in stocks table` / `ABB.SW not found`
  → Portfolio hält Ticker, die nicht in der stocks-Tabelle sind → fehlende Preise/Namen. Teils Daten (LVMUY, ABB.SW anlegen), teils Code (Warnung entschärfen).
- `[EODHD] Error fetching real-time for MONC.MI: HTTP 404` / `[DividendCalendar] … MONC.MI 404`
  → falscher Börsen-Suffix für Moncler; Symbol-Mapping prüfen.
- `[PriceAlerts] No price data for APPLE`
  → **Wurzel von L-13** «APPLE Aktueller Preis –»: Alarm auf ungültigen Ticker «APPLE» (statt AAPL) gespeichert.
- `[signalEvalCron] Error snapshotting HELN.SW: No data found, symbol may be delisted`
  → **Wurzel von L-15** «HELN.SW NaN CHF»: EODHD liefert für Helvetia keinen Kurs.

### Positiv bestätigt (live) — Admin-Backoffice ist stark
- **Admin › Berechnungen & Formeln** (neu): TTWROR, IRR, YTD, Ø-Kostenbasis, Unrealisiert, DayChange,
  Realisiert (FIFO) — je mit Formel, Variablen-Legende, konkretem Rechenbeispiel + Ergebnis.
  Erfüllt Transparenz-Anspruch (R-Dokumentation, Ghostfolio-Modell). Sehr gut. ✓
- **Admin › Signal-Performance** (F-14): Lookback-Umschalter 30/60/90/180T, «Jetzt Snapshot starten»,
  Kalibrierungskurve je Conviction-Bucket, «Letzte Signale» (50) mit Engine/Regime/Überzeugung%/Rendite/Korrekt.
  «0 evaluierte / ausstehend» ist erwartbar (Snapshot 04.07. 07:35, Haltedauer noch nicht abgelaufen). ✓
- **Admin › Einstellungen**: Diversifikationsregeln (Max/Min-Position, Min-Positionsgrösse, Min/Max-Titel)
  + Gebührenstruktur (Kauf/Verkauf 0.25 %, Min 9.90, Max 50, Stempelsteuer 0.075 %, FX-Spread 0.5 %). ✓
- **Admin › Secrets**: 17 Keys, FMP eliminiert (kein FMP-Key mehr), EODHD/Anthropic/Perplexity/Wikifolio vorhanden,
  «verschlüsselt gespeichert» (C-05/secretsManager). ✓

---

## KONSOLIDIERUNG — Fix-Reihenfolge

**Code-fixbar in dieser Session (Frontend/Backend-Logik):**
1. L-10 (F-12) Copilot verschlanken: nur Chat + Verlauf; Insights→Dashboard, Signale→Signale-Seite, Deep-Dive→Portfolios. **User explizit gefordert, nie umgesetzt.**
2. L-08 Portfolio-Karten Wert/YTD-Overlap (Layout).
3. L-13 «Aktive Alarme»-Widget: Änderung-%-Alarme korrekt rendern statt «Über CHF 0.00».
4. L-15 NaN-Anzeige-Guard: «—» statt «NaN CHF».
5. L-20 watchlistAlertsCron: ISIN-Einträge überspringen (Log-Spam stoppen).
6. L-09 Strategie-Scoring-Widget: Ticker/Titel binden statt nur «- BUY».
7. L-01 Landing Sie-Form; L-02 Pricing einmalig/monatlich-Widerspruch; L-04 kaputtes Logo; L-05 Produktname (APP_TITLE); L-06 DSGVO→revDSG + Jahr dynamisch; L-07 Trust-Badges; L-11 Leerraum.
8. L-03 Markt-Puls-Sektoren 0.0 % / L-12 Bubble+Sharpe 0 — Datenpfad prüfen (evtl. Code).

**Betrieb (Prod-DB, user-seitig):**
- L-16/L-20 Alt-Zeilen bereinigen bzw. ISIN→Ticker-Backfill; LVMUY/ABB.SW in stocks anlegen; «APPLE»-Alarm korrigieren; MONC.MI/HELN.SW/ROG.SW Symbol-Mapping.
- L-14/L-19 recompute-ytd-baselines.ts gegen Prod-DB (adjustedClose).
- L-17 Empfehlungen kuratieren; L-18 Platform-KPI-Datenpfad.

---

## STATUS DER UMSETZUNG (diese Session)

**Behoben (Code, committet):**
- L-01/02/04/05/06/07 Landing/Pricing-Copy ✓
- L-08 Portfolio-Karten-Overlap ✓
- L-09 Strategie-Scoring-Widget (ticker/combinedScore) ✓
- L-10/F-12 Copilot verschlankt + Deep-Dive nach Portfolios ✓
- L-13 Alarm-Widget alle Typen ✓
- L-15 NaN-Anzeige-Guard ✓
- L-12 Sharpe/Bubble «—» statt vorgetäuschter 0 ✓
- L-20 watchlistAlertsCron ISIN-Skip + isLikelyIsin (+ Test) ✓

**Analysiert, kein Code-Bug:**
- L-03 Markt-Puls-Sektoren/Top-Mover 0.0 %: `fetchEODHDRealTime` liefert korrekt `null`
  für fehlende Werte (kein 0-Coercion). Der 04.07.2026 ist ein **Samstag** → EODHD-Real-Time
  liefert `change_p: 0` (Börse zu). Die daneben stehende KI-Analyse stammt vom letzten Handelstag.
  Echtes Datenverhalten am Wochenende, kein Fehler. Optionale UX-Verbesserung: «Börse geschlossen»-
  Hinweis am Markt-Puls (nicht umgesetzt — nicht live verifizierbar).

**Nicht umgesetzt (bewusst):**
- L-11 Portfolios-Leerraum: rein kosmetisch [S], ohne Live-Ansicht nicht zielsicher fixbar.
- L-14/L-16/L-17/L-18/L-19 + APPLE/MONC.MI/HELN.SW: Datenbereinigung/Symbol-Mapping gegen die
  Prod-DB (user-seitig), nicht aus dieser Session heraus durchführbar.
