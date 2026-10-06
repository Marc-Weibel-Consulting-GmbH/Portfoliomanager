# Straumann Holding AG (`STMN.SW`) – KGV-, PEG- und Signalabgleich

**Prüfdatum:** 06.10.2026  
**Instrument:** Straumann Holding AG, SIX Swiss Exchange, CHF, ISIN `CH1175448666`  
**Umfang:** Datenfluss, Periodenabgrenzung, Signalformel und universumsweiter Rechenabgleich. Keine Portfolio-, Cash-, Ledger-, Transaktions- oder Handelsdaten wurden geändert.

## Ergebnis in einem Satz

Das sichtbare **KGV 38,9 ist ein TTM-KGV**, während der UBS/FactSet-Beleg **Forecast-KGVs (2026E: 27,21; 2027E: 23,36)** zeigt. Die Werte beantworten unterschiedliche Fragen und dürfen nicht gegeneinander ausgetauscht werden. Die Signalzahl **68** ist aus **Qualität 69 und Timing 67** nachweisbar korrekt berechnet; der Wert **24,6 für Bewertung** ist bewusst ein Wächter und trägt **0 %** zur Signaladdition bei, solange keine Extremteuer-Sperre greift.

## 1. Primärdaten- und Periodenabgleich

| Kennzahl | EODHD-Rohwert, abgerufen 06.10.2026 | UBS/FactSet-Nutzerbeleg | Fachliche Einordnung |
|---|---:|---:|---|
| Kurs / Handelslinie | `STMN.SW`, CHF, ISIN `CH1175448666` | STMN, SIX, CHF, ISIN `CH1175448666` | Gleiche Primärlinie und Währung. |
| KGV (TTM) | `Highlights.PERatio = 38.8745` | – | Kurs / Gewinn der letzten zwölf Monate. |
| EPS (TTM) | `Highlights.EarningsShare = 2.31` | – | TTM-Gewinnbasis des Anbieters. |
| KGV (Forward) | `Valuation.ForwardPE = 26.1097` | 2026E `27.21`; 2027E `23.36` | Beide sind Forecast-Kennzahlen; unterschiedliche Schätzstichtage, Konsensuniversen und Rundungen erklären die verbleibende Differenz. |
| 2026E EPS | `3.2747` | `3.30` | Nahe beieinander, aber nicht identisch. |
| PEG | `Highlights.PEGRatio = 1.2548` | PEG(E) `2.10` | Nicht unmittelbar vergleichbar: EODHD publiziert die Standard-/Trailing-PEG, FactSet «PEG(E)» eine forecastbasierte Konsensdefinition. Ohne identische Formel, EPS-Periode und Wachstumsfenster gibt es **keine** seriöse Austauschbarkeit. |
| Dividendenrendite | `1.09 %` | 2026E `1.21 %` | Anbieter-TTM vs. Forecast-Ausschüttung; periodisch getrennt zu bezeichnen. |

**Rohdatenbeleg:** [STMN.SW EODHD Fundamentals](/home/ubuntu/portfolio_analysis_website/docs/audit/workings/STMN_SW_RAW_EVIDENCE_2026-10-06.json)

### Einordnung der behaupteten KGV-Abweichung

Die Rechnung ist nicht «CHF 91,26 / CHF 3,30». Das ergäbe ein **Forward-KGV 2026E von rund 27,7**, nahe bei FactSet `27,21` und EODHD `26,11`.

Die App zeigte hingegen den EODHD-TTM-Wert `38,8745`. Eine TTM-Kennzahl ist für Rückschau und konservative Standardbewertung nützlich, aber sie ist **nicht** mit 2026E oder 2027E zu vergleichen. Der bisherige Fehler lag in der ungenügenden Beschriftung, nicht darin, dass ein FactSet-Forward-KGV irrtümlich als EODHD-TTM-Feld gespeichert worden wäre.

## 2. Warum aus 69 / 24,6 / 67 das Signal 68 entsteht

Für das Standardregime gilt:

```text
Signal = 50 % × Qualitäts-Score + 0 % × Bewertungs-Score + 50 % × Timing-Score
       = 0,50 × 69          + 0,00 × 24,6            + 0,50 × 67
       = 34,5 + 0 + 33,5
       = 68,0
```

Die Regel ist absichtlich so implementiert:

- **Qualität** und **Timing** beschreiben Unternehmen und Marktzeitpunkt und werden gewichtet kombiniert.
- **Bewertung** liefert keine positiven Signalpunkte. Andernfalls würde eine historisch schwache PEG-/KGV-Rangfolge das Signal künstlich anheben.
- **Bewertungs-Wächter:** Nur bei extremer Überbewertung begrenzt der Bewertungs-Score ein ansonsten hohes Signal auf maximal `HOLD`. Im dargestellten 24,6-Fall war diese Extrem-Sperre nicht ausgelöst.

Die Detailansicht zeigt die drei Beiträge jetzt tabellarisch, so dass die Zahl in jedem Einzelfall nachvollzogen werden kann.

## 3. Korrekturen

1. **Kennzahlen eindeutig abgegrenzt:**
   - Aktiendetail: `KGV (TTM)` statt nicht spezifiziertem `KGV (P/E)`.
   - Watchlist: `KGV TTM` statt `P/E`.
   - `PEG (TTM · EODHD)` statt eines unpräzisen Standardlabels.
   - Hilfetexte erklären ausdrücklich, dass 2026E-/2027E- und PEG(E)-Werte separate Forecast-Kennzahlen sind.
2. **Signalrechnung offengelegt:** Der Signaldialog zeigt nun Titel-Score, Gewicht und Beitrag je Komponente sowie den Wächterhinweis.
3. **Formel gegen Regression abgesichert:** Der konkrete Fall `69 / 24,6 / 67 → 68` ist als Unit-Test festgehalten.

## 4. Universumsweiter Rechenabgleich

Die gesamte aktuelle Tabelle `stock_scores` wurde **ohne Mutation** gegen die zentrale Funktion `rechneSignal` abgeglichen:

| Kennzahl | Ergebnis |
|---|---:|
| gespeicherte Drei-Score-Sätze | 265 |
| vollständig prüfbare Signale | 232 |
| Rechenabweichungen | **0** |
| ohne qualifizierte Timing-/Signalbasis | 33 |

Die 33 Lücken sind keine still als gültig dargestellten Signale; die Anwendung zeigt dafür einen Datenstatus statt eine erfundene Scorezahl. Die Prüfung garantiert die **arithmetische und regelbasierte Konsistenz** der gespeicherten Signale. Sie ersetzt keine Aussage, dass zwei unabhängige Datenanbieter zwingend denselben Forecast-Konsens oder dieselbe PEG-Definition veröffentlichen müssen.

## Grenzen und nächste fachliche Ausbaustufe

Die derzeitige Datenbank speichert verlässlich TTM-KGV/Standard-PEG aus der bevorzugten EODHD-Quelle. Ein **eigener, lizenzierter Forecast-Konsens** (z. B. FactSet/UBS) ist nicht angebunden. Deshalb soll die App keine behauptete «Forward»-Kennzahl anzeigen, wenn deren Zeitraum, Analystenkonsens und Datenstand nicht als solche vorliegen. Für echte Vergleichbarkeit wären künftig getrennt gespeicherte Felder nötig: `TTM`, `FY1E`, `FY2E`, Forecast-Datum, Konsensquelle und Wachstumsfenster der PEG-Formel.

> Research und Analyse, keine persönliche Anlageberatung.
