# Research-Triage-Loop — 31. August 2026

**Repository:** `Marc-Weibel-Consulting-GmbH/Portfoliomanager`  
**Referenzzeitpunkt:** 31. August 2026  
**Scope:** Alle offenen Issues mit dem Label `research`, Titelpräfix `[Research]`, ohne Fortschrittslabel aus `research:spike`, `research:review`, `research:accepted` oder `research:rejected`; maximal zwei Kandidaten.

## Ergebnis der Kandidatenfilterung

Der vollständige Filter ergab genau **einen** zulässigen Kandidaten. Alle weiteren offenen Research-Issues trugen bereits ein Fortschrittslabel und wurden entsprechend dem vorgegebenen Protokoll nicht erneut bearbeitet.

| Rang | Issue | Konfidenz | Technische Entscheidung | GitHub-Status |
|---:|---|---:|---|---|
| 1 | [#342 — Profilgerechte Diversifikationsregeln vereinfachen](https://github.com/Marc-Weibel-Consulting-GmbH/Portfoliomanager/issues/342) | 8 / 10 | `SKIPPED` / nicht leakage-frei testbar | `research`, `research:rejected` |

## Daten- und Engine-Prüfung

Die Preisabdeckung allein wäre für den verlangten OOS-Zeitraum ausreichend: 112 Ticker haben insgesamt mindestens 300 gespeicherte Preisbeobachtungen, davon 109 Ticker auch im Fenster **2020-01-01 bis 2024-12-31**. Diese Beobachtung genügt jedoch nicht für einen zulässigen Variantenvergleich der Issue-Hypothese.

`algoBacktestEngine` zieht aktuelle Watchlist-, Signal-, Markt-Hub- und Diversifikationszustände heran. Für die drei vorregistrierten `stocks_only`-Varianten existieren keine monatlich versionierten Portfolio- oder Profilzustände und keine zeitgestempelten Signale aus 2020–2024. Das nachträgliche Anwenden der aktuellen Regel auf frühere Rebalancingdaten würde daher Zukunftsinformationen einbeziehen. Die geforderte mindestens eintägige Informationslücke wäre nicht prüfbar.

> Es wurde kein Backtest mit heutigen Regeln auf historischen Daten simuliert. Ein solcher Lauf hätte nur scheinbare Kennzahlen erzeugt und wäre kein zulässiger OOS-Nachweis.

## Durchgeführte GitHub-Aktion

Auf Issue #342 wurde ein vollständiger `SKIPPED`-Kommentar mit Datenabdeckung, fehlender punkt-in-zeitlicher Evidenz, Look-ahead-Begründung und den notwendigen Voraussetzungen für eine spätere Wiederaufnahme veröffentlicht. Anschliessend wurde ausschliesslich das Label `research:rejected` ergänzt. Die Verifikation bestätigte einen Kommentar und die Labels `research` sowie `research:rejected`; nach dem Filter verbleiben keine offenen, unmarkierten `[Research]`-Issues.

Da der Kandidat vor der Prototypphase abgelehnt wurde, wurden bewusst **kein** Research-Branch, **kein** TypeScript-Modul, **kein** Backtest-Skript, **kein** Feature-Flag, **kein** Commit, **kein** Push und **keine** Draft-PR angelegt. Dies entspricht dem Protokollpfad für nicht umsetzbare oder nicht leakage-frei validierbare Hypothesen.

## Wiederaufnahmebedingung

Eine künftige, neue Issue-Iteration kann erst zu einem OOS-Backtest übergehen, wenn für jedes monatliche Rebalancingdatum mindestens die Portfolio-/Profilkonfiguration, die Regelversion, die relevanten Signale und ihr Information-Cutoff point-in-time gespeichert vorliegen. Erst dann wären drei vorregistrierte Varianten mit 10 bps Kosten, monatlichem Rebalancing, den sechs Regimen und der ΔSharpe-Netto-Schwelle ohne Look-ahead prüfbar.

## Referenzen

[1]: [Issue #342](https://github.com/Marc-Weibel-Consulting-GmbH/Portfoliomanager/issues/342)  
[2]: [`server/lib/algoBacktestEngine.ts`](../../server/lib/algoBacktestEngine.ts)  
[3]: [`drizzle/schema.ts`](../../drizzle/schema.ts) — `historicalPrices` als geprüfte Preisquelle
