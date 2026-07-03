# Portfolio-Übersicht UI-Redesign Vorschlag

## Slide 1: Aktuelle Probleme der Portfolio-Übersicht
Die aktuelle Portfolio-Übersicht hat mehrere UX-Schwächen, die die Informationsdichte und Benutzerfreundlichkeit beeinträchtigen.

**Identifizierte Probleme:**
- Kacheln sind zu gross und verschwenden wertvollen Bildschirmplatz
- Einzelne Zahlen und Texte wirken verloren in den grossen Containern
- Wichtige Metriken wie Outperformance fehlen komplett
- Performance zeigt 0% für Demo-Portfolios (nicht aussagekräftig)
- Keine Möglichkeit, verschiedene Zeiträume auf einen Blick zu vergleichen

---

## Slide 2: Redesign-Konzept - Kompakte Statistik-Header
Ersetze die drei grossen Kacheln durch einen kompakten, horizontalen Statistik-Header.

**Neues Layout:**
- Einzeilige Statistik-Leiste mit 5-6 Metriken nebeneinander
- Metriken: Portfolios (3) | Gesamtwert (CHF 102'865) | Performance YTD (+3.31%) | vs. Benchmark (+1.2%) | Div. Rendite (1.8%) | Beste Position (CIFR +27%)
- Farbcodierung: Grün für positive, Rot für negative Werte
- Kompakte Icons statt grosser Kacheln

---

## Slide 3: Redesign-Konzept - Portfolio-Karten
Die Portfolio-Karten werden kompakter und informativer gestaltet.

**Neue Kartenstruktur:**
- Kleinere Kartenhöhe (ca. 50% der aktuellen Höhe)
- Horizontales Layout: Logo | Name/Status | Positionen | Wert | Performance-Tabelle
- Integrierte Mini-Outperformance-Tabelle: 1M | 3M | 6M | YTD | 1Y
- Sparkline-Chart bleibt, aber kleiner und rechts positioniert
- Hover-Effekt zeigt erweiterte Details

---

## Slide 4: Historische Outperformance-Tabelle
Jede Portfolio-Karte enthält eine kompakte Outperformance-Übersicht für alle Zeiträume.

**Tabellenformat:**
| Zeitraum | Portfolio | Benchmark | Differenz |
|----------|-----------|-----------|-----------|
| 1M       | +6.48%    | +1.63%    | +4.85% ▲  |
| 3M       | +12.3%    | +8.1%     | +4.2% ▲   |
| 6M       | +18.5%    | +15.2%    | +3.3% ▲   |
| YTD      | +3.34%    | +1.24%    | +2.1% ▲   |
| 1Y       | +25.8%    | +22.1%    | +3.7% ▲   |

**Farbcodierung:** Grüner Hintergrund bei Outperformance, Roter bei Underperformance

---

## Slide 5: Kompaktes Karten-Layout Mockup
Visueller Vergleich zwischen aktuellem und neuem Design.

**Aktuell (links):**
- Grosse Kacheln mit viel Leerraum
- Nur 2 Portfolios pro Zeile
- Wenig Informationsdichte

**Neu (rechts):**
- Kompakte Karten mit mehr Inhalt
- 3 Portfolios pro Zeile möglich
- Outperformance-Tabelle integriert
- Alle wichtigen Metriken auf einen Blick

---

## Slide 6: Empfohlene Implementierungsschritte
Priorisierte Umsetzung des UI-Redesigns in drei Phasen.

**Phase 1 - Quick Wins:**
- Historische Outperformance-Tabelle in bestehende Karten integrieren
- Performance-Anzeige für Demo-Portfolios korrigieren (YTD statt 0%)

**Phase 2 - Layout-Optimierung:**
- Kompakter Statistik-Header implementieren
- Kartenhöhe reduzieren und Layout optimieren

**Phase 3 - Erweiterte Features:**
- Sortierung nach Outperformance ermöglichen
- Filter für Zeitraum-basierte Performance-Ansicht
