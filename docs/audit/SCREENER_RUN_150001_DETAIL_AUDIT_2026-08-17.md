# Detailaudit — Screener-Lauf 150001

**Prüfdatum:** 17. August 2026  
**Prüfobjekt:** Export `screener-lauf-150001-1786960247646.xlsx` sowie persistierter Lauf 150001  
**Datenbasis:** EODHD-Screener und -Fundamentaldaten, gespeicherte Kandidaten-, Score- und Statusdaten  
**Prüfziel:** Vollständigkeit, Identitäts-/Dublettenkontrolle, Kennzahleneinheiten, Scorekonsistenz, Statuslogik und offene Quellenrisiken bewerten.

> **Gesamturteil:** Der Lauf ist technisch abgeschlossen und gegenüber dem vorherigen Stand deutlich transparenter. Die Scorelogik ist im Export konsistent. Drei relevante Datenqualitätsrisiken bleiben: eine fehlertolerante, aber nicht wiederaufgenommene Titelverarbeitung bei 25-Sekunden-Timeouts, unvollständige Anbieter-Identifikatoren für Zweitnotierungen sowie auffällig hohe Dividendenrenditen, die als Quellenwerte getrennt validiert werden müssen.

## 1. Prüfgrundlage und Abgleich

Der gelieferte Export enthält drei Arbeitsblätter: **607 berechnete Kandidaten**, **545 aussortierte Zeilen** und **19 Abdeckungszeilen**. Dieser Inhalt stimmt mit dem persistenten Lauf überein. Von 1'152 gesammelten Universumszeilen sind 607 berechnet, 305 als Zweitkotierung geführt, 114 bereits in der Watchlist, 111 ausgeschlossen und 15 als Fehler ausgewiesen.[1]

| Bereich | Export | Persistierter Lauf | Bewertung |
|---|---:|---:|---|
| Universum | 1'152 Zeilen über alle Status | 1'152 | Konsistent |
| Berechnete Kandidaten | 607 | 607 | Konsistent |
| Zweitkotierungen | 305 | 305 | Konsistent |
| Bereits vorhandene Watchlist-Titel | 114 | 114 | Konsistent |
| Ausschlüsse | 111 | 111 | Konsistent |
| Fehlerzeilen | 15 | 15 | Konsistent |

Der Lauf selbst steht auf `fertig` und enthält keinen Laufabbruchfehler. Die Prüfung bewertet den Datenstand vom 17. August 2026; sie stellt keine Aussage über spätere Markt-, Unternehmens- oder Ausschüttungsereignisse dar.

## 2. Positive Kontrollbefunde

Die zentralen Integritätsprüfungen sind bestanden. Es gibt keine leeren Ticker, keine doppelt vorkommenden Ticker und keine doppelt vorkommenden **gesetzten** Primärticker unter den 607 berechneten Kandidaten. Land und Währung sind vollständig. Der Dividendenwert wird nach dem expliziten EODHD-Bruch-zu-Prozent-Vertrag gespeichert; kein berechneter Kandidat weist eine Dividendenrendite von mehr als 25 % aus.[1]

| Prüfkriterium | Ergebnis | Bedeutung |
|---|---:|---|
| Leere Ticker | 0 | Jede berechnete Zeile ist adressierbar. |
| Exakte Ticker-Dubletten | 0 | Keine Doppelzeile derselben Notierung. |
| Dubletten gesetzter Primärticker | 0 | Anbieteridentifizierte Zweitnotierungen werden entfernt. |
| Fehlendes Land / fehlende Währung | 0 / 0 | Stammdatenabdeckung für berechnete Titel vollständig. |
| Dividendenrendite > 25 % | 0 | Die frühere offensichtliche 25-%-Klasse ist nicht vorhanden. |
| Signal ohne vollständige Qualität/Bewertung | 0 | Kein inkonsistenter Signal-Score. |

Die Scorezustände sind vollständig erklärbar: 554 Zeilen sind als `vollständig` markiert, 52 als `Bewertung unter Mindestabdeckung (unter 60 % belegtes Gewicht)` und eine als `Qualität unter Mindestabdeckung`. Genau daraus folgen die 53 fehlenden Signalwerte. Es handelt sich somit nicht um einen stillen Rechenabbruch.[1]

## 3. Scoreabdeckung und Berechnungslogik

Die Qualitätsabdeckung ist hoch: 606 von 607 berechneten Kandidaten besitzen einen Qualitätsscore. Die Bewertung ist für 555 von 607 Kandidaten und das Signal für 554 von 607 Kandidaten ableitbar. Die Differenz zwischen Bewertung und Signal von einer Zeile wird durch die einzelne Qualitäts-Mindestabdeckung erklärt.

| Komponente | Belegt | Fehlend | Abdeckung | Befund |
|---|---:|---:|---:|---|
| Qualität | 606 | 1 | 99,8 % | Sehr hoch; eine Datenlücke bleibt transparent. |
| Bewertung | 555 | 52 | 91,4 % | Fehlende Faktoren unterschreiten bewusst die Mindestabdeckung. |
| Signal | 554 | 53 | 91,3 % | Folgerichtig nur bei vollständiger Qualität und Bewertung. |

Die Faktorabdeckung erklärt die verbleibenden Lücken. KGV ist bei 98 % der Kandidaten vorhanden, während PEG nur bei 57 %, Free-Cash-Flow-Rendite bei 74 %, Dividendenrendite bei 85 % und Kurs-Buchwert bei 22 % verfügbar ist. Die besonders schwache Kurs-Buchwert-Abdeckung wird nach der aktuellen Gewichtung weitgehend neutralisiert; sie darf nicht automatisch zu einem Ersatzscore führen. Eine Lockerung der 60-%-Mindestabdeckung wäre eine **Modelländerung**, nicht eine Datenkorrektur, und benötigt deshalb eine eigene OOS-Validierung.

## 4. Datenqualität und Ausreisser

Die höchsten gespeicherten Dividendenrenditen sind LISP.SW mit 18,98 %, RRTL.DE mit 17,19 % und ML.PA mit 12,91 %. Dies sind Anbieterwerte; die Einheitenumrechnung im Screener ist konsistent, denn der Wert wird einmalig an der EODHD-Grenze von Bruch in Prozent überführt.[1]

LISP.SW ist dennoch ein **P0-Validierungsfall**. Lindt & Sprüngli bestätigt, dass LISP der an der SIX gehandelte Partizipationsschein mit ISIN `CH0010570767` ist.[2] Der archivierte Geschäftsbericht weist für die Ausschüttung pro Partizipationsschein einen separaten Wert aus.[3] Eine Rendite von 18,98 % ist damit nicht als Rechenfehler bewiesen, aber als wirtschaftlich auffälliger Quellenwert vor einer Signalverwendung gegen Ausschüttung und Preis desselben Instruments zu prüfen. Die Plattform darf diesen Wert bis zur Gegenprüfung nicht still auf einen willkürlichen Höchstwert kappen.

## 5. Identität und Doppelzählungsrisiko

Obwohl die Primärticker-Deduplizierung technisch greift, fehlen bei **70** berechneten Titeln Primärticker und bei **60** von ihnen gleichzeitig ISIN und Primärticker. Daraus entstehen 14 identische Namensgruppen mit 28 berechneten Zeilen. Beispiele sind Capgemini (`CAP.PA`/`CGM.DE`), Signify (`LIGHT.AS`/`G14.DE`), Safran (`SAF.PA`/`SEJ1.DE`) und TotalEnergies (`TTE.PA`/`TTE.L`). Bei diesen Paaren liefert die Hauptnotierung bereits ISIN und Primärticker, während der deutsche beziehungsweise internationale Zweitplatz keinen Anbieteridentifikator zurückgibt.[1]

Nicht jede Namensgruppe ist ein Duplikat: BP-A/B und Sixt-Stamm-/Vorzugsaktien können unterschiedliche Aktiengattungen darstellen. Deshalb ist eine reine Namensbereinigung fachlich unzulässig. Das Risiko besteht nicht in einem Rechenfehler, sondern in einer möglichen **Doppelrepräsentation desselben wirtschaftlichen Emittenten** in einer späteren Auswahl.

## 6. Fehlerzeilen und Wiederanlauf

Von 15 Fehlerzeilen haben 12 den Grund `Zeitüberschreitung (..., 25s)`; betroffen sind unter anderem AD.AS, AZN.L, BNP.PA, CFR.SW, COST, CSCO, EXO.AS, GLEN.L, HSBA.L, RIGD.L, RIO.L und RR.L. Drei Titel — 3HM.DE, NAQ.DE und RNL.PA — haben keine berechenbare Säule aus den vorliegenden Fundamentaldaten.[1]

Die Ursachen liegen im aktuellen Kontrollfluss: Ein gesamter `getDreiScores`-Aufruf hat ein Titelzeitlimit von 25 Sekunden; ein Überschreiten setzt die Zeile direkt auf `fehler`. Der Lauf bleibt dabei korrekt fortsetzbar, aber die betroffenen Titel erhalten keinen automatischen späteren Wiederanlauf. Die vorhandenen begrenzten Retries für einzelne EODHD-Abfragen beheben diesen Titel-Level-Fall nicht vollständig.[4]

## 7. Priorisierte Massnahmen

| Priorität | Massnahme | Root Cause | Erfolgskriterium |
|---|---|---|---|
| **P0** | Zeitüberschreitungen in einen begrenzten Retry-/Wiederanlaufstatus überführen | Titel-Level-Timeout schreibt dauerhaft `fehler`; 12 Zeilen sind betroffen. | Kein Titel bleibt nach zwei kontrollierten Wiederanläufen allein wegen eines transienten 25-Sekunden-Timeouts im Fehlerstatus. |
| **P0** | Dividenden-Quellenvalidierung für hohe Renditen einführen | Anbieterwert kann wirtschaftlich auffällig sein, obwohl die Einheitenumrechnung korrekt ist. | Werte ab einem klar dokumentierten Prüfband werden mit Instrument-ISIN, Ausschüttung und unabhängiger Referenz als `zu prüfen` markiert; keine stille Kappung. |
| **P1** | Emittentenabgleich in separater Review-Queue erweitern | 70 fehlende Primärticker; 60 Zeilen ohne ISIN und Primärticker. | Kreuznotierungen werden als `Identität unklar` gekennzeichnet und vor einer Auswahl manuell oder über eine zweite Identitätsquelle bestätigt. |
| **P1** | Export um Datenstatus und Wiederanlaufgrund erweitern | Die 53 unvollständigen Scores sind korrekt, aber der Nutzer muss Ursache und nächste Aktion direkt sehen. | Jede leere Scorezeile zeigt `Mindestabdeckung`, `Provider-Timeout`, `keine Fundamentaldaten` oder `Identität unklar`. |
| **P2** | Bewertungs-Mindestabdeckung erst OOS-validiert variieren | 52 Bewertungen fehlen bewusst bei unter 60 % belegtem Gewicht. | Varianten mit 2- statt 3-Faktoren werden nur mit OOS-, Kosten- und Regimeprüfung akzeptiert. |

## 8. Freigabeempfehlung

Der Screener-Lauf ist für **explorative Kandidatensichtung** nutzbar: Status, Scoreabdeckung und Aussortierungen sind nachvollziehbar, und keine stillen Scoreinkonsistenzen oder offensichtlichen Dividenden-Extremwerte über 25 % wurden festgestellt. Für eine automatisierte Übernahme oder Ranglistenentscheidung sollten P0-Wiederanlauf und P0-Dividendenreferenz jedoch vorher umgesetzt werden. Die 52 Bewertungs- und 53 Signallücken sind keine Kandidaten für Füllwerte.

## Referenzen

[1] Gelieferter Screener-Export `screener-lauf-150001-1786960247646.xlsx` und read-only Datenbankabgleich von Lauf 150001, geprüft am 17. August 2026.  
[2] [Lindt & Sprüngli — Share information](https://www.lindt-spruengli.com/investors/share-information/) — Identität und ISIN des LISP-Partizipationsscheins.  
[3] [Lindt & Sprüngli Annual Report 2023 — Dividend per Share/Participation Certificate](https://reports.lindt-spruengli.com/annual-report-2023/financial-report/notes-to-the-consolidated-financial-statements/dividend-per-share-participation-certificate-pc.html).  
[4] `server/lib/screenerLauf.ts`, Rechenpfad und Titelzeitlimit, geprüfter Projektstand vom 17. August 2026.

**Basis:** Qualität, Bewertung und Signal entsprechen der bestehenden Drei-Score-Definition; Dividendenrenditen werden als EODHD-Rohbruch an der Anbietergrenze einmalig in Prozent konvertiert.  
**Zeit:** Daten- und Exportstand vom 17. August 2026; Laufstart 16. August 2026, 09:40:39.  
**Annahmen:** Fehlende Scores werden als fehlend behandelt, nie mit Null oder Mittelwert ersetzt; gleiche Namen werden nicht automatisch als Duplikat gelöscht.  
**Quellen und Vertrauen:** Primärbasis sind der Export und die persistierten Laufdaten; EODHD ist der operative Anbieter. Für LISP bestätigt der Emittent die Instrumentidentität, nicht jedoch die aktuelle Renditeberechnung.  
**Compliance:** Diese Prüfung ist Research und Datenqualitätsanalyse, keine persönliche Anlageberatung.
