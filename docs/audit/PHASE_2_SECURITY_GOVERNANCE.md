# Phase 2 — Security & Governance

**Stand:** 15. August 2026  
**Status:** Kritische, bestätigte Expositionen behoben; vertiefte Mandanten-, Datenschutz- und High-Severity-Dependency-Prüfung bleibt offen.

> Die folgenden Massnahmen ändern keine Portfolio-, Markt- oder Researchdaten. Sie begrenzen ausschliesslich unberechtigte Seiteneffekte und aktualisieren produktionsrelevante Bibliotheken.

## Verifizierte Remediations

| ID | Befund | Risiko vor Fix | Remediation | Nachweis |
|---|---|---|---|---|
| S2-01 | Öffentliche KI-Boom-Trigger | Beliebige anonyme Aufrufe konnten Snapshots, Perplexity-Fetches und 5-Jahres-Credit-Spread-Backfills starten. | Drei Mutationen auf `adminProcedure` umgestellt; zentrale Auth-Guard lehnt fehlende und Fallback-ID 1 ab. | 13 Auth- und KI-Boom-Routertests bestanden. |
| S2-02 | Market-Report-Webhook akzeptierte JWT-Secret | Ein zentraler Session-Signaturschlüssel durfte als Webhook-Schlüssel wirken. | Ausschliesslich `MARKET_REPORT_API_KEY`; fehlender Schlüssel arbeitet fail-closed. | Roter Regressionstest, anschliessend grün. |
| S2-03 | Drei Scheduled-Endpoints öffentlich | Öffentliche POSTs konnten Snapshot-Recompute/Löschung, Research-Refresh und Signalbenachrichtigungen auslösen. | `portfolioMetricsSnapshot`, `researchSignalsRefresh` und `signalAlerts` verlangen Cron-Authentisierung; interne Admin-Aufrufe nutzen nur einen in-memory-Marker nach bestehender Admin-Prüfung. | Drei nicht-cron-Handler-Tests bestanden. |
| S2-04 | Kritische PDF- und XML-Parser-Abhängigkeiten | `jspdf` und transitiver `fast-xml-parser` hatten kritische Auditbefunde. | jsPDF 4.2.1, jsPDF-AutoTable 5.0.8, AWS S3 SDK und Presigner 3.1111.0. | TypeScript und Build grün; `pnpm audit --prod`: **0 kritisch**. |

## Zugriffs- und Mandantenprüfung

Die Suche nach öffentlichen tRPC-Mutationen findet nach S2-01 nur den zustandslosen Logout. Die geprüften risikoreichen Portfolio-Operationen `applyOptimization`, Portfolio-Snapshot und PDF-Import verifizieren vor Schreibzugriff die Eigentümerschaft. Die Analyse ist repräsentativ, aber noch kein vollständiger Nachweis für sämtliche Endpunkte und Tabellen.

## Abhängigkeitsstatus

Der Produktionsaudit reduziert sich von **3 kritischen / 49 hohen** auf **0 kritische / 40 hohe** Befunde. Die verbleibenden hohen und moderaten Befunde müssen nach tatsächlichem Produktpfad, Exploitbarkeit und Upgrade-Risiko einzeln priorisiert werden. Ein blindes Upgrade aller Pakete wäre nicht verantwortbar.

## Deterministische Testbasis

Die vollständige lokale Suite besteht nun aus **147 bestandenen Testdateien und 1'290 bestandenen Tests**; neun bewusst externe oder charakterisierende Checks sind übersprungen. Sornette, TradingView und Upstash führen ihre echten Upstream-Healthchecks nur bei `RUN_LIVE_INTEGRATION_TESTS=true` aus. Die jeweiligen lokalen Client-, Fallback- und Vertragsprüfungen bleiben Bestandteil der deterministischen Suite. Damit blockiert eine externe Latenz nicht mehr die Prüfung von Projektcode.

## Verbleibende Freigabe- und Prüfpflichten

| Thema | Nächster Schritt |
|---|---|
| Scheduled-Endpunkte | Cron-Task-UID-Bindung und wiederverwendbare Idempotenz auch für die drei gehärteten Alt-Handler ergänzen. |
| Mandantentrennung | Vollständige, testbare Matrix aller Portfolio-/Transaktions-/Dokumentendpunkte erstellen. |
| Datenschutz und Geheimnisse | Log-Retention, personenbezogene Felder, Export-/Löschpfade und entropiebasierten Git-Secret-Scan prüfen. |
| High-Severity Dependencies | 40 hohe Befunde auf direkte Nutzung und sichere Zielversionen prüfen. |
| HTTP-Härtung | Security-Header und Webhook-Request-Limits gegen reale Einbettungs- und PDF-Importpfade testen. |
