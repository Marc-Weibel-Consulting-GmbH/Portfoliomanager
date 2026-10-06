# Entity Card – Palantir Technologies Inc.

- **Unternehmen:** Palantir Technologies Inc.
- **Primärnotierung:** `PLTR`, Nasdaq, USD (interne EODHD-Schreibweise: `PLTR.US`)
- **ISIN:** `US69608A1088`
- **Anteilsklasse:** Class A Common Stock
- **Geschäftsjahresende:** 31. Dezember
- **Sektor:** Technology / Software
- **Prüffrage:** Herleitung des robusten historischen EPS-Ratenmittels von 17,7 %, Abgrenzung gegenüber aktuellem und erwarteten Gewinnwachstum sowie Ursache der fehlenden Timing-/Signalzahl.
- **Abgrenzung:** Historisch berichtete EPS-Wachstumsraten, TTM-Wachstum und Analystenschätzungen werden getrennt geprüft. Keine Portfolio-, Cash-, Ledger-, Transaktions- oder Handelsänderung.

## Read-only Evidenz (Abruf 06.10.2026)

EODHD Fundamentals für `PLTR.US` meldet `PERatio`/`TrailingPE` **163,2759x**, `ForwardPE` **85,4701x**, `PEGRatio` **1,8461**, TTM-EPS **USD 1,16**, EPS-Schätzung aktuelles Jahr **USD 1,6201** und nächstes Jahr **USD 2,3442**. Die implizite Steigerung der zwei EODHD-Schätzjahre beträgt **44,6948 %**. Der vollständige, tokenfreie Rohbeleg liegt in `PLTR_US_RAW_EVIDENCE_2026-10-06.json`.

Die offizielle Palantir-Q2-Mitteilung vom 03.08.2026 nennt für Q2 ein GAAP-EPS von **USD 0,41**, +93 % Umsatzwachstum und für das Gesamtjahr 2026 eine Umsatz-Guidance von USD 8,150–8,158 Mrd.; sie veröffentlicht dort jedoch **keine** eigene Jahres-EPS-Prognose. Eine Aussage über mehr als 100 % Gewinnwachstum ist daher entweder ein zeitbezogener Quartalsvergleich (EODHD: +215,4 % Q2 EPS YoY) oder eine externe Konsensschätzung; sie darf nicht unbeschriftet als nachhaltiger Mehrjahres-PEG-Nenner verwendet werden.

**Quellen:** [Palantir Q2 2026 Earnings Release](https://investors.palantir.com/news-details/2026/Palantir-Reports-Q2-2026-U-S--Comm-Revenue-Growth-of-149-YY-and-Revenue-Growth-of-93-YY-Raises-FY-2026-Revenue-Guidance-to-82-YY-Growth-and-U-S--Comm-Revenue-Guidance-to-134-YY-Crushing-Consensus-Expectations/), [Palantir Q2 2026 Letter](https://www.palantir.com/q2-2026-letter/en/), EODHD-Rohantwort (lokaler Auditbeleg).

## Bestätigte Ursachen und Korrektur

1. Das historische robuste EPS-Ratenmittel von **17,7 %** ist keine Prognose für 2026/2027. Die aktuelle EODHD-Schätzung beträgt **44,6948 %** (EPS 1,6201 → 2,3442); sie wird separat als **Analystenschätzung** ausgewiesen und beim Vendor-PEG-Vergleich mit dem Forward-KGV gepaart. Historische Wachstumsraten bleiben strikt auf höchstens 35 % begrenzt, eine plausible, klar markierte Schätzung kann bis 60 % reichen. Dadurch wird weder ein Einmaleffekt stillschweigend akzeptiert noch der Zukunftsrahmen des Vendor-PEGs durch eine vergangenheitsbezogene Rate verfälscht.
2. `PLTR.US` ist die syntaktische EODHD-Detailroute, während der zentrale Score-Snapshot unter der internen Stammzeile `PLTR` lag. Die Auflösung erkennt jetzt ausschliesslich dieses `.US`-Suffixpaar; sie mischt keine Börsen-, ADR- oder Anteilsklassen-Ticker. Damit wird das vorhandene Timing wieder angezeigt.
3. Auch mit der frame-konsistenten PEG-Prüfung bleibt ein hoher absoluter Bewertungsanker sichtbar: TTM-KGV ca. 163x, Forward-KGV ca. 85x und geringe FCF-Rendite. Der Bewertungswächter begrenzt daher ein sonst höheres Qualitäts-/Timing-Signal auf HOLD, statt den Titel wegen eines niedrigen PEGs unkritisch als Kauf zu markieren.

4. Die Anzeige erhielt zusätzlich eine universumsweite Frischeabsicherung: Vorberechnete Signale aus dem Zwei-Stunden-Lauf sind nur 2 Stunden 45 Minuten gültig. Bei fehlender qualifizierter Kursreihe schreibt der Lauf einen expliziten Datenlücken-Satz ohne Timing oder Signal und kann dadurch kein altes BUY/SELL weiterzeigen. Das betrifft nicht die Palantir-Logik selbst, verhindert aber dieselbe Fehlerklasse in der gesamten Watchlist.
