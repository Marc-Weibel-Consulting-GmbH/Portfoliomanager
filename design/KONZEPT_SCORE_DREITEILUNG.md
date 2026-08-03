# Konzept: Qualität, Bewertung und Timing trennen

**Status:** Entwurf zur Entscheidung — keine Umsetzung
**Anlass:** Der angezeigte «Qualitäts-Score» misst überwiegend die Bewertung, nicht die
Güte des Unternehmens.
**Betroffen:** `server/scoring.ts`, `server/lib/qualityMetricsService.ts`,
`server/lib/signalBlend.ts`, alle Anzeigestellen des Scores
**Externe Referenz:** Sandro Rosa, «Qualitätsaktien für unsichere Zeiten»,
*The Market NZZ*, 30.07.2026 — Piotroski F-Score über rund 1550 Aktien aus SPI,
Stoxx 600, S&P 500 und Nikkei 225

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

Die Rendite wird **zweimal** in Prozent umgerechnet und steht damit hundertfach zu hoch
in der Datenbank.

EODHD liefert einen Bruch (`0.0151` = 1.51 %). Die Umrechnung geschieht korrekt in
`server/_core/eodhdApi.ts:198`:

```ts
// EODHD returns dividend yield as decimal (0.03 = 3%)
fundamentals.dividendYield = pf(highlights.DividendYield) * 100;   // 0.0151 → 1.51
```

`server/scheduled/signalScoreRefreshScheduled.ts:190` multipliziert denselben, bereits
umgerechneten Wert erneut:

```ts
const divYield = fundamentals.dividendYield;                      // = 1.51, schon Prozent
dividendYield: divYield != null ? (divYield * 100).toFixed(4) : stock.dividendYield;
//                                            ^^^^^ → 151.0000
```

Stichprobe aus der Produktionsdatenbank (2026-08-03):

| Titel | gespeichert | tatsächlich |
|---|---|---|
| ABBN.SW | 151.0000 | 1.51 % |
| NESN.SW | 376.0000 | 3.76 % |
| NOVN.SW | 368.0000 | 3.68 % |
| KO.US | 235.0000 | 2.35 % |
| AAPL.US | 31.0000 | 0.31 % |

Ein zweiter Schreibpfad macht es richtig: `server/cron/watchlistAlertsCron.ts:128` holt
den Wert von Yahoo, wo er tatsächlich noch ein Bruch ist — die Variable heisst dort
`dividendYieldFraction` (Zeile 118). Zwei Jobs schreiben also mit unterschiedlichem
Verständnis in dieselbe Spalte.

**Auswirkungen:**

- **Anzeige.** `client/src/pages/StockDetail.tsx:782` gibt den Rohwert mit
  Prozentzeichen aus (`parseFloat(...).toFixed(1)`, `suffix="%"`) — für ABB also
  «151.0 %». Im Client wird nirgends durch 100 geteilt.
- **Ampel.** `getRating` (`StockDetail.tsx:433`) stuft `> 3` als «gut» ein; bei 151 ist
  jeder Titel mit irgendeiner Ausschüttung grün.
- **Score.** `calculateStockScore()` vergleicht mit Schwellen in Prozent
  (`[1.5, 2.5, 4, 6]`). Zwei Stellen reichen den Rohwert ungeteilt weiter:
  `server/helpers/portfolioEnrichment.ts:162` und `server/routers/stocksRouter.ts:532`.
  Nachgerechnet für ABB: Teilscore **87.5 statt 12.8**, Gesamtscore **56.5 gegenüber
  26.6**.
- **Profilzuordnung.** Die Fallback-Regel aus 1.5 («Rendite > 2 %») sieht 151 und
  schlägt bei praktisch jedem Titel an.

**Korrektur:** Das `* 100` in `signalScoreRefreshScheduled.ts:190` entfällt, dazu ein
einmaliges Aufräumen der Bestandswerte und ein Test, der die Konvention festhält.
Eigenständiger Fehler, unabhängig von der Konzeptfrage, in einem separaten Schritt zu
beheben.

### 1.7 Gegenprobe an einer etablierten Methodik

*The Market NZZ* hat am 30.07.2026 rund 1550 Aktien aus SPI, Stoxx 600, S&P 500 und
Nikkei 225 nach dem **Piotroski F-Score** durchgerechnet (Sandro Rosa, «Qualitätsaktien
für unsichere Zeiten»). Der Vergleich mit unserem Score:

| Titel | Piotroski F-Score | unser «Qualitäts-Score» |
|---|---|---|
| Novartis | 7 von 9 — «gut» | 68 |
| **ABB** | 7 von 9 — «gut» | **31 — «schwach»** |
| **Logitech** | 7 von 9 — «gut» | **43 — «mittel»** |
| **Apple** | **8 von 9** — Spitzengruppe S&P 500 | **48 — «mittel»** |

Drei von vier Titeln, die eine etablierte Qualitätsmethodik unter die besten ihres
Marktes einordnet, führt unser Score als mittel oder schwach. Das ist kein Beleg dafür,
dass Piotroski recht hat — wohl aber dafür, dass unser Score etwas anderes misst als
das, was in der Branche unter Qualität verstanden wird.

**Der Einheitenfehler aus 1.6 erklärt das nicht.** Die gespeicherten Werte sind
einheitenrichtig gerechnet; ABB bleibt nach dessen Behebung bei rund 27. Der Befund ist
konzeptioneller Natur.

### 1.8 Was der Piotroski F-Score misst

Neun binäre Kriterien, je 0 oder 1, Maximum 9:

**Profitabilität (4)**
- Betrieblicher Cashflow ist positiv
- Betrieblicher Cashflow übertrifft den Gewinn
- Gesamtkapitalrendite (ROA) ist positiv
- ROA höher als im Vorjahr

**Bilanz (3)**
- Geringere langfristige Verschuldung als im Vorjahr
- Current Ratio über dem Vorjahreswert
- Aktienzahl konstant oder gesunken

**Operative Effizienz (2)**
- Bruttomarge höher als im Vorjahr
- Kapitalumschlag (Umsatz ÷ mittleres Gesamtkapital) höher als im Vorjahr

Bewertung: ab 8 «sehr gutes Investment», unter 3 «Alarmglocken».

**Drei Dinge daran fehlen unserem Entwurf vollständig:**

1. **Richtung statt nur Niveau.** Sechs der neun Kriterien vergleichen mit dem Vorjahr.
   Unser Entwurf misst ausschliesslich Niveaus. Ein Unternehmen mit 25 % ROIC, dessen
   Marge seit drei Jahren fällt, sieht bei uns hervorragend aus.
2. **Ertragsqualität.** «Betrieblicher Cashflow übertrifft den Gewinn» prüft, ob der
   ausgewiesene Gewinn durch Zahlungsströme gedeckt ist. Das ist der wirksamste Schutz
   gegen buchhalterisch erzeugte Gewinne — und in unserem Entwurf gar nicht vorhanden.
3. **Verwässerung.** Eine steigende Aktienzahl verwässert den Wert je Aktie. Kommt bei
   uns nicht vor.

**Was der F-Score nicht kann**, und weshalb er unseren Score nicht ersetzt: Er misst
Veränderung, nicht Güte. Ein mittelmässiges Unternehmen, das sich in allen neun Punkten
verbessert, erreicht 9; ein hervorragendes auf hohem Plateau kommt kaum über 4. Der
Artikel nennt den ursprünglichen Zweck ausdrücklich — Piotroski entwarf ihn, um bei
**Value-Aktien** die Bewertungsfallen auszusortieren, nicht als Qualitätsrangliste.

Niveau und Richtung sind also zwei verschiedene Fragen, und beide gehören beantwortet.

### 1.9 Der Artikel bestätigt die Dreiteilung selbst

Seine Tabellen führen den F-Score (Qualität) und daneben in eigenen Spalten das
geschätzte KGV, das Kurs-Buchwert-Verhältnis und die Free-Cash-Flow-Rendite
(Bewertung). Beides wird nirgends zu einer Zahl verrechnet.

Und zum Timing: Der Artikel berichtet, dass Terry Smith seinen strikten Qualitätsansatz
aufweicht und künftig auch Momentum berücksichtigt; zu GSK heisst es, der Titel sei
«auch aus markttechnischer Perspektive interessant». Qualität, Bewertung und Timing
stehen dort nebeneinander — genau die Struktur, die dieses Konzept vorschlägt.

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

### 2.1 Qualität — zwei Teile

Nach 1.8 zerfällt Qualität in zwei Fragen, die getrennt zu beantworten sind:

> **Niveau (0.60):** Ist das ein gutes Geschäft?
> **Richtung (0.40):** Bewegt es sich fundamental vorwärts oder rückwärts?

Ohne den Niveau-Teil belohnt man Aufholer und bestraft Spitzenreiter auf hohem Plateau.
Ohne den Richtungs-Teil sieht ein Unternehmen mit erstklassigen, aber seit Jahren
erodierenden Kennzahlen tadellos aus. Die Gewichtung 60/40 gibt dem Niveau den Vorrang —
gemessen wird «Qualität», nicht «Verbesserung».

#### Niveau (0.60 des Qualitätsscores)

Alle Kennzahlen liegen in `qualityMetricsService` bereits vor.

| Faktor | Anteil | Quelle | Begründung |
|---|---|---|---|
| ROIC | 0.25 | `roic` | Kapitalrendite über den Kapitalkosten ist der belastbarste Einzelindikator für einen Wettbewerbsvorteil |
| Betriebsmarge | 0.20 | `operatingMargin` | Preissetzungsmacht |
| **Ertragsqualität** | **0.20** | *neu:* operativer Cashflow ÷ Nettogewinn | Deckt der Zahlungsstrom den ausgewiesenen Gewinn? Der wirksamste Schutz gegen buchhalterisch erzeugte Gewinne (Piotroski-Kriterium 2) |
| EPS-Stabilität | 0.15 | `epsStabilityScore` | schwankende Gewinne sind ein Qualitätsmangel, kein Kursrisiko |
| Net Debt / EBITDA | 0.10 | `netDebtToEbitda` | Bilanzrisiko, invertiert |
| Bruttomarge | 0.10 | `grossMargin` | Struktur des Geschäftsmodells |

Die Eigenkapitalrendite entfällt gegenüber dem ersten Entwurf: Sie misst weitgehend
dasselbe wie ROIC, reagiert aber zusätzlich auf die Verschuldung — ein hoch
fremdfinanziertes Unternehmen erscheint dadurch besser. Der freigewordene Anteil geht an
die Ertragsqualität, die etwas misst, das sonst niemand abdeckt.

#### Richtung (0.40 des Qualitätsscores) — Piotroski F-Score

Die neun Kriterien aus 1.8, unverändert übernommen und auf 0–100 skaliert
(`F-Score ÷ 9 × 100`). Die binäre Form ist bewusst beibehalten: Sie braucht keine
Kalibrierung, ist gegen Ausreisser unempfindlich und international vergleichbar.

Der rohe F-Score (0–9) wird **zusätzlich** ausgewiesen. Er ist die verständlichere Zahl
— «7 von 9 Kriterien erfüllt» sagt einem Privatanleger mehr als «78 von 100».

**Zwei Eigenheiten sind zu kommunizieren:** Der F-Score beruht auf Jahresabschlüssen und
ändert sich höchstens einmal jährlich. Und er kennt nur zehn Stufen — zwischen 6 und 7
liegt ein sichtbarer Sprung, innerhalb einer Stufe keine Abstufung.

#### Bewusst nicht enthalten

**Umsatz- und Gewinnwachstum.** Wachstum ist eine eigene Dimension und wird in der
Bewertung über das PEG berücksichtigt; im Qualitätsscore würde es zyklische Titel im
Aufschwung systematisch begünstigen.

**Die Surprise-Rate** (`surpriseRate`) misst die Treffsicherheit der Analystenschätzungen,
nicht die Güte des Unternehmens.

### 2.2 Bewertung

| Faktor | Gewicht | Quelle | Anmerkung |
|---|---|---|---|
| PEG (adjusted) | 0.25 | `adjustedPeg` | bereits qualitäts- und volatilitätsbereinigt |
| KGV (forward) | 0.25 | `forwardPE` | Rückfall auf `trailingPE`, wenn nicht verfügbar |
| **FCF-Rendite** | **0.20** | *fehlt* | siehe offene Punkte — der Artikel führt sie in **jeder** seiner vier Tabellen; sie ist schwerer zu manipulieren als der Gewinn |
| Dividendenrendite | 0.15 | `stocks.dividendYield` | siehe 1.6 |
| **Kurs-Buchwert** | **0.15** | *fehlt* | Piotroskis Definition einer Value-Aktie; im Artikel durchgehend ausgewiesen. Für Banken und Versicherer die aussagekräftigste Bewertungsgrösse überhaupt |

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

| Score | erwartete Aussage | Beleg |
|---|---|---|
| Qualität | **hoch** | Piotroski 7 von 9 laut *The Market*; solide Margen und Kapitalrendite |
| Bewertung | **tief** | KGV 26.5 (2027e), Kurs-Buchwert 10.9, FCF-Rendite 2.8 % — alle drei am oberen Rand |
| Timing | **gut** | Signal 75, Sharpe 1.54, YTD +36 % |

Gelesen: **«Gutes Unternehmen, zu teuer, läuft gerade gut.»** Damit kann ein Anleger
etwas anfangen. «31 — schwach» kann er es nicht.

Die Bewertungszahlen stammen aus der Schweizer F-Score-Tabelle des Artikels und decken
sich mit unseren eigenen Werten (KGV trailing 36.0). Bemerkenswert ist die
Gegenläufigkeit: Dieselbe Aktie ist zugleich von hoher Qualität **und** teuer. Genau
diese Aussage kann ein einzelner Score nicht transportieren — er muss sich für eine der
beiden entscheiden, und heute entscheidet er sich stillschweigend für die Bewertung.

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

## 5 · Datenverfügbarkeit für Piotroski

Der F-Score braucht Jahresabschlüsse über **zwei** Geschäftsjahre. Was heute schon
abgerufen wird:

| Benötigt | Abschnitt der EODHD-Antwort | Status |
|---|---|---|
| Betrieblicher Cashflow | `Financials.Cash_Flow.yearly` | in derselben Antwort enthalten, **noch nicht gelesen** |
| Nettogewinn, Umsatz, Bruttomarge | `Financials.Income_Statement.yearly` | wird gelesen (`qualityMetricsService.ts:264`) |
| Gesamtkapital, langfristige Schulden, Umlaufvermögen | `Financials.Balance_Sheet.yearly` | wird gelesen (`:263`) |
| Aktienzahl | Bilanz bzw. `SharesStats` | zu bestätigen |

Der entscheidende Punkt: **Es braucht keinen zusätzlichen Abruf und keine neue Quelle.**
`getQualityMetrics` holt die vollständigen Fundamentaldaten bereits und wertet nur das
jeweils **letzte** Jahr aus (`bsKeys.at(-1)`). Die Vorjahreswerte liegen im selben
Objekt und werden schlicht verworfen.

Ungeprüft ist die Vollständigkeit über das Universum hinweg — insbesondere bei
Schweizer Nebenwerten. Das gehört vor der Umsetzung gemessen; siehe den Punkt zur
Abdeckung unten.

---

## 6 · Offene Punkte

- **FCF-Rendite, EV/EBITDA und Kurs-Buchwert fehlen.** Alle drei sind für die
  Bewertungsachse wertvoll, aber heute nicht erhoben. FCF-Rendite und Kurs-Buchwert
  führt der Artikel in jeder seiner vier Tabellen — sie gehören offensichtlich zum
  Standardrepertoire. `signalsRouter.ts:143–146` erfindet derzeit einen `fcfYield` aus
  Score-Bändern (`> 60 → 3.0`, `> 40 → 1.0`, sonst `-1.0`). Das ist ein Platzhalter,
  keine Messung, und sollte durch den echten Wert ersetzt oder entfernt werden.
- **Shiller-KGV für die Marktebene.** Der Artikel begründet seine Vorsicht mit dem
  zyklisch adjustierten KGV des Weltaktienindex, das so hoch steht wie zuletzt in der
  Technologieblase. Das ist keine Titelkennzahl, sondern eine Regime-Grösse — sie
  gehörte in `marketRegimeRouter`, nicht in den Bewertungsscore. Die dortige
  Bubble-Engine misst mit LPPL etwas anderes (Beschleunigungsmuster im Kurs), nicht die
  Bewertungshöhe. Eigener Prüfpunkt.
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
