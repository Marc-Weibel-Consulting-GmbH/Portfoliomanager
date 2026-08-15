# AUDIT_LOG — Portfoliomanager

**Audit-Branch:** `audit/phase-0-baseline`  
**Start:** 2026-08-13  
**Arbeitsmodus:** Befunde und Fix-Vorschläge werden je Phase vorgelegt. Implementierungen erfolgen erst nach ausdrücklicher Freigabe.

| ID | Phase | Titel | Status | Beleg / nächster Schritt |
|---|---:|---|---|---|
| P0-01 | 0 | Reproduzierbare technische Baseline | abgeschlossen | Installation, Build und TypeScript erfolgreich; vollständige Vitest-Suite mit 11 Fehlern in 3 Dateien. Siehe `PHASE_0_BASELINE.md`. |
| P0-02 | 0 | Architektur- und Modul-Inventur | abgeschlossen | 209 Client-, 442 Server- und 46 Drizzle-Quelldateien; Integrations- und Job-Inventur dokumentiert. |
| P0-03 | 0 | Secrets-Scan | abgeschlossen | Kein Treffer für die geprüften Schlüssel-Signaturen im Arbeitsbaum oder in der erreichbaren Historie; vertiefter Secret-Scanner bleibt Teil von Phase 5. |
| P0-04 | 0 | Dependency-, Lizenz- und Schwachstellen-Audit | abgeschlossen | `pnpm audit`: 114 Befunde, davon 3 kritisch; Lizenznachweise mit Unknown-/Unlicense-Einträgen. Keine Abhängigkeitsänderung vorgenommen. |
| P0-05 | 0 | Dokumentationsdrift | abgeschlossen | Keine eigenständige A3-Systemübersicht gefunden; PR-Status aus dem Auftragsdokument ist teilweise überholt. |
| P0-06 | 0 | Phase-1-Prüfplan | abgeschlossen | Modulreihenfolge, Prüfinvarianten und Beleganforderungen in `PHASE_0_BASELINE.md` festgehalten. |
| F1-01 | 1 | Einheiten- und Referenzfallvertrag | abgeschlossen | Kennzahlskalen, Vorzeichen, Datumsbasis und Sollformeln gegen zentrale Module und Referenzfälle abgeglichen. |
| F1-02 | 1 | Score-, Signal- und Regime-Pipeline | abgeschlossen | Blending, Abdeckung, Regime-Aliase und Risk Overlay gegen 43 zielgerichtete Tests und Referenzfälle geprüft. |
| F1-03 | 1 | Risiko und Performance | verifiziert | F1-01 target-aware Sortino und F1-02 transparente TTWROR umgesetzt. TTWROR-Ausreisser werden nicht verändert, sondern als Datenqualitätswarnung in der Portfolioansicht angezeigt. |
| F1-04 | 1 | Optimierung, Benchmarks und Kosten | abgeschlossen | HRP, Multi-Asset, Kosten- und Composite-Benchmark gegen 75 zielgerichtete Tests geprüft. |
| F1-05 | 1 | Punkt-in-Zeit und Look-Ahead | verifiziert | F1-03 umgesetzt: datumsgenaue Filings, Frist-Fallbacks und Quartalsberichte gelten erst nach dem Kalendertag als verfügbar; Rekonstruktion zensiert gegen den effektiven letzten Handelstag. |
| F1-06 | 1 | Befundbericht und Fix-Gates | abgeschlossen | `PHASE_1_FINDINGS.md` und `PHASE_1_REPORT.md` enthalten Ursache, Gegenprobe, Falsch-positiv-Check und Abnahmekriterium. |
| S1-01 | Screener | 20-Titel-Stichprobenvalidierung | verifiziert | 20 aktuell berechnete Aktien gegen externe Yahoo-Referenzwerte und eine offizielle BAC-Dividendenquelle geprüft. Kein materieller Berechnungsfehler nach vorab dokumentierten Schwellen bestätigt. |
| S1-02 | Screener | Wöchentliche Validierungsautomatisierung | aktiviert | Idempotenter Heartbeat-Handler, revisionssichere Lauf-/Befundtabellen und Wochen-Seed-Vertrag implementiert. Preflight `2026-W34`: 20 geprüft, 0 materiell, 12 partielle Verfügbarkeiten. Aktiver Task `4c2hvVQ9uK7YsLxRL4bQ34`, Montag 08:30 UTC. |
| D1-01 | Datenintegrität | Novo Nordisk Dividendenrendite | nicht reproduzierbar | Aktuelle Stammdaten, Signal-Cache und EODHD-Rohdaten stehen bei 3.92 %; offizielle und unabhängige Referenzen bestätigen rund 3.9 %. Kein aktueller 25-%-Wert und damit keine spekulative Datenmutation. |
| D1-02 | Datenintegrität | Screener-Berechnungen ausgeblendet | verifiziert behoben | Kein Datenverlust: 639 historische Berechnungen blieben erhalten. Ein fehlgeschlagener neuer Lauf #90002 verdrängte Lauf #60001 mit 331 Berechnungen in der Anzeige. UI-Fallback und transparente Warnung implementiert und gegen reale Laufdaten geprüft. |
| S2-01 | Security | Öffentliche KI-Boom-Trigger | verifiziert behoben | Drei seiteneffektbehaftete Mutationen sind nun fail-fast `adminProcedure`; anonyme und Fallback-ID-1-Aufrufe werden vor jedem Seiteneffekt abgewiesen. |
| S2-02 | Security | Market-Report-Webhook-Schlüsseltrennung | verifiziert behoben | JWT-Secret-Fallback entfernt; nur dedizierter `MARKET_REPORT_API_KEY`, sonst 401. |
| S2-03 | Security | Unautorisierte Scheduled-Endpoints | verifiziert | Drei öffentlich auslösbare Handler verlangen Cron-Identität. Aktive Research- und Alert-Tasks sind zusätzlich durch persistierte Task-UID-Bindung und atomare Mindestintervalle gegen unbekannte oder wiederholte Cron-Aufrufe geschützt. |
| S2-04 | Security | Kritische Produktabhängigkeiten | verifiziert behoben | jsPDF, AutoTable, AWS-S3-SDK und Presigner aktualisiert; Produktionsaudit von 3 kritischen auf 0 kritische Befunde reduziert. |
| T1-01 | Testqualität | Deterministische Gesamtsuite | verifiziert | 145 Testdateien und 1'289 Tests bestanden; zwei bewusst deaktivierte Charakterisierungstests sowie der optionale TradingView-Upstream-Healthcheck sind übersprungen. |
| T1-02 | Externe Integrationen | Sornette API | verifiziert | API-Vertrag auf `POST /v1/auth/login` und `accessToken` aktualisiert; Authentisierung, Confidence-Abruf und Bubble-Score bestehen gegen den Live-Dienst. |
| T1-03 | Externe Integrationen | TradingView MCP | extern gestört, Produktpfad nicht betroffen | Connector ist aktiviert, Initialize liefert upstream 502 „Application failed to respond“. Keine produktive Codeverwendung der URL gefunden; Live-Healthcheck ist nur mit `RUN_LIVE_INTEGRATION_TESTS=true` aktiv. |
| T1-04 | Testqualität | Deterministische Suite nach Security-Remediation | verifiziert | 147 Testdateien und 1'290 Tests bestehen. Sornette-, TradingView- und Upstash-Upstream-Healthchecks sind bewusst opt-in; lokale Verträge, Fallbacks und Clienttests bleiben verpflichtend. |

## Statusdefinitionen

`offen` → `in Prüfung` → `wartet auf dein OK` → `in Umsetzung` → `verifiziert` → `abgeschlossen`.

Ein Punkt wird erst mit reproduzierbarem Beleg, Gegenprobe und — sofern sichtbar — Browser-Verifikation als **verifiziert** markiert.

## Phase-0-Entscheidungspunkt

**Phase 0 wurde am 13. August 2026 ausdrücklich angenommen.** Phase 1 erstellt zunächst nur Befunde und Verifikationspläne; fachliche Fixes bleiben bis zu deiner separaten Freigabe gesperrt.
