# Positionsrendite — Datenlücke bei fehlender Einstandsbasis

## Ursache

Wenn eine Position keinen bestätigten Einstandspreis in CHF und keine daraus ableitbare Transaktionsbasis besitzt, verwendete der Portfolio-Router bisher den aktuellen CHF-Kurs als technischen Ersatzwert. Die daraus berechnete Differenz betrug zwangsläufig `0,0 %`, obwohl keine tatsächliche Rendite seit Kauf bekannt war.

Die Detailansicht unterdrückte den Block für fehlende Einstandsdaten bereits, während Exportmodell und Attributionspfad den technischen Wert weiterverwenden konnten. Das erzeugte eine semantische Inkonsistenz zwischen Position, PDF/Excel und den «seit Kauf»-Attributionen.

## Fixvertrag

Der Router liefert bei fehlender bestätigter Einstandsbasis nun `null` für positionsbezogene Renditen sowie einen expliziten Qualitätsstatus. Marktwert, Tagesrendite, YTD, Gesamtwert, Cash und Portfolio-KPIs bleiben davon unabhängig. Der Export setzt «seit Kauf» auf `—` und nennt im Datenstatus «Einstandsdaten fehlen». Die Detailansicht erklärt diesen Sachverhalt, statt eine 0,0%-Rendite zu suggerieren. «Seit Kauf»-Attributionen schliessen solche Positionen aus, statt ersatzweise YTD einzumischen.

## Bisheriger Live-Nachweis

Am 8. September 2026 wurde die Portfolioansicht «Mami» (`#4020001`) nach dem Hot-Reload rein lesend geöffnet. Sie zeigt 35 Positionen, einen Gesamtwert von CHF 511'230, Cash von CHF 49'047 und eine getrennte Gesamtkennzahl «seit Kauf» von +2,2 %. Die Tabellenansicht zeigt DBS weiterhin mit `—` für die Tagesrendite statt des früheren Phantomverlusts. Keine Position, Cashreserve, Preisreihe, Transaktion oder Handelsaktion wurde ausgelöst.

Die aufgeklappte CHDVD-Position zeigt jetzt sichtbar **«Einstandsdaten fehlen»** und erklärt, dass «Rendite seit Kauf» erst mit bestätigtem CHF-Einstand oder einer Transaktionsbasis ausgewiesen wird. Sie zeigt ausdrücklich keine künstliche `0,0 %` an. Der Marktwert und die getrennte Gesamtkennzahl bleiben sichtbar.

Die neue Exportmodell-Regressionsdatei lief grün (6/6). Der erste Vollsuitenlauf hatte zwei Auth-Guard-Timeouts; beide bestanden sofort isoliert (11/11), sodass der Befund als nicht reproduzierbarer Parallelitäts-Timeout eingeordnet wurde. Der einmalige Vollsuiten-Wiederholungslauf war vollständig grün: 214 Testdateien bestanden, 5 übersprungen; 1'565 Tests bestanden, 11 übersprungen. TypeScript lief vor der Live-Prüfung ohne Fehler.
