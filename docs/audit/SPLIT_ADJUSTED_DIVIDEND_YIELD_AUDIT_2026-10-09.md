# Audit: Splitbereinigte Dividendenrenditen

**Stichtag:** 09.10.2026  
**Status:** Korrektur umgesetzt, verifiziert und auf abgeleitete Gesamtrendite-Snapshots angewendet.

> **Kurzbefund:** Die angezeigte Swissquote-Dividendenrendite von 21,24 % war falsch. Der TTM-Algorithmus kombinierte den heutigen post-split-Kurs (CHF 34,84) mit der historischen pre-split-Dividende (CHF 7,40). Richtig ist die nach dem 1:10-Split dargestellte Ausschüttung von **CHF 0,74 je heutiger Aktie**, also **2,1240 % TTM-Brutto**.

## Entity Card und Primärquellen

| Feld | Wert |
|---|---|
| Emittent | Swissquote Group Holding SA |
| Handelslinie | SQN.SW, SIX Swiss Exchange |
| ISIN | CH1548235246 |
| Handelswährung | CHF |
| Geschäftsjahresende | Dezember |
| Kapitalmaßnahme | 1:10-Split, wirksam 28.05.2026 |
| Primärquelle | Swissquote Generalversammlung, 07.05.2026; EODHD `/div`, `/splits`, EOD und Fundamentals |

Die offizielle Swissquote-Mitteilung vom 07.05.2026 bestätigt gleichzeitig die beschlossene **Bruttodividende CHF 7,40** und den **1:10-Split**. Die im Mai ausgeschüttete CHF-7,40-Dividende war folglich eine Zahlung je **alter** Aktie. EODHD führt dieselbe Zahlung korrekt als `unadjustedValue=7.40` und `value=0.74`.

## Rechenbeleg Swissquote

| Eingabe | Wert | Basis |
|---|---:|---|
| Aktueller Kurs | CHF 34,84 | post-split, EODHD Real-Time vom 09.10.2026 |
| EODHD `unadjustedValue` | CHF 7,40 | historische Aktie vor dem 1:10-Split — **nicht** mit heutigem Kurs kombinierbar |
| EODHD `value` | CHF 0,74 | heutige, splitbereinigte Aktie |
| TTM-Ereignisse | 1 | reguläre, währungsgleiche Ausschüttung |
| Korrekte TTM-Bruttorendite | **CHF 0,74 / CHF 34,84 × 100 = 2,1239954076 %** | einmalig gerundet angezeigt: **2,12 %** |

## Fehlerursache

EODHD liefert für Dividendenereignisse zwei Felder:

- `unadjustedValue`: historisch deklarierte Cashdividende pro **damaliger** Aktie;
- `value`: Cashdividende pro **heutiger, splitbereinigter** Aktie.

Der Anwendungsweg hatte priorisiert `unadjustedValue` verwendet. Das ist bei einer reinen historischen Darstellung zulässig, aber wirtschaftlich falsch, wenn der Betrag mit heutigem Kurs oder einer splitbereinigten Preisreihe kombiniert wird. Bei Swissquote entstand so CHF 7,40 / CHF 34,84 = 21,24 % statt CHF 0,74 / CHF 34,84 = 2,12 %.

## Universumsprüfung

Es wurden alle **24 aktiven Instrumente mit EODHD-bestätigter Kapitalmaßnahme** und deren TTM-Dividendenereignisse geprüft.

| Ergebnis | Anzahl |
|---|---:|
| EODHD-Dividendenabrufe erfolgreich | 24 / 24 |
| Titel mit unterschiedlichen `value` / `unadjustedValue` im TTM | 3 |
| Materiell betroffene Titel | 3 |
| Weitere betroffene Titel | 0 |

| Ticker | Alte TTM-Bruttorendite | Korrigierte TTM-Bruttorendite | Alte Jahresdividende | Korrigierte Jahresdividende |
|---|---:|---:|---:|---:|
| **SQN.SW** | 21,2400 % | **2,1240 %** | CHF 7,400000 | CHF 0,740000 |
| **KLAC** | 3,2178 % | **0,4295 %** | USD 6,330000 | USD 0,840000 |
| **NOBL** | 3,1965 % | **2,1301 %** | USD 1,759660 | USD 1,172950 |

## Zentraler Fix und Schutzwirkung

Eine zentrale Auswahlfunktion verwendet für alle Berechnungen, die einen aktuellen oder splitbereinigten Kurs verwenden, vorrangig EODHD `value`; auf `unadjustedValue` fällt sie nur zurück, wenn `value` fehlt. Sie wird in beiden fachlich gekoppelten Pfaden eingesetzt:

1. **TTM-Dividendenrendite:** Sichtbare Detail-, Watchlist-, Portfolio- und Exportkennzahlen.
2. **Ereignisrekonstruierte Brutto-Gesamtrendite:** Cashdividenden werden nur auf derselben splitbereinigten Aktienbasis wie die Preisreihe reinvestiert.

Für KLAC, NOBL und SQN.SW wurden die abgeleiteten Total-Return- und splitbereinigten Preis-Snapshots kontrolliert neu berechnet. Alle drei verwenden nach der Validierung die EODHD-adjusted-Quelle (KLAC/NOBL je 1’270, SQN.SW 1’272 Zeilen). **Rohkurse wurden nicht überschrieben.**

## Validierung

| Prüfung | Ergebnis |
|---|---|
| Roter Reproduktionstest: SQN 1:10, CHF 0,74 vs. CHF 7,40 | reproduziert: Altlogik ergab CHF 7,40 |
| Regression nach Fix | bestanden: CHF 0,74, 2,1239954076 % |
| Zusatztests: Splitbetrag-Selektor, TTM-Annuallogik, Splits, Total Return | 14 / 14 bestanden |
| TypeScript | bestanden |
| Datenbank-Endabgleich | SQN.SW 2,1240 %, KLAC 0,4295 %, NOBL 2,1301 % |
| Vollständige Test- und Signalcache-Prüfung | Signalcache für 267 aktive Titel erfolgreich erneuert; 259 Testdateien / 1’756 Tests bestanden, 5 / 11 übersprungen |

## Datenintegrität und Ausschlüsse

| Bereich | Ergebnis |
|---|---|
| Rohhistorien | unverändert |
| Marktstammdaten | nur die drei belegbar falschen Dividendenfelder aktualisiert |
| Total-Return-/Split-Snapshots | kontrolliert, abgeleitet, neu aufgebaut |
| Portfolios / Positionen / Gewichtungen | unverändert |
| Cash / Ledger / Transaktionen / Orders | unverändert |

## Reproduzierbare Artefakte

- Entity Card: `docs/audit/workings/SQN_SW_ENTITY_CARD_2026-10-09.md`
- Rohbeleg Swissquote: `docs/audit/workings/SQN_SW_SPLIT_RAW_EVIDENCE_2026-10-09.json`
- Universumsinventur: `docs/audit/workings/SPLIT_ADJUSTED_DIVIDEND_EVENT_AUDIT_2026-10-09.json`
- Kontrollierter Refresh: `docs/audit/workings/SPLIT_ADJUSTED_DIVIDEND_REFRESH_2026-10-09.json`

**Definition:** TTM-Brutto-Dividendenrendite = Summe der regulären, währungsgleichen Ausschüttungen der letzten 365 Tage je **heutiger splitbereinigter Aktie** / aktueller Kurs × 100. Sonderdividenden bleiben ausgeschlossen.

**Zeit und Quellen:** Stichtag 09.10.2026; EODHD-Marktdaten mit Gegenprobe der Swissquote-Primärmitteilung vom 07.05.2026.  
**Hinweis:** Research und Datenqualitätsprüfung, keine persönliche Anlageberatung.
