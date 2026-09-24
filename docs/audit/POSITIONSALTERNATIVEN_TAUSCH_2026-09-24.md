# Positionsalternativen und 1:1-Demo-Tausch

**Datum:** 24. September 2026  
**Geltungsbereich:** Portfolio «Mami» (`4020001`) und alle gleichartigen, nicht aktivierten Demoportfolios  
**Autor:** Manus AI

## Ergebnis

Die Positionsbearbeitung enthält jetzt die Aktion **«Alternativen»**. Sie öffnet eine read-only Vergleichsliste mit maximal fünf verfügbaren Aktien, die dieselbe Handelswährung und denselben Sektor wie die ausgewählte Position haben. Bereits enthaltene Titel, ETFs, inaktive Instrumente, Titel ohne gültigen Marktpreis und Titel mit dem Datenqualitätsstatus `data_gap` werden ausgeschlossen. Die Liste ist ein Vergleichswerkzeug und keine Kaufempfehlung.

Ein 1:1-Tausch kann erst nach einer zweiten, detaillierten Bestätigung ausgelöst werden. Der Dialog nennt den ausgetauschten Titel, den CHF-Gegenwert, die neue Stückzahl, die Rundungsdifferenz und die Folgen der Aktion. Ohne diese Bestätigung werden weder Portfolio-, Cash- noch Ledgerdaten verändert.

## Aktuelle Prüfung für Luzerner Kantonalbank

Die read-only Vorschau für `LUKN.SW` ergab einen Positionswert von **CHF 10’070.77** bei 84.913749 Stück zu CHF 118.60. Es standen fünf aktive, nicht bereits in «Mami» enthaltene Vergleichstitel zur Verfügung. Die Stückzahlen unten sind auf sechs Dezimalstellen gerundet. Dadurch verbleibt höchstens ein Bruchteil eines Rappens in der Cash-Reserve.

| Vergleichstitel | Vergleichsbasis | Vorgeschlagene Stückzahl | Gegenwert in CHF | Cash-Rest in CHF |
|---|---:|---:|---:|---:|
| Valiant Holding (`VATN.SW`) | gleiche Branche | 66.342363 | 10’070.77 | −0.000025 |
| VZ Holding (`VZN.SW`) | gleicher Sektor | 62.707165 | 10’070.77 | −0.000020 |
| UBS Group (`UBSG.SW`) | gleicher Sektor | 259.355413 | 10’070.77 | −0.000008 |
| Swissquote Group (`SQN.SW`) | gleicher Sektor | 261.578459 | 10’070.77 | +0.000007 |
| Vontobel Holding (`VONN.SW`) | gleicher Sektor | 110.304170 | 10’070.77 | −0.000042 |

**St. Galler Kantonalbank** bleibt grundsätzlich ein gültiger Peervergleich, erscheint in dieser konkreten Liste jedoch nicht, wenn der aktuelle Drei-Score oder die Vergleichsreihenfolge andere zulässige Titel vorzieht. **Berner Kantonalbank** wird nicht ergänzt, solange sie nicht als aktiver, ausreichend bepreister Datensatz im lokalen Universum vorliegt. Der Ablauf erfindet keine Kandidaten, Kurse oder Kennzahlen.

## Sicherheitsvertrag

Der Tausch ist streng auf einen eigentümergebundenen, nicht aktivierten Demo-Kontext begrenzt. Die Serverprozedur prüft bei der Vorschau und nochmals unmittelbar vor der Bestätigung: Eigentümerschaft, `portfolioType = demo`, `isLive = 0`, keine vorhandenen Ledgerbuchungen, gültige Kurse, gleiche Handelswährung, gültigen CHF-Wechselkurs und den unveränderten angezeigten CHF-Gegenwert. Weichen Kurs oder Gegenwert zwischen Vorschau und Bestätigung um mehr als zwei Rappen ab, wird die Ausführung abgebrochen und eine neue Vorschau verlangt.

Nach einer bestätigten Ausführung wird die alte Position entfernt und die neue Position mit dem gleichen absoluten CHF-Gegenwert eingesetzt. Nur der rechnerische Rundungsrest verändert die Cash-Reserve. Es werden keine Börsenorders, Zahlungen, Transfers, Transaktionen oder Ledgerbuchungen ausgelöst. Die betroffenen Kurse werden anschliessend best-effort aus EODHD aktualisiert; inkompatible ADR- oder Proxyreihen werden weiterhin als Datenlücke behandelt statt umgerechnet.

Für das geprüfte Portfolio blieb vor und nach der read-only Vorschau unverändert: **Demoportfolio**, **Live-Tracking aus**, **Cash CHF 49’047.22** und **0 Ledgerbuchungen**.

## Validierung

Die Auswahl- und Rundungslogik ist mit vier neuen Tests abgedeckt. Die kombinierte Regression für Alternativen und cash-neutrale Demo-Rebalancierung bestand mit zehn Tests. Der direkte serverseitige Vorschaupfad wurde für `LUKN.SW` ausgeführt; er lieferte die obige Fünferliste und erzeugte keine Portfolio- oder Buchungsänderung. TypeScript wurde nach der UI- und Routerintegration fehlerfrei geprüft. Die vollständige Projektsuite bestand mit **219 Testdateien, 1’582 Tests bestanden und 11 bewusst übersprungenen Tests**. Die Entwicklungsroute `/portfolios/4020001` antwortete mit HTTP 200.

## Bedienung

In der Tabelle **Positionen** steht rechts neben jeder Position in einem nicht aktivierten Demoportfolio das Vergleichssymbol. Derselbe Einstieg befindet sich im Dialog **«Position bearbeiten»** als Button **«Alternativen»**. Nach Auswahl eines Kandidaten zeigt **«Tausch vorbereiten»** die verbindliche Bestätigung. Erst der anschliessende Button **«LUKN.SW durch … tauschen»** führt die Modelländerung aus.

## References

[1]: https://portfolio.mw/portfolios/4020001 "Portfolio Mami (authentifizierte Ansicht)"
