# Phase 2 — Security & Governance

**Stand:** 15. August 2026  
**Status:** Kritische, bestätigte Expositionen behoben; vertiefte Mandanten-, Datenschutz- und High-Severity-Dependency-Prüfung bleibt offen.

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

## Zugriffs- und Mandantenprüfung

Die Suche nach öffentlichen tRPC-Mutationen findet nach S2-01 nur den zustandslosen Logout. Die geprüften risikoreichen Portfolio-Operationen `applyOptimization`, Portfolio-Snapshot und PDF-Import verifizieren vor Schreibzugriff die Eigentümerschaft. Die Analyse ist repräsentativ, aber noch kein vollständiger Nachweis für sämtliche Endpunkte und Tabellen.

## Abhängigkeitsstatus

Der Produktionsaudit reduziert sich von **3 kritischen / 49 hohen** auf **0 kritische / 40 hohe** Befunde. Die verbleibenden hohen und moderaten Befunde müssen nach tatsächlichem Produktpfad, Exploitbarkeit und Upgrade-Risiko einzeln priorisiert werden. Ein blindes Upgrade aller Pakete wäre nicht verantwortbar.

## Deterministische Testbasis

Die vollständige lokale Suite besteht nun aus **147 bestandenen Testdateien und 1'290 bestandenen Tests**; neun bewusst externe oder charakterisierende Checks sind übersprungen. Sornette, TradingView, Upstash und Kimi führen ihre echten Upstream-Healthchecks nur bei `RUN_LIVE_INTEGRATION_TESTS=true` aus. Die jeweiligen lokalen Client-, Fallback- und Vertragsprüfungen bleiben Bestandteil der deterministischen Suite. Damit blockiert eine externe Latenz nicht mehr die Prüfung von Projektcode.

## Verbleibende Freigabe- und Prüfpflichten

| Thema | Nächster Schritt |
|---|---|
| Scheduled-Endpunkte | Für einen künftig registrierten Portfolio-Metrics-Heartbeat zusätzlich eine persistierte Task-UID-Bindung anlegen; Research und Alerts sind bereits gebunden. |
| Mandantentrennung | Vollständige, testbare Matrix aller Portfolio-/Transaktions-/Dokumentendpunkte erstellen. |
| Datenschutz und Geheimnisse | Log-Retention, personenbezogene Felder, Export-/Löschpfade und entropiebasierten Git-Secret-Scan prüfen. |
| High-Severity Dependencies | 40 hohe Befunde auf direkte Nutzung und sichere Zielversionen prüfen. |
| HTTP-Härtung | Restriktive Content-Security-Policy erst nach Inventur aller legitimen Produktionsressourcen, Einbettungen und API-Ursprünge ergänzen. |

Der aktive Portfolio-Metrics-Snapshot besitzt derzeit keinen Heartbeat-Task und wird ausschliesslich über bereits autorisierte Admin-/Dashboard-Pfade in-memory ausgelöst. Sobald ein eigener Heartbeat dafür registriert wird, muss seine UID als zusätzliche Bindung in `scheduled_task_bindings` hinterlegt werden; unbekannte Cron-UIDs erhalten keinen Seiteneffekt.

### Ergänzung: HTTP-Transporthärtung

Der Server entfernt das Express-Fingerprinting und setzt für jede Antwort `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, eine restriktive Referrer-Policy sowie deaktivierte Kamera-, Mikrofon- und Geolokalisierungsrechte. In Produktion wird zusätzlich HSTS gesetzt. Die Header sind über zwei isolierte Tests abgesichert. Eine Content-Security-Policy wird erst nach einer vollständigen Inventur aller legitimen Skript-, Font-, Einbettungs- und API-Ursprünge ergänzt, damit die produktive Portfoliooberfläche nicht spekulativ eingeschränkt wird.
