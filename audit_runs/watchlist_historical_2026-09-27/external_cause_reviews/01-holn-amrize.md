# HOLN.SW — Prüfung der Amrize-Abspaltung 2025

## Entity Card

| Feld | Feststellung |
|---|---|
| Rechtlicher / gebräuchlicher Name | **Holcim Ltd**, Grafenauweg 10, 6300 Zug, Schweiz. |
| Primärinstrument | **HOLN**, Namenaktie, ISIN **CH0012214059**, an der **SIX Swiss Exchange**. `HOLN.SW` ist die übliche Datenanbieter-Kennung für diese SIX-Linie. |
| Listing-Status | Börsennotiert; Holcim bezeichnet die Referenznotierung als **SIX: HOLN**. |
| Geschäftsjahresende | **31. Dezember**. |
| Berichts- und Arbeitswährung | **CHF**; der Holcim-Geschäftsbericht berichtet die Konzernkennzahlen in CHF. |
| Branche | Baustoffe / Building Materials & Building Solutions. |
| Abspaltungsinstrument | **Amrize Ltd**, **AMRZ**, ISIN **CH1430134226**, dual gelistet an SIX und NYSE. |
| Entitätsabgrenzung | Die Prüfung betrifft die **SIX/CHF-Linie HOLN**. Für die Wertfortschreibung der abgespaltenen Beteiligung ist die korrespondierende **SIX/CHF-Linie AMRZ** die währungskongruente Referenz. |

**Entity-Card-Belege:** Holcim, [2025 Integrated Annual Report](https://www.holcim.com/sites/holcim/files/docs/27022026-finance-holcim-fy-2025-report-full-en.pdf) (SIX: HOLN, Sitz Zug, CHF-Berichtszahlen); Holcim, [AGM-Broschüre zur Amrize-Abspaltung](https://www.holcim.com/sites/holcim/files/docs/holcim-annual-general-meeting-2025-proposed-spin-off-of-amrize.pdf) (ISINs, Ticker und Börsen).

## Strukturierte Audit-Felder

| Feld | Feststellung |
|---|---|
| **id** | `01-holn-amrize` |
| **Ereignis** | 100%-Abspaltung des Nordamerika-Geschäfts als **Sachdividende** (*dividend-in-kind*) von Amrize-Aktien. |
| **Verteilungsverhältnis** | **1:1** — je **eine (1) AMRZ-Aktie** pro am Stichtag gehaltener HOLN-Aktie. |
| **Letzter Cum-Tag / Anspruchsstichtag** | Letzter Handelstag einschließlich Bezugsrecht und Eigentumsstichtag: **Freitag, 20. Juni 2025, Geschäftsschluss**. |
| **Ex- und Wirksamkeitsdatum** | **Montag, 23. Juni 2025**: erster Handelstag von HOLN ohne Amrize-Bezugsrecht, Wirksamkeit/Ausführung der Sachdividende und erster Handelstag von AMRZ an SIX und NYSE. Die AGM-Broschüre definiert den Ex-Tag als den ersten HOLN-Handelstag ohne Bezugsrecht; der ursprünglich darin noch indikative Zeitpunkt wurde durch die Vollzugsmeldung und SIX-Notierungsmitteilung realisiert. |
| **Relevante Handelswährung** | Für die geprüfte **HOLN.SW-/SIX-Linie: CHF**. Die werterhaltende Gegenposition **AMRZ an SIX handelt in CHF**; AMRZ an NYSE handelt dagegen in USD. Für die Schweizer Preisreihe daher **AMRZ-SIX/CHF**, nicht die NYSE/USD-Linie, verwenden. |
| **Beeinträchtigt ein HOLN-Preisverlauf ohne Dividende die Rendite?** | **Ja, wenn daraus die Rendite der vor dem Spin-off gehaltenen Gesamtposition abgeleitet wird.** Die ex-Tag-Bewegung von HOLN enthält den Abgang eines wirtschaftlich werthaltigen Unternehmensteils. Eine reine, unbereinigte HOLN-Schlusskursreihe schreibt diese ausgegebene AMRZ-Aktie nicht fort und erzeugt deshalb einen künstlichen negativen Sprung für die **Gesamtvermögensrendite**. **Nein**, wenn ausdrücklich nur die Kursrendite der nach dem 23. Juni 2025 verbleibenden, eigenständigen HOLN-Aktie gemessen wird; diese Kennzahl muss dann als *HOLN standalone, unadjusted* bezeichnet werden und ist nicht mit der Rendite der ursprünglichen HOLN-Position gleichzusetzen. |
| **Konfidenz** | **Hoch** für Verhältnis, Stichtag, Vollzug, Börsen und Währungen; **hoch mit dokumentierter Methodikgrenze** für eine eventuelle synthetische historische HOLN-Adjustierung, da kein amtlicher, frei zugänglicher ereignisspezifischer Parent-Adjustment-Faktor vorliegt. |
| **Empfohlene Maßnahme** | Keine Daten-/Codeänderung im Rahmen dieses Audits. Für eine spätere Implementierung: ab **23.06.2025** aus einer vor dem Spin-off gehaltenen HOLN-Position eine **1 HOLN + 1 AMRZ(SIX, CHF)**-Basket-Position machen; Rohkurse unverändert aufbewahren, die Rendite separat berechnen und die Zeitreihe mit `spin_off_amrize_2025` kennzeichnen. |

## Feststellungen und fachliche Behandlung

### 1. Verteilungsverhältnis und zeitliche Einordnung

Holcim vollzog die Abspaltung als Ausschüttung einer Sachdividende, nicht als Aktiensplit und nicht als Barausschüttung:

> „Holcim today completed its 100% spin-off of Amrize … through a **dividend-in-kind distribution of one (1) Amrize share for every outstanding Holcim share owned as of the close of business on 20 June 2025**.“ — Holcim, 23. Juni 2025, [Vollzugsmeldung](https://www.holcim.com/media/media-releases/holcim-completes-spin-off-of-north-america-business)

Der zugehörige 1:1-Anspruch und der Eigentumsstichtag sind damit **tatsächlich vollzogen**, nicht nur ein Vorschlag. Die vorangegangene Holcim-Mitteilung vom 2. Juni nennt gleichlautend „one Amrize share for every Holcim share“ und konkretisiert, dass die Aktionäre die HOLN-Aktien am Geschäftsschluss des **20. Juni 2025** besitzen mussten: [Holcim plant Abspaltung zum 23. Juni](https://www.holcim.com/media/media-releases/holcim-plans-amrize-spin-off-for-june-23).

Die Holcim-AGM-Broschüre definiert die Logik des Ex-Tags: Der **Cum-Dividend Date** ist der letzte Handelstag mit Anspruch, der **Ex-Dividend Date** der erste HOLN-Handelstag ohne Anspruch; an diesem Tag sollten AMRZ an SIX und NYSE erstmals handeln. Siehe [S. 8, „Indicative Timeline“](https://www.holcim.com/sites/holcim/files/docs/holcim-annual-general-meeting-2025-proposed-spin-off-of-amrize.pdf). Da der letzte Cum-Tag der Freitag, 20. Juni 2025 war und die Ausschüttung/Erstnotierung am Montag, 23. Juni 2025 erfolgte, ist **23. Juni 2025** das operative Ex- und Wirksamkeitsdatum.

**Konfidenz: hoch.** Die Broschüre war vor Vollzug indikativ; Datum und Ausführung werden jedoch durch die spätere Holcim-Vollzugsmeldung sowie die amtliche SIX-Notierungsmitteilung bestätigt.

### 2. Börse, Handelswährung und verwendbare Preislinie

SIX bestätigt den tatsächlichen Handelsbeginn am 23. Juni 2025 und die 1:1-Sachdividende:

> „Amrize shares commenced trading under the ticker symbol **‘AMRZ’** … on SIX Swiss Exchange … The 100% spin-off is completed via the distribution of a dividend-in-kind of **one Amrize share for every Holcim share** owned as of the close of business on 20 June 2025.“ — [SIX, 23. Juni 2025](https://www.six-group.com/en/newsroom/media-releases/2025/20250623-amrize-listing.html)

Für die Währungsabgrenzung sind die amtlichen SIX-Erstnotierungsdaten eindeutig: **AMRZ**, ISIN CH1430134226, erster Handelstag **23.06.2025**, erster Schlusskurs **CHF 39.31**. Quelle: [SIX IPO/First-listing data — Amrize](https://www.six-group.com/en/market-data/shares/ipo-history/2025/amrz.html). Ergänzend bestätigt die Amrize-IR-FAQ ausdrücklich: AMRZ handelt **in USD an der NYSE und in CHF an der SIX**: [Amrize FAQ](https://investors.amrize.com/resources/faq).

**Sichere Währungsregel:** Für `HOLN.SW` und die anzurechnende Abspaltungsaktie ausschließlich die **SIX-Schlusskurse in CHF** kombinieren. Wird ausnahmsweise AMRZ-NYSE verwendet, muss jeder USD-Wert mit einer fest definierten, zeitlich synchronisierten USD/CHF-Spotquelle in CHF überführt werden; ohne diese FX-Konvention dürfen NYSE- und SIX-Kurse nicht vermischt werden.

**Konfidenz: hoch.**

### 3. Konsequenz für eine Preisreihe ohne Dividendenanrechnung

Der Wirtschaftsgegenstand der gehaltenen Position änderte sich am 23. Juni:

- **bis einschließlich 20.06.2025:** 1 HOLN-Aktie mit dem Bezugsrecht auf Amrize;
- **ab 23.06.2025:** 1 HOLN-Aktie **plus 1 AMRZ-Aktie**.

Der beobachtete Preisrückgang der verbleibenden HOLN-Aktie ist folglich nicht vollständig ein Kursverlust des vorherigen Anlegervermögens. Es wurde ein handelbares Wertpapier geliefert. Ein Anbieterfeld wie `close`, `unadjusted_close` oder eine Preisreihe „ohne Dividenden“ darf daher **nicht** kommentarlos als Wertentwicklung der historischen HOLN-Position über den 20./23.-Juni-Sprung hinweg verwendet werden.

Die SIX-Indexregel bestätigt den wirtschaftlichen Charakter: Eine Abspaltung ist „generally treated as an extraordinary payment“. Ist das abgespaltene Unternehmen an derselben Börse/Region notiert, kommt die **Basket Method** zur Anwendung: Die Tochter wird mindestens bis zu ihrem ersten Handelstag dem gleichen Indexuniversum wie die Mutter zugeordnet. Quelle: [SIX Index Calculation and Corporate Actions Rulebook, Abschnitt 5.1.2.3 „Spin-off“](https://www.six-group.com/dam/download/market-data/indices/six-index-calc-and-corp-act-rulebook-en.pdf). Die für dieses Ereignis veröffentlichte SIX-Mitteilung kündigte genau diese Basket-Methode für Amrize/Holcim an: [SIX Index Message, 15. Mai 2025](https://www.six-group.com/dam/download/market-data/indices/index-messages/index-adjustments-spin-off-amrize-holcim.pdf).

**Einordnung:**

| Auswertung | Fachlich korrekte Behandlung | Was nicht zulässig ist |
|---|---|---|
| **Kursrendite: HOLN standalone** | Unbereinigte SIX-HOLN-Schlusskurse verwenden. Die Rendite misst nur die nach Abspaltung verbleibende Holcim-Aktie. Den 23.06. als Corporate Action markieren. | Die resultierende Zeitreihenrendite als Rendite eines Anlegers aus einer vor dem Event gehaltenen HOLN-Position ausgeben. |
| **Kursrendite: ökonomisch kontinuierliche Ursprungsholding / Spin-off-adjustierte Preisrendite** | Ab 23.06. eine CHF-Basket-Reihe **HOLN + AMRZ** führen. Die Sachdividende wird als erhaltenes Wertpapier abgebildet, nicht als Cash-Dividende. Dies entspricht der wirtschaftlichen Kontinuität und der SIX-Basket-Logik. | Einen bloßen HOLN-Kursverlauf als kontinuierliche Total- oder Holding-Performance behandeln. |
| **Brutto-Gesamtrendite (Gross Total Return)** | Dieselbe CHF-Basket-Position führen und **alle** nach dem jeweiligen Anspruchsdatum fälligen Barausschüttungen beider Titel brutto (vor Quellensteuer und vor individuellen Steuern) wiederanlegen bzw. als Wertzufluss erfassen. Die am 23.06. gelieferte AMRZ-Aktie ist bereits der Sachwertzufluss. | Die Amrize-Lieferung weglassen, als nicht vorhandene CHF-Barausschüttung buchen oder Nettoausschüttungen (nach Quellensteuer) als Brutto-Gesamtrendite bezeichnen. |

Die SIX-Regel trennt diese Konzepte ebenfalls: Brutto-Renditeindizes unterstellen volle Wiederanlage aller Ausschüttungen, während Preisrenditeindizes grundsätzlich keine Ausschüttungswiederanlage vornehmen; Aktienausschüttungen können wegen ihrer Form dennoch in einer Preisrendite-Basket-Reihe abgebildet werden. Quelle: [SIX Rulebook, Abschnitt 5.1.1.1](https://www.six-group.com/dam/download/market-data/indices/six-index-calc-and-corp-act-rulebook-en.pdf).

### 4. Sichere Implementierungsregel — ohne Daten-/Codeänderung

**Keine Änderung vorgenommen.** Die folgende Regel ist eine fachliche Vorgabe für eine spätere, kontrollierte Implementierung.

1. **Corporate-Action-Event anlegen:** `event_type = spin_off / dividend_in_kind`; `parent = HOLN.SW`; `child = AMRZ.SW`; `effective_date = 2025-06-23`; `last_cum_date = 2025-06-20`; `ratio = 1.0 AMRZ je 1.0 HOLN`; `currency = CHF`; `source = Holcim/SIX`.
2. **Rohkurse unverändert bewahren:** `HOLN`-Rohschlusskurse weder überschreiben noch den Preisrückgang als normale negative Tagesrendite klassifizieren.
3. **Holding-/Preis-Basket ab Ex-Tag:** Für jede am 20.06. gehaltene HOLN-Aktie am 23.06. exakt **eine AMRZ-SIX-Aktie in CHF** ergänzen. Für den Eventschritt lautet die nicht-dividendenbereinigte, aber corporate-action-kontinuierliche Preisrendite:

   \[
   R^{\mathrm{basket}}_{23.06.2025} = \frac{C^{CHF}_{HOLN,23.06.2025} + 1.0 \times C^{CHF}_{AMRZ,23.06.2025}}{C^{CHF}_{HOLN,20.06.2025}} - 1
   \]

   wobei \(C\) jeweils ein einheitlich definierter SIX-Schlusskurs ist. An Folgetagen bleibt der Bestand zunächst `1 HOLN + 1 AMRZ`; spätere Käufe/Verkäufe oder Rebalancings sind davon getrennt zu buchen.
4. **Brutto-Gesamtrendite:** Zusätzlich je Ausschüttung den **Bruttobetrag** (ohne Quellensteuerabzug) in die jeweilige Position reinvestieren. Für den Spin-off selbst wird keine fiktive Cash-Dividende angesetzt, weil der Zufluss als **1 AMRZ-Aktie** erfolgt.
5. **Ausgabe klar labeln:** Mindestens `HOLN standalone price return (unadjusted)`, `HOLN+AMRZ spin-off-adjusted price return` und `HOLN+AMRZ gross total return` getrennt ausweisen.

### 5. Explizite Datenlücke und Schutzregel

**Datenlücke:** In den geprüften frei zugänglichen offiziellen Holcim- und SIX-Unterlagen wurde **kein ereignisspezifischer numerischer Adjustierungsfaktor für eine rückwirkend bereinigte HOLN-Einzelkursreihe** veröffentlicht. SIX veröffentlicht zwar den ersten AMRZ-Schlusskurs von CHF 39.31, aber dieser erste Handelstag enthält bereits die Intraday-Kursentwicklung von AMRZ. Er ist daher **nicht automatisch** der amtliche Referenzwert für einen historischen Vendor-Back-Adjustment-Faktor.

**Schutzregel:** Keinen synthetischen `adjusted_close`-Faktor rückwirkend aus dem ersten AMRZ-Schlusskurs ableiten und keine vorliegende Datenreihe überschreiben. Bis ein lizenzierter Corporate-Action-Feed oder ein Anbieter mit dokumentiertem Adjustment-Faktor und Preiszeitpunkt vorliegt, ist die **explizite 1:1-HOLN+AMRZ-CHF-Basket-Reihe** die sichere, reproduzierbare Behandlung. Für die ausschließlich nach dem Event betrachtete HOLN-Standalone-Rendite bleibt die Rohkursreihe zulässig, aber mit Eventhinweis.

## Quellenprotokoll

| Quelle | Primärstatus | Zitat / Kernfakt | Konfidenz |
|---|---|---|---|
| Holcim, [Vollzugsmeldung, 23.06.2025](https://www.holcim.com/media/media-releases/holcim-completes-spin-off-of-north-america-business) | Emittentenquelle | Vollzug der 100%-Abspaltung; Sachdividende „one (1) Amrize share for every outstanding Holcim share“ für Bestand zum Geschäftsschluss 20.06.2025; Handelsbeginn AMRZ an SIX und NYSE. | Hoch |
| Holcim, [Planungsmitteilung, 02.06.2025](https://www.holcim.com/media/media-releases/holcim-plans-amrize-spin-off-for-june-23) | Emittentenquelle | 1:1-Verteilung, Stichtag 20.06.2025, erwarteter Handelsbeginn 23.06.2025; HOLN bleibt SIX-Ticker. | Hoch |
| Holcim, [AGM-Broschüre](https://www.holcim.com/sites/holcim/files/docs/holcim-annual-general-meeting-2025-proposed-spin-off-of-amrize.pdf) | Emittentenquelle | Definiert Cum- und Ex-Dividend Date; HOLN ISIN CH0012214059, AMRZ ISIN CH1430134226; AMRZ an SIX und NYSE. Zeitplan vor Vollzug als indikativ gekennzeichnet. | Hoch für Mechanik; Mittel allein für endgültiges Datum |
| SIX, [Amrize Lists on SIX, 23.06.2025](https://www.six-group.com/en/newsroom/media-releases/2025/20250623-amrize-listing.html) | Börsenquelle | Tatsächlicher SIX-Handelsbeginn, 1:1-Sachdividende, letztmaliger Anspruch per 20.06.2025. | Hoch |
| SIX, [First-listing data — AMRZ](https://www.six-group.com/en/market-data/shares/ipo-history/2025/amrz.html) | Börsenquelle | Erstnotierung 23.06.2025, ISIN CH1430134226, erster Schlusskurs CHF 39.31. | Hoch |
| SIX, [Index Calculation and Corporate Actions Rulebook](https://www.six-group.com/dam/download/market-data/indices/six-index-calc-and-corp-act-rulebook-en.pdf) und [Index Message zur Amrize-Abspaltung](https://www.six-group.com/dam/download/market-data/indices/index-messages/index-adjustments-spin-off-amrize-holcim.pdf) | Börsen-/Indexmethodik | Spin-off als außergewöhnliche Ausschüttung; Basket-Methode bei Notierung der Tochter an gleicher Börse/Region; für Amrize angekündigt. | Hoch für Methodik |
| Holcim, [2025 Integrated Annual Report](https://www.holcim.com/sites/holcim/files/docs/27022026-finance-holcim-fy-2025-report-full-en.pdf) | Emittentenquelle | Holcim Ltd, SIX: HOLN, Sitz Zug, CHF-Berichtswährung und 31.12.-Geschäftsjahresbezug. | Hoch |

## Prüfungsrahmen

- **Zeitbezug:** Historisches Ereignis im Jahr 2025; Audit-Stichtag **27. September 2026**.
- **Basis:** Preisrendite = Wertänderung ohne Wiederanlage regulärer Barausschüttungen; Brutto-Gesamtrendite = Wertentwicklung einschließlich Ausschüttungen vor Quellensteuer. Die Sachdividende wird durch die tatsächlich erhaltene AMRZ-Aktie abgebildet.
- **Annahmen:** Keine Transaktionskosten, keine individuelle steuerliche Behandlung und keine Intraday-Bewertung. Einheitlicher SIX-Schlusskurs in CHF, sofern die Basket-Rendite berechnet wird.
- **Keine Datenänderung:** Diese Prüfung hat weder Kurs-, Corporate-Action- noch Code-Daten verändert.

*Dies ist Research und Analyse, keine persönliche Finanzberatung.*
