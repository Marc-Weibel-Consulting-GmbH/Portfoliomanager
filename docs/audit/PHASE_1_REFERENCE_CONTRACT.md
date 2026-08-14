# Phase 1 — Einheiten- und Referenzfallvertrag

**Status:** in Prüfung  
**Zweck:** Dieser Vertrag ist der Massstab für die fachliche Codeprüfung. Er beschreibt beobachtete Schnittstellen und handrechenbare Sollfälle. Er ist **keine** Änderung der Geschäftslogik.

## Skalen- und Vorzeichenvertrag

| Domäne | Repräsentation | Beobachtete zentrale Quelle | Prüfinvariante |
|---|---|---|---|
| Tagesrendite | Dezimalzahl, z. B. `0.012 = +1.2 %` | `server/analytics/riskStats.ts:7–15` | Jede annualisierte Kennzahl erhält eine Tagesrenditeserie, niemals schon Prozentwerte. |
| Qualitäts-/Momentum-Rohscore | `[-1, +1]` | `qualityMomentumEngine`-Aufrufer im Signal-Cache | Umrechnung in 0–100 nur an klar markierten Persistenz-/Darstellungsgrenzen. |
| Drei-Score-Signal | `[0, 100]` | `server/lib/dreiScoreSignal.ts:155–246` | Qualität, Bewertung und Timing verwenden dieselbe Skala; Gewichte werden nur auf vorhandene Faktoren normiert. |
| LPPL-/Blasenscore | `[0, 1]` für Überhitzung; Regime-Risiko `[-1, 1]` | `dreiScoreSignal.ts:70–72`, `signals/types.ts:49–52` | Eine Vermischung beider Bedeutungen muss explizit transformiert werden. |
| Cashflow | Einzahlung positiv, Entnahme negativ | `performanceEngine.ts:29–37`, `542–582` | TTWROR neutralisiert nur externe Cashflows; Käufe/Verkäufe/Dividenden sind auf Portfolioebene intern. |
| Drawdown | Dezimalzahl `≤ 0` | `riskStats.ts:88–99`, `signals/types.ts:51` | Maximaler Drawdown ist negativ; Anzeige darf sein Vorzeichen nicht still ändern. |
| Gewicht | Dezimalzahl `[0, 1]` | `riskStats.ts:204–244` | Zielsumme = 1; Minimum und Maximum müssen zusammen zulässig sein. |

## Verbindliche Sortino-Definition (F1-01)

Die Anwendung verwendet die **target-aware Sortino-Ratio**. Für tägliche einfache Renditen `r_t` und den jährlichen risikofreien Satz `rf` gilt die tägliche Mindesthürde `T = rf / 252`.

```text
Excess return:       e_t = r_t − T
Annualized return:   mean(e_t) × 252
Downside deviation:  sqrt(sum(min(0, e_t)^2) / N) × sqrt(252)
Sortino:             annualized return / downside deviation
```

Zähler und Downside-Term verwenden damit dieselbe Mindesthürde. Bei `rf = 0` entspricht diese Definition dem bisherigen Nullziel-Fall. Wenn keine Rendite unter der Mindesthürde liegt, bleibt der bestehende Rückgabevertrag `0` als endlicher, neutraler Wert bestehen; die Anwendung erzeugt keine unendlichen Kennzahlen.

## Handrechenbare Referenzfälle

| ID | Sollfall | Erwartetes Ergebnis | Primäre Prüffläche |
|---|---|---|---|
| R1 | Signal: Qualität = 50, Timing = 0, Gewichte 50/50 | Signierter Qualitätsteil = 0; Gesamt = 0; Empfehlung `hold`. | `signalBlend.ts:85–91`, `169–191` |
| R2 | Drei-Score: Qualität 80, Bewertung fehlt, Timing 60; Bullen-Gewichte 25/25/50 | Abdeckung = 0.75; normierter Score = `(80×0.25 + 60×0.50)/0.75 = 66.666…`; Band B / `BUY`. | `dreiScoreSignal.ts:203–245` |
| R3 | Drei-Score: Nur Timing vorhanden im Bullenregime | Abdeckung = 0.50 < 0.60; Ergebnis muss `null` sein. | `dreiScoreSignal.ts:52–60`, `214–225` |
| R4 | Sharpe: konstante Tagesrenditen über Risikofreier Tagesrate | Standardabweichung = 0; Rückgabewert gemäss aktuellem Vertrag = 0. | `riskStats.ts:44–49` |
| R5 | TTWROR: CHF 100'000 → CHF 160'000 mit Einzahlung CHF 50'000 am Folgetag | Tagesrendite = `160'000 / 150'000 − 1 = 6.666… %`; Einzahlung wird neutralisiert. | `performanceEngine.ts:142–180` |
| R6 | TTWROR: CHF 100'000 → CHF 85'000 mit Entnahme CHF 20'000 am Folgetag | Tagesrendite = `(85'000 + 20'000)/100'000 − 1 = 5 %`; Entnahme wird neutralisiert. | `performanceEngine.ts:154–177` |

## Vorläufige Beobachtungen, noch keine Fixfreigabe

| ID | Beleg | Beobachtung | Nächster Verifikationsschritt |
|---|---|---|---|
| K1 | `signals/regimeEngine.ts:282–289` | Der Kommentar verlangt bei LPPL-Warnung eine reduzierte Konfidenz; die Rückgabe bleibt jedoch bei `rulesMatched / totalRules` und damit im Bullenpfad 1.0. | Deterministischer Feature-Fall mit LPPL-Risiko `0.6`; Rückgabe und UI-Verwendung der Konfidenz verfolgen. |
| K2 | `riskStats.ts:51–64` | Der Zähler des Sortino nutzt Überschussrenditen, der Downside-Term aber negative Bruttorenditen relativ zu 0. | Sollformel/Produktdefinition des Mindestziels feststellen und einen Referenzfall knapp unter der risikofreien Tagesrate rechnen. |
| K3 | `tickerScoring.ts` gegenüber `signalBlend.ts:125–142` | Ein paralleler Helper besitzt abweichende Signalbänder; die tatsächlichen Aufrufer und die beabsichtigte Rolle werden vor jeder Bewertung geprüft. | Aufrufer, Persistenz und sichtbare Verbraucher ermitteln; bewusstes Legacy-/Shadow-Verhalten ausschliessen. |

> Ein Punkt wird erst dann als Befund `F1-xx` aufgenommen, wenn der Referenzfall reproduzierbar ausgeführt, die Auswirkungen entlang des tatsächlichen Produktpfads verfolgt und ein Falsch-positiv-Check gegen dokumentierte Entscheidungen abgeschlossen ist.
