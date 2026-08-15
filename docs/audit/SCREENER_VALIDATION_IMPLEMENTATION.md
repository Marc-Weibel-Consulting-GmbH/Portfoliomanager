# Implementierungsnachweis — Wöchentliche Screener-Validierung

**Konfiguration:** Montag, 08:30 UTC (`0 30 8 * * 1`), 20 Titel, Projekt-Heartbeat.  
**Status:** Implementiert, preflight-verifiziert und als Projekt-Heartbeat aktiviert.

## Architektur

| Baustein | Umsetzung |
|---|---|
| Auswahl | Stabile FNV-1a-Sortierung nach ISO-Wochen-Seed; dadurch deterministisch und bei Wiederholung reproduzierbar. |
| Idempotenz | Eindeutiger `weekKey` in `screener_validation_runs` sowie gemeinsamer Job-Lock. |
| Preisgegenprobe | Yahoo-Finance-Chart über die serverseitige Daten-API; Querywerte sind als Strings serialisiert. |
| Fundamentaldaten | Frischer EODHD-Rohdatenabruf kontrolliert Cache-Mapping, Skalierung und Datenalter. Er ist keine zweite Providerquelle; die unabhängige KGV-/PEG-Referenz bleibt ein Ausbaupunkt. |
| Persistenz | `screener_validation_runs` und `screener_validation_results` speichern Quelle, interne/externe Snapshots, Schwellen, Klassifikation und Befundstatus. |
| Sicherheit | Der Handler akzeptiert nur Cron-Identitäten und ordnet den Trigger ausschliesslich über `taskUid` der persistierten Projektkonfiguration zu. |
| Benachrichtigung | Nur materielle Abweichungen melden sich an den Projektinhaber; Scores werden nie automatisch verändert. |

## Aktive Ausführung

| Feld | Wert |
|---|---|
| Heartbeat-Name | `screener-validation-weekly` |
| Task-UID | `4c2hvVQ9uK7YsLxRL4bQ34` |
| Callback | `POST /api/scheduled/screenerValidation` |
| Cron | `0 30 8 * * 1` — Montag 08:30 UTC |
| Aktiv | Ja |
| Callback-Zuordnung | Persistiert in `screener_validation_config`; der Handler akzeptiert ausschliesslich die gespeicherte Task-UID. |

## Verifizierter Preflight

Der valide Preflight-Lauf für **`2026-W34`** verarbeitete 20 Titel. Er protokollierte **0 materielle Abweichungen** und **12 partielle Datenverfügbarkeiten**. Die Teilverfügbarkeiten betreffen überwiegend nicht publizierte Fundamentalkennzahlen und sind nicht als Berechnungsfehler klassifiziert.

Zwei technische Vorläuferläufe wurden im Audit-Trail bewusst als verworfen markiert: Die anfängliche Versionsspalte war mit 32 Zeichen zu kurz für die Quellenkennung, und ein Yahoo-Boolean musste gemäss Daten-Proxy-Vertrag als String serialisiert werden. Beide Ursachen sind mit roten und anschliessend grünen Tests abgesichert. Die Montags-Frischegrenze wurde von 48 auf **72 Stunden** erweitert, damit der letzte Freitags-Refresh um Montag 08:30 UTC noch prüfbar ist.

## Verifikation

| Prüfung | Ergebnis |
|---|---|
| Validator-Unit-Tests | 7 bestanden — Seed, ISO-Woche, Schwellen, `NULL`/0-Semantik, Quellenlänge, Parameter-Serialisierung und Wochenendfrische. |
| TypeScript | bestanden |
| Produktions-Build | bestanden |
| E2E-Preflight | 20 Titel gespeichert, keine materialisierte Abweichung, keine Benachrichtigung ausgelöst. |

> Die Hintergrundprüfung ist eine Datenqualitätskontrolle und keine Anlageempfehlung. Materialisierte Befunde sind Untersuchungsaufträge; sie ändern Portfolios oder Scores nicht selbsttätig.
