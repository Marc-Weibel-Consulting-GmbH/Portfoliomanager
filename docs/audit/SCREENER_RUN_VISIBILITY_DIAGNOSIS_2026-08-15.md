# Screener — Diagnose der vermeintlich verlorenen Berechnungen

**Untersuchungsdatum:** 15. August 2026  
**Ergebnis:** **Kein Datenverlust.** Berechnete Kandidaten waren nach einem neueren fehlgeschlagenen Lauf nur in der Admin-Anzeige ausgeblendet.

## Datenintegritätsgegenprobe

| Datenbestand | Befund |
|---|---:|
| Aktive Stammdaten | 288 Titel |
| Aktueller Signal-Cache | 246 Einträge, alle innerhalb der letzten 24 Stunden aktualisiert |
| Historische Screener-Berechnungen | 639 Zeilen für 510 unterschiedliche Titel |
| Letzter Lauf mit Ergebnissen | Lauf **#60001**, 331 berechnet, 25 mit Fehler, 84 Zweitkotierungen, 1 abgelehnt |
| Neuester Lauf | Lauf **#90002**, Status `fehler`, 0 berechnet, 527 wartend |

Die Kandidatentabellen sind laufbezogen (`screener_lauf` → `screener_kandidat`). Ein neuer Lauf löscht keine Zeilen eines älteren Laufs. Die 331 Berechnungen aus Lauf #60001 blieben unverändert gespeichert.

## Root Cause

Der Admin-Endpunkt wählte bisher mit `letzterLauf()` immer die höchste Lauf-ID. Nach einem fehlgeschlagenen neuen Lauf #90002 zeigte die Oberfläche deshalb dessen 0 Berechnungen und keine Kandidatenliste, obwohl Lauf #60001 weiterhin 331 berechnete Titel enthielt.

## Korrektur

Die Anzeigeauswahl fällt jetzt bei einem fehlerhaften neuesten Lauf auf den letzten Lauf mit `berechnet`, `übernommen` oder `abgelehnt` zurück. Die Oberfläche zeigt zusätzlich eine sichtbare Warnung mit der ID und Fehlerbeschreibung des ausgeblendeten fehlerhaften Laufs. Ein tatsächlich laufender neuer Lauf bleibt unverändert sichtbar; es erfolgt kein irreführender Rückfall auf historische Daten.

## Verifikation

| Prüfschritt | Ergebnis |
|---|---|
| Roter Test | Reproduziert: fehlgeschlagener Lauf #90002 verdrängt gültigen Lauf #60001 ohne Fallback. |
| Unit-Test | 2 Tests bestanden: Fehler-Fallback und laufender neuer Lauf. |
| Reale Datenbankgegenprobe | #90002 (`fehler`, 0 berechnet) → #60001 (`rechnet`, 331 berechnet), Fehlerlauf explizit ausgewiesen. |
| TypeScript | bestanden |
| Produktions-Build | bestanden |

> Es wurde keine Neuberechnung ausgelöst und keine Kandidaten- oder Scorezeile verändert.

## Ergänzung: Lauf #90002

Die forensische Datenabfrage bestätigt für Lauf #90002 den Status `fehler` mit dem gespeicherten Hinweis **„Sammeln abgebrochen (Prozessneustart oder Fehler)“**. Der Lauf startete um 06:31 UTC und enthielt bereits 598 erfasste Kandidaten: 527 wartend, 71 als vorhanden erkannt. Der Lauf wurde damit während des Sammelns durch einen Prozessneustart beziehungsweise eine laufende Deployment-/Entwicklungsinstanz unterbrochen, nicht durch einen Fehler in den 331 historischen Berechnungen.

Der Screener ist dafür jetzt fehlertolerant: Der letzte gültige Lauf #60001 wird sichtbar gehalten und der unterbrochene Lauf explizit ausgewiesen. Die Kandidaten von #90002 bleiben für einen bewusst gestarteten neuen oder fortgesetzten Lauf erhalten; es erfolgte keine Löschung und keine automatische Neuberechnung.
