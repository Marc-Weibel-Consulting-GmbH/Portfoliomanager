# CHDVD.SW — Ausschüttungs- und Renditeprüfung

**Prüfstatus:** abgeschlossen, rein dokumentarisch; **keine Code- oder Datenänderungen vorgenommen.**  
**Analysefenster:** 15.09.2021 bis 25.09.2026 (beide Stichtage eingeschlossen)  
**Datenabzug / Referenz:** iShares-/BlackRock-Seite mit NAV per 25.09.2026 und Performance-/Ausschüttungsdaten, abgerufen am 28.09.2026.

## 1. Entity Card

| Feld | Aufgelöste Entität |
|---|---|
| Rechtlicher / gebräuchlicher Name | **iShares Swiss Dividend ETF (CH)** |
| Geprüfte Handelslinie | **CHDVD** an der **SIX Swiss Exchange**, Angebots-/Handelswährung **CHF** |
| Eindeutiger Primärschlüssel | **ISIN CH0237935637**; Valor **23793563**; Bloomberg **CHDVD SW**; RIC **CHDVD.S** |
| `CHDVD.SW` | Vendor-Symbol für die SIX-Linie; `.SW` ist kein eigener Fonds / keine zweite Anteilsklasse |
| Anteilsklasse / Ertragsverwendung | Swiss Franc, **ausschüttend** |
| Domizil / Auflegung | Schweiz; 28.04.2014 |
| Basiswährung | CHF |
| Referenzindex | **SPI Select Dividend 20 Total Return** |
| Fondsstruktur | physisch replizierend; TER 0,15 %; Geschäftsjahresende 31. Mai |
| Ausschüttungsfrequenz laut Emittent | **Ad-Hoc** (nicht als monatlich, quartalsweise oder jährlich zu codieren) |

**Entity-Urteil:** Der korrekte Bestand für eine SIX-CHF-Kursreihe ist `ISIN=CH0237935637`, `exchange=SIX Swiss Exchange/XSWX`, `symbol=CHDVD`, `currency=CHF`. Eine Abfrage nur mit `CHDVD` ohne ISIN/Handelsplatz ist als Identifikator nicht hinreichend robust.

## 2. Primärquellen und belegte Sachverhalte

| Primärquelle | Belegter Sachverhalt | Verwendung im Audit |
|---|---|---|
| [iShares Produktseite](https://www.ishares.com/ch/individual/en/products/264108/ishares-swiss-dividend-ch-fund) | ISIN, CHF-Basiswährung, ausschüttend, **Distribution Frequency: Ad-Hoc**, Benchmark, tägliche historische NAV- und Performance-Reihen. Die Seite definiert die angezeigte Performance als NAV-basiert, **mit reinvestiertem Bruttoertrag, soweit anwendbar**, und weist auf die Abweichung zum Börsenmarktpreis hin. | Hauptquelle für NAV-/Gesamtrendite-Methodik und Endpunkte |
| [iShares Ausschüttungstabelle (JSON)](https://www.ishares.com/ch/individual/en/products/264108/ishares-swiss-dividend-ch-fund/1495092304799.ajax?tab=distributions&fileType=json&subtab=table) | Record Date, Ex-Date, Payable Date und Bruttoausschüttung je Anteil; vollständige Ereignisliste für den Fonds bis 2014. | Primärbeleg für die unten aufgeführten 35 Cash-Events |
| [iShares Factsheet, August 2026 (DE, PDF)](https://www.ishares.com/ch/individual/en/literature/fact-sheet/chdvd-ishares-swiss-dividend-etf-ch-fund-fact-sheet-de-ch.pdf) | Handelsinformationen: **Börse SIX Swiss Exchange, Ticker CHDVD, Angebotswährung CHF**, ISIN/Valor/RIC/Bloomberg; ausschüttende CHF-Anteilsklasse; Ad-Hoc-Frequenz; Performance-Hinweis (NIW/NAV, Bruttoertrag reinvestiert). | Cross-Check der exakten Handelslinie und Methodik |
| [BlackRock Produktseite](https://www.blackrock.com/ch/professionals/en/products/264108/ishares-swiss-dividend-ch-fund) | Gleiche Fonds-Stammdaten und NAV-/Total-Return-Definition; NAV per 25.09.2026 CHF 188,10 (seitengenau angezeigt: 188,1014 in der historischen NAV-Reihe). | Unabhängiger Emittenten-Cross-Check |
| [SIX ETF Explorer — ISIN CH0237935637, CHF-Linie](https://www.six-group.com/en/market-data/etf/etf-explorer/etf-detail.CH0237935637CHF4.html) | SIX-Primärreferenz für das ETF-Instrument und dessen Fondsdetailseite. | Börsen-Primärquelle; öffentliche Seitenausgabe liefert in diesem Abruf jedoch **keine exportierbare historische Schlusskursreihe**. |

> **Wichtige Quellenabgrenzung:** iShares/BlackRock liefert die offizielle **NAV-Performance**, nicht notwendigerweise die Rendite eines Anlegers zum SIX-Börsenkurs. SIX ist die Referenz für die börsengehandelte CHF-Linie. Für eine tatsächlich ausgeführte Anlegerperformance kommen Spread, Gebühren, Steuern und der individuelle Handelszeitpunkt zusätzlich hinzu.

## 3. Ausschüttungen im Prüfzeitraum

### Ergebnis zur Frequenz

- **Formale Frequenz:** `Ad-Hoc` laut iShares/BlackRock.
- **Empirisch im vollen Kalenderjahr 2022–2026:** jeweils **sieben** Ausschüttungen, gehäuft März–Mai sowie im Juli. Das ist ein beobachtetes Muster, **keine** zulässige Regel „siebenmal jährlich“.
- Zwischen **15.09.2021 und 31.12.2021** weist die offizielle Tabelle keine Ex- oder Zahlungstermine aus. Das erste im Fenster liegende Event ist der 08.03.2022.
- Insgesamt liegen im Fenster **35 Ausschüttungsevents** mit zusammen **CHF 29,0800 je Anteil** vor. Dieser Betrag ist die arithmetische Summe der vom Emittenten ausgewiesenen Bruttoausschüttungen; er ist **nicht** als Rendite zu interpretieren.

### Offizielle Cash-Events

Alle Beträge in CHF je Fondsanteil. Die Daten entsprechen der Reihenfolge **Record Date / Ex-Date / Payable Date / Total Distribution** der offiziellen iShares-Tabelle.

| Jahr | Record Date | Ex-Date | Payable Date | Ausschüttung CHF |
|---:|---|---|---|---:|
| 2022 | 09.03.2022 | 08.03.2022 | 10.03.2022 | 0,9800 |
| 2022 | 18.03.2022 | 17.03.2022 | 21.03.2022 | 0,4400 |
| 2022 | 29.03.2022 | 28.03.2022 | 30.03.2022 | 0,6200 |
| 2022 | 11.04.2022 | 08.04.2022 | 12.04.2022 | 1,3200 |
| 2022 | 12.04.2022 | 11.04.2022 | 13.04.2022 | 0,5600 |
| 2022 | 17.05.2022 | 18.05.2022 | 20.05.2022 | 0,5400 |
| 2022 | 18.07.2022 | 19.07.2022 | 21.07.2022 | 0,4800 |
| **2022 Summe** |  |  |  | **4,9400** |
| 2023 | 08.03.2023 | 09.03.2023 | 13.03.2023 | 0,6600 |
| 2023 | 15.03.2023 | 16.03.2023 | 20.03.2023 | 0,6600 |
| 2023 | 29.03.2023 | 30.03.2023 | 03.04.2023 | 0,6800 |
| 2023 | 11.04.2023 | 12.04.2023 | 14.04.2023 | 1,1400 |
| 2023 | 21.04.2023 | 24.04.2023 | 26.04.2023 | 0,8400 |
| 2023 | 10.05.2023 | 11.05.2023 | 15.05.2023 | 0,5800 |
| 2023 | 17.07.2023 | 18.07.2023 | 20.07.2023 | 0,6600 |
| **2023 Summe** |  |  |  | **5,2200** |
| 2024 | 06.03.2024 | 07.03.2024 | 11.03.2024 | 0,7400 |
| 2024 | 13.03.2024 | 14.03.2024 | 18.03.2024 | 0,8600 |
| 2024 | 15.04.2024 | 12.04.2024 | 16.04.2024 | 1,7000 |
| 2024 | 17.04.2024 | 16.04.2024 | 18.04.2024 | 0,8800 |
| 2024 | 23.04.2024 | 22.04.2024 | 24.04.2024 | 0,9000 |
| 2024 | 20.05.2024 | 17.05.2024 | 21.05.2024 | 0,6200 |
| 2024 | 17.07.2024 | 16.07.2024 | 18.07.2024 | 0,4200 |
| **2024 Summe** |  |  |  | **6,1200** |
| 2025 | 12.03.2025 | 11.03.2025 | 13.03.2025 | 0,8200 |
| 2025 | 28.03.2025 | 27.03.2025 | 31.03.2025 | 0,9000 |
| 2025 | 14.04.2025 | 11.04.2025 | 15.04.2025 | 1,5800 |
| 2025 | 16.04.2025 | 15.04.2025 | 17.04.2025 | 0,7600 |
| 2025 | 23.04.2025 | 22.04.2025 | 24.04.2025 | 0,8800 |
| 2025 | 19.05.2025 | 16.05.2025 | 20.05.2025 | 0,5800 |
| 2025 | 16.07.2025 | 15.07.2025 | 17.07.2025 | 0,7400 |
| **2025 Summe** |  |  |  | **6,2600** |
| 2026 | 11.03.2026 | 10.03.2026 | 12.03.2026 | 0,7800 |
| 2026 | 13.03.2026 | 12.03.2026 | 16.03.2026 | 0,8000 |
| 2026 | 13.04.2026 | 10.04.2026 | 14.04.2026 | 1,7400 |
| 2026 | 15.04.2026 | 14.04.2026 | 16.04.2026 | 0,9200 |
| 2026 | 21.04.2026 | 20.04.2026 | 22.04.2026 | 1,0400 |
| 2026 | 12.05.2026 | 11.05.2026 | 13.05.2026 | 0,5000 |
| 2026 | 22.07.2026 | 21.07.2026 | 23.07.2026 | 0,7600 |
| **2026 Summe bis 25.09.2026** |  |  |  | **6,5400** |
| **Fenstersumme** |  |  |  | **29,0800** |

## 4. Historische Rendite: richtige Reihenbasis und Rechenbefund

### 4.1 Offizieller NAV-Total-Return (richtige Basis für Fonds-Gesamtrendite)

Die iShares-Produktseite beschreibt die Performance ausdrücklich als **NAV-basiert mit reinvestiertem Bruttoertrag** („gross income reinvested where applicable“). Das ist die geeignete offizielle Gesamtrenditebasis für den Fonds, aber nicht identisch mit einer auf SIX-Ausführungskursen basierenden Anlegerperformance.

| Kennzahl | Wert | Rechenweg / Einordnung |
|---|---:|---|
| Startwert der offiziellen Performance-/Wealth-Reihe, 15.09.2021 | 20.117,5143 | iShares `performanceData` (Wachstum einer hypothetischen CHF-10.000-Anlage) |
| Letzter nativer Wert dieser Reihe, 24.09.2026 | 28.688,8954 | iShares `performanceData` |
| Offizielle kumulierte NAV-Gesamtrendite 15.09.2021–24.09.2026 | **42,6066 %** | `28.688,8954 / 20.117,5143 − 1` |
| Offizieller täglicher NAV, 24.09.2026 / 25.09.2026 | 187,8279 / 188,1014 CHF | iShares `navData` |
| Abgeleitete NAV-Gesamtrendite bis zum verlangten Enddatum 25.09.2026 | **42,8142 %** | 24.09-Total-Return-Wert × `188,1014 / 187,8279`; am 25.09. lag kein Ausschüttungsevent vor |
| Annualisiert über 1.836 Kalendertage (5,0267 Jahre) | **7,3470 % p.a.** | `(1 + 0,428142)^(1 / 5,026694) − 1` |

**Einordnung der Enddatum-Brücke:** Der Emittent veröffentlichte im abgerufenen Seitenquelltext eine Total-Return-/Wealth-Reihe nur bis 24.09.2026, aber eine NAV-Reihe bis 25.09.2026. Die 25.09.-Zahl ist deshalb eine **reproduzierbare Ein-Tages-Ableitung** aus zwei offiziellen Reihen, keine separat vom Emittenten ausgewiesene 25.09.-Total-Return-Beobachtung. Für eine kanonische Produktionshistorie ist die frisch gelieferte vollständige Total-Return-/Adjusted-Close-Reihe vorzuziehen.

### 4.2 Was eine unadjustierte Reihe zeigt — und was fehlt

| Kennzahl | Wert | Aussage |
|---|---:|---|
| Roher Fonds-NAV 15.09.2021 | 157,9301 CHF | **Nicht** um Cash-Ausschüttungen bereinigt |
| Roher Fonds-NAV 25.09.2026 | 188,1014 CHF | **Nicht** gleich SIX-Schlusskurs, aber derselbe Cash-Ausschüttungsfehler gilt für einen unadjustierten Börsenkurs |
| Veränderung roher NAV | **19,1042 %** / **3,5392 % p.a.** | `188,1014 / 157,9301 − 1`; keine Gesamtrendite |
| Unterschied zum oben hergeleiteten NAV-Total-Return | **23,7100 Prozentpunkte** | Veranschaulicht, warum eine nur rohe Reihe für die Renditefrage unzureichend ist |

**Klarstellung:** Ja — **Cash-Ausschüttungen fehlen in einer reinen Close-/Kursreihe** und auch in einer bloßen NAV-Level-Reihe. Am Ex-Tag wird der Anspruch auf die Ausschüttung vom Fondsanteil getrennt; ein Preis-/NAV-Vergleich allein behandelt diesen Cashflow ökonomisch wie einen Verlust. Marktbewegungen können den mechanischen Abschlag am selben Tag überdecken; daher darf der beobachtete Tageskursrückgang nicht als einziger Dividendennachweis verwendet werden.

## 5. Entscheidung: Adjusted Close/Event-Gesamtrenditereihe erforderlich?

**Ja — zwingend für jede Aussage „historische Rendite“ oder für einen Vergleich gegen den als Total Return geführten Benchmark.**

- **Nicht ausreichend:** unadjustierter SIX-Schlusskurs, unadjustierter NAV oder eine Kursreihe unbekannter Adjustierungslogik.
- **Ausreichend:**
  1. eine eindeutig als **Adjusted Close / Total Return** bezeichnete CHF-Reihe derselben SIX-Handelslinie, deren Dividendenadjustierung dokumentiert ist; **oder**
  2. die offizielle iShares/BlackRock-NAV-Performance-/Wealth-Reihe mit reinvestiertem Bruttoertrag (für Fonds-NAV-Performance); **oder**
  3. eine aus unadjustierten SIX-CHF-Schlusskursen und der offiziellen iShares-Eventtabelle konstruierte Event-Gesamtrenditereihe.
- **Nicht doppelt adjustieren:** Wenn ein Datenlieferant sein Feld nachweislich bereits „adjusted close“/„total return“ nennt und dessen Corporate-Action-Policy Dividenden umfasst, dürfen die CHF-Events aus Abschnitt 3 nicht noch einmal aufaddiert werden.

## 6. Sichere Implementierungsregel / Datenlücke

### Sichere Implementierungsregel

1. **Instrument fixieren:** Nur `CH0237935637` / `CHDVD` / `XSWX` / `CHF` verwenden. Kein Mapping allein über `CHDVD.SW` ohne ISIN.
2. **Rendite-Modus explizit machen:**
   - Für Fondsvergleich: `iShares NAV total return, gross income reinvested`.
   - Für tatsächlichen Börsenhandel: `SIX CHF adjusted close total return`; bei fehlender fertiger Adjustierung Eventreihe verwenden.
3. **Eventkonstruktion bei rohem Close:** Für jeden Handelstag mit Ex-Date `e` einen Reinvestitionsindex nach

   `TR_t = TR_(t-1) × (Close_t + Distribution_e) / Close_(t-1)`

   bilden. `Distribution_e` ist die in Abschnitt 3 genannte CHF-Ausschüttung pro Anteil; bei mehreren Events am selben Ex-Tag summieren. Liegt der Ex-Tag nicht in der Börsenreihe, den ersten verfügbaren SIX-Handelstag am oder nach dem Ex-Tag verwenden und diesen Fallback protokollieren.
4. **Stichtagsregel:** Start- und Endlevel am jeweiligen verfügbaren Schlusskurs/NAV des Stichtags verwenden; bei Nicht-Handelstag den vorherigen verfügbaren Handelstag wählen und die Substitution ausweisen. Im vorliegenden Fall sind 15.09.2021 und 25.09.2026 in der iShares-NAV-Reihe vorhanden.
5. **Nicht vergleichen oder vermischen:** Ein SIX-Marktpreis darf nicht mit dem iShares-NAV in einem Return-Quotienten gemischt werden. Gebühren, bid/ask spread, Steuern und individuelle Quellensteuer sind nicht Teil der hier dokumentierten Brutto-NAV-Gesamtrendite.

### Datenlücke

Die öffentliche SIX-ETF-Explorer-Seite ist als Primärreferenz der Handelslinie belegt, stellte im Abruf aber keine exportierbare historische **tägliche SIX-Schlusskurs- oder Adjusted-Close-Zeitreihe** bereit. Daher ist im Audit **keine verifizierte SIX-Marktpreisrendite** für 15.09.2021–25.09.2026 ausgewiesen. Die oben genannte **42,8142-%-Zahl ist NAV-Gesamtrendite**, nicht eine SIX-Schlusskursrendite.

**Vor einer Produktionseinbindung nachzuliefern:** lizenzierte oder anderweitig autorisierte SIX-CHF-Daily-Close-Reihe plus eindeutige Corporate-Action-/Adjusted-Close-Definition — oder die iShares-NAV-Total-Return-Reihe bis exakt 25.09.2026. Bis dahin die 25.09.-Ein-Tages-Brücke nur als Auditbefund, nicht als gespeicherte kanonische Historie verwenden.

## 7. Konfidenz und Abschlussurteil

| Gegenstand | Konfidenz | Begründung |
|---|---|---|
| Entity / exakte CHF-SIX-Handelslinie | **Hoch** | iShares-Factsheet und iShares-/BlackRock-Produktdaten nennen übereinstimmend ISIN, SIX, CHDVD und CHF. |
| Ausschüttungsstatus und Frequenz `Ad-Hoc` | **Hoch** | Direkt aus iShares/BlackRock Key Facts. |
| 35 Cash-Events und Beträge im Prüfzeitraum | **Hoch** | Direkte offizielle iShares-Eventtabelle mit Record-, Ex- und Zahlungstagen. |
| Roh-NAV-Endpunkte | **Hoch** | Offizielle tägliche iShares-NAV-Reihe. |
| NAV-Gesamtrendite bis 24.09.2026 | **Hoch** | Direkte offizielle iShares-Wealth-/Performance-Reihe, Bruttoertrag reinvestiert. |
| NAV-Gesamtrendite bis exakt 25.09.2026 | **Mittel-hoch** | Deterministische Ein-Tages-Brücke mit offiziellen NAVs; keine native TR-Beobachtung für den 25.09. in der abgerufenen Reihe. |
| SIX-Marktpreis-Gesamtrendite | **Nicht feststellbar** | Historische, adjustierte SIX-Close-Reihe war öffentlich nicht aus der Explorer-Ausgabe extrahierbar. |

**Schlussfolgerung:** `CHDVD.SW` ist die CHF-SIX-Handelslinie des ausschüttenden iShares Swiss Dividend ETF (CH), ISIN `CH0237935637`. Der Fonds schüttet **ad hoc** aus; im Prüfzeitraum sind 35 offizielle Cash-Events dokumentiert. Eine reine Kurs- oder NAV-Level-Reihe unterschätzt die Anleger-/Fonds-Gesamtrendite, weil die Cash-Ausschüttungen fehlen. Für Renditeberechnungen ist deshalb eine verifizierte **Adjusted-Close-/Event-Total-Return-Reihe** erforderlich; als fondsseitige Referenz ist die iShares-NAV-Performance mit reinvestiertem Bruttoertrag geeignet. Die dokumentierte NAV-Gesamtrendite beträgt bis 25.09.2026 abgeleitet **42,8142 %** bzw. **7,3470 % p.a.**; sie darf nicht als SIX-Marktpreisrendite etikettiert werden.

**Basis / Zeit / Annahmen:** Brutto-NAV-Total-Return mit Wiederanlage gemäß iShares; Zeitraum 15.09.2021–25.09.2026; die 25.09.-Total-Return-Endzahl verwendet die offen gelegte NAV-Tagesbrücke. Keine persönliche Steuer, Transaktionskosten oder Spreadannahme.  
**Quellen & Compliance:** Primär iShares/BlackRock und SIX, URLs oben. Dies ist Research und Analyse, keine persönliche Anlageberatung.
