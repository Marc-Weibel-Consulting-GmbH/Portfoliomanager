# ABTC.SW — Corporate-Action- und Sprungtage-Review

**Prüfintervall:** 15.09.2021–25.09.2026 (einschließlich)  
**Erstellt:** 28.09.2026  
**Prüfobjekt:** ausschließlich die exakte Schweizer CHF-Handelslinie, die im Projekt als `ABTC.SW` geführt wird.  
**Datenänderungen:** Keine. Die Prüfung verwendete nur lesende Abfragen und Abrufe.

## 1. Entity Card (zuerst erstellt)

| Feld | Verifizierter Befund |
|---|---|
| Exakte Handelslinie | `ABTC.SW` = 21shares Bitcoin ETP, **SIX Swiss Exchange, CHF-Linie** (`ABTCCHF` in der Emittenten-Nomenklatur) |
| Instrument / rechtliche Natur | Physisch mit Bitcoin besicherte, nicht verzinsliche, offene **Schuldverschreibung (Debt Security / ETP)**; keine Aktie, kein Fondsanteil |
| ISIN / Valor / WKN | **CH0454664001** / **45466400** / **A2T64E** |
| Emittentin | **21Shares AG**, Schweiz, LEI 254900UWHMJRRODS3Z64 |
| Basiswert und Basiswährung | Bitcoin (BTC); die Produkt-/Settlement-Währung ist USD. Dies ist von der geprüften **CHF-Handelslinie** zu unterscheiden. |
| Börsenstatus | Die Final Terms nennen SIX als Börse und die Erstnotierung am 25.02.2019; das Factsheet vom 30.08.2026 führt ABTCCHF an SIX weiterhin als CHF-Linie. |
| Ausschüttungsstatus | `Distribution: Not applicable`; das ETP ist kein Dividendentitel. |
| Identitätsrisiko | Der Ticker `ABTC` existiert auf mehreren Handelsplätzen und in mehreren Währungen. Preis- und Corporate-Action-Zuordnung darf daher nur über **ISIN CH0454664001 + SIX/CHF** erfolgen, niemals über den nackten Ticker. |
| Geschäftsjahresende | Für die Preislinie nicht anwendbar; es handelt sich nicht um eine operative Gesellschaft. |

**Entity-Card-Konfidenz: hoch.** Die Identität wird durch die offiziellen [21Shares Final Terms](https://cdn.21shares.com/uploads/current-documents/FinalTerms/ABTC/ABTC%20-%20EU%20Final%20Terms.pdf), das [21Shares Factsheet](https://cdn.21shares.com/uploads/current-documents/factsheets/all/Factsheet_ABTC.pdf) und den offiziellen [SIX-Historic-Endpunkt](https://www.six-group.com/sheldon/market_data/v1/CH0454664001CHF4/historic.csv) gestützt.

## 2. Ergebnis in einem Satz

> **Für die exakte Linie ABTC.SW/ABTCCHF ist im Prüfintervall keine preis- oder stückzahlwirksame Corporate Action (Split, Reverse Split, Nennwertreduktion, Spin-off, Sonderdividende, Produkt-/ISIN-Namewechsel oder Delisting) verifiziert.** Der einzige dokumentierte ABTC-Split war **14:1 mit Wirksamkeit 12.04.2021** und liegt damit **vor** dem Prüfstart. Die auffälligen lokalen Ein-Tages-Sprünge ab August 2026 sind im Abgleich mit den offiziellen SIX-Schlusskursen **Datenfehler der lokalen Preisreihe**, nicht Corporate Actions.

**Gesamtkonfidenz:** **hoch** für die 2026-Datenfehler und für den vorperiodischen Split; **mittel bis hoch** für die Negativfeststellung zu weiteren Corporate Actions, weil öffentlich kein vollständiger, historischer SIX-SIS-Corporate-Actions-Golden-Record für jeden Tag des gesamten Fünfjahresfensters verfügbar war.

## 3. Verifizierte Corporate-Action- bzw. strukturrelevante Ereignisse

| Datum / Wirksamkeit | Ereignis | Relevanz für ABTC.SW | Verhältnisse / Details | Urteil für Preisreihe | Konfidenz / Primärquelle |
|---|---|---|---|---|---|
| **12.04.2021** (vor Prüfintervall) | **ETP-Split** | ABTC, ISIN CH0454664001, war ausdrücklich erfasst. | **14:1**. | Echter Split, aber **nicht** Ursache einer Bewegung ab 15.09.2021. Historische Kurse vor/nach diesem Datum müssen splitkonsistent sein. | **Hoch.** [Offizielle 21Shares/SIX-Mitteilung vom 31.03.2021](https://5250-prd-web-21shares-cms.s3.amazonaws.com/21_Shares_AG_Official_Notice_ETP_Share_Split_1_8814f06a4b.pdf) |
| **28.02.2022** | Wechsel des Index Sponsors (Jura Pentium Limited → Jura Pentium AG) und der Jura-Pentium-Servicing-Entity | ABTC ausdrücklich aufgeführt. | Kein Splitverhältnis, keine Kapitalmaßnahme, keine Änderung von ISIN, Instrument oder Handelswährung genannt. | **Strukturadministration, nicht preis-/stückzahlwirksame Corporate Action.** Kein Grund, einen Tagessprung mechanisch zu bereinigen. | **Hoch.** [Offizielle Mitteilung](https://www.bxswiss.com/ols/downloads/publication-attachments/220221-071050_BX%20Official%20Notice_Change%20of%20Jura%20Pentium%20Serv.pdf) |
| **17.01.2025** | Mindest-Creation-/Redemption-Order für Authorized Participants | ABTC ausdrücklich aufgeführt. | Creation Unit von **2'500 auf 10'000 ETPs**. | Nur AP-Mindestordergröße; **kein** Split, keine Umrechnung bestehender Anlegerstücke, kein ex-Tag. Nicht zur Kursbereinigung verwenden. | **Hoch.** [SIX Official Notice, publ. 10.01.2025](https://cdn.21shares.com/uploads/current-documents/products/notices/SIX_Official_Notice-CU_Size_Change.pdf) |
| **08.07.2026** | Custodian-/Referenzpreis-Änderung | ABTC ausdrücklich aufgeführt. | BitGo Europe GmbH als zusätzlicher Custodian; Copper Markets (Switzerland) AG und Coinbase Custody International Ltd. entfernt; CCIX/CBER als Referenzpreise entfernt. Die Mitteilung sagt: **„Other product details will remain unchanged.“** | Keine Änderung der ETP-Anzahl oder des Inhaber-Verhältnisses. **Keine** Erklärung für mechanische Kurssprünge. | **Hoch.** [SIX Official Notice, publ. 01.07.2026](https://cdn.21shares.com/uploads/current-documents/products/notices/30Jun2026%20-%20SIX%20Official%20Notice%20on%20Custody%20Changes.pdf) |
| **laufend** | Creation/Redemption und sich verändernde ausstehende ETP-Zahl | Für offene ETP-Struktur vorgesehen. | 31.12.2024: **26'587'500 ABTC-Produkte** ausstehend; aktuelle 2026-Final-Terms nennen beispielsweise 24'757'500 für die Tranche. | Schaffung/Rücknahme durch APs ist **kein Split** und ändert nicht das Verhältnis eines bereits gehaltenen ETPs. | **Hoch.** [SIX/21Shares Notice zu Fees und Outstanding Products](https://cdn.21shares.com/uploads/current-documents/products/notices/30Apr2025%20-%20%20Update%20on%20Total%20Fees%20Collected%20and%20Nr.%20of%20Outstanding%20Products%20of%20the%20Company%20for%20the%20Financial%20Year%202024.pdf); [Final Terms](https://cdn.21shares.com/uploads/current-documents/FinalTerms/ABTC/ABTC%20-%20EU%20Final%20Terms.pdf) |

### Explizit abgegrenzte, nicht verifizierte Ursachen

| Hypothese | Befund |
|---|---|
| Split / Reverse Split im Prüfintervall | **Keine verifizierbare Ursache.** Der einzige in den offiziellen ABTC-Notices gefundene Split ist der 14:1-Split vom 12.04.2021, also vor dem Fenster. |
| Nennwertreduktion / Kapitalherabsetzung | **Keine verifizierbare Ursache.** ABTC ist eine offene Schuldverschreibung, keine Aktie mit Nennwertkapital; die geprüften ABTC-Unterlagen nennen keine entsprechende Maßnahme. |
| Spin-off / Sachdividende | **Keine verifizierbare Ursache.** Das Produkt dokumentiert `Distribution: Not applicable`; kein ABTC-spezifisches Spin-off-/Ausschüttungsereignis wurde in den offiziellen Mitteilungen gefunden. |
| Sonderdividende | **Keine verifizierbare Ursache.** Keine Distribution; die 1,49%-Gebühr wird täglich in-kind auf das Krypto-Collateral erhoben und ist keine Barausschüttung. |
| Delisting / Produktname-/ISIN-Wechsel | **Keine verifizierbare Ursache.** Die aktuelle offizielle Dokumentation führt weiterhin Name **21shares Bitcoin ETP**, ISIN **CH0454664001**, SIX-Linie **ABTCCHF**. |
| Emittentennamewechsel | Der Wechsel **Amun AG → 21Shares AG** erfolgte am **14.02.2020**, somit vor dem Prüfintervall; er ist keine Ursache für Sprünge im Fenster. | 

Für die letzten beiden Abgrenzungen siehe [21Shares Jahresbericht 2024, Note 1](https://cdn.21shares.com/uploads/current-documents/products/finance/21Shares_AG_Annual_Financial_Report_WpHG_German_Securities_Trading_Act.pdf), [Factsheet](https://cdn.21shares.com/uploads/current-documents/factsheets/all/Factsheet_ABTC.pdf) und [Final Terms](https://cdn.21shares.com/uploads/current-documents/FinalTerms/ABTC/ABTC%20-%20EU%20Final%20Terms.pdf).

## 4. Auffällige Ein-Tages-Sprünge

### 4.1 Sprünge 2021–2025: keine Corporate-Action-Ursache verifizierbar

In der lokal vorhandenen ABTC.SW-Reihe lagen folgende absolute Tagesbewegungen bei mindestens 10 %. Für keine dieser Bewegungen wurde in den geprüften offiziellen 21Shares-/SIX-/Börsenquellen eine ABTC-spezifische Split-, Ausschüttungs-, Terminierungs-, Produktnamen- oder ISIN-Maßnahme verifiziert. **Die belegte Ursache lautet daher jeweils ausdrücklich: keine verifizierbare Corporate-Action-Ursache.** Dies ist keine Behauptung, dass keine Marktnachricht existierte; ABTC bildet Bitcoin ab und kann große Marktbewegungen aufweisen.

| Tag | Lokale Tagesrendite | Belegte Ursache / Status | Konfidenz |
|---|---:|---|---|
| 06.12.2021 | -12,13 % | Keine verifizierbare Corporate-Action-Ursache | Mittel |
| 04.02.2022 | +10,37 % | Keine verifizierbare Corporate-Action-Ursache | Mittel |
| 01.03.2022 | +13,68 % | Keine verifizierbare Corporate-Action-Ursache | Mittel |
| 12.05.2022 | -10,26 % | Keine verifizierbare Corporate-Action-Ursache | Mittel |
| 13.06.2022 | -20,26 % | Keine verifizierbare Corporate-Action-Ursache | Mittel |
| 09.11.2022 | -14,62 % | Keine verifizierbare Corporate-Action-Ursache | Mittel |
| 16.01.2023 | +10,30 % | Keine verifizierbare Corporate-Action-Ursache | Mittel |
| 16.02.2023 | +10,84 % | Keine verifizierbare Corporate-Action-Ursache | Mittel |
| 13.03.2023 | +15,73 % | Keine verifizierbare Corporate-Action-Ursache | Mittel |
| 05.08.2024 | -18,30 % | Keine verifizierbare Corporate-Action-Ursache | Mittel |
| 06.05.2025 | +10,22 % | Keine verifizierbare Corporate-Action-Ursache | Mittel |
| 21.05.2025 | +14,33 % | Keine verifizierbare Corporate-Action-Ursache | Mittel |
| 01.10.2025 | +11,12 % | Keine verifizierbare Corporate-Action-Ursache | Mittel |
| 24.10.2025 | +35,32 % | Keine verifizierbare Corporate-Action-Ursache | Mittel |
| 27.10.2025 | -21,78 % | Keine verifizierbare Corporate-Action-Ursache | Mittel |
| 04.03.2026 | +42,80 % | Keine verifizierbare Corporate-Action-Ursache aus den geprüften Notices; siehe zugleich die ab 24.04.2026 direkt belegte Datenlücke unten. | Niedrig bis mittel |
| 09.03.2026 | -24,63 % | Keine verifizierbare Corporate-Action-Ursache aus den geprüften Notices; siehe zugleich die ab 24.04.2026 direkt belegte Datenlücke unten. | Niedrig bis mittel |

**Begründung der Konfidenzgrenze:** SIX erklärt, dass Official Notices u. a. Reorganisationen, Kapitaländerungen und Dividenden enthalten. Die öffentlich extrahierbare instrumentgefilterte Seite lieferte jedoch keinen vollständigen ABTC-Ereignisexport für alle Tage; deshalb ist die Negativfeststellung dokumentenbasiert und nicht gleichbedeutend mit einem lizenzierten SIX-SIS-Golden-Record. [SIX Official Notices](https://www.six-group.com/en/market-data/news-tools/official-notices.html?securityId=CH0454664001&fromDate=20210915&reference=linkDirectly)

### 4.2 August–September 2026: **belegter Datenfehler**, keine Corporate Action

Die aktuelle offizielle SIX-CSV ist instrument- und währungsspezifisch beschriftet als **„21Shares Bitcoin ETP (21Shares AG/CH0454664001/CHF)”**. Sie liefert für den Zeitraum 24.04.2026–25.09.2026 offizielle Schlusskurse und Volumina. Die lokale ABTC.SW-Reihe weicht bereits am ersten in dieser SIX-Datei sichtbaren Tag ab (**24.04.2026: lokal CHF 19,218 vs. SIX CHF 20,260; -5,143 %**). Ab August erzeugen einzelne lokale Ausreißer scheinbare Sprünge; die offiziellen SIX-Tagesrenditen zeigen an denselben Tagen keine entsprechende Kapitalmaßnahme oder Sprungbewegung.

| Tag | Lokal: Vortag → Schlusskurs / Rendite | Offizieller SIX-Schlusskurs / Tagesrendite | Abweichung lokaler vs. SIX-Schlusskurs | Befund |
|---|---|---|---:|---|
| 03.08.2026 | 15,340 → 20,645 / **+34,58 %** | 17,050 / **+1,89 %** | +21,09 % | Datenfehler |
| 04.08.2026 | 20,645 → 15,678 / **-24,06 %** | 17,050 / **0,00 %** | -8,05 % | Datenfehler / Folge des Vortagsausreißers |
| 19.08.2026 | 15,582 → 22,520 / **+44,53 %** | 18,240 / **+5,13 %** | +23,46 % | Datenfehler |
| 20.08.2026 | 22,520 → 17,356 / **-22,93 %** | 19,016 / **+4,25 %** | -8,73 % | Datenfehler / Folge des Vortagsausreißers |
| 25.08.2026 | 19,284 → 26,050 / **+35,09 %** | 20,975 / **-0,64 %** | +24,20 % | Datenfehler |
| 26.08.2026 | 26,050 → 18,912 / **-27,40 %** | 20,880 / **-0,45 %** | -9,43 % | Datenfehler / Folge des Vortagsausreißers |
| 31.08.2026 | 19,190 → 25,840 / **+34,65 %** | 20,975 / **-0,64 %** | +23,19 % | Datenfehler |
| 01.09.2026 | 25,840 → 18,940 / **-26,70 %** | 20,810 / **-0,79 %** | -8,99 % | Datenfehler / Folge des Vortagsausreißers |
| 10.09.2026 | 19,148 → 25,360 / **+32,44 %** | 20,825 / **-0,45 %** | +21,78 % | Datenfehler |
| 14.09.2026 | 20,755 → 25,805 / **+24,33 %** | 20,910 / **+0,75 %** | +23,41 % | Datenfehler |
| 22.09.2026 | 20,825 → 28,240 / **+35,61 %** | 23,310 / **+0,11 %** | +21,15 % | Datenfehler |
| 24.09.2026 | 22,870 → 27,650 / **+20,90 %** | 23,000 / **+0,57 %** | +20,22 % | Datenfehler |

Mehrere scheinbare Gegenbewegungen enden an einem lokal wieder mit SIX identischen Schlusskurs, z. B. 11.09.2026 (CHF 20,755), 17.09.2026 (CHF 20,785), 23.09.2026 (CHF 22,870) und 25.09.2026 (CHF 22,910). Das bestätigt, dass auch deren berechnete lokale Renditen durch den jeweils vorherigen lokalen Ausreißer verzerrt sind.

**Belegte Ursache:** **Datenfehler/Fehlzuordnung in der lokalen ABTC.SW-Preisreihe.** Die Ursache ist nicht eine Corporate Action: Es gibt kein offizielles Splitverhältnis, keinen Ex-Tag, keine Termination und keine Änderung von Produktdetails; zugleich sind die offiziellen SIX-Schlusskurse an den Ausreißertagen direkt unvereinbar mit den lokalen Sprüngen.  
**Konfidenz: hoch.** Quelle: [offizieller SIX-Historic-CSV-Endpunkt für CH0454664001/CHF](https://www.six-group.com/sheldon/market_data/v1/CH0454664001CHF4/historic.csv). Die offiziellen SIX-Werte wurden nur gegen die vorhandene lokale Rohreihe verglichen; es wurden keine Werte überschrieben oder korrigiert.

## 5. Sichere globale Regel und Datenlückenempfehlung

### Sichere globale Regel

> **Corporate-Action- und Preisprüfung für ABTC.SW nur für `ISIN=CH0454664001`, `venue=SIX Swiss Exchange`, `trading currency=CHF` bzw. lokale Linie `ABTCCHF` durchführen. Nie das unqualifizierte Symbol `ABTC`, eine USD-/EUR-/GBP-/JPY-Linie oder einen US-Ticker als Ersatz verwenden.**
>
> **Ein lokaler Tageswert darf nicht als Marktbewegung oder Corporate Action gelten, wenn sein Schlusskurs gegenüber dem offiziellen SIX-Schlusskurs derselben ISIN/CHF-Linie materiell abweicht.** In diesem Fall die Rohpreiszeile und die daraus berechnete Tagesrendite als **„Preisquelle ungeklärt / nicht für Rendite-, Volatilitäts-, Drawdown- oder Alarmberechnung verwenden“** markieren, bis ein identitätsgleicher SIX- oder lizenzierter EOD-Nachweis vorliegt.

Für ABTC gilt zusätzlich: **Creation/Redemption, Änderungen der Mindest-Creation-Unit, Custodian-, Index-Sponsor- und Referenzpreisänderungen sind nicht als Split-/Ausschüttungsfaktor anzuwenden**, sofern die jeweilige offizielle Mitteilung kein konkretes Umtauschverhältnis oder keine Änderung der Produktrechte nennt.

### Datenlückenempfehlung

1. **Keine Daten ändern** aufgrund dieses Berichts. Die betroffenen lokalen Zeilen und abgeleiteten Kennzahlen bleiben bis zur kontrollierten, nachvollziehbaren Behebung gesperrt bzw. als Datenlücke gekennzeichnet.
2. Für eine vollständige Fünfjahresfreigabe einen **lizenzierten SIX/SIX SIS Corporate-Actions-Feed** oder einen dokumentierten Custodian-Entitlement-Report für **CH0454664001** abrufen. Er muss mindestens Split-/Redenomination-Faktor, Ausschüttungs-/Redemption-/Termination-Events, Ex- und Effective-Date, alte/neue ISIN sowie Quellenzeitstempel enthalten.
3. Separat einen vollständigen, identischen **SIX-CHF-EOD-Preisexport** beziehen und jede lokale Zeile inklusive `close`, Handelsdatum, Währung und ggf. Adjustierungsfaktor gegen diesen Export abstimmen. Die aktuelle öffentliche SIX-CSV ist ein starker Beleg für 24.04.2026–25.09.2026, deckt aber nicht die ganze verlangte Historie ab.
4. Für berechnete Renditen/Volatilität/Drawdown ausschließlich unadjustierte, identitätsgleiche SIX-CHF-Schlusskurse verwenden; bei einem später bestätigten Split nur mit dem ausdrücklich dokumentierten Verhältnis rückwirkend anpassen. Der vorperiodische 14:1-Split vom 12.04.2021 liegt außerhalb des Prüffensters.

## 6. Quellenverzeichnis (offizielle Quellen)

1. [21Shares ABTC Final Terms (17.09.2026)](https://cdn.21shares.com/uploads/current-documents/FinalTerms/ABTC/ABTC%20-%20EU%20Final%20Terms.pdf) — ISIN, Rechtsnatur, SIX, Distribution, Creation/Redemption, Gebühren, Erstnotierung.
2. [21Shares ABTC Factsheet (30.08.2026)](https://cdn.21shares.com/uploads/current-documents/factsheets/all/Factsheet_ABTC.pdf) — Produktidentität, Debt Security, SIX-Handelslinien inklusive ABTCCHF.
3. [SIX Historic CSV: CH0454664001/CHF](https://www.six-group.com/sheldon/market_data/v1/CH0454664001CHF4/historic.csv) — offizielle Schlusskurse/Volumen der exakten CHF-Linie, Abrufstand 25.09.2026.
4. [21Shares/SIX Official Notice: 14:1 ABTC-Split, wirksam 12.04.2021](https://5250-prd-web-21shares-cms.s3.amazonaws.com/21_Shares_AG_Official_Notice_ETP_Share_Split_1_8814f06a4b.pdf) — vorperiodischer Split.
5. [Official Notice: Index Sponsor/Servicing Entity, 28.02.2022](https://www.bxswiss.com/ols/downloads/publication-attachments/220221-071050_BX%20Official%20Notice_Change%20of%20Jura%20Pentium%20Serv.pdf) — strukturadministrative Änderung.
6. [SIX Official Notice: Creation/Redemption CU Size, publ. 10.01.2025](https://cdn.21shares.com/uploads/current-documents/products/notices/SIX_Official_Notice-CU_Size_Change.pdf) — AP-Mindestorder 2'500 → 10'000.
7. [SIX Official Notice: Custodian-/Referenzpreisänderung, publ. 01.07.2026](https://cdn.21shares.com/uploads/current-documents/products/notices/30Jun2026%20-%20SIX%20Official%20Notice%20on%20Custody%20Changes.pdf) — ABTC betroffen, sonstige Produktdetails unverändert.
8. [SIX/21Shares Notice: 2024 Fees and Outstanding Products, publ. 30.04.2025](https://cdn.21shares.com/uploads/current-documents/products/notices/30Apr2025%20-%20%20Update%20on%20Total%20Fees%20Collected%20and%20Nr.%20of%20Outstanding%20Products%20of%20the%20Company%20for%20the%20Financial%20Year%202024.pdf) — 26'587'500 ausstehende ABTC-Produkte zum 31.12.2024.
9. [21Shares Annual Report 2024](https://cdn.21shares.com/uploads/current-documents/products/finance/21Shares_AG_Annual_Financial_Report_WpHG_German_Securities_Trading_Act.pdf) — Amun AG → 21Shares AG am 14.02.2020, damit vor dem Prüfintervall.
10. [SIX Official Notices — Erläuterung des Ereignisumfangs](https://www.six-group.com/en/market-data/news-tools/official-notices.html?securityId=CH0454664001&fromDate=20210915&reference=linkDirectly) — methodische Datenlücke des öffentlich extrahierbaren instrumentgefilterten Archivs.

**Basis & Zeit:** Preisprüfung der auffälligen 2026-Tage gegen den offiziellen SIX-Schlusskurs der CHF-Linie; Prüfperiode 15.09.2021–25.09.2026.  
**Annahmen:** Keine nicht belegten Corporate Actions oder Marktursachen unterstellt; lokale Preiswerte wurden nicht mit NAV-, USD- oder anderen Börsenlinien vermischt.  
**Compliance:** Dies ist Research und Analyse, keine personalisierte Finanzberatung.
