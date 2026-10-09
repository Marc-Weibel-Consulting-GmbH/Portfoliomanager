# Universumsweite Prüfung von Splits und Kapitalmaßnahmen

**Stichtag:** 9. Oktober 2026  
**Umfang:** 314 Stammdatensätze, davon 313 aktive Instrumente (267 kuratierte Watchlist-/Empfehlungstitel und 46 weitere aktive Instrumente)  
**Status:** Korrektur und Präventionsmechanismen umgesetzt; keine Handelsaktion ausgeführt.

> **Ergebnis:** Die beanstandete Swissquote-Anzeige war ein echter Anwendungsfehler durch eine vermischte Preisbasis: ein bereits gesplitteter Punktkurs wurde gegen unbereinigte YTD-/52-Wochen-Anker gespeichert. Die gleiche Fehlerklasse betraf auch KLA, CrowdStrike, NOBL sowie weitere Split- und ETF-Fälle. Sie ist zentral behoben. Nicht eindeutig auflösbare Reihen werden nicht geschätzt, sondern als Datenlücke bzw. Signalsperre behandelt.

## 1. Prüfauftrag und Methodik

Geprüft wurden für jedes aktive Instrument:

1. **Identität der Handelslinie:** Ticker, Börsenkürzel, Währung und – falls verfügbar – ISIN.
2. **Kapitalmaßnahmen:** EODHD-Endpunkt `/splits` über die gleiche Handelslinie; Vorwärts- und Reverse-Splits werden getrennt klassifiziert.
3. **Preisbasen:**
   - additive, unveränderte Rohkurse,
   - separate splitbereinigte Preisrenditereihe (ohne Cash-Dividenden),
   - separate Brutto-Gesamtrenditereihe (mit reinvestierten Cash-Dividenden).
4. **Ankerprüfung:** aktueller Kurs, erster Handelstag im Jahr, YTD, 52-Wochen-Hoch und -Tief müssen auf **derselben direkten Handelslinie und Splitbasis** liegen.
5. **Integritätsprüfung:** mechanische Sprünge von mindestens Faktor 2 bzw. höchstens 0,5 ohne verifiziertes Event sperren Timing und abgeleitete Kennzahlen.

Die Rohhistorien wurden nicht überschrieben. Änderungen beschränken sich auf kontrollierte abgeleitete Snapshots und Marktstammdatenfelder.

## 2. Universumsresultat

| Prüfung | Vor der Korrektur | Nach der Korrektur |
|---|---:|---:|
| Aktive Instrumente geprüft | 313 | 313 |
| Kuratierte Watchlist-/Empfehlungstitel | 267 | 267 |
| EODHD-bestätigte Kapitalmaßnahmen | 24 | 24 |
| davon Vorwärtssplits | 23 | 23 |
| davon Reverse-Splits | 1 | 1 |
| YTD-Startpreis auf falscher Splitbasis | 4 | **0** |
| 52-Wochen-Anker auf falscher Splitbasis | 3 | **0** |
| YTD-Rechenabweichungen ≥ 3 Prozentpunkte | 37 | **0** für direkt verifizierte Handelslinien |
| Instrumente ohne direkte splitbereinigte Snapshotreihe | 219 | 204 |
| Datenqualität bewusst gesperrt/zu prüfen | 33 beim ersten Gate | weiterhin transparent statt geschätzt |

Die 24 verifizierten Events umfassen u. a. SQN.SW (1:10), KLAC (1:10), CRWD (1:4), NOBL (1:2), NFLX (1:10), NOW (1:5), NVDA (1:10), XLK.US/XLY.US (je 1:2) und HODL.CN (Reverse Split 1:8). Für 23 dieser direkten Linien wurden die getrennten Split- und Gesamtrendite-Snapshots kontrolliert erneuert; 8015.T blieb ohne verifizierbare direkte Snapshotquelle gesperrt.

## 3. Belegte Hauptfälle

| Titel | Kapitalmaßnahme / Befund | Vorher | Korrigierte direkte Splitbasis |
|---|---|---:|---:|
| **SQN.SW – Swissquote** | 1:10 am 28.05.2026; Punktkurs war post-split, YTD-/52W-Anker pre-split | CHF 34,84; YTD-Anker 487,79; **−92,48 %**; 52W-Hoch 543,50 | CHF 34,84; YTD-Anker 49,74; **−29,96 %**; 52W 34,04–54,35 |
| **KLAC – KLA** | 1:10 am 12.06.2026; alte Anker zehnfach | USD 195,57; Anker 1’274,47; **−84,56 %**; 52W-Hoch 2’411,64 | USD 195,57; Anker 127,45; **+53,45 %**; 52W 98,28–301,71 |
| **CRWD – CrowdStrike** | 1:4 am 02.07.2026 | USD 275,04; Anker 453,58; **−42,01 %** | USD 275,04; Anker 113,40; **+142,55 %** |
| **NOBL – Dividend Aristocrats ETF** | 1:2 am 28.05.2026 | USD 55,07; Anker 104,46; **−47,30 %**; Hoch 114,59 | USD 55,07; Anker 52,23; **+5,43 %**; 52W 50,40–59,07 |
| **D05.SI – DBS Group** | 11:10 am 25.04.2024; zusätzlich wurde ein unplausibler EODHD-Quote verworfen | Quote/Anker/Ranges hatten unterschiedliche Skalen | SGD 73,85; Anker 56,40; **+30,94 %**; 52W 52,00–78,65 |
| **HODL.CN** | Reverse Split 1:8 am 05.08.2025 | ohne robuste einheitliche Darstellungsbasis | CAD 2,37; Anker 2,45; **−3,27 %**; 52W 1,25–5,84 |
| **WILC** | Kein EODHD-Splitbeleg; isolierte Rohwerte bis 10’160 / 9’268 bei sonst rund 20–33 | falsche YTD bis **+26’474,91 %**, unplausibler 52W-Wert | **Quote, YTD und 52W bewusst leer; Datenstatus „prüfen“** |

### Swissquote-Rohbeleg

Der EODHD-Rohabruf zu `SQN.SW` zeigt die Kapitalmaßnahme 1:10 am 28.05.2026. Die getrennte EODHD-Splitreihe enthält 1’272 Beobachtungen und plausibel CHF 9,44–56,90. Damit ist eine CHF-487,79-YTD-Basis neben dem CHF-34,84-Punktkurs fachlich ausgeschlossen. Der vollständige, tokenfreie Rohbeleg befindet sich in `docs/audit/workings/SQN_SW_SPLIT_RAW_EVIDENCE_2026-10-09.json`.

### WILC: absichtliche Datenlücke statt erfundene Korrektur

EODHD liefert für `WILC.US` keine aktuellen Splits, aber isolierte Werte von etwa 9’268, 10’160 und 7’679 zwischen normalen Kursen um 20–33. Der externe Sekundärquote war zudem veraltet. Dies ist weder als Split noch als Reverse Split belegt. Deshalb wurden **keine** Faktoren geschätzt, sondern die sichtbaren Preiskennzahlen bis zu einer verifizierten Handelslinie gesperrt. Rohdaten blieben unverändert.

## 4. Ursache und zentraler Fix

### Ursache

Mehrere alte Aktualisierungspfade kombinierten:

- einen aktuellen Quote (historisch teils aus einer sekundären Quelle),
- mit älteren, teilweise unbereinigten `ytdStartPrice`-/52W-Feldern,
- oder mit einer indirekten bzw. währungsabweichenden Historienquelle.

So konnte z. B. ein post-split Kurs neben einem pre-split YTD-Anker fortbestehen. Zusätzlich durfte ein täglicher Kennzahlenjob 52-Wochen-Felder aus der Rohhistorie zurückschreiben und die Korrektur damit später wieder rückgängig machen.

### Umgesetzte Prävention

1. **Zentrale Kennzahlenfunktion:** `currentPrice`, YTD-Anker, YTD und 52W werden aus *einer* direkten splitbereinigten Reihe abgeleitet.
2. **Direktheitsregel:** ADRs, ausländische Primärnotierungen, FX-/ISIN-Proxies und falsche Quoteinheiten dürfen keine direkten Aktienkennzahlen überschreiben.
3. **Quote-Abgleich:** Ein plausibler neuer EODHD-Punktkurs darf nur den YTD-Endpunkt derselben Reihe aktualisieren. Weicht er um mindestens Faktor 2 ab, wird er verworfen und die bestätigte Schlusskursbasis beibehalten.
4. **Integritätsgate:** Auch eine bereits gespeicherte Splitreihe wird auf ungeklärte mechanische Sprünge geprüft; sie ist kein Vertrauensbeweis allein.
5. **Keine Rückschreibung aus Rohkursen:** Der tägliche Kennzahlenrefresh schreibt keine 52W-Ranges mehr aus `historical_prices`. Watchlist- und Tagesrefresh synchronisieren nach dem Quote-Abruf über die zentrale Splitbasis.
6. **Signalbasis:** Der Signalcache wählt nur direkte, kompatible splitbereinigte Reihen; der Cache wurde für **267 aktive Titel** neu aufgebaut (0 fehlgeschlagen).

## 5. Restlücken und Umgang damit

Die 204 Instrumente ohne dedizierten Split-Snapshot sind **nicht automatisch fehlerhaft**. Für eine direkte, währungskompatible Rohreihe ohne mechanischen Sprung kann diese als transparent beschriebener Fallback verwendet werden. Wo dies nicht möglich ist, werden keine Kennzahlen geschätzt.

Offene Klassen:

- **Ungeprüfte direkte Handelslinie/Währung:** u. a. 0QOK.L, 6856.T, 7735.T, 8015.T, 9962.T, PRY.MI, SE0007491303.SG, SGLD.L und SRG.MI.
- **EODHD-Splitendpunkt 404:** mehrere ISIN-/ETP-Zeilen sowie einzelne Instrumente wie BCOM.SW oder VBTC.SW; diese erfordern eine separate native Produkt-/Börsenprüfung.
- **Unbelegter Datenanbieter-Ausreißer:** WILC bleibt gesperrt.

Diese Restlücken führen nicht zu einer erfundenen Splitkorrektur und lösen keine Portfoliotransaktion aus.

## 6. Validierung

| Prüfung | Resultat |
|---|---|
| Fokustests Split, Reverse Split, WILC-/DBS-Ausreißer und neuer Quote-Endpunkt | 17 / 17 bestanden |
| TypeScript | `pnpm exec tsc --noEmit` bestanden |
| Gesamtsuite | 257 Testdateien bestanden, 5 übersprungen; 1’753 Tests bestanden, 11 übersprungen |
| `git diff --check` | fehlerfrei |
| Signalcache-Neuberechnung | 267 Titel, 0 Fehler |
| Browser-/Devcheck | Devserver erreichbar; Browserkonsole 0 Fehler. Die Detailroute leitete ohne eingeloggte Dev-Session erwartungsgemäss zur Anmeldung weiter; daher wurde die geschützte Detailansicht zusätzlich über Datenbank- und Routerbasis geprüft. |

## 7. Datenmutationen und Ausschlüsse

| Bereich | Status |
|---|---|
| Additive Rohhistorien | **nicht verändert** |
| Split-/Total-Return-Snapshots | kontrolliert für die 24 verifizierten Event-Kandidaten erneuert (23 mit Quelle, 1 gesperrt) |
| Marktstammdatenfelder | kontrolliert aus homogener Basis abgeleitet bzw. gesperrt |
| Portfolioallokationen/Stückzahlen | **nicht verändert** |
| Cash, Ledger, Transaktionen | **nicht verändert** |
| Orders oder Live-Aktivierungen | **keine** |

## 8. Reproduzierbare Arbeitsartefakte

- Vorher-/Nachher-Inventur: `docs/audit/workings/ACTIVE_UNIVERSE_SPLIT_METRIC_INVENTORY_BEFORE_REFRESH_2026-10-09.json` und `docs/audit/workings/ACTIVE_UNIVERSE_SPLIT_METRIC_INVENTORY_2026-10-09.json`
- Kontrollierter Refresh: `docs/audit/workings/SPLIT_SNAPSHOT_REFRESH_2026-10-09.json` und `docs/audit/workings/SPLIT_METRIC_REFRESH_2026-10-09.json`
- Swissquote-Rohbeleg: `docs/audit/workings/SQN_SW_SPLIT_RAW_EVIDENCE_2026-10-09.json`
- WILC-Rohbeleg und Sperrprotokoll: `docs/audit/workings/WILC_PRICE_RAW_EVIDENCE_2026-10-09.json` und `docs/audit/workings/WILC_VENDOR_OUTLIER_CORRECTION_2026-10-09.json`
- Signalrefresh: `docs/audit/workings/SIGNAL_REFRESH_AFTER_SPLIT_CORRECTION_2026-10-09.json`

---

**Hinweis:** Dieses Audit dokumentiert Datenqualität und Berechnungslogik. Es ist Research/Analyse und keine persönliche Anlageberatung.
