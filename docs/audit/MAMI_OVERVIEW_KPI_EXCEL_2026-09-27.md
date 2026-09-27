# Mami – Excel-Nachvollzug der Übersichtskennzahlen

**Portfolio:** Mami (`4020001`)  
**Erstellt:** 27.09.2026  
**Historisches Risiko-/Berechnungsfenster:** 27.09.2021 bis 25.09.2026  
**Abgrenzung:** Research und Analyse, keine persönliche Anlageberatung.

## Ergebnis

Die Arbeitsmappe `Mami_Kennzahlen_Nachvollzug_2026-09-27.xlsx` bildet **alle Übersichtskennzahlen bis zur einzelnen Handelslinie und dem einzelnen Handelstag** nach. Sie enthält sichtbare Excel-Formeln, gespeicherte Formelwerte sowie die verwendeten Quellen-/Reihenentscheidungen.

| Kennzahl | Excel-Nachrechnung | Portalwert | Abgleich |
|---|---:|---:|---|
| Aktueller Depotwert inkl. Cash | CHF 508’695.12 | CHF 508’695.12 | exakt |
| Rendite seit Portfolio-Start | 1.7390 % | 1.74 % | Rundung |
| Rendite YTD inkl. Cash | 8.4520 % | 8.4520 % | exakt |
| Kursrendite p.a. (5J) | 5.5683 % | 5.6 % | Rundung |
| Brutto-Gesamtrendite p.a. (5J) | 9.0384 % | 9.0 % | Rundung |
| Volatilität p.a. (5J) | 9.5486 % | 9.5 % | Rundung |
| Sharpe Ratio (5J) | 0.7212 | 0.72 | Rundung |
| Max. Drawdown (5J) | −13.0788 % | −13.1 % | Rundung |
| Beta (5J) | 0.5419 | 0.54 | Rundung |
| Gewichtete Dividendenrendite | 3.2653 % | 3.2653 % | exakt |

## Inhalt der Arbeitsmappe

| Blatt | Zweck |
|---|---|
| **Übersicht** | Portalwert neben Excel-Formel, Abweichung, Berechnungsbasis und Status jeder Kachel. |
| **Positionen** | 25 Titel mit Stückzahl, aktuellen Kursen/FX, Wert, Gewicht, KGV, PEG, Dividendenmetadaten sowie eigener 5J-Kurs- und Totalrendite. |
| **5J_Tagesdaten** | 1’293 qualifizierte Portfoliotage, inklusive CHF-Kurs- und Totalwert, Tagesrenditen, Hochwasserstand, Drawdown und datumsgleich gepaarter SPI-Rendite. |
| **5J_Titelwerte** | 32’325 Titel-/Tageszeilen: Stückzahl, Handelswährungsquote, historische FX-Rate, CHF-Preis/-Wert und Gesamtrenditewert je Titel. |
| **Rendite_Perioden** | Separater Nachweis der Anzeige-Engine für 1M, 3M, 6M, YTD und 1Y. |
| **Chart_5J** | Historische gewichtete Anzeige-Reihe inklusive Chart und SPI. |
| **Quellen** | Die tatsächlich gewählte Kurs- und Gesamtrenditereihe je Titel, Reihenwährung und Dividendenbasis. |
| **Methodik** | Fachliche Abgrenzung, Formeln, Währungs-, Split- und Dividendenbehandlung. |

## Formel- und Datenbasis

- **Kursrendite p.a. (5J):** `((Endwert / Startwert) ^ (365.25 / Kalendertage)) − 1`; mit **splitbereinigten Kursreihen ohne Cash-Dividenden**.
- **Brutto-Gesamtrendite p.a. (5J):** dieselbe Annualisierungsformel, aber mit einer Gesamtreturnreihe, in der Cash-Dividenden an Ereignistagen rechnerisch reinvestiert werden. Keine Steuern, Gebühren oder persönliche Ausschüttungsverwendung.
- **Volatilität:** `STDEV` der täglichen CHF-Brutto-Gesamtrenditen × `SQRT(252)`.
- **Sharpe:** `((Durchschnitt tägliche Rendite − 2 % / 252) / Standardabweichung) × SQRT(252)`.
- **Max. Drawdown:** Minimum von `Totalwert / bisheriges Hoch − 1`.
- **Beta:** `COVAR(portfolio, SPI) / VARP(SPI)` mit **ausschliesslich datumsgleichen täglichen Renditen**. Dadurch werden Feiertage unterschiedlicher Handelsplätze nicht künstlich gegeneinander verschoben.
- **Währungen:** Jede Kursquote wird am gleichen Datum in CHF konvertiert. Londoner Pence-Quoten werden mit der GBPCHF-Rate geteilt durch 100 behandelt.
- **Quellenhierarchie:** EODHD ist primär; eine geprüfte native Sekundärreihe ist nur dort enthalten, wo Instrumentidentität und Handelswährung eindeutig validiert wurden. Reihenquelle und Währung sind pro Titel im Blatt **Quellen** sichtbar.

## Validierung

- Alle gespeicherten Excel-Formelergebnisse wurden mit LibreOffice Calc neu berechnet.
- Die acht Arbeitsblätter, Tabellen, Formeln und gespeicherten Ergebnisse wurden programmgesteuert geprüft.
- **Keine Formelzellen mit Fehlerwerten** (`#NAME?`, `#VALUE!`, usw.) verbleiben.
- Der aktuelle Depotwert, die gewichtete Dividendenrendite sowie die fünfjährigen Risiko-/Renditekennzahlen stimmen bis auf die im Portal vorgesehenen Rundungen ab.
- Es wurden keine Portfolio-, Cash-, Ledger-, Transaktions- oder Handelsdaten verändert.
