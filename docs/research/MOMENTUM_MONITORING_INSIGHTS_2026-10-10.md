# Momentum-Monitoring: Erkenntnisse aus dem Beitrag für den Portfoliomanager

Der Beitrag von *The Market* verwendet einen nachvollziehbaren Kern: Aktien werden über **sechs und zwölf Monate Kursmomentum** gleich gewichtet rangiert. Das ist für das Tool ein sinnvoller Ausgangspunkt, aber nicht als alleiniger Kauf- oder Verkaufsmechanismus. Die Forschung stützt die Idee, dass vergangene Kurs- und Gewinnüberraschungen Informationen über nachfolgende Renditen enthalten können. Sie stützt **nicht** die Behauptung, dass ein hoher Rang eine sichere oder zeitlich präzise Anlageentscheidung ist. [1]

## Was im Tool konkret ergänzt werden sollte

### 1. Ein erklärbares Momentum-Ranking als eigene Ebene

Für jede qualifizierte Aktie sollte das Tool zusätzlich zum bestehenden Timing einen **Momentum-Rang** veröffentlichen. Die Berechnung soll strikt aus der getrennten, splitbereinigten Preisrenditereihe kommen, ohne Cashdividenden zu reinvestieren:

- `Momentum 6M`: Preisrendite über rund 126 Handelstage;
- `Momentum 12M`: Preisrendite über rund 252 Handelstage;
- `Momentum-Gesamtscore`: gleichgewichteter Durchschnitt beider Renditen;
- `Perzentil im Vergleichsuniversum`: nicht nur eine absolute Rendite, sondern Rang innerhalb von Schweiz, Europa, USA oder Global; zusätzlich Rang innerhalb des Sektors;
- `Relative Stärke`: 6M/12M gegen denselben regionalen Referenzindex und gegen den Sektorindex.

Damit wird sichtbar, ob ein Titel wie im Artikel zwar stark gestiegen ist, aber gegenüber dem Markt oder seinem Sektor bereits an Führung verliert. Die bestehende Regel zur Trennung von Rohkurs, splitbereinigter Preisrendite und Brutto-Gesamtrendite ist dafür zwingend: Ein Split darf weder als Momentum noch als Umkehrsignal erscheinen.

**Anzeigevorschlag:** eine Karte „Momentum“ mit `6M`, `12M`, Gesamtperzentil, Sektorperzentil, regionaler relativer Stärke und einem Datenbasis-Badge. Titel mit ungeklärter Corporate Action, Fremdlisting, ADR-/Währungsmischung oder zu kurzer Historie bleiben ohne Rang und ohne daraus abgeleitetes Signal.

### 2. Trendzustand statt pauschalem „Kauf bei Stärke“

Der Beitrag unterscheidet praktisch drei sehr verschiedene Situationen: stabiler Trend, Konsolidierung mit intakter relativer Stärke und beschleunigter, potenziell überhitzter Anstieg. Diese Zustände dürfen nicht denselben Timing-Score erhalten.

Ein neuer, **rein beschreibender Trendzustand** sollte auf Wochen- und Monatsdaten basieren:

- **Intakter Trend:** Kurs über steigendem 10-Monats-Durchschnitt; relative Stärke zum Markt nicht fallend.
- **Konsolidierung:** Kursbewegung seitwärts oder Rücksetzer, während der 10-Monats-Durchschnitt weiter steigt und die relative Stärke stabil bleibt.
- **Erholung/Trendwende beobachten:** schwacher Langfristtrend, aber neuer Ausbruch über Trendfilter und verbesserte relative Stärke. Dies bleibt „Beobachten“, bis Mindestdauer und Breite bestätigt sind.
- **Überhitzung:** ungewöhnlich grosse Distanz zum 10-Monats-Durchschnitt oder starke Expansion der Volatilitätsbänder nach langem Anstieg. Das ist ein Risikohinweis, kein automatischer Verkaufsauftrag.
- **Trendbruch:** Kurs und relative Stärke unter flachem oder fallendem Trendfilter.

Bollinger-Bänder und Kerzeninformationen aus dem Beitrag sind nützlich als **Kontext und Visualisierung**. Sie sollen keine isolierten Signale auslösen. Der Artikel selbst zeigt die Grenze gut: Ein hoher Kurs kann gutes Momentum sein, während eine stark beschleunigte Bewegung nach langer Hausse die Eintrittsqualität verschlechtert.

### 3. Sektorbreite und Rotation sichtbar machen

Die wichtigste nicht offensichtliche Beobachtung des Beitrags ist die Differenz zwischen den 25 Spitzenwerten und der breiteren Marktbreite: Technologie dominiert die Spitze, während Finanz- und Industriewerte bei den vielen global überdurchschnittlichen Titeln breiter vertreten sind. Das Tool sollte deshalb nicht nur „Top-Titel“, sondern auch **Trendbreite je Sektor und Region** zeigen.

Ein kleines Dashboard-Modul sollte je Sektor ausweisen:

- Anzahl qualifizierter Titel und Anteil oberhalb des regionalen Benchmark-Momentums;
- Median und Streuung von 6M/12M-Momentum;
- Anzahl neuer Aufsteiger gegenüber dem vorigen Monats-Snapshot;
- Anteil mit intaktem Trend, Konsolidierung, Überhitzung und Trendbruch;
- stärkste und schwächste Veränderung gegenüber dem letzten Monats-Snapshot.

Damit wird eine Konzentration etwa in KI-/Halbleiterwerten transparent. Gleichzeitig können neu aufkommende Gruppen wie der im Artikel erwähnte Gesundheitssektor früh erkannt werden, ohne einzelne Namen aufgrund einer kurzen Kurserholung zu übergewichten.

### 4. Ein expliziter Momentum-Risikogate

Momentum kann in gestressten Marktphasen besonders verwundbar sein. Daniel und Moskowitz dokumentieren seltene, aber schwere Momentum-Crashs insbesondere nach Marktverlusten, bei hoher Volatilität und gleichzeitig starken Markt-Rebounds. [2] Der bestehende LPPL-/Blasenhinweis ist dafür hilfreich, deckt aber nicht dieselbe Marktregime-Gefahr ab.

Ein separates **Momentum-Crash-Gate** sollte deshalb die Kaufstärke herabsetzen oder den Status auf „Beobachten“ stellen, wenn gleichzeitig gelten:

1. der regionale Markt liegt unter seinem langfristigen Trend oder hat einen erheblichen vorangegangenen Drawdown;
2. die realisierte Marktvolatilität ist erhöht;
3. ein starker kurzfristiger Markt-Rebound läuft;
4. der Titel zählt zu den vorherigen Gewinnern und seine relative Stärke flacht ab.

Das Gate darf keine Positionen verkaufen, keine Allokationen ändern und keine Orders auslösen. Es ist ein erklärter Risiko- und Datenkontext für die manuelle Entscheidung.

### 5. Bessere Watchlist- und Portfoliointegration

Die Watchlist sollte künftig drei getrennte Aussagen nebeneinander zeigen:

- **Unternehmensqualität und Bewertung:** bestehende Qualitäts-/Bewertungsscores;
- **Trendqualität:** Momentum-Rang, Trendzustand und relative Stärke;
- **Eintrittsrisiko:** Überhitzung, Momentum-Crash-Gate, Datenqualität und Konzentration im Portfolio.

Ein Titel kann damit etwa „hohe Qualität, gutes Momentum, aber Eintrittsrisiko erhöht“ sein. Das ist wesentlich verständlicher als ein einzelnes Kauf- oder Reduzieren-Label. Für bestehende Portfolio-Positionen soll der Titelstatus nur als Beobachtung dienen; die konkrete Portfolioempfehlung muss weiterhin Diversifikation, Zielallokation, Steuer-/Transaktionskosten und die Karenzzeit nach Portfolioerstellung respektieren.

## Was nicht übernommen werden sollte

Der Beitrag beschreibt Einzeltitel und qualitative Chartdeutung. Daraus sollte das Tool keine automatischen Handelsregeln ableiten. Insbesondere sollten Kerzenformationen, eine einzelne Bollinger-Band-Berührung oder ein Ausbruch über einen gleitenden Durchschnitt niemals ohne Datenqualitäts-, Liquiditäts-, Bewertungs- und Risikokontext zu einem Kauf- oder Verkaufssignal führen.

Ebenso sollte der globale Screen nicht künstlich auf die im Artikel genannten rund 1'300 Indexmitglieder erweitert werden, bevor Handelslinie, Währung, vollständige Historie und Corporate-Action-Basis je zusätzlichem Titel qualifiziert sind. Das bestehende Prinzip „Datenlücke statt geschätztes Signal“ bleibt richtig.

## Empfohlene Reihenfolge der Umsetzung

1. **Monatliche Datensicherheit:** Corporate-Action-Audit als read-only Heartbeat, der alle aktiven Instrumente auf Splits, Reverse-Splits, YTD-/52W-Basis und Handelslinienkompatibilität prüft. Dieser technische Teil ist im Dev-Stand vorbereitet.
2. **Datenmodell für Momentum-Snapshots:** tägliche, versionierte 6M-/12M-Renditen, regionale und sektorale Benchmarks sowie ein Monats-Snapshot für Rangänderungen. Kein Überschreiben von Rohkursen.
3. **Lesende Watchlist-Ansicht:** Momentum-Rang, Trendzustand, relative Stärke, Überhitzung und eine klare Datenqualitätsanzeige.
4. **Sektor-/Regionsmonitor:** Breite, Rotation und Konzentrationswarnungen.
5. **Walk-forward-Backtest vor Signalgewichtung:** gleiche Handelslinie, am Stichtag bekannte Daten, zeitlich versetzte Umsetzung, realistische Transaktionskosten, Turnover-Auswertung und Vergleich gegen bestehendes Drei-Score-Signal. Erst bei belastbarer Out-of-Sample-Verbesserung darf das Modul die Signalstärke beeinflussen.

> **Fazit:** Der Artikel liefert eine gute Blaupause für ein transparentes **Trend- und Marktbreitenmonitoring**. Der richtige Nutzen für den Portfoliomanager ist nicht „die stärksten Aktien kaufen“, sondern Trends, Rotation, Überhitzung und Datenqualität verständlich getrennt darzustellen. Damit werden Empfehlungen nachvollziehbarer und seltener durch kurzfristige, mechanische oder datenbedingte Bewegungen verzerrt.

**References**

[1]: https://onlinelibrary.wiley.com/doi/10.1111/j.1540-6261.1996.tb05222.x "Chan, Jegadeesh und Lakonishok: Momentum Strategies"
[2]: https://www.stern.nyu.edu/sites/default/files/assets/documents/con_038332.pdf "Daniel und Moskowitz: Momentum Crashes"

*Grundlage: der vom Nutzer beigefügte The-Market-Beitrag vom 09.10.2026 sowie die zitierten Studien. Research und Produktkonzept, keine persönliche Anlageberatung.*
