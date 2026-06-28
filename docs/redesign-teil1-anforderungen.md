# Redesign Teil 1 – Dashboard und Portfolios

## Mockup-Analyse (aus ÜberarbeitungPortfoliomanagerTeil1.docx)

### Seite 1: Dashboard-Mockup (Claude Design)
- Dunkles Design, Sidebar links mit Navigation
- Header: "Willkommen zurück, Marc"
- Portfolio-Selektor: "Aggregiert" Button + Dropdown für einzelne Portfolios (NICHT separate Buttons)
- KPI-Karten oben: Gesamtwert CHF 1'267'291, Tagesveränderung +1.635, Sharpe -0.42, Bubble 45 (Mittel)
- Performance-Chart links (Zeitraum-Buttons: 1W, 1M, 3M, YTD, 1J, Max)
- Allokations-Donut rechts (Sektoren: Technology, Aktien, Consumer, Healthcare, Finance)

### Seite 1: KPI-Streifen (aus Portfolio-Übersicht, soll ins neue Dashboard)
- Performance YTD: -9.30% (Live Portfolios)
- vs. Benchmark: -16.82% (S&P 500)
- Div. Rendite: 2.73% (Durchschnitt)
- Diese KPIs sollen ins neue Dashboard integriert werden

### Seite 2: Copilot Insights (Dashboard-Bereich)
- Panel "Copilot Insights" mit LIVE-Badge und "Aktualisieren"-Button
- "5 neue · AI · vor 12 Min."
- Insight-Karten mit Icon (Warnung/Info), Titel, Beschreibung, grüner Aktions-Button
  - Sektor-Konzentration Finance → Button "→ Sektoren überprüfen"
  - Einzeltitel-Konzentration → Button "→ Top-Positionen analysieren"
  - Cash-Quote im guten Bereich → Button "→ Liquidität prüfen"
  - Diversifikation prüfen → Button "→ Regionale Verteilung ansehen"
- WICHTIG: Jeder grüne Button öffnet ein eigenes Pop-Up-Fenster mit direkten Aktionsmöglichkeiten

### Seite 3: Portfolio-Detailseite – Übersicht
- Header: Portfolio-Name, Buttons: Aktionen, + Position, Bearbeiten, Optimieren
- KPI-Zeile: Wert CHF 475'000, YTD +5.0%, Rel. S&P500 -5.0%, Sharpe —
- Tabs: Übersicht | Positionen (11) | Transaktionen (0) | Performance | Risiko | Optimieren (AI)
- Übersicht-Tab: Wertentwicklung-Chart + Top-Positionen nach Gewicht (klickbar!)
- Letzte Aktivität-Liste rechts

### Seite 3: Portfolio-Detailseite – Konstellation
- Scatter-Plot: Risiko (X-Achse) vs. Rendite (Y-Achse)
- Problem: Ausreisser (Holcim) quetscht alle anderen Titel zusammen
- Fix: Ausreisser-Handling mit Pfeil nach oben rechts (ausserhalb der Skala andeuten)
- Daten für Holcim prüfen (können nicht stimmen)

### Seite 4: Portfolio-Detailseite – Transaktionen
- Bei Demo-Portfolios: keine Transaktionen erlaubt
- Löschen-Button hinzufügen (einzeln + Bulk)

### Seite 4: Portfolio-Detailseite – Performance
- Realisierte Gewinne als aufklappbare Box (bei Demo-Portfolio: leer)
- NEUE Box: Performance-Attribution als Wasserfall-Diagramm:
  - Beitrag nach Sektor
  - Beitrag nach Assetklasse (Aktien, Obligationen, Gold, etc.)
  - Beitrag nach Titel
  - Beitrag Fremdwährungen

### Seite 4: Portfolio-Detailseite – Risiko
- Tool-Tips für alle KPI
- Bubble-Indikator: Info-Button → Pop-Up mit detaillierter Zusammensetzung und Gewichtung
- Grüne Boxen unten (Schnellaktionen): Funktion klären → Alarm erstellen, Portfolio bearbeiten, Portfolio löschen

### Seite 5: Portfolio-Detailseite – Optimieren AI
- Live App Probleme:
  - KI-Empfehlungen schlagen Extrem-Positionen vor → Diversifikations-Regeln einbauen:
    - Einzel-Position max. 10%, min. 1%
    - Minimum-Positionsgrösse CHF 3'000.-
    - Minimum Anzahl Titel: 15
- Effizienzgrenze: stimmt nicht mit Mockup überein (hardcoded?)
  - Alternative: Tab "Konstellation" statt Effizienzgrenze?

### Seite 5: Mockup Claude Design – Optimieren
- KI-Empfehlungen mit "Anwenden"-Button je Empfehlung
- Effizienzgrenze: Aktuell vs. Optimiert (Scatter-Plot, korrekte Daten)
- Empfehlungs-Karten: Healthcare reduzieren, Tech-Position aufstocken, Cash investieren

---

## Priorisierte Aufgabenliste

### A. Dashboard (Neues Design)
- [ ] Portfolio-Selektor: Dropdown statt separate Buttons
- [ ] Hover-Tooltip für Sharpe und Bubble KPI
- [ ] Tagesveränderung-Berechnung prüfen und korrigieren
- [ ] KPI-Streifen (Performance YTD, vs. Benchmark, Div. Rendite) ins Dashboard integrieren
- [ ] Copilot Insights Panel: LIVE-Badge, Aktualisieren-Button, Zeitstempel

### B. Copilot Insights – Aktions-Popups
- [ ] "Sektoren überprüfen" → Pop-Up mit Sektor-Analyse und Aktionsvorschlägen
- [ ] "Top-Positionen analysieren" → Pop-Up mit Konzentrations-Analyse
- [ ] "Liquidität prüfen" → Pop-Up mit Cash-Quote-Analyse
- [ ] "Regionale Verteilung ansehen" → Pop-Up mit geografischer Verteilung
- [ ] Demo-Portfolio: nur Positionen ändern (keine Transaktionen)
- [ ] Live-Portfolio: Transaktionen erstellen + Gebührenberechnung
- [ ] Gebührenstruktur unter Einstellungen hinterlegbar

### C. Portfolio-Übersicht (wird zum neuen Dashboard-Inhalt)
- [ ] Aktuelles Dashboard wird zur Portfolio-Übersicht

### D. Portfolio-Detailseite – Übersicht
- [ ] Top-Positionen klickbar machen (Link zu Aktiendetails)

### E. Portfolio-Detailseite – Konstellation
- [ ] Ausreisser-Handling: Pfeil-Indikator für Titel ausserhalb der Skala
- [ ] Holcim-Daten prüfen und korrigieren
- [ ] Skalierung verbessern (alle Titel sichtbar)

### F. Portfolio-Detailseite – Transaktionen
- [ ] Demo-Portfolio: Transaktionen-Anzeige deaktivieren oder leeren
- [ ] Löschen-Button (einzeln) hinzufügen
- [ ] Bulk-Löschen hinzufügen

### G. Portfolio-Detailseite – Performance
- [ ] Realisierte Gewinne als aufklappbare Box
- [ ] Performance-Attribution Wasserfall-Diagramm (Sektor, Assetklasse, Titel, FX)

### H. Portfolio-Detailseite – Risiko
- [ ] Tool-Tips für alle KPI
- [ ] Bubble-Indikator Info-Pop-Up (Zusammensetzung + Gewichtung)
- [ ] Schnellaktionen-Boxen: Funktion implementieren

### I. Portfolio-Detailseite – Optimieren AI
- [ ] Diversifikations-Regeln: max. 10%, min. 1%, min. CHF 3'000, min. 15 Titel
- [ ] Effizienzgrenze: echte Daten statt hardcoded
- [ ] Alternative: Konstellation-Tab statt Effizienzgrenze prüfen
