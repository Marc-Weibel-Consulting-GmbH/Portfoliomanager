# Phase 2 — Security & Governance

**Stand:** 15. August 2026  
**Status:** Technische Phase-2-Prüfung abgeschlossen. Bestätigte Expositionen sind minimal remediated; die verbleibenden transitive Abhängigkeits- und Lizenzbefunde sind als Release-Gates dokumentiert.

> Die folgenden Massnahmen ändern keine Portfolio-, Markt- oder Researchdaten. Sie begrenzen ausschliesslich unberechtigte Seiteneffekte und aktualisieren produktionsrelevante Bibliotheken.

## Verifizierte Remediations

| ID | Befund | Risiko vor Fix | Remediation | Nachweis |
|---|---|---|---|---|
| S2-01 | Öffentliche KI-Boom-Trigger | Beliebige anonyme Aufrufe konnten Snapshots, Perplexity-Fetches und 5-Jahres-Credit-Spread-Backfills starten. | Drei Mutationen auf `adminProcedure` umgestellt; zentrale Auth-Guard lehnt fehlende und Fallback-ID 1 ab. | 13 Auth- und KI-Boom-Routertests bestanden. |
| S2-02 | Market-Report-Webhook akzeptierte JWT-Secret | Ein zentraler Session-Signaturschlüssel durfte als Webhook-Schlüssel wirken. | Ausschliesslich `MARKET_REPORT_API_KEY`; fehlender Schlüssel arbeitet fail-closed. | Roter Regressionstest, anschliessend grün. |
| S2-03 | Drei Scheduled-Endpoints öffentlich | Öffentliche POSTs konnten Snapshot-Recompute/Löschung, Research-Refresh und Signalbenachrichtigungen auslösen. | `portfolioMetricsSnapshot`, `researchSignalsRefresh` und `signalAlerts` verlangen Cron-Authentisierung; interne Admin-Aufrufe nutzen nur einen in-memory-Marker nach bestehender Admin-Prüfung. Aktive Research- und Alert-Crons sind zusätzlich über persistierte Task-UID-Bindungen und atomare Mindestintervalle gesichert. | Nicht-cron-Handler-Tests, TypeScript und Build bestanden. |
| S2-04 | Kritische PDF- und XML-Parser-Abhängigkeiten | `jspdf` und transitiver `fast-xml-parser` hatten kritische Auditbefunde. | jsPDF 4.2.1, jsPDF-AutoTable 5.0.8, AWS S3 SDK und Presigner 3.1111.0. | TypeScript und Build grün; `pnpm audit --prod`: **0 kritisch**. |
| S2-06 | Globales Transaktions-Auditlog war öffentlich | Anonyme Aufrufer konnten 100 globale Änderungsprotokolle inklusive Ticker, Werten und Freitextkommentaren lesen; jeder angemeldete Nutzer konnte sie zudem löschen. | Die Legacy-Tabelle besitzt keine Nutzer- oder Portfolio-Fremdschlüssel; Lesen und Löschen sind deshalb ausschliesslich `adminProcedure`. | Roter Anonym-Test reproduzierte die reale Datenrückgabe; danach zwei Auth-Regressionstests grün. |
| S2-07 | TradingView-Analysebrücke öffentlich | Anonyme Aufrufer konnten externe Preis-, Analyse-, Scan-, Backtest-, Walk-Forward- und Multi-Agent-Aufrufe bis zu 180 Sekunden auslösen. | Alle 17 TradingView-Prozeduren verwenden nun `protectedProcedure`; die Prüfung passiert vor MCP-Initialisierung oder Upstream-Aufruf. | Zwei repräsentative anonyme Aufrufe (`status`, `stockScoring`) werden im Routertest fail-fast abgewiesen. |
| S2-08 | Produktionsstart loggte Secret-Metadaten | Ein beim Serverstart importiertes Diagnosemodul protokollierte für drei Schlüssel mehrfach Verfügbarkeit, Länge und siebenstellige Präfixe. | Der automatische Import und alle verzögerten Checks wurden entfernt. Die Diagnostik ist nur noch explizit abrufbar und gibt ausschliesslich boolesche Verfügbarkeit zurück. | Regressionstest prüft, dass weder Werte, Präfixe noch Längen serialisierbar sind. |
| S2-09 | Deterministische Tests hingen an externen Diensten | Der Perplexity-Healthcheck lief bereits bei vorhandenem Schlüssel; ein ungültiger ISIN-Test löste über den EODHD-Fallback eine echte Netzabfrage aus. | Perplexity ist nun wie alle Upstream-Checks nur mit `RUN_LIVE_INTEGRATION_TESTS=true` aktiv. Der ISIN-Resolver weist syntaktisch ungültige Werte vor Yahoo- oder EODHD-Aufrufen ab. | Perplexity ohne Opt-in übersprungen; der vorherige 15-s-Timeout-Test läuft mit Vorabvalidierung in Millisekunden grün. |
| S2-10 | Benchmark-Datenpflege nur mit Inline-Rollencheck | Eine administrative Schreiboperation verwendete einen individuellen Fehler statt des zentralen fail-fast-Guards. | `upsertBenchmarkData` nutzt nun `adminProcedure`. | Anonyme und reguläre Nutzer werden vor jeder DB-Operation mit `UNAUTHORIZED` beziehungsweise `FORBIDDEN` abgewiesen. |
| S2-11 | Öffentliche LLM- und Formularpfade | `dailyNews` konnte anonyme Kimi-Aufrufe starten; Newsletter und Kontakt hatten keine validierten Grenzen, der Kontaktpfad protokollierte PII. | Daily News erfordert eine Sitzung. Öffentliche Formulare validieren E-Mail, Längen und begrenzen pro IP auf drei Anfragen pro Stunde; PII-Log entfernt. | Auth- und Formularregressionstests grün. |

## Zugriffs- und Mandantenprüfung

Das zeilengenaue Inventar der öffentlichen Prozeduren liegt in `public-trpc-procedures-2026-08-15.txt`. Öffentliche Authentisierungs-, Markt- und Katalogdatenpfade sind beabsichtigt; kosten- oder zustandsintensive Ausnahmen wurden begrenzt. Die prüfbaren Portfolio-Transaktionspfade verwenden `getSavedPortfolioById(..., ctx.user.id)` oder gleichwertige Ownership-Prüfungen vor Lesen, Export, Update und Löschung. Der PDF-Import verifiziert die Portfolioeigentümerschaft vor dem Import. Das nicht mandantierbare globale Transaktionsauditlog ist bewusst administrativ.

## Abhängigkeitsstatus

Die gezielte Aktualisierung von tRPC, Axios, Drizzle ORM, Officeparser, Nanoid, Nodemailer, jsdom und Twilio sowie das Ersetzen von SheetJS durch ExcelJS reduziert den Produktionsaudit von **0 kritisch / 40 hoch / 34 moderat** auf **0 kritisch / 19 hoch / 9 moderat**. Die verbleibenden hohen Befunde liegen nun überwiegend transitiv unter ExcelJS (`minimatch`, `brace-expansion`, `tmp`), PptxGenJS (`image-size`), Recharts (`lodash`), Express 4 (`path-to-regexp`), Officeparser (`pdfjs-dist`) und ONNX Runtime (`adm-zip`). Sie werden nicht durch ein pauschales Major-Upgrade verändert; die vollständigen Vorher-/Nachherartefakte und Paketpfade liegen im Auditverzeichnis.

Die Lizenzinventur (`pnpm-licenses-prod-2026-08-15.json`) weist überwiegend permissive Kennzeichen aus. `numeric` und `buffers` sind über ihre offiziellen Repositories als MIT beziehungsweise MIT/X11 belegt. Für die beiden Builder-Entwicklungspakete gibt es eine plausible MIT-Quelle auf der offiziellen Monorepoebene, jedoch keine paketindividuelle Referenz. `vite-plugin-manus-runtime` bleibt als reine Entwicklungsabhängigkeit ohne veröffentlichte Primärlizenz **unklar**. Alle Einzelbefunde mit Primär-URLs stehen in `LICENSE_PRIMARY_SOURCE_NOTES_2026-08-15.md`.

## Deterministische Testbasis

Die vollständige lokale Suite besteht nun aus **152 bestandenen Testdateien und 1'301 bestandenen Tests**; elf bewusst externe oder charakterisierende Checks sind übersprungen. Sornette, TradingView, Upstash, Kimi und Perplexity führen echte Upstream-Healthchecks nur bei `RUN_LIVE_INTEGRATION_TESTS=true` aus. Die jeweiligen lokalen Client-, Fallback- und Vertragsprüfungen bleiben Bestandteil der deterministischen Suite. Produktionsbuild und TypeScript-Prüfung sind ebenfalls grün.

## Verbleibende Freigabe- und Prüfpflichten

| Thema | Nächster Schritt |
|---|---|
| Portfolio-Metrics-Heartbeat | Aktiv: `portfolio-metrics-snapshot-daily`, täglich 14:30 UTC, UID persistiert und auf `portfolioMetricsSnapshot` gebunden. Ein kontrollierter, autorisierter Handlerlauf antwortete mit HTTP 200, 95 Portfolios und 0 Fehlern; der reguläre erste Plattformlauf bleibt über die Heartbeat-Logs nachprüfbar. |
| Transitive High-Severity Dependencies | 19 verbleibende hohe Befunde nicht als grün freigeben; pro Paketpfad ein getestetes Upgrade oder eine formale Risikoakzeptanz beschliessen. |
| Lizenzfreigabe | Nur `vite-plugin-manus-runtime` ist ohne Primärlizenz unklar; als reine Entwicklungsabhängigkeit vor einem formalen kommerziellen Release mit dem Anbieter klären. |

Der aktive Portfolio-Metrics-Snapshot besitzt derzeit keinen Heartbeat-Task und wird ausschliesslich über bereits autorisierte Admin-/Dashboard-Pfade in-memory ausgelöst. Sobald ein eigener Heartbeat dafür registriert wird, muss seine UID als zusätzliche Bindung in `scheduled_task_bindings` hinterlegt werden; unbekannte Cron-UIDs erhalten keinen Seiteneffekt.

### Ergänzung: HTTP-Transporthärtung

Der Server entfernt das Express-Fingerprinting und setzt für jede Antwort `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, eine restriktive Referrer-Policy sowie deaktivierte Kamera-, Mikrofon- und Geolokalisierungsrechte. In Produktion sind zusätzlich HSTS und eine CSP aktiv: Skripte, Verbindungen und Formulare bleiben same-origin; Bilder dürfen nur von `https:`, `data:` und `blob:` stammen, um verifizierte Logo- und Bildpfade nicht zu brechen. Die Header sind über isolierte Tests abgesichert.
