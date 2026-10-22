# EODHD: Kostenoptimierung und Nutzungspotenzial

**Stichtag:** 22. Oktober 2026  
**Umfang:** aktuelle EODHD-All-in-One-Nutzung im Portfoliomanager, ohne Portfolio-, Cash-, Ledger-, Transaktions- oder Handelsmutation.

## Kurzfazit

Der Engpass ist **nicht** das Tageskontingent: Die sichere Live-Abfrage von `/api/user` zeigte am 22.10.2026 **6'736 von 100'000 API-Calls**. Das sind rund **6,7 %** der bezahlten Tageslimite. Zusätzliche Calls oder 500 WebSocket-Abonnements wären daher aktuell reine Mehrkosten.

Das All-in-One-Paket ist für die Produktanforderung grundsätzlich passend: Der Portfoliomanager nutzt gleichzeitig globale EOD-/Livekurse, Fundamentals, Splits, Dividenden, Screener und Real-Time-/WebSocket-Funktionen. Ein Wechsel auf nur ein günstigeres Einzelpaket würde wesentliche Datenklassen verlieren. Die **sicherste unmittelbare Abonnementersparnis** ist daher der Jahresplan, sofern die Bindung gewünscht ist: EODHD bewirbt zwei Gratis-Monate, also EUR 999.90 statt EUR 1'199.88 pro Jahr (effektiv rund EUR 83.33 statt EUR 99.99 monatlich, Ersparnis EUR 199.98 p.a.).

Der technische Haupthebel ist nicht die Menge der verfügbaren Calls, sondern die **Beseitigung doppelter Fundamental- und Quoteabrufe**. Damit werden Daten konsistenter, der Anbieter weniger belastet und der Datenfeed lässt sich gezielter für nützliche zusätzliche Prüfungen einsetzen.

## Verifizierter Status

| Punkt | Befund |
|---|---|
| Aktueller EODHD-Verbrauch | 6'736 / 100'000 Calls am 22.10.2026 (6,7 %) |
| Call-Kosten laut Anbieter | EOD, Splits, Dividenden, Live: 1; Intraday, Technical, News, Screener: 5; Fundamentals: 10; Bulk EOD: 100 |
| Universum in der Anwendung | 313 Titel, davon 312 aktiv (174 US/ohne Suffix, 55 SIX, 12 Xetra/DE, Rest auf weiteren Handelsplätzen) |
| Im Paket enthaltene WebSockets | 50 simultane Symbole; aktuell kein Grund für das im Dashboard angebotene, kostenpflichtige Upgrade auf 500 |
| Überlappende Preisjobs | `priceUpdater` täglich, `dailyRefreshCron` täglich und `watchlistAlertsCron` alle vier Stunden holen für teilweise identische Titel EODHD-Quotes |
| Überlappende Fundamentals-Jobs | `signalScoreRefresh` bezieht EODHD-Fundamentals täglich; `dailyRefreshCron` bezieht sie nochmals direkt; `signalCacheCron` bezieht sie über `qualityMetricsService` zusätzlich mit eigenem 6h-Cache |

Die Zahl 6'736 ist eine Tagesaufnahme, keine Hochrechnung für jeden Kalendertag. Manuelle Screenings, Detailseiten und Backfills können sie erhöhen. Die Codepfade belegen jedoch, dass die Architektur vermeidbare Abrufdopplungen besitzt.

## Warum ein Paketdowngrade derzeit nicht die richtige Optimierung ist

Die offiziellen EODHD-Pakete sind derzeit wie folgt ausgewiesen:

| Paket | Preis/Monat | Für die Anwendung relevante Lücke |
|---|---:|---|
| Historian (EOD Historical) | EUR 19.99 | Keine Fundamentals und keine Intraday-/Real-Time-WebSockets |
| Active Trader (EOD + Intraday) | EUR 29.99 | Keine Fundamentals |
| Equity Analyst (Fundamentals) | EUR 59.99 | Keine globalen EOD-/Livekurse und keine Splits/Dividenden |
| All-in-One | EUR 99.99 | Deckt die heute benötigten Datenklassen gemeinsam ab |

Theoretisch ergeben Active Trader + Fundamentals EUR 89.98 monatlich. Das ist **nicht** als sichere Ersparnis einzuplanen: EODHD dokumentiert die Pakete als getrennte Berechtigungen; es wäre zu klären, ob beide auf einer produktiven Key-/Abrechnungsstruktur bündelbar sind und ob die All-in-One-exklusiven Funktionen (z. B. Kalender, SEC-Filings, Insiderdaten, Makro/Zinsen) weiter benötigt werden. Die mögliche Differenz von EUR 10.01 pro Monat ist kleiner als der Betriebs- und Qualitätsverlust einer geteilten Datenbasis. Daher: **nicht downgraden, bevor EODHD dies schriftlich bestätigt und ein Staging-Test alle benötigten Endpunkte verifiziert.**

Der Bulk-Fundamentals-Endpunkt ist ebenfalls kein Gratishebel: EODHD verlangt dafür ausdrücklich ein zusätzliches **Extended Fundamentals**-Abo; All-in-One allein enthält es nicht. Der Preis wird nur auf Anfrage genannt. Er kann für sehr grosse, häufige US-Screenings wertvoll sein, ist aber bei 313 Titeln nicht die erste Massnahme.

## Konkrete technische Einsparungen ohne Informationsverlust

### 1. Eine zentrale Fundamentals-Snapshot-Schicht schaffen — höchste Priorität

Heute greifen drei Pfade auf denselben, teuren `/fundamentals/{ticker}`-Endpoint zu:

1. `signalScoreRefreshScheduled.ts` (täglich für alle Titel; Fundamentals kosten je 10 Calls),
2. `dailyRefreshCron.ts` über `multiApiDataMerger.ts` (direkter, nicht gemeinsamer Abruf),
3. `signalCacheCron.ts` über `qualityMetricsService.ts` (separater 6h-In-Memory-Cache).

**Zielbild:** Ein zentraler EODHD-Fundamentals-Adapter mit DB-Snapshot (`symbol`, `payloadVersion`, `fetchedAt`, `reportDate`, `source`, `validityStatus`), Request-Coalescing und klaren Frischefenstern. Der tägliche Kennzahlenrefresh schreibt einmal; Qualitäts-, Bewertungs-, Portfolio-, Detail- und Screenerpfade lesen danach denselben verifizierten Snapshot.

**Frischepolitik:**
- Fundamentals und Bilanz-/GuV-Daten: einmal täglich genügt; unmittelbar nach einem gemeldeten Earnings-Event zusätzlich refreshen.
- Kurs-/Timingdaten: separat aktualisieren; sie dürfen nicht einen kompletten Fundamentals-Abruf auslösen.
- Manuell geöffnete, noch nicht gespeicherte Titel: On-Demand-Abruf mit sichtbarem Zeitstempel.

**Nutzen:** Bei 313 Titeln kostet ein vollständiger Fundamentals-Pass rund 3'130 Calls. Jede vermiedene Doppelrunde spart ungefähr diese Größenordnung — ohne dass eine Kennzahl älter wird. Zusätzlich wird der Konflikt vermieden, dass Quality-/Scorefelder in unterschiedlichen Prozessen aus unterschiedlich frischen Vendorantworten stammen.

### 2. Die drei Quote-Aktualisierungspfade zusammenführen — höchste Priorität

Derzeit existieren parallel:

- `priceUpdater.ts`: täglicher Quote-Abruf für alle Titel,
- `dailyRefreshCron.ts`: EODHD-Fundamentals **und** Quote über den Legacy-Merger, danach nochmals ein EODHD-Quote,
- `watchlistAlertsCron.ts`: alle vier Stunden EODHD-Quotes der aktiven kuratierten Titel.

Der `dailyRefreshCron` zieht im Merger je Titel einen Fundamentals- und einen Quote-Request und holt danach nochmals einen Quote. Das sind bei rund 313 Titeln allein in diesem Pfad ungefähr **3'756 EODHD-Calls pro vollständigem Durchlauf** (313 × [10 Fundamentals + 2 Quotes]).

**Zielbild:**

- Ein einziger, splitbasiskompatibler Quote-Service mit dem heutigen 5-Minuten-Cache und einer pro Symbol laufenden Request-Coalescing-Sperre.
- EOD-Schlusskurse als tägliche Standardbasis für das Gesamtuniversum.
- Live-/verzögerte Quotes nur für: eigene Portfoliopositionen, die engere Alertliste und den gerade geöffneten Titel.
- Der Legacy-`dailyRefreshCron` darf weder eigene Fundamentals noch einen zweiten Quote ziehen, wenn der tägliche zentrale Snapshot bereits vorliegt.

Das verbessert gleichzeitig die Datenintegrität: Der bereits korrigierte Split-/YTD-Pfad bleibt auf einer einheitlichen EODHD-Handelslinie, statt mehrere konkurrierende Quotes in `stocks.currentPrice` zu schreiben.

### 3. Dividendenevents als Ereignisdaten cachen, Rendite aus aktuellem Preis neu rechnen — mittlere Priorität

Die TTM-Dividendenrendite ist korrekt auf datierte, splitbereinigte Dividendenereignisse umgestellt. Der aktuelle Refresh ruft die `/div/{ticker}`-Events aber regelmässig erneut ab.

**Zielbild:** Dividendenereignisse pro Titel persistent mit Abrufzeit speichern, wöchentlich oder bei Corporate-Action-/Ex-Dividenden-Hinweis aktualisieren. Der TTM-Cashbetrag wird aus dem Snapshot berechnet; nur die Division durch den aktuellen Preis erfolgt häufiger lokal.

Das erhält die fachlich korrekte TTM-Basis, senkt aber unnötige Eventabrufe. Bei ungeklärter Währung, Splitbasis oder Sonderdividende bleibt die bisherige Sperr-/Hinweislogik bestehen.

### 4. Bulk nur dort einsetzen, wo es mathematisch günstiger ist — niedrige Priorität

Ein normaler EOD-/Split-/Dividend-Request kostet je Titel 1 Call. Der EODHD-Bulk-Endpunkt kostet 100 Calls pro gesamter Börse und Tag.

- Für die 174 US-/plain-Titel kann ein vollständiger US-EOD-Bulkdownload nach sauberem Pilotversuch rund 74 Calls pro Handelstag sparen (100 statt ungefähr 174 Einzelaufrufe), benötigt aber Filterung, Tickersymbol-Mapping und einen Speicher-/Integritätstest.
- Für SIX (55) und kleinere Börsen ist der Bulkdownload teurer als Einzelabfragen.
- Für monatliche Corporate-Action-Audits sind Einzelabrufe ebenfalls günstiger: 313 Split- und Dividendabfragen kosten grob 626 Calls; Bulk über mehrere Börsen wäre bereits wegen der 100-Call-Pauschale je Börse meist teurer.

**Entscheid:** Kein Bulk-Refactoring als erster Schritt. Zuerst Fundamentals- und Quote-Doppelungen beseitigen.

### 5. Screener gezielt nutzen statt Volluniversum unnötig zu hydratisieren — mittlere Priorität

Der bestehende globale Screener macht bereits einen guten ersten Schritt: Der `/screener`-Endpoint kostet 5 Calls pro Seite und liefert Kandidaten vor der aufwendigen Detailanalyse.

Optimierung für den nächsten Ausbau:

1. Screenerfelder für den universumsweiten ersten Filter verwenden.
2. Stammdaten-/Primärlistingprüfung beibehalten; sie verhindert ADR-, OTC- und Zweitnotizfehler.
3. Vollständige Fundamentals nur für die engere Shortlist (z. B. Top 100 pro Lauf) abrufen.
4. Bei einem erneut geöffneten Screenerlauf vorhandene, frische Fundamentals-Snapshots wiederverwenden.
5. Ergebnis mit Snapshot-/Datenqualitätszeitstempel zeigen statt bei jeder Ansicht erneut zu hydratisieren.

Das schützt Datenqualität stärker als ein reines „mehr API-Aufrufe“-Modell und hält die Kosten auch bei einem künftig deutlich grösseren Universum beherrschbar.

## Das volle Potenzial sinnvoll ausschöpfen

Nicht jede verfügbare API verbessert eine Investmententscheidung. Diese Erweiterungen haben für den Portfoliomanager jedoch einen klaren, prüfbaren Mehrwert und können kontingentschonend auf eine kleine Relevanzliste begrenzt werden:

| EODHD-Funktion | Sinnvoller Einsatz im Tool | Abrufstrategie |
|---|---|---|
| Corporate Calendar | Earnings-/Ex-Dividenden-/Split-Risiko im Titel- und Momentum-Monitor; keine Scheingenauigkeit direkt vor Ereignissen | Täglich einmal, danach lokal nach gehaltenen/überwachten Titeln filtern |
| SEC Filings (US) | Quelle für die Prüfung strittiger Kennzahlen und Earnings-Überraschungen; nicht als unkritische Scorezahl | Nur bei US-Researchfällen oder gemeldeten Ereignissen |
| Insider Transactions (US) | Transparenter Sekundärindikator mit Datenstand und Mindestschwelle, nie alleiniger Kauf-/Verkaufsgrund | Nur für Portfolio und engere Watchlist, wöchentlich |
| News + Sentiment | Ereignis-Overlay für offene Detailseiten und wichtige Titel; nicht als täglicher Volluniversums-Score | Nur relevante Titel und nur seit letztem Abruf |
| Zinsen, Makro, Sovereign/Credit Risk | Nachvollziehbare Regimeindikatoren für defensiv/offensiv, ohne individuelle Aktienkennzahlen zu verfälschen | Täglich/wöchentlich je Datenklasse |
| 50 inkludierte WebSocket-Symbole | Realtime für aktuelle Positionen und hochpriorisierte Alerts | Eine Verbindung je Markt/Stream, gebündelte Symbole; keine kostenpflichtige 500er-Erweiterung |

Für alle neuen Datenklassen gilt: Quelle, Zeitstempel, Währung/Einheit, Adjustment und Datenlücken sichtbar halten. Anbieterwerte, insbesondere KGV/PEG und Corporate Actions, bleiben bei auffälligen Fällen gegen Emittenten-/Börsenquellen prüfbar und dürfen nicht blind eine Empfehlung erzeugen.

## Empfohlene Reihenfolge

1. **Abo sofort:** keine Extra-Calls und keine 500 WebSockets kaufen; bei gewünschter Vertragsbindung auf Jahreszahlung umstellen.
2. **Code-Phase A:** zentralen Fundamentals-Snapshot und Request-Coalescing implementieren; Legacy-Daily-Refresh so umbauen, dass er keine doppelten EODHD-Fundamentals/Quotes zieht. Vorher/nachher je Endpoint in einem Nutzungsprotokoll messen.
3. **Code-Phase B:** Dividendenevent-Snapshot und bedarfsorientierte Quote-Tiers einführen; 50 freie WebSockets nur für Portfolio/Alerts verwenden.
4. **Code-Phase C:** Corporate Calendar, Filing- und Insider-Overlay für Research Desk/Momentum-Monitor ergänzen. Zuerst read-only, datenqualitätsgeprüft und mit sichtbarer Quellenangabe.
5. **Erst dann:** einen US-EOD-Bulkpilot gegen die 174 US-Titel messen. Extended Fundamentals nur bei nachgewiesenem Nutzen und vorliegendem Preisangebot von EODHD evaluieren.

## Quellen

- EODHD, [Pricing plans](https://eodhd.com/pricing), abgerufen am 22.10.2026: Paketinhalt, Preise, tägliche Limite, 50 inkludierte WebSocket-Ticker.
- EODHD, [API limits](https://eodhd.com/financial-apis/api-limits), abgerufen am 22.10.2026: Call-Kosten je Endpoint und Resetlogik.
- EODHD, [Bulk API](https://eodhd.com/financial-apis/bulk-api-eod-splits-dividends), abgerufen am 22.10.2026: 100-Call-Pauschale je Börse/Tag und fehlender Kostenvorteil bei kleinen Symbolgruppen.
- EODHD, [Bulk Fundamentals API](https://eodhd.com/financial-apis/bulk-fundamentals-api-via-extended-fundamentals-plan), abgerufen am 22.10.2026: Extended-Fundamentals-Erfordernis, nicht in All-in-One enthalten.
- EODHD, [WebSockets](https://eodhd.com/financial-apis/new-real-time-data-api-websockets), abgerufen am 22.10.2026: 50 simultane Symbolabonnements pro API-Key, nicht pro Verbindung.
- Interne lesende Prüfung von `/api/user` am 22.10.2026 sowie Codeinventur der beschriebenen Refreshpfade.

*Diese Analyse beschreibt Datenarchitektur und Research-Werkzeuge, keine persönliche Anlageberatung und keine Handelsanweisung.*
