# Datenintegritätsprüfung — Screener-Lauf 150001

**Prüfdatum:** 16. August 2026. **Stichtag der Laufdaten:** 16. August 2026, 09:40:39. **Umfang:** Exportdatei, Persistenzdaten des Laufs, Export-/Scoringcode und kontrollierte EODHD-Proben. Es wurden keine Kandidaten, Scores oder Stammdaten verändert.

> **Kurzurteil:** Der Lauf ist als Sammlung vollständig und rechnerisch konsistent, jedoch als länderübergreifender Ranking-Lauf derzeit **nicht freigabefähig**. Die Ursache ist nicht eine fehlerhafte Gewichtungsformel, sondern drei reproduzierte Datenpfadprobleme: falsche EODHD-Fundamentalsymbole für XETRA und LSE, eine erneute Hundertfach-Skalierung niedriger Dividendenrenditen sowie ein unvollständiger Stammdatenvertrag.

## 1. Prüfgegenstand und Abgleich

Der Lauf nutzt die Börsen US, SW, XETRA, PA, LSE, AS und MI, eine Mindestmarktkapitalisierung von 1 Mrd. und maximal 700 Einträge je Börse. Der Datenbankkopf meldet den Status `fertig` ohne Laufkopffehler. Die Exportdatei und die Statussummen stimmen vollständig überein: 1'152 Titel sind genau einem Ergebnisstatus zugeordnet.[1] [2]

| Status | Anzahl | Anteil am Universum | Bewertung |
|---|---:|---:|---|
| Berechnet | 914 | 79.3 % | In der Kandidaten-Tabelle dargestellt; Scoreabdeckung uneinheitlich. |
| Bereits in Watchlist | 114 | 9.9 % | Erwartet, aber im Export ohne verständlichen Grund ausgewiesen. |
| Ausgeschlossen | 100 | 8.7 % | Stammdatenregeln für Nicht-Stammaktien/OTC greifen. |
| Zweitkotierung | 23 | 2.0 % | Teilweise korrekt erkannt; das volle Potenzial der Regel wird durch Symbolfehler verhindert. |
| Fehler | 1 | 0.1 % | `EXO.AS`: Zeitüberschreitung nach 25 Sekunden. |
| **Total** | **1'152** | **100.0 %** | **Vollständig abgeglichen.** |

Die Arbeitsmappe enthält 914 berechnete Kandidaten und 238 nicht als Kandidat auszuweisende Titel; es gibt weder vollständige Doppelzeilen noch doppelte Ticker innerhalb des Laufs. Die Primärschlüsselregel `(laufId, ticker)` ist daher wirksam.[1] [3]

## 2. Befunde nach Priorität

| Priorität | Befund | Reproduzierter Nachweis | Auswirkung |
|---|---|---|---|
| **P0** | XETRA- und LSE-Fundamentals werden mit ungültigen EODHD-Symbolen abgefragt. | `1U1.DE` und `BP-A.L` liefern HTTP 404; `1U1.XETRA` und `BP-A.LSE` liefern HTTP 200 und vollständige General-Stammdaten. | 405 von 405 XETRA- und 140 von 140 LSE-Kandidaten haben keinen Qualitäts-, Bewertungs- oder Signal-Score. |
| **P0** | Niedrige Dividendenrenditen werden im Rechenpfad ein zweites Mal mit 100 multipliziert. | 20 Exportzeilen weichen exakt um Faktor 100 ab, z. B. `BP-A.L` 0.24 % im Kopf und 24.00 % im Bewertungsfaktor. Die EODHD-Rohprobe ist 0.0024 und wird beim Sammeln korrekt zu 0.24 % normalisiert. | Der Dividendenfaktor und damit die Bewertung dieser Titel sind materiell überhöht. |
| **P1** | Stammdatenvertrag ist unvollständig. | `waehrung` fehlt bei allen 1'152 Zeilen. `land` fehlt bei 660 Zeilen; davon 555 auf XETRA/LSE. Der EODHD-Screener liefert nur `currency_symbol`, nicht einen eindeutigen ISO-Währungscode. | Länder-/Währungsfilter, Konzentrationsanalyse und Umsatz-/Währungslogik sind nicht zuverlässig auswertbar. |
| **P1** | Status `berechnet` bedeutet nicht „vollständig bewertbar“. | 335 berechnete Titel sind vollständig, 546 haben weder Qualität noch Bewertung noch Signal; 33 haben Qualität, aber keine Bewertung und kein Signal. | Eine gemeinsame Rangliste mischt vollständige und nicht bewertbare Titel. |
| **P1** | Mehrfachnotierungen werden nicht vollständig bereinigt. | 75 Namensgruppen haben mehr als einen Ticker, z. B. Safran, ABB, AXA und AstraZeneca. Die vorhandene Primärnotizregel erhält bei fehlenden Stammdaten keinen Vergleichswert. | Ranking, Sektor-/Länderanteile und manuelle Auswahl können denselben Emittenten mehrfach berücksichtigen. |
| **P2** | Exporttransparenz für nicht berücksichtigte Titel ist unzureichend. | Bei allen 114 Einträgen mit Status `vorhanden` ist `Grund` leer. | Der Ausschluss ist korrekt, aber für Anwender nicht nachvollziehbar. |
| **P2** | Einzelne Kennzahlen benötigen eine Datenqualitätskennzeichnung. | Vier KGV-Werte liegen über 200; `EDEN.PA` hat Kurs-Buchwert 0 und deshalb keine Punkte. | Kein bestätigter Formeldefekt; die Werte sollen aber nicht wie normale Vergleichswerte wirken. |

## 3. Abdeckung und Berechnungslogik

Die in der Exportdatei vorhandenen Formeln sind intern konsistent. Für alle nicht leeren Qualitätswerte stimmt `Qualität = 60 % × Q-Niveau + 40 % × Q-Richtung` beziehungsweise die dokumentierte Renormalisierung bei fehlender Säule. Auch die Bewertungswerte stimmen mit Faktorwerten, Gewichten und KGV-Deckel überein. Es wurde kein Wert ausserhalb der 0–100-Scoregrenze gefunden. Das Problem liegt folglich **vor** der Formel: bei Datenverfügbarkeit und Einheiten.[1] [4] [5]

| Scorezustand unter den 914 berechneten Kandidaten | Anzahl | Anteil |
|---|---:|---:|
| Qualität, Bewertung und Signal vorhanden | 335 | 36.7 % |
| Qualität vorhanden, Bewertung und Signal fehlen | 33 | 3.6 % |
| Qualität, Bewertung und Signal fehlen | 546 | 59.7 % |

Die Signalregel selbst verhält sich vertragsgemäss: Ein Signal wird nur ab 60 % belegtem Gewicht ausgegeben. Ohne Bewertungswert sind mit Qualität allein maximal 35 % der Standardgewichte belegt; ein leeres Signal ist deshalb fachlich korrekt. Falsch ist der vorangehende 404-/Leerdatenpfad, der diese fehlenden Bewertungswerte erzeugt.[4] [5]

## 4. Ursachenanalyse

### 4.1 Symbolkonvention zwischen Screener und Fundamentals

Der Universumssammler speichert XETRA als `.DE` und London als `.L`; der zentrale Fundamentalsymbol-Resolver gibt diese Endungen jedoch unverändert weiter. Der EODHD-Fundamentals-Endpunkt verlangt für die geprüften Fälle `.XETRA` beziehungsweise `.LSE`. Die gleiche Abweichung betrifft auch die Stammdatenabfrage im Screener, die den Roh-Ticker sogar ohne zentralen Resolver aufruft.[2] [6]

Die Lösung darf **nicht** Display- oder Datenbankticker pauschal umbenennen. Diese sind in der Anwendung bereits etabliert. Die Mapping-Änderung gehört ausschliesslich an die Grenze zum EODHD-Fundamentals-Endpunkt.

### 4.2 Dividendenrendite ohne expliziten Einheitenvertrag

Beim Sammeln wird die EODHD-Rendite korrekt vom Bruch in Prozent überführt. Vor der Bewertungsberechnung multipliziert jedoch eine „Übergangsheilung“ jeden Wert unter 0.3 erneut mit 100. Die zugrunde liegende Annahme, reale Renditen unter 0.3 % seien praktisch ausgeschlossen, ist durch den Export und die EODHD-Rohprobe widerlegt. Diese Heuristik ersetzt einen Einheitenvertrag durch eine Vermutung.[2]

### 4.3 Stammdaten und Emittentenidentität

Der Screener-Endpunkt liefert ein Währungssymbol, aber kein eindeutiges ISO-Land und keinen ISO-Währungscode. Der aktuelle Persistenzpfad speichert deshalb weder einen verlässlichen ISO-Code noch einen Anbieter-Primärticker. Die spätere Stammdatenabfrage soll dies ergänzen, scheitert jedoch für die beiden betroffenen Börsen an der Symbolabweichung. Ohne kanonischen Emittentenschlüssel kann die Mehrfachnotizregel nur nachträglich und unvollständig entscheiden.[2] [3]

## 5. Empfohlene Remediation

| Reihenfolge | Änderung | Konkrete Umsetzung | Abnahmekriterium |
|---:|---|---|---|
| 1 | **EODHD-Resolver korrigieren** | In `toEodhdSymbol` `.DE → .XETRA` und `.L → .LSE` für Fundamentals-/Stammdatenaufrufe abbilden; `holeStammdaten` muss denselben Resolver verwenden. | Regressionstests für `1U1.DE → 1U1.XETRA` und `BP-A.L → BP-A.LSE`; kontrollierte Abrufe liefern HTTP 200. |
| 2 | **Dividenden-Einheiten fixieren** | Die `<0.3`-Heuristik entfernen. Eine Rendite darf ausschliesslich beim Rohimport vom Bruch in Prozent umgerechnet werden. Für Altdaten eine explizite `sourceUnit`/`schemaVersion` speichern, nie Werte anhand ihrer Höhe erraten. | Testfälle: 0.0024 Rohwert → 0.24 %, 0.24 % → unverändert 0.24 %; Bewertungsfaktor stimmt mit Exportkopf überein. |
| 3 | **Lauf 150001 kontrolliert neu rechnen** | Erst nach 1 und 2 alle `berechnet`-Kandidaten mit der bestehenden Rücksetzfunktion in die Warteschlange legen und den Lauf fortsetzen. Keine Kandidaten löschen; Entscheidungen bleiben erhalten. | Vollständige Scoreabdeckung oder expliziter Grund je Restlücke; Dividendenwerte stimmen in Kopf und Faktorübergabe überein. |
| 4 | **Stammdatenvertrag erweitern** | `eodhdSymbol`, `primaryTicker`, `landIso`, `currencyCode`, `metadataStatus` und `metadataFetchedAt` speichern. ISO-Währung nur aus `General.CurrencyCode`, nie aus `$`/`€`/`£` raten. | `waehrung` und `land` sind entweder ISO-Werte oder mit einem expliziten Abrufgrund als fehlend markiert. |
| 5 | **Emittenten-Deduplizierung härten** | Nach erfolgreicher Stammdatenauflösung einen kanonischen Emittentenschlüssel bilden. Nur echte Zweitnotierungen ausschliessen; verschiedene Stammaktienklassen (z. B. A/B) brauchen eine separate, dokumentierte Regel. | Mehrfachnotierungen werden als `zweitkotierung` mit Primärticker ausgewiesen; keine blind nach Name gelöschten Titel. |
| 6 | **Exportvertrag verbessern** | `Score-Abdeckung`, `fehlende Faktoren`, `Metadatenstatus` und für `vorhanden` den Grund „bereits in Watchlist“ exportieren. Ungültige Faktorwerte als „nicht anwendbar“ statt leere Punkte erklären. | Export trennt „nicht berechenbar“, „ausgeschlossen“, „bereits vorhanden“ und „vollständig gerankt“ eindeutig. |
| 7 | **Timeout einzeln behandeln** | Für `EXO.AS` eine begrenzte Retry-/Backoff-Strategie mit dokumentiertem Fehlergrund einsetzen. | Ein fehlender Anbieterabruf blockiert keinen Lauf und bleibt revisionsfähig. |

## 6. Vorgeschlagene Release-Gates

1. Kein internationaler Screener-Ranking-Export, solange eine gesamte Zielbörse wegen eines Symbolmappings 0 % Bewertungsabdeckung hat.
2. Keine Bewertung freigeben, wenn Exportkopf und Faktorwert derselben Dividendenrendite voneinander abweichen.
3. Kandidaten ohne Qualität **oder** Bewertung nicht in eine gemeinsame Signalrangfolge einmischen; sie müssen eine gesonderte Datenlückenklasse erhalten.
4. Ein Lauf gilt erst als fachlich vollständig, wenn jede Statuszeile einen maschinenlesbaren Grund, einen Datenzeitpunkt und eine Metadatenauflösung besitzt.

## 7. Prüfdisclosure

**Basis:** Qualität und Bewertung wurden gemäss der im Projekt implementierten Drei-Score-Formeln sowie deren 60-%-Mindestabdeckung geprüft. **Zeit:** Stichtag der Laufdaten ist der 16. August 2026; EODHD-Proben wurden am selben Tag ausgeführt. **Annahmen:** Kein fehlender Wert wurde als Null interpretiert und keine Dublette allein wegen eines identischen Namens entfernt. **Quellen und Sicherheit:** Hohe Sicherheit für Status-, Skalierungs- und Symbolbefunde, weil sie im gelieferten Export, der Datenbank und durch direkte EODHD-HTTP-Proben übereinstimmend belegt sind. **Compliance:** Diese Prüfung bewertet Datenqualität und Berechnungswege; sie ist Forschung und Analyse, keine persönliche Anlageberatung.

## Referenzen

[1]: file:///home/ubuntu/upload/screener-lauf-150001-1786882680898.xlsx "Gelieferter Screener-Export Lauf 150001"
[2]: ../../server/lib/screenerLauf.ts "Screener-Sammlung, Stammdaten- und Berechnungspfad"
[3]: ../../server/lib/screenerStore.ts "Persistenz, Status- und Exportpfad"
[4]: ../../server/lib/dreiScoresService.ts "Drei-Score-Service und Signal-Fallback"
[5]: ../../server/lib/dreiScores.ts "Qualitäts- und Bewertungsformeln"
[6]: ../../server/lib/eodhdSymbol.ts "Zentrale EODHD-Symbolauflösung"
