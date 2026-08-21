# Konzeptbewertung: Research-Desk als spezialisierter Agentenverbund

**Datum:** 21. August 2026  
**Zweck:** Übertragung des beigefügten Bot-Swarm-Konzepts auf den Portfoliomanager, ohne unbelegte Alpha-Behauptungen, Look-Ahead-Bias oder automatisierte Handelsentscheidungen zu übernehmen.

## Kurzurteil

Das Konzept ist **als Research- und Priorisierungsschicht sinnvoll**, nicht als autonomer Handelsapparat. Der Portfoliomanager besitzt bereits vier wesentliche Bausteine: ein gecachtes Research Observatory, tägliche Refreshes, eine strukturierte Research-zu-GitHub-Triage sowie eine Mehrmodell-Synthese. Deshalb wäre ein vollständiger, externer Sechs-Bot-Neubau unnötig und würde Governance, Datenherkunft und Kosten verschlechtern.

> Der geeignete nächste Schritt ist ein **beobachtender „Research Desk Lite“**: verifizierte Ereignisse erfassen, Evidenz versioniert speichern, nur bei klarer Mehrquellen-Bestätigung priorisieren und jede Hypothese erst über den vorhandenen OOS-Backtestprozess bewerten.

## Was am Konzept fachlich trägt — und was nicht

Die Idee enger Rollen mit einer nachgelagerten Prüfinstanz ist übertragbar. Besonders nützlich sind die Trennung zwischen **Erfassung** und **Synthese**, feste Zustandsdateien, eindeutige Stop-Bedingungen sowie ein kurzer Morgenbrief. Die im Artikel genannten Rendite- und Kostenbehauptungen sind dagegen weder ein Implementierungsauftrag noch ein Nachweis für zukünftige Alpha.

| Baustein aus dem Konzept | Einordnung für den Portfoliomanager | Entscheidung |
|---|---|---|
| Filing- und Ereignisbeobachtung | Für US-Titel über primäre SEC-Quellen klar abgrenzbar; für SIX/EU erst nach belastbarer Quellenauswahl | **Pilotfähig, US zuerst** |
| Earnings-Analyse | Strukturierte Überraschung, Guidance und Tonalität können Hypothesen liefern; Transkript-Lizenzen müssen vorab geklärt werden | **Pilotfähig, aber nur mit Quellenbeleg** |
| Insider-Tracker | Opportunistische Insidertätigkeit ist von Routinehandel zu unterscheiden; reine Handelsanzahl reicht nicht | **Pilotfähig, Form 4 nur für US** |
| Sektor-Research | Bestehendes n8n/Research Observatory deckt diesen Teil bereits an | **Ausbauen, nicht neu bauen** |
| Social-Sentiment/X | Fehlende, stabile und lizenzierte Zeitreihe; hohe Manipulations- und Datenqualitätsgefahr | **Nicht in Pilot 1** |
| 13F-Tracking | Stark verzögert und kein Echtzeitsignal; höchstens als langsamer Kontextfaktor | **Nicht in Pilot 1** |
| Selbstmodifizierende Bots | Unversionierte Schwellenwertänderungen zerstören Vergleichbarkeit und fördern Overfitting | **Explizit ausschliessen** |
| Automatische Ausführung | Widerspricht dem bestehenden Research→Hypothese→OOS-Backtest→Freigabe-Prozess | **Explizit ausschliessen** |

## Bereits vorhandene Ausgangslage

Der bestehende Research-Stack bildet bereits einen grossen Teil der benötigten Steuerungslogik ab. Das Research Observatory validiert und persistiert n8n-Signale, arbeitet cachebasiert und liefert bei einem Fehler weiterhin den letzten belegten Datenstand. Der tägliche Handler ist über einen persistenten Task-Guard geschützt. Für hochrelevante Signale erstellt der Research-Issue-Prozess bereits eine strukturierte Hypothese mit Quelle, betroffener Engine und vorregistrierter Schwelle. Die Mehragentenfunktion trennt parallele Expertenantworten von einer nachgelagerten Synthese.[1] [2] [3]

| Vorhandene Komponente | Gegenstück im Konzept | Nutzung im Pilot |
|---|---|---|
| `research_signals` + n8n-Refresh | Sektor-/Quellenbeobachter | Bestehender Maker für thematische Evidenz |
| Research-GitHub-Issue ab Score ≥ 8 | Coordinator/Triage | Checker für Hypothesen, **nicht** für Handelsentscheidungen |
| Multi-Agent-Sitzungen mit Synthese | Spezialisten + Synthesizer | Manuelle Tiefenprüfung bei Ausnahmen |
| Backtest-Engine mit Look-Ahead-Schutz | Outcome-Evaluation | Einziger Weg von Hypothese zu Algorithmusänderung |
| Scheduled-Task-Guard | Laufzustand/Stop-Bedingung | Idempotenz, Fehlerprotokoll und Nachvollziehbarkeit |

## Empfohlener Pilot: Research Desk Lite

Der Pilot soll **sechs Wochen beobachtend** laufen und eine kleine, eindeutig definierte US-Testmenge aus dem bestehenden Universum verwenden. Dadurch sind SEC-Quellen, Form 4 und 8-K rechtlich/technisch sauber abgrenzbar. Schweizer und europäische Titel werden erst ergänzt, wenn eine gleichwertige Primärquelle samt Identifier-Mapping festgelegt ist.

### Rollen und Verträge

| Rolle | Eingabe | Deterministische Ausgabe | Harte Stop-Bedingung |
|---|---|---|---|
| Filing-Ereignisdetektor | SEC EDGAR, US-Ticker, letzter verarbeiteter Zeitstempel | Formtyp, Ereigniszeit, EDGAR-URL, Content-Hash, extrahierte Risikokategorie | Keine EDGAR-URL, ungültiger CIK/Ticker oder fehlender Zeitstempel → kein Signal |
| Earnings-Ereignisdetektor | Unternehmens-IR/8-K-Quelle und Kalender | Veröffentlichung, EPS-/Umsatz-/Guidance-Feldwerte, Quellen-URL | Kein Primärdokument oder unbekannte Vergleichsbasis → nur „unvollständig“, keine Wertung |
| Insider-Ereignisdetektor | SEC Form 4 | Rohtransaktionen, Käufer/Verkäufer, Stück, Wert, Zeitfenster | Keine offene Markttransaktion oder unklarer Transaktionstyp → nicht als Cluster zählen |
| Themen-/Sektor-Maker | Bestehende n8n-Signale | Bestehendes Research Signal mit Score und Themen | Quelle/URL fehlt → nur Kontext, keine Bestätigung |
| Checker/Coordinator | Normalisierte Maker-Evidenz | Priorität, Evidenzliste, Hypothese, vorregistrierte Messung | Weniger als zwei unabhängige Evidenzen → Beobachtung, kein „High Conviction“ |

Der Checker darf keine Rohforschung erfinden. Er darf nur normalisierte Evidenz verknüpfen und muss für jede Aussage Quelle, Zeitstempel, Datensatzversion und Gegenhypothese nennen. Der aktuelle Research-Issue-Prozess ist dafür der geeignete Ansatzpunkt; seine bestehende Schwelle von Score ≥ 8 bleibt bestehen.[2]

## Datenmodell und Governance

Jeder neue Befund benötigt eine persistierte Evidenzzeile mit `source_type`, `source_url`, `source_published_at`, `fetched_at`, `ticker`, `isin`, `event_type`, `raw_hash`, `extraction_version`, `confidence`, `run_id` und `status`. Diese Datenstruktur ist wichtiger als zusätzliche Modellnamen: Sie erlaubt Deduplizierung, Wiederholbarkeit, Fehleranalyse und spätere Punkt-in-Zeit-Auswertung.

Der Pilot erhält vier verbindliche Regeln. Erstens bleiben alle Feature Flags standardmässig deaktiviert. Zweitens darf keine Research-Evidenz unmittelbar Score, Optimierung oder Handelsentscheidung ändern. Drittens sind Prompt-, Regel- und Quellenversionen unveränderlich pro Lauf zu speichern. Viertens sind Regeländerungen nur über eine genehmigte, versionierte Konfiguration zulässig; ein Bot darf seine Schwellen nie selbst umschreiben.

## Messung ohne Selbsttäuschung

Der Artikel schlägt vor, Regeln anhand späterer Kursbewegungen anzupassen. Das ist nur dann zulässig, wenn die Entscheidung zeitlich sauber vor dem Ergebnis liegt und der Anpassungszeitraum vom Testzeitraum getrennt wird. Der Portfoliomanager soll deshalb je Signal mindestens `t+1`, `t+3`, `t+5` und `t+20` Handelstage sowie eine Benchmark-bereinigte Rendite speichern. Ein Ergebnis misst zunächst **Research-Qualität**, nicht Alpha.

| Messgrösse | Vorregistrierte Definition | Freigabekriterium |
|---|---|---|
| Quellenvollständigkeit | Anteil der Signale mit URL, Ereigniszeit, Roh-Hash und gültigem Identifier | ≥ 98 % vor Nutzeranzeige |
| Maker-Fehlerquote | Anteil verworfener/duplizierter Befunde | Dokumentieren, nicht wegfiltern |
| Checker-Präzision | Anteil der High-Conviction-Befunde mit mindestens zwei unabhängigen Evidenzen | 100 % formale Evidenzprüfung |
| Outcome-Abdeckung | Anteil der Befunde mit verfügbaren, zeitlich passenden `t+1` bis `t+20` Preisen | ≥ 95 % vor jeder Performanceaussage |
| Hypothesenwert | OOS-Vergleich gegen vorregistrierte Schwelle, netto Kosten und Regime-robust | Nur über vorhandenen Backtest-/Issue-Prozess |

Der bestehende Backtestvertrag schliesst aktuelle Fundamentaldaten explizit aus, wenn keine Punkt-in-Zeit-Historie vorliegt. Diese Grenze muss für Filing-, Earnings- und Insiderereignisse unverändert gelten.[4]

## Zwei umsetzbare Wege

| Ansatz | Funktionsweise | Abwägung | Laufende Kosten | Einrichtungsaufwand |
|---|---|---|---|---|
| **A. Integrierter Research Desk Lite — empfohlen** | Ergänzt die bestehende Anwendung um tägliche, deterministische Quellenadapter, Evidenzspeicher und eine Checker-Ansicht; KI fasst nur normierte Evidenz zusammen | Maximale Nachvollziehbarkeit, bestehende Authentifizierung/Task-Guards/Backtests nutzbar; startet mit US-Quellen | Keine neue Agentenplattform; nur vorhandene Daten-/LLM-Nutzung | Mittel |
| **B. Externer Bot-Workspace als Research-Zulieferer** | Mehrere externe Bots schreiben tägliche Dateien/Briefings, die danach importiert werden | Schnell demonstrierbar, aber schwächere Reproduzierbarkeit, neue Zugangsdaten und externe Abhängigkeit; der im Artikel genannte Preis ist nicht unabhängig verifiziert | Externe Abogebühr gemäss Anbieter | Niedrig bis mittel |
| **C. Bestehendes Observatory ohne neue Quellen** | Nutzt nur n8n-Signale und den heutigen Issue-/Backtestfluss | Schnell, aber keine neue Primärevidenz für Filings/Insider | Keine zusätzlichen Kosten | Niedrig |

## Empfohlene Reihenfolge

Zuerst wird **Ansatz A als zweiwöchiger technischer Pilot** umgesetzt: Schema, EDGAR-Form-4-/8-K-Adapter, Evidence Ledger, täglicher Lauf und reine Adminansicht. Danach folgt eine vierwöchige Beobachtungsphase ohne Benachrichtigungen ausserhalb des Adminbereichs. Erst wenn Datenvollständigkeit, Deduplizierung und Zeitstempelqualität die vorregistrierten Anforderungen erfüllen, wird die Checker-Zusammenfassung an das Research Observatory gekoppelt. Eine algorithmische Nutzung bleibt davon getrennt und bedarf eines eigenen OOS-Experiments.

## Quellen

[1]: [Cohen, Malloy & Pomorski — Decoding Inside Information, NBER Digest](https://www.nber.org/digest/apr11/decoding-inside-information)  
[2]: [Lokaler Code: `server/scheduled/researchGithubIssueScheduled.ts`](../../server/scheduled/researchGithubIssueScheduled.ts)  
[3]: [Lokaler Code: `server/routers/researchRouter.ts`](../../server/routers/researchRouter.ts)  
[4]: [Lokaler Code: `server/routers/backtestRouter.ts`](../../server/routers/backtestRouter.ts)  
[5]: [Loughran–McDonald Master Dictionary, University of Notre Dame](https://sraf.nd.edu/loughranmcdonald-master-dictionary/)  
[6]: [Ben-Rephael et al. — Who Pays Attention to SEC Form 8-K?](https://publications.aaahq.org/accounting-review/article/97/5/59/336/Who-Pays-Attention-to-SEC-Form-8-K)
