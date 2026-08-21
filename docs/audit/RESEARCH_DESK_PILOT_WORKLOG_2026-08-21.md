# Research Desk Lite — Pilot-Arbeitsprotokoll

**Startdatum:** 21. August 2026  
**Pilotmodus:** Ausschliesslich beobachtend (`isShadowMode=1`, `decisionImpact='none'`)  
**Universum:** MSFT, GOOGL, META, AMZN, ORCL (`hyperscaler-us-v1`)  
**Primärquelle:** SEC EDGAR Submissions API (`sec-submissions-v1`)

## Sicherheits- und Governancevertrag

Der Pilot persistiert nur versionierte Quellen-Evidenz. Jede Evidenz enthält Ticker, CIK, Formtyp, SEC-Original-URL, Quellzeit, Abrufzeit, Rohdatenhash und Qualitätsstatus. Weder Scores noch Empfehlungen, Backtests oder Handelsbuchungen werden durch einen Pilotlauf geändert. Der Score- und Handels-Impact ist im Schema und in der Laufzeitlogik auf `none` festgelegt.

## Erster manueller Shadow-Run

Der erste Live-Run wurde am **21. August 2026 um 11:06 Uhr** über die neue Adminansicht `/admin/research-desk` mit einer autorisierten Administrationssitzung ausgelöst. Alle fünf SEC-Quellen waren erreichbar; es wurden **17 vollständige Evidenzen** erfasst und **keine** unvollständige Zeile erzeugt. Die aktuelle Evidenz besteht vorwiegend aus SEC Form 4 von META, AMZN und MSFT. Dies ist eine Quellenbeobachtung, keine Aussage über die ökonomische Richtung der Ereignisse.

| Nachweis | Ergebnis |
|---|---|
| Abrufumfang | 5/5 Pilotemittenten erfolgreich |
| Beobachtete Evidenzen | 17 |
| Unvollständige Evidenzen | 0 |
| Entscheidungswirkung | `none` für jede Evidenz |
| Checker-Status | 16 offen, 1 kontrolliert als `reviewed` gesetzt |
| Score-/Handelsänderung | Keine |

Die Triageaktion „Prüfen“ wurde für genau eine META-Form-4-Evidenz getestet. Sie änderte ausschliesslich den Checker-Status von `pending` zu `reviewed`; die UI bestätigte anschliessend 16 offene Checker und zeigte weiter `Impact: none`.

## Tägliche Ausführung und Abschlussverifikation

Der produktive, fail-closed Heartbeat `research-desk-shadow-daily` ist aktiv und mit der UID `J6amTPb7x4KAL8mVMrMYET` ausschliesslich an den Handler `researchDeskShadow` gebunden. Er läuft täglich um **22:15 UTC**. Die Datenbankprüfung nach Registrierung bestätigt eine aktive Bindung, einen abgeschlossenen Shadow-Run, 17 Evidenzen mit `decisionImpact='none'`, null unvollständige Evidenzen und keine Evidenz ausserhalb des Shadow-Modus.

Die Implementierungsgates sind damit erfüllt. Das fachliche OOS-Gate bleibt dennoch geschlossen, bis die künftigen sechs Wochen des täglichen, punkt-in-zeit-sicheren Shadow-Runs vollständig vorliegen.

Ein zweiter manueller Start am selben Kalendertag wurde zusätzlich live getestet. Die Anwendung bestätigte „Heutiger Shadow-Run liegt bereits vor“, beließ den Lauf bei 5/5 Quellen und die Evidenzliste unverändert bei 17 Zeilen. Damit ist die tagesbezogene Idempotenz sowohl technisch als auch in der Adminoberfläche nachgewiesen.

## Nächste Prüfgates

Der tägliche Lauf muss über eine gebundene Heartbeat-UID registriert werden und über sechs Wochen in Shadow Mode laufen. Erst danach sind Datenvollständigkeit, Punkt-in-Zeit-Qualität, Mehrquellenbestätigung und eine strikt vom Collector getrennte OOS-Backtesthypothese zu bewerten. Die automatische Übergabe an Scores, Empfehlungen, GitHub-Issues oder Handel bleibt gesperrt.
