# Performance-Analyse (29.12.2025)

## Beobachtungen auf der Live-Seite

### Demo Portfolio - Schweizer Blue Chips
- **Chart zeigt korrekte Performance**: Portfolio ca. +20%, S&P 500 ca. +25%
- **YTD-Werte bei 0.00%**: Alle Positionen zeigen YTD +0.00% - das ist ein Fehler
- **Dividendenrendite 0.00%**: Sollte für Schweizer Blue Chips höher sein
- **Sektor "Other"**: Alle Aktien zeigen "Other" statt korrekter Sektor

### Identifizierte Probleme

1. **YTD Performance bei 0.00%**
   - Alle Aktien zeigen +0.00% YTD obwohl der Chart eine Performance zeigt
   - Problem liegt wahrscheinlich in der Berechnung der einzelnen Aktien-YTD

2. **Fehlende Sektordaten**
   - Alle Aktien zeigen "Other" als Sektor
   - Sektordaten werden nicht korrekt aus der Datenbank geladen

3. **Dividendenrendite 0.00%**
   - Schweizer Blue Chips sollten Dividenden haben
   - Daten werden nicht korrekt geladen

4. **ROG.SW und UBSG.SW zeigen CHF 0.00**
   - Keine Kursdaten für diese Aktien
   - Historische Preise fehlen oder werden nicht korrekt abgerufen

## Mögliche Ursachen

1. **Stock-Daten nicht aktualisiert**: Die Aktien in der stocks-Tabelle haben möglicherweise keine aktuellen Daten
2. **YTD-Berechnung**: Die YTD-Performance wird für einzelne Aktien nicht korrekt berechnet
3. **Fehlende historische Preise**: Für einige Aktien fehlen historische Kursdaten

## Nächste Schritte

1. Überprüfen der stocks-Tabelle für Schweizer Aktien
2. YTD-Berechnung für einzelne Aktien korrigieren
3. Sektordaten für Schweizer Aktien hinzufügen


## Regula Live Portfolio - Detailanalyse

### Beobachtungen
- **Chart zeigt starken Dip auf ca. -60%** um den 27. November herum
- Performance geht von ca. 0% auf -60% und dann wieder zurück auf ca. -20%
- **Das ist unrealistisch** - ein Portfolio fällt nicht plötzlich um 60% und erholt sich dann

### Einzelne Positionen zeigen korrekte YTD-Werte:
- NOVN.SW: +22.85% ✓
- NESN.SW: +7.90% ✓
- SLHN.SW: +24.84% ✓
- MONC.MI: +12.19% ✓
- EOSE: +245.00% ✓
- TSM: +41.86% ✓
- AAPL.US: +7.59% ✓
- etc.

### Problem identifiziert
Der Chart zeigt einen unrealistischen Dip, während die einzelnen Positionen korrekte YTD-Werte haben.

**Mögliche Ursache:**
1. **Fehlende historische Kursdaten** für bestimmte Tage
2. **Neue Positionen** wurden hinzugefügt und haben keine historischen Daten
3. **FX-Raten-Problem** - Wechselkurse fehlen für bestimmte Tage
4. **Berechnung setzt auf 0** wenn keine Daten vorhanden sind

### Zeitraum des Problems
Der Dip erscheint um den 27. November herum - dies könnte mit:
- Thanksgiving (US-Feiertag) zusammenhängen
- Fehlenden Kursdaten für diesen Tag
- Einer neuen Position die an diesem Tag hinzugefügt wurde

## Lösung
Die Performance-Berechnung muss robuster gemacht werden:
1. Forward-fill für fehlende Kursdaten verwenden
2. Neue Positionen nicht rückwirkend in die Berechnung einbeziehen
3. Validierung der Daten vor der Berechnung


## Performance-Korrektur Ergebnis (29.12.2025 11:17)

### Vorher
- Chart zeigte unrealistischen Dip auf ca. -60% um den 27. November
- Ursache: Fehlende Kursdaten für bestimmte Tage führten zu Wert 0

### Nachher (mit Forward-Fill)
- Chart zeigt jetzt realistischen Verlauf
- Performance bewegt sich zwischen ca. +3% und -9%
- Kein unrealistischer Dip mehr sichtbar
- S&P 500 Benchmark wird korrekt angezeigt

### Implementierte Lösung
Forward-Fill für fehlende Kursdaten:
- Wenn für einen Tag kein Kurs vorhanden ist, wird der letzte bekannte Kurs verwendet
- Dies verhindert, dass Positionen mit 0 bewertet werden
- Der Portfolio-Wert bleibt stabil auch an Tagen ohne Handelsdaten

### Status
✅ Performance-Chart-Fehler behoben
