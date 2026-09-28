# Globales Audit historischer Watchlist-Daten und Signalbasis

**Stichtag:** 28. September 2026  
**Umfang:** Aktives Aktien-/Watchlist-Universum, historische Kurs- und FX-Reihen, Corporate-Action-Semantik, Kernsignale  
**Status:** Implementierte Datenintegritätskorrekturen und erneuerte Signalbasis  

> **Entscheidungsregel:** Rohkurs, splitbereinigte Kursreihe und Brutto-Gesamtrendite sind drei unterschiedliche Reihen. Sie dürfen weder miteinander vermischt noch aus einer Ausschüttungsrendite geschätzt werden.

## 1. Fragestellung und Auditumfang

Nach dem Abgleich der Mami-Arbeitsmappe wurde untersucht, ob die dabei entdeckten historischen Datenprobleme systematisch im gesamten Watchlist-Bestand auftreten und welche Erkenntnisse sicher universumsweit angewendet werden können.

| Bereich | Prüfumfang | Ergebnis |
|---|---:|---|
| Aktives Universum | 268 instrumentierte Titel (267 aktiv kuratiert) | vollständig inventarisiert |
| Rohkurse | 516'188 Zeilen | EODHD-primäre Rohkursbasis beibehalten |
| Splitbereinigte Preisreihen | 29'105 Zeilen | separat, nie in Rohkurse zurückgeschrieben |
| Brutto-Gesamtrenditereihen | 80'953 Zeilen | separat, teilweise Datenlücken offen ausgewiesen |
| Externe Stichprobe | 25 repräsentative Titel × 5 Stichtage = 125 Vergleiche | Rohkurs, Adjusted Close und Identität getrennt verglichen |
| Corporate-Action-Review | u. a. HOLN/Amrize, ABTC, CHDVD | keine erfundenen Anpassungen; Fälle in den entsprechenden Reihen als Datenlücke bzw. geprüfte Eventreihe behandelt |

## 2. Belegte Befunde

### 2.1 Rohkursbasis

Der EODHD-Rohkursvergleich ergab in der 25-Titel-Stichprobe **113 Übereinstimmungen, 11 Abweichungen und einen kalenderbedingten Vortrag**. Die fünf betroffenen Handelslinien sind **D05.SI (5)**, **NVDA (3)**, **NOVO-B.CO (2)** und **GOOGL (1)**; für **KAP.IL** lag an einem Stichtag kein Handel vor. Diese Zeilen wurden nicht pauschal überschrieben: Der Rohkurs ist die historische Tatsachenreihe, während eine abweichende Provider- oder Corporate-Action-Semantik getrennt zu behandeln ist.

### 2.2 Adjusted Close ist keine universelle Wahrheit

EODHD- und Yahoo-adjusted-close-Reihen weichen für mehrere Titel voneinander ab. Ein Anbieterwert darf daher nicht als allgemeine Dividenden- oder Splitwahrheit in eine andere Quellenbasis eingemischt werden. Die Anwendung verwendet jetzt strikt getrennte Basen:

| Kennzahl / Verwendung | Zulässige Reihe | Ausschlüsse |
|---|---|---|
| Technisches Timing | geprüfte **splitbereinigte** Kursreihe; sonst intakte Rohkursreihe | keine Dividendenreinvestition, keine Quellmischung |
| Kursrendite / Volatilität / Drawdown | homogene splitbereinigte Kursreihe | keine Brutto-Gesamtrendite |
| Brutto-Gesamtrendite / Sharpe | homogene Adjusted-/Event-Gesamtrenditereihe | keine Schätzung aus aktueller Dividendenrendite |
| Tatsächliche Ausschüttungen | explizite Dividendenevents je Handelslinie und Währung | keine USD-/NOK- oder GBp-/GBP-Vermischung |

Die Inventur weist für **184 Titel** noch keine getrennte Brutto-Gesamtrenditereihe aus. Das ist eine sichtbare Datenlücke – keine künstlich konstruierte Gesamtrendite.

### 2.3 Corporate Actions

- **HOLN.SW / Amrize:** Die Abspaltung wurde als wirtschaftlich relevante Kapitalmaßnahme identifiziert. Ohne die vollständige, verifizierte Komponentenreihe wird kein künstlicher Total Return erzeugt.
- **ABTC.SW:** Corporate-Action- und Providerabweichungen bleiben getrennt dokumentiert; keine rückwirkende Rohkursänderung.
- **CHDVD.SW:** Ausschüttungen können nur über geprüfte Eventdaten in eine Brutto-Gesamtrenditereihe einfließen; sie dürfen nicht mit einer Preisrendite verwechselt werden.
- **Ungeklärte Rohkurssprünge ab ±50 %:** Ein technisches Timing-Signal wird neu blockiert, wenn keine homogene splitbereinigte Reihe verfügbar ist. Damit kann ein Split, Reverse Split, Spin-off oder Vendorfehler nicht als Momentum ausgegeben werden.

### 2.4 FX-Faktorfehler

Drei echte Datenbankausreißer wurden belegt und bereinigt:

| Paar / Datum | Ursprünglich | Korrektur | Behandlung |
|---|---:|---:|---|
| NOKCHF · 04.11.2022 | 0.000957 | 0.097200 | exakter EODHD-Tageswert |
| JPYCHF · 12.07.2026 | 0.498300 | entfernt | Sonntag, kein offizieller EOD-Schluss; der letzte geprüfte Handelstag wird genutzt |
| DKKCHF · 12.07.2026 | 12.340000 | entfernt | Sonntag, kein offizieller EOD-Schluss; der letzte geprüfte Handelstag wird genutzt |

Neu gelten breite, währungspaarspezifische Plausibilitätsgrenzen sowohl beim täglichen Abruf als auch beim historischen Backfill und beim zentralen Lookup. Ungültige Werte werden nie wieder in die CHF-Berechnung übernommen. **EODHD ist Primärquelle** für tägliche FX-Raten; Yahoo dient ausschließlich als technisch gekennzeichneter Fallback.

## 3. Universumsweite Umsetzung

1. **EODHD-Fundamentals werden geschützt:** Der Alert-Job darf nur noch einen sekundären Marktpreis abrufen; er überschreibt nie wieder KGV, PEG, Dividendenrendite oder 52-Wochen-Werte aus dem EODHD-Fundamentalpfad.
2. **Corporate-Action-Guard:** Die stündliche Signalberechnung verwendet, sofern verfügbar, eine einzelne geprüfte splitbereinigte Preisquelle. Ohne diese wird eine Rohkursreihe nur bei fehlendem extremen mechanischen Sprung akzeptiert.
3. **Transparente Signal-Sperre:** Ein Titel ohne valide Qualitäts-, Bewertungs- oder Timingbasis erhält keinen Kauf-/Verkaufsscore. Statt einer scheinbaren Präzision steht in der Watchlist über die Datenampel die konkrete Ursache `Signalgate`.
4. **Score-Neuberechnung:** Der vollständige aktive Bestand wurde neu gerechnet und dann in die Watchlist projiziert: **203 freigegeben**, **64 bewusst gesperrt**. Verteilung der freigegebenen Signalzustände: **81 Kaufen**, **107 Halten**, **15 Verkaufen**.
5. **Keine Handelswirkung:** Es wurden keine Orders, Käufe/Verkäufe, Cash-, Ledger- oder Portfolio-Transaktionen ausgelöst.

## 4. Verbleibende, sichtbar zu behandelnde Datenlücken

| Lücke | Umgang im Produkt | Nächster sichere Schritt |
|---|---|---|
| Fehlende Brutto-Gesamtrenditereihe | Gesamtrendite/Sharpe nicht erfinden | EODHD-Adjusted Close gegen Dividendenevents und Corporate-Action-Quelle pro Titel ergänzen |
| Späte Erstnotierung | 5J-Kennzahlen klar als nicht verfügbar | keine Proxyreihe ohne identische Handelslinie verwenden |
| ISIN-/Proxy-Altimporte | keine automatische Empfehlung | kanonischen Ticker und Handelslinie identifizieren |
| Corporate Actions ohne vollständige Komponentenwerte | Timing und Total Return sperren/kennzeichnen | offizielle Emittenten-/Börsenunterlagen mit Wertverhältnis dokumentieren |

## 5. Validierung

- Fokussierte Datenqualitätsregressionen: **32 Tests bestanden**.
- Vollständige Suite: **253 Testdateien bestanden, 5 übersprungen; 1'732 Tests bestanden, 11 übersprungen**.
- TypeScript: fehlerfrei.
- `git diff --check`: fehlerfrei.
- Dev-Livecheck: Watchlist lädt mit aktualisierten Signalsäulen; gesperrte Titel sind mit einer gelben Datenampel und begründetem `Signalgate` markiert.

## 6. Belegartefakte

- [Watchlist-Inventar](../../audit_runs/watchlist_historical_2026-09-27/watchlist_historical_inventory_2026-09-27.json)
- [Externe 25-Titel-Preisparität](../../audit_runs/mami_historical_2026-09-27/external_price_parity_2026-09-28.json)
- [Identitäts- und Corporate-Action-Stichprobe](../../audit_runs/mami_historical_2026-09-27/external_title_identity_corporate_actions_2026-09-28.json)
- [FX-Reparaturprotokoll](../../audit_runs/watchlist_historical_2026-09-27/fx_outlier_repair_2026-09-28.json)

> **Hinweis:** Dies ist Research und Datenintegritätsanalyse, keine persönliche Anlageberatung.
