# Dividendenrenditen: Integritätsaudit und Korrektur

**Stichtag:** 22. Oktober 2026  
**Umfang:** 314 aktive Instrumente (kuratiertes Universum und aktive Portfolio-Stammdaten)  
**Datenquelle:** EODHD – datierte Ausschüttungen (`/api/div`), Fundamentals und die bereits gespeicherte direkte Handelslinie  
**Mutation:** Nur abgeleitete Instrumentenkennzahlen und deren Quellenmetadaten. Keine Rohkurshistorie, Portfolioallokation, Stückzahl, Cash-Reserve, Ledger-, Transaktions- oder Handelsdaten wurden geändert.

## Anlass und bestätigter Befund

Die sichtbare Rendite von Aker BP betrug 0,68 %, obwohl die Anwendung gleichzeitig vier TTM-Cash-Ereignisse über insgesamt NOK 25,180520 je Aktie gespeichert hatte. Bei einem damaligen Kurs von NOK 386,60 entspricht das **6,5133 % TTM-Bruttorendite**:

`25,180520 / 386,60 × 100 = 6,5133 %`

Der Fehler war damit kein neuer Ausschüttungsbetrag und keine Portfoliofrage, sondern eine inkonsistente Speicherung: eine belegte TTM-Jahressumme wurde neben einer veralteten bzw. fremdbasierten Rendite weitergeführt.

Die initiale Vollinventur fand bei 192 als `ttm_gross` markierten, mathematisch prüfbaren Reihen 82 materielle Abweichungen (mindestens 0,05 Prozentpunkte), darunter Aker BP, mehrere Schweizer Einmalzahler, US-Quartalszahler sowie einige Londoner Linien. Eine lokale Reparatur wäre deshalb fachlich nicht ausreichend gewesen.

## Korrekturregeln

Die Persistenzreihenfolge ist jetzt zentral und in allen regulären Schreibpfaden identisch:

1. **TTM-Brutto:** Summe der regulären, datierten EODHD-Cash-Ereignisse innerhalb der letzten 365 Tage, ohne Sonderdividenden.
2. **Forward / indicated:** Nur wenn keine qualifizierten TTM-Ereignisse verfügbar sind; deutlich als Forward-Basis ausgewiesen.
3. **Provider-Highlights:** Nur als explizit markierter letzter EODHD-Fallback.
4. **Keine belegte Basis:** Keine künstliche Rendite; Datenlücke bleibt sichtbar.

Eine sekundäre Yahoo-/Mehrquellenrendite darf weder eine verifizierte EODHD-Basis überschreiben noch beim Hinzufügen eines Watchlisttitels als vermeintliche TTM-Rendite gespeichert werden. Admin-Refresh, Einzel-/Bulk-Refresh, Watchlist-Anreicherung, manuelles Hinzufügen und PDF-Import benutzen nun die gleiche Persistenzregel.

## Londoner Sonderfall – ohne FX-Schätzung

EODHD verwendet für Londoner Handelslinien beide Quoteinheiten:

- **GBX / GBp:** Preis in Pence; GBP-Cash-Ereignisse werden für die reine Quoteinheitsrechnung durch 100 angepasst.
- **GBP:** Preis bereits in Pfund; es erfolgt **keine** zusätzliche Teilung.

Das ist keine Währungsumrechnung. Die EODHD-Rohbelege zeigen den Unterschied klar:

| Titel | Preis-/Stammdatenquote | TTM-Cash | Korrekte Renditebasis |
|---|---:|---:|---:|
| MNG.L | 312,40 GBp | GBP 0,206000 (2 Ereignisse) | 6,6004 % TTM |
| DGE.L | 1’744,80 GBp | GBP 0,375790 (2 Ereignisse) | 2,1548 % TTM |
| AZN.L | 12’624,00 GBp | GBP 2,390000 (2 Ereignisse) | 1,8932 % TTM |
| VWRL.L | GBP 137,54 | GBP 1,840390 (4 Ereignisse) | 1,3390 % TTM |
| BATS.L | 4’445 GBp | Forward GBP 2,450000 | 5,5900 % Forward |

Damit ist sowohl die frühere 100-fache Untertreibung bei Pence-Quoten als auch die potenzielle 100-fache Übertreibung bei bereits in GBP gelieferten Londoner Kursen ausgeschlossen.

## Kontrollierter Refresh und Endabgleich

Der kontrollierte Refresh über alle aktiven Instrumente hat zunächst **280 Metadatensätze** aktualisiert; bei **214** davon veränderte sich auch der sichtbare Renditewert. Der Refresh ist auditierbar und rate-limitiert.

| Abschlusszustand | Anzahl |
|---|---:|
| TTM-Brutto aus datierten EODHD-Events | 209 |
| EODHD Forward / indicated | 73 |
| Ohne belegte Renditebasis | 32 |
| Mathematisch prüfbare TTM-Reihen | 208 |
| Materielle Abweichungen nach Abschlussabgleich (≥ 0,05 Prozentpunkte) | **0** |

Die 32 Lücken sind überwiegend Rohstoff-/Krypto-/nicht ausschüttende Instrumente, ISIN-Stammdatensätze oder fehlende aktuelle Preise. Sie wurden **nicht** durch eine geschätzte Rendite ersetzt.

### Aker BP – finaler Nachweis

| Feld | Wert |
|---|---:|
| Aktueller Kurs (Handelslinie Oslo) | NOK 386,50 |
| TTM-Ausschüttungen | NOK 25,180520 je Aktie |
| Ereignisse | 4 |
| Angezeigte Rendite | **6,5133 % TTM-Brutto** |
| Quelle | EODHD `/api/div` |
| Stichtag | 22.10.2026 |

Die offizielle Aker-BP-Aktienseite beschreibt die quartalsweise Ausschüttungspolitik; die offizielle Q2-2026-Mitteilung dient als zusätzlicher Primärbeleg für die Cash-Dividenden.  
Quellen: [Aker BP – Share & dividend](https://akerbp.com/en/investor/share/), [Aker BP – Key information related to cash dividend (Q2 2026)](https://akerbp.com/en/borsmelding/aker-bp-key-information-related-to-cash-dividend-44/).

## Reproduzierbare Belege

- [Aker BP EODHD-Rohbeleg](workings/AKRBP_OL_DIVIDEND_RAW_EVIDENCE_2026-10-22.json)
- [Londoner Quote-/Dividendeneinheiten](workings/LSE_DIVIDEND_QUOTE_UNIT_EVIDENCE_2026-10-22.json)
- [Endabgleich der verifizierten Dividendenbasis](workings/VERIFIED_DIVIDEND_METRIC_POST_REFRESH_AUDIT_2026-10-22.json)

## Test- und Betriebsanforderung

Die Regressionstests decken Splitdividenden, GBP/GBp, bereits in GBP notierte Londoner Linien, Ereignisanzahl, die zentrale Persistenzregel und Prozentnormalisierung ab. Abschlusstest am 22.10.2026: **266 Testdateien / 1’785 Tests bestanden, 5 / 11 übersprungen**; TypeScript und `git diff --check` fehlerfrei. Der reguläre Tagesrefresh verwendet die identische, belegte Reihenfolge.

Diese Datenqualitätskorrektur ist Research und Systemwartung, keine persönliche Anlageberatung und keine Handelsaufforderung.
