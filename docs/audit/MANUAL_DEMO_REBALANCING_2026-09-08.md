# Manuelle Demo-Positionsbearbeitung — Integritätsnachweis

**Stand:** 8. September 2026  
**Umfang:** Stückzahl-, Lösch-, Hinzufüge- und Cash-Reserve-Vertrag für nicht aktivierte Demoportfolios

## Reproduzierter Befund

Die vom Nutzer gespeicherte Änderung von Nestlé (`NESN.SW`) von 260 auf 200 Stück war bereits in der Portfolionutzlast persistiert. Die Portfoliodetailansicht konnte jedoch weiterhin den zwei Minuten gültigen Detailcache ausliefern. Zusätzlich berücksichtigte der frühere allgemeine Bearbeitungspfad keine Gegenbuchung zum Cashbestand. Der sichtbare Depotwert, die Cash-Reserve und daraus abgeleitete Gewichte konnten deshalb nach manuellen Änderungen inkonsistent sein.

## Korrigierter Vertrag

Für nicht aktivierte Demoportfolios bewertet der serverseitige Bearbeitungspfad die Position vor und nach der manuellen Änderung ausschliesslich mit kanonischem Kurs, Handelswährung und CHF-Wechselkurs. Eine Reduktion oder Löschung erhöht die Cash-Reserve um den CHF-Wert; ein Zugang ist nur bei ausreichender Cash-Reserve möglich. Der Gesamtwert unmittelbar vor und nach der Änderung bleibt dabei erhalten. Der Gewichtungseditor übergibt nur Zielgewichte bis maximal 100 %; nicht mehr zugeordnete Werte bleiben als Cash, sie werden nicht implizit umverteilt.

Der gemeinsame Mutation-Cachevertrag invalidiert nach erfolgreicher Bearbeitung Detail- und Performancecache desselben Eigentümers. Die Detailansicht kann damit keinen vor der Änderung gespeicherten Bestand mehr ausliefern. Live wurde bei „Mami“ nach dem Reload der bereits gesicherte Nestlé-Wert als CHF 15'495 angezeigt; dies entspricht 200 Stück auf der damals verwendeten Kursbasis. Die Cash-Reserve betrug CHF 49'047 beziehungsweise 9,8 % des Startkapitals; der Einstellungsdialog leitet seine Startquote nun defensiv aus diesen tatsächlichen Werten ab und zeigt sie auf eine Dezimalstelle gerundet.

## Blockierter Folgefehler im Altpositionspfad

Bei der anschliessenden Quellpfadprüfung wurde vor einer erneuten Speicherung ein kritischer Altpositionsfehler gefunden: Historisch gewichtsbasiert gespeicherte Positionen enthalten keine explizite `shares`-Eigenschaft. Der neue Stückzahlpfad setzte solche Ausgangsbestände bislang mit `Number(holding.shares ?? 0)` auf null. Eine Bearbeitung hätte damit die vollständige Ausgangskapitalbasis falsch berechnet und nicht bearbeitete Positionen beim Filtern aus der gespeicherten Liste entfernt. Dieser Pfad wird **nicht** verwendet, bis die Ausgangsstückzahlen strikt aus gespeicherten Gewichten, Startkapital und kanonischen CHF-Kursen rekonstruiert sowie durch einen Mehrpositions-Regressionstest abgesichert sind. Während der Prüfung wurde keine weitere Änderung gespeichert.

## Sicherheitsgrenzen

Der Pfad ist ausschliesslich für nicht aktivierte Demoportfolios verfügbar. Er erzeugt keine Börsenorder, keine Zahlung, keine externe Geldbewegung und keine Ledgertransaktion. Aktivierte beziehungsweise Liveportfolios bleiben für diese direkte Bearbeitung gesperrt.

## Abnahme des Altpositions- und Aktualisierungspfads

Der Altpositionsschutz wurde umgesetzt und testgetrieben abgenommen. Fehlen gespeicherte Stücke, rekonstruiert der Demo-Pfad sie aus Gewicht, Kapitalbasis, kanonischem Lokalkurs und CHF-Wechselkurs, statt sie als null zu behandeln. Nicht bearbeitete Positionen bleiben erhalten. Stückzahlreduktionen und Löschungen schreiben den CHF-Gegenwert als Cash-Gutschrift, Zugänge und Erhöhungen sind nur bei ausreichender Cash-Reserve zulässig.

Nach einer erfolgreichen Cashquote-, Stückzahl- oder Gewichtungsänderung wird ausschliesslich der betroffene Titelbestand punktuell über EODHD nachgeladen. Der Nachlauf aktualisiert aktuelle Kurse nur bei kompatibler Instrument- und Preisreihenbasis, ergänzt historische Tage ausschliesslich additiv und überschreibt bei Fehlern keinen bestehenden Kurs. Inkompatible ADR-/Proxybasen werden als Datenlücke zurückgegeben. Danach verwirft der Server Detail- und Performancecache; die Dialoge lösen zudem die bestehende zentrale Invalidierung für Portfolio-, Dashboard- und Performancequeries aus.

Die fokussierten Regressionsdateien für Cash-Gegenbuchung, Altpositionsrekonstruktion, Cacheinvalidierung, Positionsbearbeitung und Kapitalbasis bestanden am 8. September 2026 mit **22 Tests**. Die vollständige Suite bestand anschliessend mit **1'561 Tests**, **11 bewusst übersprungenen Tests** und fehlerfreiem TypeScript-Check. Eine erneute Nestlé-Mutation wurde nicht ausgelöst; die Positionsänderung bleibt dem Nutzer zum eigenen Test vorbehalten.
