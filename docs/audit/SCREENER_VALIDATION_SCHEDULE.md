# Wöchentliche Screener-Stichprobenvalidierung

**Status:** verbindlicher Prüfvertrag, Umsetzung folgt.  
**Zeitzone:** UTC.  
**Zeitplan:** Montag, 08:30 UTC (`0 30 8 * * 1`).

| Parameter | Verbindliche Einstellung |
|---|---|
| Stichprobe | 20 aktive, kuratierte und in den letzten 48 Stunden berechnete Aktien; reproduzierbare Wochen-Seed-Auswahl |
| Kursreferenz | Regulärer Marktpreis aus Yahoo Finance über die serverseitige Daten-API |
| KGV | Trailing-KGV; keine Vermischung mit Forward-KGV |
| PEG | Nur Vergleich, wenn beide Anbieter einen publizierten Wert liefern; keine neue PEG-Berechnung |
| Dividendenrendite | Prozent; `NULL` gegenüber 0.00 % ist ein Verfügbarkeits-/Semantikbefund, kein Rechenfehler |
| Materielle Schwellen | Kurs > 2.00 %; KGV > 10.00 %; PEG > 20.00 %; Dividende > 0.50 Prozentpunkte **und** > 20.00 % relativ |
| Idempotenz | Ein Lauf pro ISO-Woche; Duplikat-Trigger enden ohne erneute externe Abfragen |
| Speicherung | Laufmetadaten und Einzelbefunde werden revisionssicher in der Datenbank gespeichert |
| Benachrichtigung | Projektinhaber erhält nur bei materiellen, nicht rein semantischen Abweichungen eine Benachrichtigung |

> Die Prüfung überwacht die Daten- und Berechnungskonsistenz; sie erzeugt keine Anlageempfehlung und verändert keine Screener-Scores automatisch.
