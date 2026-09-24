# Positionsalternativen: Layout, Kantonalbanken und Dividendenband

**Datum:** 24. September 2026  
**Geltungsbereich:** Vergleichsliste im Dialog «Alternativen» für nicht aktivierte Demoportfolios  
**Autor:** Manus AI

## Ergebnis

Das Alternativenfenster nutzt nun eine breite Desktopansicht bis `sm:max-w-5xl`. Damit überschreibt es ausdrücklich die allgemeine `sm:max-w-lg`-Vorgabe der Dialogkomponente. Die fünf Kennzahlen **Dividendenrendite, Sharpe, Qualität, Bewertung und Timing** liegen in einer festen Fünferspalte. Jeder Kennzahlenname bleibt zusammen mit seinem Wert auf derselben Zeile. Bei kleinen Viewports lässt sich nur diese Kennzahlenzeile horizontal bewegen; die Karten selbst behalten ihre Lesbarkeit.

Eine Alternative muss jetzt zusätzlich eine **belegte Dividendenrendite innerhalb von ±1,0 Prozentpunkt** zur Ausgangsposition haben. Fehlt die Rendite, wird der Titel nicht geschätzt und nicht angezeigt. Für eine Kantonalbank werden zuerst gleichartige Kantonalbanken sortiert. Andere Finanzwerte füllen die Liste nur auf, falls weniger als fünf zulässige Kantonalbank-Peers vorhanden sind.

Der Ausschluss von bestehenden Portfolioinhalten wurde auf kanonische Tickeridentitäten erweitert. Dadurch schliesst beispielsweise ein gespeichertes `ABB.SW` auch den Datenbankticker `ABBN.SW` aus. Ein unsuffigierter US-Ticker wie `NVDA` schliesst `NVDA.US` aus. ETFs, inaktive Titel, Titel mit Preis- oder Datenlücken und alle vorhandenen Portfolioinhalte bleiben ausgeschlossen.

## Additive Kantonalbankbasis

Zwei aktiv gehandelte, bis dahin im lokalen Universum fehlende Kantonalbanken wurden **additiv** aus EODHD-Fundamentals und Echtzeitkursen ergänzt. Vor der Übernahme wurden Namen, SIX-/EODHD-Symbol, ISIN, CHF-Handelswährung, Sektor, Branche, positiver Kurs und positive Dividendenrendite geprüft. Diese Ergänzung ändert kein Portfolio, keine Cash-Reserve, keine Transaktion und keine Börsenorder.

| Titel | ISIN | EODHD-Kurs bei Import | EODHD-Dividendenrendite | Verwendung in der Liste |
|---|---|---:|---:|---|
| Thurgauer Kantonalbank (`TKBP.SW`) | CH0231351104 | CHF 158.50 | 2.25 % | Kantonalbank-Peer |
| Zuger Kantonalbank (`ZUGER.SW`) | CH0493891243 | CHF 10’800.00 | 2.16 % | Kantonalbank-Peer |

## Prüfergebnis

Die serverseitige, ausschliesslich lesende Vorschau für die aktuell gehaltene **St. Galler Kantonalbank (`SGKN.SW`)** ergab folgende Reihenfolge: Luzerner Kantonalbank (2.31 %), Zuger Kantonalbank (2.16 %), Thurgauer Kantonalbank (2.25 %), danach UBS und Vontobel als weitere Finanzwerte. Alle drei Kantonalbanken liegen gegenüber SGKN (2.95 %) im erlaubten ±1-Prozentpunkt-Band. Der sichtbare Ausgangswert betrug CHF 10’041.62; die Zielwerte blieben bis auf die offen ausgewiesene Rundungsdifferenz konstant. Die Vorschau löste weder einen Tausch noch eine sonstige Portfolio- oder Ledgeränderung aus.

Die Tests decken das Dividendenband, die Kantonalbankpriorisierung, den ETF-/Preisfilter, den Ausschluss von vorhandenen Titeln inklusive Tickeraliasen sowie die Datenlücke bei fehlender Quellrendite ab.

## References

[1]: https://www.six-group.com/en/market-data/shares/share-explorer/share-details.CH0231351104CHF4.html "Thurgauer KB PS – SIX Swiss Exchange"
[2]: https://www.six-group.com/en/market-data/shares/share-explorer/share-details.CH0493891243CHF4.html "Zuger KB N – SIX Swiss Exchange"
[3]: https://eodhd.com/financial-summary/GLKBN.SW "EODHD financial summary – Glarner Kantonalbank"
