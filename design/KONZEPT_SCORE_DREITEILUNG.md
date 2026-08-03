# Konzept: Qualität, Bewertung und Timing trennen

**Status:** Entwurf zur Entscheidung — keine Umsetzung
**Anlass:** Der angezeigte «Qualitäts-Score» misst überwiegend die Bewertung, nicht die
Güte des Unternehmens.
**Betroffen:** `server/scoring.ts`, `server/lib/qualityMetricsService.ts`,
`server/lib/signalBlend.ts`, alle Anzeigestellen des Scores

---

## 1 · Befund

### 1.1 Kein einziger Qualitätsfaktor im Qualitäts-Score

`calculateStockScore()` (`server/scoring.ts:355`) wählt anhand des Titeltyps eines von
zwei Faktorenbündeln:

| Faktor | Gewicht | misst tatsächlich |
|---|---|---|
| **Dividendenprofil** (`scoreDividendStock`) | | |
| Dividendenrendite | 0.40 | Bewertung — Ausschüttung ÷ **Kurs** |
| KGV | 0.30 | Bewertung |
| Beta | 0.20 | Kursrisiko |
| Volatilität | 0.10 | Kursrisiko |
| **Wachstumsprofil** (`scoreGrowthStock`) | | |
| Sharpe Ratio | 0.30 | vergangene Kursentwicklung |
| PEG Ratio | 0.25 | Bewertung |
| Gewinnwachstum | 0.25 | abgeleitet aus KGV ÷ PEG |
| Beta | 0.20 | Kursrisiko |
| Momentum YTD | 0.15 | vergangene Kursentwicklung |

**Abgrenzungstest:** Ein Faktor gehört in einen Qualitätsscore, wenn er sich *nicht*
ändert, sobald allein der Kurs sich ändert. Unter diesem Test verlassen **alle neun**
heutigen Faktoren den Score. Es fehlen: Kapitalrendite, Margen, Margentrend,
Gewinnstabilität, Verschuldung, Ausschüttungsdeckung.

### 1.2 Belegfall ABB (ABBN.SW, Stand 2026-08-03)

| Kennzahl | Wert |
|---|---|
| Angezeigter Qualitäts-Score | **31 / 100 — «Schwach»** |
| Kategorie | Dividendenaktien → Dividendenprofil |
| Dividendenrendite | 1.51 % → Teilscore 12.8 (Gewicht 0.40) |
| KGV | 35.98 → Teilscore 12.5 (Gewicht 0.30) |
| Beta | 1.026 → Teilscore 60.3 (Gewicht 0.20) |
| Volatilität | 27.15 % → Teilscore 57.1 (Gewicht 0.10) |
| Sharpe Ratio | 1.54 |
| Performance YTD | +36.3 % |
| Signal-Score | 75 |

70 % des Gewichts (Rendite + KGV) sagen dasselbe aus: **teuer**. Die Note «schwache
Qualität» ist in Wahrheit die Aussage «hoch bewertet». Über ABBs operative Güte —
Margen, Kapitalrendite, Gewinnstabilität — enthält der Score keine Information.

Nachgerechnet mit `calculateStockScore()` und den Live-Werten; die Teilscores oben
stammen aus dem Lauf, nicht aus einer Schätzung.

### 1.3 Doppelzählung im Wachstumsprofil

```ts
// server/scoring.ts:201
earningsGrowth = (metrics.peRatio / metrics.pegRatio);
```

«Gewinnwachstum» ist keine eigenständige Messung, sondern eine Umformung von KGV und
PEG. PEG (0.25) und Gewinnwachstum (0.25) tragen zusammen die Hälfte des Gewichts und
beruhen auf denselben zwei Zahlen. Ein Fehler im PEG geht doppelt und gleichgerichtet
ein.

### 1.4 Die Inhalte sind teilweise vertauscht

`server/lib/qualityMetricsService.ts` berechnet bereits:

- ROIC, Eigenkapitalrendite
- Bruttomarge, Betriebsmarge
- EPS-Wachstum TTM und 5J-CAGR, EPS-Volatilität, EPS-Stabilitätsscore
- Net Debt / EBITDA
- Surprise-Rate der letzten acht Quartale
- einen eigenen `qualityScore` (0–100)

Diese Werte fliessen in den **Signal**-Score (`signalsRouter.ts:135–147` liest ROE,
Bruttomarge und Verschuldung) — aber **nicht** in den Score, der «Qualität» heisst.
Die operative Qualität wird also bereits gemessen und an der falschen Stelle
ausgewiesen.

### 1.5 Zwei unvergleichbare Zahlen unter einer Beschriftung

Die beiden Profile liefern Werte auf derselben 0–100-Skala, mit derselben Beschriftung
und denselben Bändern (`>80 ausgezeichnet · 61–80 gut · 41–60 mittel · ≤40 schwach`).
Eine 31 im Dividendenprofil und eine 31 im Wachstumsprofil bedeuten Verschiedenes.

Die Zuordnung selbst ist zusätzlich instabil:

- `determineStockType` (`scoring.ts:110`) steckt *Value, Balanced, ETF* und *Andere*
  ins Dividendenprofil. Ein ETF wird damit zu 40 % nach seiner Ausschüttungsrendite
  beurteilt.
- Fehlt die Kategorie, greift «Rendite > 2 % → Dividendentitel» (`scoring.ts:117`).
  Ein Titel kann das Profil wechseln, weil sein **Kurs gefallen** ist — die Rendite
  steigt dann rechnerisch, ohne dass das Unternehmen sich verändert hat.

### 1.6 Einheitenfehler bei der Dividendenrendite

`dividendYield` wird ×100 gespeichert (`stocksRouter.ts:574`: `str(divYield * 100)`),
also **151** für 1.51 %. Zwei Aufrufstellen reichen diesen Rohwert ungeteilt an
`calculateStockScore()` weiter, dessen Schwellen `[1.5, 2.5, 4, 6]` in Prozent stehen:

- `server/helpers/portfolioEnrichment.ts:162`
- `server/routers/stocksRouter.ts:532` (Nachberechnung bei fehlendem Score)

Nachgerechnet für ABB: Teilscore **12.8 statt 87.5**, Gesamtscore **26.6 gegenüber
56.5**. Derselbe Rohwert lässt ausserdem die Fallback-Regel aus 1.5 immer anschlagen —
praktisch jeder Titel ohne passende Kategorie landet im Dividendenprofil.

Das ist ein eigenständiger Fehler, unabhängig von der Konzeptfrage, und in einem
separaten Schritt zu beheben.

---

## 2 · Vorschlag

Drei Scores statt einem, jeder mit einer klaren Frage:

| Score | Frage | Kurzform |
|---|---|---|
| **Qualität** | Ist das ein gutes Unternehmen? | *Was* kaufe ich |
| **Bewertung** | Ist der Preis dafür angemessen? | *Zu welchem Preis* |
| **Timing** | Ist jetzt ein guter Zeitpunkt? | *Wann* |

Die Trennlinien:

- **Kursunabhängigkeit** entscheidet zwischen Qualität und den beiden anderen. Ändert
  sich ein Faktor, wenn nur der Kurs sich bewegt, gehört er nicht zu Qualität.
- **Geschäftsrisiko** (Gewinnstabilität, Verschuldung) gehört zu Qualität,
  **Kursrisiko** (Beta, Volatilität) zu Timing.

### 2.1 Qualität

Alle Kennzahlen liegen in `qualityMetricsService` bereits vor.

| Faktor | Gewicht | Quelle | Begründung |
|---|---|---|---|
| ROIC | 0.25 | `roic` | Kapitalrendite über den Kapitalkosten ist der belastbarste Einzelindikator für einen Wettbewerbsvorteil |
| Betriebsmarge | 0.20 | `operatingMargin` | Preissetzungsmacht |
| Eigenkapitalrendite | 0.15 | `returnOnEquity` | ergänzt ROIC, reagiert aber auf Verschuldung — deshalb geringeres Gewicht |
| EPS-Stabilität | 0.15 | `epsStabilityScore` | schwankende Gewinne sind ein Qualitätsmangel, kein Kursrisiko |
| Net Debt / EBITDA | 0.15 | `netDebtToEbitda` | Bilanzrisiko, invertiert |
| Bruttomarge | 0.10 | `grossMargin` | Struktur des Geschäftsmodells |

Bewusst **nicht** enthalten: Umsatz- und Gewinnwachstum. Wachstum ist eine eigene
Dimension und wird in der Bewertung über das PEG bereits berücksichtigt; im
Qualitätsscore würde es zyklische Titel im Aufschwung systematisch begünstigen.

Die Surprise-Rate (`surpriseRate`) bleibt vorerst draussen — sie misst die Treffsicherheit
der Analystenschätzungen, nicht die Güte des Unternehmens.

### 2.2 Bewertung

| Faktor | Gewicht | Quelle | Anmerkung |
|---|---|---|---|
| PEG (adjusted) | 0.30 | `adjustedPeg` | bereits qualitäts- und volatilitätsbereinigt |
| KGV (forward) | 0.25 | `forwardPE` | Rückfall auf `trailingPE`, wenn nicht verfügbar |
| Dividendenrendite | 0.20 | `stocks.dividendYield` | **÷ 100**, siehe 1.6 |
| FCF-Rendite | 0.15 | *fehlt* | siehe offene Punkte |
| EV / EBITDA | 0.10 | *fehlt* | siehe offene Punkte |

Für Titel ohne Gewinn (PEG und KGV nicht definiert) tragen die verbleibenden Faktoren
hochskaliert — dieselbe Mechanik wie heute. Ist gar kein Bewertungsmass verfügbar,
wird **kein Score** ausgewiesen statt einer 0 (Lehre aus dem Regime-Ausfall, PR #235).

### 2.3 Timing

**Existiert bereits als Signal-Score.** Hier ist keine neue Grösse zu bauen, sondern
umzuräumen:

- **hinein:** Sharpe Ratio und Momentum YTD — heute im Qualitätsprofil, obwohl sie
  vergangene Kursentwicklung messen. Ebenso Beta und Volatilität als Kursrisiko.
- **hinaus:** die operativen Kennzahlen (ROE, Bruttomarge, Verschuldung), die
  `signalsRouter.ts:135–147` heute einliest — sie gehören in den Qualitätsscore.

Der Signal-Score behält seinen `qualityScore`-Eingang in `blendCombinedScore()`; er
wird künftig aus dem **neuen** Qualitätsscore gespeist statt aus einer Mischung.

### 2.4 Was das für ABB ergäbe

| Score | erwartete Aussage |
|---|---|
| Qualität | hoch — solide Margen und Kapitalrendite |
| Bewertung | tief — KGV 36, PEG teuer |
| Timing | gut — Signal 75, Sharpe 1.54, YTD +36 % |

Gelesen: **«Gutes Unternehmen, zu teuer, läuft gerade gut.»** Damit kann ein Anleger
etwas anfangen. «31 — schwach» kann er es nicht.

---

## 3 · Skala und Bänder

Jeder Score bleibt 0–100, aber die Bänder werden **je Dimension** kalibriert. Eine 80
in der Bewertung bedeutet etwas anderes als eine 80 in der Qualität, und dieselben
Etiketten für beide wären der Fehler aus 1.5 in neuer Form.

Vorschlag für die Beschriftung:

| Score | hoch heisst | Etiketten |
|---|---|---|
| Qualität | gutes Unternehmen | ausgezeichnet · gut · mittel · schwach |
| Bewertung | **günstig** | günstig · fair · ambitioniert · teuer |
| Timing | günstiger Zeitpunkt | bestehende Notenbänder aus `SCORE_BAENDER` |

Die Bewertungsachse braucht besondere Sorgfalt: Ein hoher Wert muss «günstig»
bedeuten, sonst liest sich «Bewertung 85» als «teuer». Die Richtung ist in der
Oberfläche ausdrücklich zu benennen.

---

## 4 · Migration

1. **Einheitenfehler zuerst** (1.6) — er verfälscht heute Zahlen und ist unabhängig
   vom Umbau. Eigener, kleiner PR.
2. **Neue Scores parallel berechnen**, ohne Anzeige. Wie bei der Regime-Schattenrechnung
   (`regimeSchatten.ts`): erst messen, wie stark sich alt und neu unterscheiden.
3. **Umstellung der Anzeige** in einem Zug, damit nie zwei Bedeutungen desselben
   Etiketts nebeneinander stehen. Betroffen sind mindestens:
   `StockDetail.tsx`, `PortfolioDetailsPage.tsx`, `Dashboard.tsx`,
   `PositionsKonstellation.tsx`, `PortfolioQualityHistory.tsx`, `RiskTab.tsx`,
   `PegContextCard.tsx`, `AdminScoreConfig.tsx`.
4. **Historie**: `stocks.score` und die Score-Snapshots enthalten Werte nach altem
   Konzept. Sie sind nicht in die neue Skala umrechenbar. Vorschlag: alte Reihe
   einfrieren und stehen lassen, neue Reihe daneben beginnen — nicht rückwirkend
   überschreiben.

---

## 5 · Offene Punkte

- **FCF-Rendite und EV/EBITDA fehlen.** Beide sind für die Bewertungsachse wertvoll,
  aber heute nicht erhoben. `signalsRouter.ts:143–146` erfindet derzeit einen
  `fcfYield` aus Score-Bändern (`> 60 → 3.0`, `> 40 → 1.0`, sonst `-1.0`). Das ist ein
  Platzhalter, keine Messung, und sollte durch den echten Wert ersetzt oder entfernt
  werden.
- **`debtToEquity` ist ein Proxy** (`netDebtToEbitda * 0.5`, `signalsRouter.ts:141`).
  Für den Qualitätsscore wird `netDebtToEbitda` direkt verwendet; der Proxy entfällt.
- **Abdeckung ist nicht gemessen.** Wie viele Titel im Universum liefern ROIC, Margen
  und EPS-Historie? Ist die Abdeckung dünn, greift der Qualitätsscore bei vielen
  Titeln auf wenige Faktoren zurück. Vor der Umsetzung zu erheben — mit derselben
  Konsequenz wie in PR #235: unter einer Mindestabdeckung **kein Score** statt eines
  schwach belegten.
- **Asset-Klassen.** `calculateStockScore` leitet Obligationen, Gold, Rohstoffe,
  Krypto und Immobilien an eigene Scorer weiter (`scoring.ts:365–375`). Für sie ist
  «Qualität» teils nicht definiert (Gold hat keine Marge). Vorschlag: Dreiteilung nur
  für Aktien, für die übrigen Klassen der bestehende Pfad und eine ehrliche
  Kennzeichnung statt einer Zahl.
- **Profiltrennung.** Entfällt die Aufteilung in Dividenden- und Wachstumstitel
  vollständig? Der Vorschlag oben verwendet einheitliche Faktoren für alle Aktien. Das
  ist die einfachere und besser vergleichbare Lösung, benachteiligt aber
  möglicherweise Titel, deren Geschäftsmodell strukturell tiefe Margen hat (Handel,
  Versorger). Alternative: Branchenrelative Normalisierung statt zweier fester
  Profile — mehr Aufwand, aber sachlich näher dran.
