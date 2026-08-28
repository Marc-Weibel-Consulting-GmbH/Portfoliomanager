# AI Capital Cycle Watchlist Dashboard — Worklog

**Datum:** 28. August 2026  
**Autor:** Manus AI  
**Status:** Shadow-Mode-Research-Overlay ausgeliefert; OOS-Gate weiterhin geschlossen.

## Zweck und Abgrenzung

Das Dashboard bringt die **kuratierte Watchlist** mit zwei bereits vorhandenen Evidenzsträngen zusammen: dem globalen AI-Capital-Cycle-Monitoring und der ticker-spezifischen SEC-Shadow-Evidenz des Research Desk. Es ist bewusst ein **read-time berechnetes Overlay**. Daher war keine neue Tabelle, Migration oder zusätzliche Hintergrundroutine erforderlich.

> Der Abgleich ist Research-Unterstützung. Er verändert weder Score, Signal, Alert, Portfolio, Transaktion noch Handel.

Die globale Monitoringquelle wird niemals als issuer-spezifische Primärquelle dargestellt. Ihre Abrufzeit wird separat vom in der Quellenangabe enthaltenen Datenzeitraum ausgewiesen. SEC-Evidenz wird nur dann als Einzelevidenz angezeigt, wenn sie tatsächlich im vorhandenen Shadow-Ledger für denselben Ticker liegt.

| Bereich | Umsetzung | Nicht umgesetzt |
|---|---|---|
| Watchlist-Abgleich | Reine, deterministische Ableitung bei jedem Admin-Read | Keine Watchlist-, Signal- oder Score-Mutation |
| Monitoring | Letzter persistierter Dynamic-Metrics-Cache, je Schlüssel nur der neueste Wert | Keine stille Verwendung der statischen KI-Boom-Fallbacks |
| SEC-Beleg | Vorhandene Shadow-Evidenz pro Ticker, inklusive URL, Vollständigkeit und Checker-Status | Keine Behauptung einer SEC-Abdeckung ausserhalb des Piloten |
| Handlung | Ausschliesslich «Manuell prüfen» oder «Keine Handlung» | Keine Kauf-, Verkaufs-, Reduktions- oder Umschichtungsanweisung |
| Laufbetrieb | Bestehende tägliche Metric-/Research-Desk-Aktualisierung wird weiterverwendet | Kein neuer Timer, Webhook oder aktiviertes Feature-Flag |

## Datenvertrag und Ableitungslogik

Die reine Funktion `buildAiCapitalCycleAssessment` führt die Klassifikation ohne Datenbank- oder Seiteneffekte durch. Sie verwendet eine kleine, explizite Rollenkarte statt einer unsicheren sektor- oder namensbasierten KI-Zuordnung. Erfasst sind insbesondere die Hyperscaler MSFT, GOOGL/GOOG, META, AMZN und ORCL als Kapitalinvestoren sowie NVDA, AVGO, AMD, TSM, ASML, AMAT, LRCX, MU, VRT und ANET als Infrastrukturzulieferer. CEG und VST sind als Energie-Infrastruktur vorab zugeordnet. Nicht zugeordnete Watchlist-Titel erscheinen nicht als künstliche KI-These in der fokussierten Tabelle.

| Bedingung | Monitoringstatus | Manueller Hinweis | Entscheidungsimpact |
|---|---|---|---|
| Keine explizite Rollenkarte | `nicht_relevant` | `keine_handlung` | `none` |
| Für die Rolle erforderliche Monitoringmetrik fehlt oder ist älter als 36 Stunden | `daten_pruefen` | `keine_handlung` | `none` |
| Erforderliche Metrik liegt im frischen Cache vor | `beobachten` | `manuell_pruefen` | `none` |

Für Kapitalinvestoren werden `hyperscaler_capex_yoy` und `tech_ig_spread_bps` benötigt. Infrastruktur- und Energie-Infrastrukturrollen benötigen `hyperscaler_capex_yoy`. Eine SEC-Evidenz wird unabhängig davon als `bestaetigt`, `ausstehend`, `unvollstaendig` oder `nicht_im_sec_pilot` geführt. Auch eine bestätigte Evidenz führt nie zu einer Systemaktion.

## Reale Datenlage bei der Verifikation

Die Abfragen wurden am 28. August 2026 gegen die produktiv eingebundene Projektdatenbank durchgeführt. Die Werte sind Beobachtungsnachweise des Systems, keine Aussagen über die künftige Wertentwicklung.

| Nachweis | Ergebnis |
|---|---:|
| Kuratierte Watchlist-Titel | 264 |
| Vorab zugeordnete Capital-Cycle-Titel im Dashboard | 17 |
| Frische Dynamic-Metric-Schlüssel | 12 |
| Dynamic-Metric-Zeilen innerhalb der 36-Stunden-Grenze | 19 |
| Letzter Dynamic-Metric-Cache-Abruf | 28.08.2026, 10:11 Uhr |
| Evidenzen nach manuellem Shadow-Run | 30 |
| Letzter SEC-Shadow-Abruf | 28.08.2026, 10:04 Uhr |
| Evidenzen mit `isShadowMode=1` und `decisionImpact='none'` | 30 |
| Evidenzen ausserhalb dieser Governance-Invariante | 0 |

Der im Rahmen der Live-Prüfung gestartete bestehende Shadow-Run erfasste 13 Evidenzen aus fünf angefragten Quellen. Die Benutzeroberfläche bestätigte dabei ausdrücklich «keine Score- oder Handelswirkung». Er ergänzte ausschliesslich den vorhandenen Research-Desk-Evidenzbestand.

## Benutzeroberfläche und Bediengrenzen

Die neue Sektion ist unter **Admin → Research Desk** integriert. Sie zeigt den Abrufzeitpunkt des globalen Caches, die Anzahl der zugeordneten Titel sowie die Anzahl der manuellen Prüfhweise und Datenprüfungen. Die Quellenliste ist einklappbar. Pro Titel werden Rolle, Monitoringstatus, Cache-Frische, SEC-Status, Watchlist-Datenstatus und alle tatsächlich verwendeten Quellen angezeigt. SEC-Originale bleiben als externe Links zugänglich.

Die bereits bestehende Maker-Checker-Tabelle und ihr manueller Shadow-Run bleiben erhalten. Die bestehenden Checker-Schaltflächen wurden während der Release-Prüfung nicht automatisiert betätigt, weil sie einen menschlichen Prüfstatus in realer Evidenz verändern würden. Nach einer echten menschlichen Checker-Aktion invalidiert die Seite jedoch sowohl die Evidenz- als auch die Overlayabfrage.

Für einen Hinweis mit `manuell_pruefen` kann der Admin nun **«Entwurf vormerken»** wählen. Ein Bestätigungsdialog erklärt vor der Vormerkung ausdrücklich, dass der Entwurf nur lokal in der aktuellen Browser-Sitzung liegt, weder gespeichert noch geteilt wird und keine Transaktion, Score-, Signal-, Alert- oder Portfolioänderung auslöst. Der Entwurf kann anschliessend über **«Entwurf verwerfen»** rückstandslos entfernt werden. Dies bietet einen manuellen Übernahme-/Ablehnungsschritt, ohne eine verdeckte Ausführungsfunktion einzuführen.

## Verifikation

| Prüfung | Ergebnis |
|---|---|
| TDD: Rollenklassifikation, Quellenbindung und Entscheidungsimpact | bestanden |
| TDD: Stale-Cache führt zu `daten_pruefen` und `keine_handlung` | bestanden |
| TDD: Unklassifizierter Titel erzeugt keine KI-These | bestanden |
| TDD: Quellen-Deduplizierung und unvollständige Evidenz | bestanden |
| Adminschutz des neuen Read-Endpunkts | anonymer Aufruf wird mit `UNAUTHORIZED` abgewehrt |
| TypeScript | `pnpm exec tsc --noEmit` bestanden |
| Vollständige Regression | 1'469 Tests bestanden, 11 bewusst übersprungen |
| Live-Desktopprüfung | Seite, Zahlen, Quellen-Details, Shadow-Run und keine Browser-Konsolenfehler bestätigt |
| Live-Mobilprüfung | Kopfbereich, Shadow-Run und responsive Karten bestätigt; Tabelle bleibt horizontal scrollbar statt Inhalte zu verlieren |
| Lokaler Prüfentwurf | Dialog, positive Bestätigung, sichtbare lokale Vormerkung und anschliessendes Verwerfen für GOOG live bestätigt; keine Datenbank- oder Anlageaktion ausgelöst |

In den Entwicklungslogs auftretende `QualityMetrics`-Timeouts für externe Kursanbieter wurden beobachtet. Sie sind ein vorbestehender, separater Datenabrufpfad und verursachten keinen TypeScript-, Test-, Browser- oder Dashboardfehler dieses Releases.

## OOS-Gate und nächste zulässige Weiterentwicklung

Das Feature-Flag für jede spätere Score-, Signal-, Alert- oder Handelswirkung bleibt deaktiviert. Vor einer solchen Wirkung müssen mindestens vollständige punkt-in-zeitfähige Quartalsdaten für Kapitalproduktivität, Monetarisierung, Free Cashflow und Finanzierung vorliegen. Anschliessend ist ein präregistrierter Baseline-gegen-Overlay-OOS-Test mit Kosten, robusten Regime-/Parametersensitivitäten und ohne Verschlechterung von Drawdown oder Turnover erforderlich. Die in der vorherigen Research-Bewertung festgelegte Mindestbedingung bleibt ein robuster Netto-ΔSharpe von mindestens +0,1.[1]

## Referenzen

[1]: [Brügger-Invest-Serie: KI-Infrastruktur, Kapital und Macht — Implikationen](./BRUEGGER_AI_CAPITAL_SERIES_IMPLICATIONS_2026-08-25.md)  
[2]: [`server/lib/aiCapitalCycleWatchlist.ts`](../../server/lib/aiCapitalCycleWatchlist.ts) — reine Ableitungslogik und Frischevertrag  
[3]: [`server/routers/researchDeskRouter.ts`](../../server/routers/researchDeskRouter.ts) — administrativer Read-Only-Vertrag  
[4]: [`client/src/pages/AdminResearchDesk.tsx`](../../client/src/pages/AdminResearchDesk.tsx) — integrierte Shadow-Mode-Oberfläche  
[5]: [`server/lib/researchDeskService.ts`](../../server/lib/researchDeskService.ts) — bestehender SEC-Shadow-Collector
