# Phase 0 — Technische Baseline

**Projekt:** Portfoliomanager  
**Audit-Branch:** `audit/phase-0-baseline`  
**Baseline-Commit:** `c910b81` (vor Audit-Dokumentation)  
**Datum:** 13. August 2026  
**Status:** Wartet auf dein OK

> Diese Baseline beschreibt ausschliesslich den belegten Ist-Zustand. Sie enthält **keine stillen Fixes**, keine Abhängigkeitsupdates und keine Änderungen am produktiven Verhalten. Die hier genannten Test-, Sicherheits- und Dokumentationslücken sind noch keine als abgeschlossen geltenden Fachbefunde.

## 1. Reproduzierbare Ausführung

| Prüfschritt | Ergebnis | Beleg | Einordnung |
|---|---|---|---|
| Gelockte Installation | erfolgreich | `pnpm install --frozen-lockfile` | Lockfile ist konsistent. pnpm 10 meldet jedoch, dass `patchedDependencies`, `overrides` und `onlyBuiltDependencies` im Manifestformat nicht mehr gelesen werden. |
| Produktions-Build | erfolgreich | `pnpm build`, Vite-Build in 11.29 s | Der Server-Bundle ist 2.7 MB. Mehrere Browser-Chunks überschreiten die konfigurierte 600-kB-Warnschwelle. |
| TypeScript | erfolgreich | `pnpm exec tsc --noEmit --pretty false` | Keine Typfehler. |
| Gesamte Vitest-Suite | fehlgeschlagen | `pnpm test -- --reporter=verbose` | 137 Dateien bestanden, 3 fehlgeschlagen, 2 übersprungen; 1'237 Tests bestanden, 11 fehlgeschlagen, 3 übersprungen. |
| ESLint | ohne Fehler, mit Warnungen | `pnpm lint` | 2'559 Warnungen, vor allem `any` und ungenutzte Werte. |
| Modulabhängigkeiten | fehlgeschlagen | `pnpm deps:check` | Drei Fehler: ein Server-Test importiert Client-Code; zwei Zyklen sind vorhanden. |

### Test-Baseline: Fehlergruppen

| Gruppe | Reproduktion | Beobachtung | Vorläufige Ursache | Audit-Folge |
|---|---|---|---|---|
| Schweizer Zahlenformatierung | `client/src/lib/format.test.ts` | 7 Assertions erwarten ASCII-Apostroph (`'`), die `Intl.NumberFormat("de-CH")`-Laufzeit liefert typografischen Apostroph (`’`). | Implementierung und Testvertrag sind widersprüchlich; noch nicht geklärt, ob der dokumentierte UI-Vertrag ASCII oder typografisch verlangt. | Phase 2: zentralen Formatvertrag und Browser-Ausgabe gegen Kundenerwartung verifizieren. |
| TradingView-MCP | `server/tradingview-mcp.test.ts:14–36` | Live-Initialisierung liefert HTTP 502 statt 200. | Externe MCP-Erreichbarkeit bzw. Upstream-Vertrag ist nicht gegeben; der Test ist ein Live-Integrationstest. | Phase 4/5: Endpoint, Authentisierung, Timeout/Retry, Monitoring und Testisolierung prüfen. |
| Sornette Finance | `server/__tests__/sornetteApi.test.ts:7–68` | Authentisierung liefert HTTP 404; nachgelagerte Assertions erhalten keinen Token bzw. `null`. | Hardcodierter externer Auth-Pfad oder API-Vertrag/Umgebung weicht ab. | Phase 4: Integrationsvertrag und Fallback-Verhalten gegen echten Anbieter prüfen. |

Die Testfehler werden bewusst **nicht** vorweg behoben. Zuerst wird in Phase 2 bzw. Phase 4 ein roter, isolierter Test mit einer klaren Soll-Spezifikation und eine Ursachenanalyse erstellt.

## 2. Architektur- und Modul-Inventur

| Schicht | Bestand | Aufgabe und Schnittstellen |
|---|---:|---|
| Client | 209 TypeScript-/TSX-Dateien, 61 Seiten | React 19, Vite, Wouter, TanStack Query, tRPC-Client, Dashboard-/Portfolio-/Admin-Oberflächen. |
| API-/Anwendungsschicht | 51 Router | Express 4 und tRPC 11; Fachbereiche u. a. Portfolios, Backtests, Optimierung, Research, Marktregime, Admin, Benachrichtigungen und Import. |
| Quant-/Analytics-Schicht | 23 Module | Risiko, Optimierung (HRP), Walk-Forward, ML, LPPL/Sornette, Regime- und Signalverarbeitung. |
| Hintergrundverarbeitung | 13 Handler | Kurse, Scores, Snapshots, Alerts, Research, Backtests, YTD und Wochenberichte. |
| Datenbank | 46 Schema-/Migrationsdateien | Drizzle ORM auf MySQL/TiDB; Auth-, Portfolio-, Markt-, Research- und Analyse-Daten. |
| Tests | 142 Testdateien | Unit-, Charakterisierungs- und einige echte Integrationsprüfungen. Eine Code-Coverage-Messung ist aktuell nicht als reproduzierbarer Standardlauf konfiguriert. |

```text
React/Vite-Client
  └─ tRPC/Express-Router
       ├─ Portfolio-, Markt-, Research- und Admin-Services
       ├─ Quant-Engines (Signals, Regime, Risiko, Optimierung, Backtests)
       ├─ Drizzle ORM → MySQL/TiDB
       ├─ Redis/Upstash-Caches
       └─ Scheduler → Preise, Scores, Alerts, Snapshots, Research

Externe Dienste: Markt- und Fundamentaldaten, Nachrichten/Research,
LLM-Dienste, E-Mail/WhatsApp, Zahlungen, Speicher, TradingView und Sornette.
```

Die zentrale Laufzeitkonfiguration in `server/_core/env.ts` deckt nur einen Teil der tatsächlich verwendeten Umgebungsvariablen ab. Der Arbeitsbaum referenziert darüber hinaus Konfiguration für u. a. TradingView, Sornette, SMTP, Redis, Firecrawl, GitHub, Wikifolio und weitere Datenanbieter. Das ist ein belegter **Konfigurationsflächen-Befund**, dessen fachliche Auswirkung erst in Phase 4/5 bewertet wird.

### Erkannte Modulgrenzen-Probleme

| ID | Beleg | Beobachtung | Status |
|---|---|---|---|
| B0-01 | `pnpm deps:check` | Zyklus `server/db.ts → server/fxHelper.ts → server/db.ts`. | wartet auf dein OK |
| B0-02 | `pnpm deps:check` | Zyklus `server/_core/env.ts → server/_core/secretsManager.ts → server/db.ts → server/_core/env.ts`. | wartet auf dein OK |
| B0-03 | `pnpm deps:check` | `server/__tests__/openstock-features.test.ts` importiert `client/src/components/TradingViewWidget.tsx`. | wartet auf dein OK |

## 3. Security-, Dependency- und Lizenz-Baseline

| Prüffeld | Ergebnis | Bedeutung für die nächsten Phasen |
|---|---|---|
| Secret-Signaturen im Arbeitsbaum | keine Treffer | Geprüft wurden typische GitHub-, OpenAI-, Google-, AWS- und Private-Key-Signaturen; `.env.example`-Dateien sind erwartungsgemäss versioniert. |
| Secret-Signaturen in erreichbarer Git-Historie | keine Treffer | Der Muster-Scan liefert keine bekannten Schlüssel-Signaturen. Das ersetzt keinen entropiebasierten Scanner wie Gitleaks; dieser bleibt in Phase 5 als vertiefte Gegenprobe offen. |
| Produktionsabhängigkeiten | 114 Audit-Befunde | `pnpm audit --prod`: 10 tief, 52 mittel, 49 hoch, 3 kritisch. Keine Updates wurden vorgenommen. Die Ausnutzbarkeit muss pro tatsächlich erreichbarem Pfad priorisiert werden. |
| Konkreter Paketbeleg | DOMPurify 3.3.0 | Der Audit-Report nennt Patches ab 3.4.7 für mehrere Sanitization-Befunde; die Anwendung bezieht das Paket transitiv über jsPDF/jsPDF-Autotable. |
| Lizenzen | Nachweisprüfung erforderlich | `pnpm licenses list --prod` meldet `Unknown` für `buffers` und `numeric`; `Unlicense` für `big-integer`, `fast-sha256` und `wouter`. Die rechtliche Bewertung erfolgt nicht automatisiert, sondern mit Herkunfts- und Nutzungsprüfung in Phase 5/8. |

> **Einordnung:** Ein `pnpm audit`-Treffer beweist eine betroffene Paketversion, aber nicht automatisch einen von der Anwendung erreichbaren Exploit-Pfad. Wegen drei kritischer und 49 hoher Befunde ist die sachliche Priorität jedoch hoch genug, um Remediation in die spätere Launch-Blocker-Bewertung aufzunehmen.

## 4. Dokumentationsabgleich

Die vorhandenen 43 Dokumentationsdateien liegen überwiegend unter `docs/history/` oder beschreiben spezialisierte Teilbereiche. Eine eigenständige, aktuelle A3-Systemübersicht beziehungsweise ein Dokument mit einem vollständigen Ist-Architektur-, Datenfluss-, Integrations-, Betriebs- und Verantwortungsbild wurde nicht gefunden.

| Erwartung aus dem Auftrag | Ist-Zustand | Konsequenz |
|---|---|---|
| A3-Systemübersicht | nicht als eigenständiges aktuelles Dokument auffindbar | In Phase 7 muss eine versionierte Systemübersicht als Betriebs- und Audit-Quelle entstehen. |
| Offener PR #176 | auf GitHub geschlossen | Die Auftragsannahme „offen“ ist veraltet; keine Kollision mit einem offenen Branch, aber die tatsächliche Integration muss in Phase 6 gegen `main` geprüft werden. |
| Offener PR #273 | auf GitHub gemergt | Die bekannte Entscheidung zur Trailing-PEG-Historie ist bereits in `main`; Phase 1 respektiert diese Annahme und prüft nur ihre korrekte Umsetzung. |
| System-/Integrationsvertrag | verteilt über Code, Teil-READMEs und alte Handoffs | Konfigurations-, Daten- und Betriebswissen ist nicht an einer belastbaren Stelle zusammengeführt. |

## 5. Detaillierter Arbeitsplan für Phase 1 — Fachliche und quantitative Korrektheit

**Gate:** Dieser Plan wird erst nach deinem ausdrücklichen OK ausgeführt. Jeder Befund erhält ein eigenes `F1-xx`-Log, Datei- und Zeilenbelege, eine Gegenprobe und — vor jedem Fix — einen roten Test beziehungsweise eine reproduzierbare, handgerechnete Referenz.

| Reihenfolge | Prüfpaket | Ziel und Invarianten | Belegform |
|---:|---|---|---|
| 1 | Prüfkatalog & Einheitenvertrag | Zentrale Definitionen für Dezimal/Prozent, CHF/Fremdwährung, TTM/Jahr, annualisiert/nicht annualisiert, Kosten und Null-Semantik festschreiben. | Tabellenvertrag, Grenzwerttests und Abgleich mit bestehenden Kopfkommentaren. |
| 2 | Score- und Signalpipeline | `signalBlend.ts`, `dreiScoreSignal.ts`, `signalGewichteBacktest.ts`, `regimeSchluessel.ts`, Regime-/Signal-Engines auf Gewichtssummen, Bänder, Vorzeichen und Skalierung prüfen. | Handgerechnete Referenzfälle für A–F und Extremwerte; Schnittstellentests zwischen Signal und UI/API. |
| 3 | Risiko- und Statistikfundament | `riskStats.ts`, `ledoitWolf.ts`, `performanceCore.ts`, `performanceEngine.ts`, Rendite- und Volatilitätsberechnung. | Kleine deterministische Preisreihen mit manuell berechnetem Sharpe, Sortino, MaxDD, Beta und CAGR. |
| 4 | Optimierung & Multi-Asset | `hrpOptimizer.ts`, `optimizerWorker.ts`, `multiAssetSleeve.ts`, `profileOptimizerParams.ts`. | Kovarianz-/Shrinkage-Beispiele, Gewichtssumme exakt 1, Non-Negativity und harte Anlage-/FX-Grenzen. Bewusste PR-176-Entscheidungen werden nicht als Duplikate fehlklassifiziert. |
| 5 | Benchmarks, Kosten, Wirkung | `benchmarkAlpha.ts`, `klassenBenchmark.ts`, Kosten-/Transaktionsmodule, Outcome-/Wirkungslogik. | Brutto-Netto-Brücke mit einem vollständigen Zahlenbeispiel; Abdeckungsgrenze 70 % explizit testen. |
| 6 | Punkt-in-Zeit & Look-Ahead | Alle `punktInZeit*`-Module, PEG-Historie, Kurs- und FX-Daten. | Zeitachse pro Input, Publikations-/Stichtagsprüfung, Restatement- und Split-Fälle. Trailing-PEG bleibt gemäss bestehender Entscheidung erhalten. |
| 7 | Numerische Robustheit & Gegenprobe | Alle priorisierten Module auf NaN/Infinity, fehlende Reihen, negative EPS, leere Portfolios, Wochenenden, sehr kleine Nenner und Datumsgrenzen prüfen. | Property-orientierte Fälle, Negativtests und Abgleich paralleler Code-Pfade. |

### Vorgehensweise je Phase-1-Befund

1. **Ziel und fachliche Definition** aus Code-Kommentar, existierenden Tests und dokumentierter Designentscheidung erfassen.
2. **Ist-Zustand** mit Datei:Zeile, minimalem Code-Ausschnitt und reproduzierbarem Referenzfall belegen.
3. **Falsch-positiv-Check** gegen bewusste Entscheidungen durchführen, insbesondere `null` statt Schätzung, 70-%-Abdeckung, bewusst gespiegelte Konstanten und Ausblendregeln.
4. **Hypothese und roter Test** formulieren. Es erfolgt kein Fix ohne isolierten Nachweis.
5. **Fix-Vorschlag** mit Auswirkungen und Regression-Risiko zur Freigabe vorlegen; erst nach deiner Annahme implementieren.
6. **Verifikation und Gegenprobe** mit zielgerichtetem Test, gesamter Suite, Build und — falls UI sichtbar betroffen — Browser-Check mit Screenshot.

## 6. Rückfragen vor Phase 1

| Frage | Warum sie für die Priorisierung nötig ist |
|---|---|
| Welche Kundengruppe ist zuerst verbindlich: Selbstentscheider, Vermögensberater, Family Office oder institutionelle Nutzer? | Bewertet Erklärbarkeit, Sicherheitsniveau, Mandantentrennung und regulatorische Produktgrenze. |
| Welcher Launch-Horizont und welche drei MVP-Abläufe sind nicht verhandelbar? | Trennt Launch-Blocker von späteren Optimierungen. |
| Soll der Audit zunächst auf historische Rekonstruktion, laufende Empfehlungen oder auf beide gleich stark fokussieren? | Bestimmt die Reihenfolge von Punkt-in-Zeit-Prüfung, Datenintegrationen und Optimierungslogik. |
| Welche Datenanbieter- und LLM-Verträge/Limits gelten produktiv? | Erforderlich für Kosten-, Lizenz-, Verfügbarkeits- und Fallback-Bewertung. |
| Gibt es eine fachlich autorisierte Referenz für Kostenmodell, FX-Konvention, Risikofreien Satz und Benchmarkzuordnung? | Ohne Fachreferenz können finanzmathematische Tests nur gegen den impliziten Codevertrag, nicht gegen die gewünschte Geschäftsdefinition prüfen. |
| Darf ich für spätere Browser-Phasen ausschliesslich Demo-/Testportfolios verwenden? | Verhindert versehentliche Änderungen an echten Kunden- oder Live-Portfolio-Daten. |

## 7. Freigabe

Bitte entscheide für die Baseline und den Phase-1-Plan:

| Option | Wirkung |
|---|---|
| **Annehmen** | Phase 1 startet mit dem Einheitenvertrag und dem Score-/Signalpaket. |
| **Nachschärfen** | Du gibst Ergänzungen oder eine andere Reihenfolge vor; der Plan wird angepasst. |
| **Verwerfen** | Keine weitere Audit-Arbeit in dieser Phase; Audit-Log bleibt als Nachweis bestehen. |
