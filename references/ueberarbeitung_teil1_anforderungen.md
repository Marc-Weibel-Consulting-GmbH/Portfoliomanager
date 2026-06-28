# Überarbeitung Teil 1 – Vollständige Anforderungen

## 1. Dashboard (Neues Design gemäss Mockup)

### Header-Bereich
- Datum + Begrüssung: "DIENSTAG, 1. JULI 2026 / Guten Morgen, Marc"
- TickerBar: SMI, S&P 500, NASDAQ, SOX, GOLD, BTC mit Sparklines und Tagesveränderung
- **Schnellbuttons** (horizontal scrollbar): 
  - "+ Portfolio erstellen" (grün/teal, primär)
  - "Meine Portfolios"
  - "Aktienempfehlungen"
  - "Aktiensuche"
  - "Portfolio optimieren"
  - "Copilot fragen"
  - "Preisalarm setzen"

### Portfolio Compact (GESAMTWERT · AGGREGIERT)
- Gesamtwert: CHF 487'650
- Tagesveränderung: z.B. +CHF 1'834 heute · +0.4% · YTD +11.4%
- **Tagesperformance muss korrekt sein** (nicht -9%)
- Einzelne Portfolios mit Name, LIVE-Badge, Anzahl Positionen, Wert, Tagesperformance
- "+ Neu" Button

### Markt-Puls (Sektoren heute)
- Heatmap-Grid: Pharma, Industrie, Konsum, Versorger, Finanz, Energie, Tech, Halbleiter, Kommunikation, Immobilien
- Farbig (grün/rot) je nach Tagesperformance
- **Top-Gewinner** und **Top-Verlierer** Tabelle (Ticker + Name + Performance)

### KI-Analyse
- Toggle: Tagesbericht / Wochenbericht
- **KI-TAGESANALYSE** mit Regime-Badge (z.B. "RISK-OFF · KORREKTUR")
- Datum rechts: "Dienstag, 1. Juli 2026"
- **Headline** fett: "Fünf Verlusttage in Folge — die Korrektur ist noch nicht abgeschlossen"
- **Body** (Zusammenfassung, 2-3 Sätze)
- **Szenarien NEBENEINANDER** (nicht untereinander!):
  - "Rebound-Rally 40%" | "Konsolidierung 35%" | "Weiterer Selloff 25%"
- **Sektoren** (5-7 wichtigste, NICHT alle):
  - Jeder Sektor hat:
    - Icon + Name + Unterkategorie (z.B. "Selektiv kaufen")
    - **KAUFEN / ABWARTEN Badge** (rechts)
    - **4-5 Sätze Beschreibung** der aktuellen Lage
    - **3 wichtigste Aktientitel** mit Ticker + Performance (z.B. "MU -2.1% ▼  AMAT -0.8% ▼  NVDA -1.4% ▼")

### Anstehende Termine
- Überschrift: "Anstehende Termine / Makro · diese Woche"
- Echte Wirtschaftstermine:
  - Wochentag-Kürzel + Datum (DI 1., MI 2., DO 3., FR 4., DO 10.)
  - Name des Events (ISM Manufacturing PMI, ADP Employment Report, Non-Farm Payrolls, etc.)
  - HEUTE-Badge wenn heute
  - Uhrzeit rechts
  - Relevanz-Badge: HOCH (rot), MITTEL (gelb), INFO (grau)
  - Kurzbeschreibung (1 Zeile): "Über 50 = Expansion → positiv für Chip-Nachfrage"

## 2. Portfolios-Übersicht
- Wird durch aktuelles Dashboard (vor Redesign) ersetzt
- KPIs aus alter Portfolio-Übersicht integrieren

## 3. Copilot Insights – Grüne Buttons
- Jeder Button öffnet eigenes Pop-up mit KI-Aktionen
- "Sektoren überprüfen" → Vorschläge → Aktionen ausführen
- "Top-Positionen analysieren" → Vorschläge → Aktionen ausführen
- Demo: nur Positionen ändern; Live: echte Transaktionen + Gebühren

## 4. Portfolio-Detail
- Top-Positionen klickbar
- Konstellation: Ausreisser mit Pfeil markieren
- Transaktionen: Löschen (einzeln + Bulk), Demo = keine Transaktionen
- Performance: Realisierte Gewinne aufklappbar, Performance-Attribution (Wasserfall)
- Risiko: Tooltips, Bubble-Pop-up, grüne Boxen füllen
- Optimieren: Diversifikationsregeln (max 10%, min 1%, CHF 3000, min 15 Titel)
