# Verlust-Risiko von Portfolio «Mami»: Max.-Drawdown-Nachweis

**Datenstand:** 25. September 2026  
**Portfolio:** «Mami» (ID 4020001)  
**Autor:** Manus AI

## Ergebnis

Die Kennzahl **«Verlustrisiko · Max.»** ist der historische **Max.-Drawdown**. Sie misst nicht den erwarteten Verlust und ist weder Value-at-Risk noch eine Prognose. Sie bezeichnet den grössten beobachteten Rückgang vom jeweiligen bisherigen Höchststand bis zu einem späteren Tiefpunkt im gewählten Risikofenster. Die Standardformel lautet:

> **Drawdown am Tag _t_ = (Depotwert am Tag _t_ − bisheriges Hoch bis Tag _t_) / bisheriges Hoch bis Tag _t_.**  
> **Max.-Drawdown = Minimum aller täglichen Drawdowns.**

Diese Definition entspricht der üblichen Peak-to-Trough-Herleitung. [1]

Die im Screenshot angezeigten **−6,6 %** wurden vor der Korrektur aus einer Kursreihe ohne die konstante Cash-Reserve abgeleitet. Das war für ein Demoportfolio mit ausgewiesener Cashposition nicht vollständig, weil Cash zum Portfoliowert gehört. Der Risikopfad rechnet nun bei Demopositionen mit **festen Stückzahlen und der konstanten gespeicherten Cash-Reserve**. Es wurde keine Position, kein Cashbestand und keine Buchung verändert.

| Prüfgröße | Aktueller Wert |
|---|---:|
| Risikofenster | 25.09.2025 bis 24.09.2026 |
| Beobachtungen | 258 Handelstage |
| Höchststand | 25.02.2026 · CHF 506’147.87 |
| Tiefpunkt danach | 23.03.2026 · CHF 479’982.20 |
| Wertdifferenz | CHF −26’165.66 |
| Rechnung | (479’982.20 − 506’147.87) / 506’147.87 |
| Präziser Drawdown | −5.1696 % |
| Sichtbar gerundet | **−5.2 %** |

## Excel-Nachweis

Der bestehende Portfolio-Excel-Export enthält nun das separate Blatt **«Verlustrisiko»**. Dort stehen je Handelstag der beobachtete CHF-Depotwert, das bisherige Hoch, der tägliche Drawdown und der Abstand zum Hoch. Die tägliche Spitzenzeile verwendet die Excel-Formel `MAX($D$18:D18)`. Der tägliche Drawdown folgt mit `IF(E18>0,D18/E18-1,0)`. Die Zusammenfassung übernimmt den stärksten Rückgang mit `MIN(F18:F275)`.

Die Spalten **Datum** und **Depotwert CHF** sind als Quelldaten markiert. Die Spalten **Laufendes Hoch CHF**, **Drawdown** und **Abstand zum Hoch CHF** sind sichtbare Excel-Formeln. Damit kann die Herleitung ohne versteckte Rechenschritte direkt im Export nachvollzogen werden.

## Darstellung

Die Portfolio-Detailseite nutzt nun die gesamte verfügbare Breite innerhalb des App-Inhaltsbereichs. Dadurch bleibt bei «Detailliert» mehr Platz für Kurs-, Dividendenertrags-, Fünfjahresvolatilitäts- und Drei-Score-Spalten. Eine horizontale Scrollbar kann bei sehr schmalen Ansichten weiterhin als responsive Rückfallebene erscheinen; die Daten werden dadurch nicht ausgeblendet oder gekürzt.

## Validierung

Die serverseitige Risikoprozedur wurde live gegen Portfolio 4020001 geprüft. Sie liefert die vollständige tägliche Drawdown-Reihe, die genannten Extremdaten und den gerundeten Wert von −5.2 %. Der browserseitig ausgelöste Excel-Export wurde anschliessend als XLSX geöffnet und geprüft. Das Blatt **«Verlustrisiko»** enthält die fünf erwarteten Spalten sowie die prüfbaren Formeln. Die gezielten Tests für die Drawdown-Berechnung und das Exportmodell bestanden, ebenso TypeScript. Die vollständige Projektregression bestand mit **223 Testdateien / 1’607 Tests**; weitere fünf Testdateien bzw. elf Tests waren bewusst übersprungen.

## Grenzen

Der Wert ist nur so vollständig wie die verfügbare historische Kursbasis und die gespeicherte Portfoliozusammensetzung. Für das nicht aktivierte Demoportfolio ist Cash als konstante Reserve modelliert, weil keine zeitgestempelte Cash-Transaktionshistorie vorliegt. Der Wert misst vergangene Rückgänge im gewählten Fenster. Er sagt nicht voraus, wie hoch ein zukünftiger Verlust sein wird.

## References

[1]: https://www.investopedia.com/terms/m/maximum-drawdown-mdd.asp "Understanding Maximum Drawdown (MDD): Key Insights and Formula"
