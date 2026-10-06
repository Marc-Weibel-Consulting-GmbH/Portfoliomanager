# PLTR.US – Wachstum, Timing und Frische der Signalsätze

**Prüfdatum:** 06.10.2026  
**Scope:** Palantir (`PLTR.US`) und zentrale Sicherung gegen veraltete Drei-Score-Signale.  
**Abgrenzung:** Keine Portfolio-, Cash-, Ledger-, Transaktions- oder Handelsänderung.

## Befund

### 1. Palantir-Wachstum und PEG

| Kennzahl | Wert | Basis / Stichtag |
|---|---:|---|
| TTM-KGV | 163,2759x | EODHD Fundamentals, Abruf 06.10.2026 |
| Forward-KGV | 85,4701x | EODHD Fundamentals, Abruf 06.10.2026 |
| Standard-PEG | 1,8461 | EODHD Fundamentals, nicht mit der internen Risikoprüfung gleichzusetzen |
| EPS-Schätzung aktuelles Jahr | USD 1,6201 | EODHD |
| EPS-Schätzung nächstes Jahr | USD 2,3442 | EODHD |
| Impliziertes Forward-EPS-Wachstum | 44,6948 % | `(2,3442 / 1,6201 - 1) × 100` |
| Q2-EPS-Wachstum YoY | 215,4 % | EODHD; Quartalsrate, kein nachhaltiger Mehrjahresnenner |

Die zuvor sichtbare historische Rate von **17,7 %** war ein robustes, vergangenheitsbezogenes EPS-Mittel und keine Schätzung für 2026/2027. Die zentrale PEG-Gegenprobe paart nun plausible Forward-Wachstumsschätzungen mit dem **Forward-KGV**, statt ein historisches Ratenmittel gegen eine Vorwärtsbewertung zu stellen. Der EODHD-Forward-PEG wird aber weiterhin nicht unkritisch übernommen.

Der hohe absolute Bewertungsanker bleibt fachlich relevant: TTM-KGV 163,2759x, Forward-KGV 85,4701x und geringe FCF-Rendite. Deshalb erhält Palantir nach der Korrektur einen sichtbaren Timingwert von **48,3** und ein Signal **HOLD 45/100**; der Bewertungswächter begrenzt die Empfehlung bewusst.

### 2. Fehlendes Timing: Ticker-Alias

Der Detailpfad verwendet `PLTR.US`, der Scoresnapshot lag unter der kanonischen Stammzeile `PLTR`. Die Aliasauflösung akzeptiert ausschliesslich dieses zulässige US-Suffixpaar. Sie vermischt keine Listings, ADRs oder Anteilsklassen. Dadurch kann die Detailansicht den korrekt gespeicherten Timingwert nutzen.

### 3. Universumsweite Frische-Sperre

Bei zwei aktiven Empfehlungstiteln lagen historische BUY-Signale vor, obwohl der aktuelle Zwei-Stunden-Lauf mangels qualifizierter Kursreihe kein Timing berechnen konnte:

| Ticker | Alte Scorezeit | Kurszeilen | Korrektur |
|---|---|---:|---|
| `B` | 01.09.2026 16:43:24 | 27 | Timing/Signal auf Datenlücke neutralisiert |
| `NFLX` | 19.08.2026 07:44:44 | 36 | Timing/Signal auf Datenlücke neutralisiert |

**Ursache:** Der Signallauf schrieb korrekt einen gesperrten Signalcache, aktualisierte aber die separate Tabelle `stock_scores` bei lückenhafter Reihe nicht. Die Aktiendetailansicht las somit einen alten BUY-Snapshot.

**Korrektur:**

1. Vorberechnete Drei-Scores gelten nur für maximal **2 Stunden 45 Minuten** (Zwei-Stunden-Zyklus plus Puffer). Ältere Sätze werden in der Detailansicht verworfen; Fundamentalkennzahlen bleiben sichtbar, Timing und Signal werden erst nach einem qualifizierten Lauf gezeigt.
2. Jeder aktuell gesperrte Titel schreibt jetzt einen frischen, explizit nicht handelbaren Drei-Score-Satz (`Timing = null`, `Signal = null`). Dieser überschreibt einen alten Kauf-/Verkaufswert.
3. Der anschliessende Gesamtlauf verarbeitete **267 aktive Titel**. `B` und `NFLX` zeigen seit 06.10.2026 07:48:56 UTC keine Timing- oder Signalzahl mehr. Im Gesamtspeicher sind 56 Titel ohne Timing und ohne Signal; diese sind als Datenlücke und nicht als neutrale Anlageempfehlung zu verstehen.

## Validierung

- Roter und grüner Unit-Test für Scorefrische sowie expliziten Datenlücken-Satz.
- Bestehende Signalregressionen ausgeführt.
- TypeScript-Kompilierung ohne Fehler.
- Liveprüfung `PLTR.US`: Standard-PEG 1,85, getrenntes Forward-KGV 85,5, Timing 48 und Signal HOLD 45 sichtbar.
- Datenbankabgleich `B`/`NFLX`: beide mit `timing = null`, `signalScore = null`, `signalLabel = null`.

## Datenquellen und Grenzen

- EODHD Fundamentals, Abruf 06.10.2026; vollständiger tokenfreier Rohbeleg: `docs/audit/workings/PLTR_US_RAW_EVIDENCE_2026-10-06.json`.
- Palantir Q2 2026 Earnings Release und Shareholder Letter; die Q2-Mitteilung publiziert keine eigene Jahres-EPS-Prognose.
- `stock_scores` und `historical_prices` für lokale Reproduzierbarkeit.

> **Research und Analyse, keine persönliche Anlageberatung.**
