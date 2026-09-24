# Positionsalternativen: Branchenpräzision und globales Aktienuniversum

**Datum:** 24. September 2026  
**Status:** umgesetzt und read-only verifiziert  
**Geltungsbereich:** „Alternativen“-Dialog für nicht aktivierte, eigentümergebundene Demoportfolios ohne Ledgerbuchungen.

## Anlass und Ursache

Die Alternativenvorschau für `KNIN.SW` (Kuehne + Nagel) zeigte zuvor Geberit und Georg Fischer. Die Titel gehören zwar zum Grobsektor **Industrials**, sind aber keine wirtschaftlich vergleichbaren Logistikunternehmen. Die Ursache war eindeutig: In der lokalen `stocks`-Tabelle war bei KNIN wie bei vielen älteren Einträgen nur der Sektor gepflegt; `industry` war leer. Der bisherige Vergleich fiel deshalb auf eine sektorweite Auswahl zurück.

Die aktuelle EODHD-Fundamentalsantwort für `KNIN.SW` bestätigt **Industrials / Integrated Freight & Logistics**, Dividendenrendite **2,60 %** und Handelswährung CHF. Die logische Vergleichsbasis ist damit die präzise Branche **Integrated Freight & Logistics**, nicht der Sammelsektor Industrials.

## Neuer Vergleichsvertrag

| Regel | Umsetzung |
|---|---|
| Branchenpräzision | Ein Alternativtitel muss dieselbe von EODHD bestätigte Branche besitzen. Ein Rückfall auf den Sektor ist ausdrücklich verboten. |
| Bestehende Positionen | Alle im konkreten Portfolio gehaltenen Titel werden über kanonische Tickeridentitäten ausgeschlossen. Das gilt auch für bekannte Alias- und Suffixvarianten. |
| Gleiche Gesellschaft | Mehrfachlistings derselben Gesellschaft werden über einen konservativ normalisierten Unternehmensnamen ausgeschlossen, etwa `Kuehne & Nagel` und `Kuehne + Nagel International AG`. |
| Dividendenprofil | Der Kandidat muss eine quellenbestätigte Dividendenrendite innerhalb von **±1 Prozentpunkt** zur Quellposition aufweisen. |
| Datenqualität | Ohne aktuellen Kurs, bestätigte Branche, positive Dividendenrendite oder verifizierbare CHF-FX-Rate erscheint kein Kandidat. Es wird nichts geschätzt. |
| Globaler Fallback | Reichen lokale, exakt branchenpassende Titel nicht aus, wird der gleiche EODHD-Börsenraum wie im Watchlist-Screener über die zulässigen Börsen US, SIX, XETRA, Paris, London, Amsterdam und Mailand durchsucht. |
| Fremdwährung | Globale Kandidaten werden nur bei einer aktuellen EODHD-Quote für das Währungspaar zu CHF angezeigt. Der Wertgleichheitstest nutzt diese Rate; ein stiller 1:1-CHF-Fallback ist ausgeschlossen. |
| Persistenz | Die Vorschau ist vollständig read-only. Ein globaler Peer wird erst bei einer explizit bestätigten, zulässigen Demo-Tauschaktion als Stammdatensatz abgelegt. Es gibt keine Watchlist-Übernahme und keine Portfoliomutation durch die Suche. |

## Read-only-Live-Nachweis: Kuehne + Nagel

Die Vorschau wurde direkt über den Serverpfad für Portfolio `4020001` und die bestehende Position `KNIN.SW` ausgeführt. Der Quellwert betrug CHF 5’028,86. Die Rückgabe enthielt ausschliesslich die EODHD-Branche `Integrated Freight & Logistics`; Geberit und Georg Fischer erscheinen nicht mehr.

| Alternativtitel | Gesellschaft | Branche | Währung | Dividendenrendite | Gegenwert in CHF |
|---|---|---|---|---:|---:|
| `DPSTF` | Deutsche Post AG | Integrated Freight & Logistics | USD | 2,83 % | 5’028,86 |
| `FDX` | FedEx Corporation | Integrated Freight & Logistics | USD | 1,88 % | 5’028,86 |
| `CHRW` | CH Robinson Worldwide Inc | Integrated Freight & Logistics | USD | 1,68 % | 5’028,86 |
| `ZTO` | ZTO Express (Cayman) Inc | Integrated Freight & Logistics | USD | 3,55 % | 5’028,86 |
| `SGHDY` | SG Holdings Co.Ltd. | Integrated Freight & Logistics | USD | 3,48 % | 5’028,86 |

Alle dargestellten Renditen liegen innerhalb des Bandes von 1,60 % bis 3,60 %. Der aktuelle USD/CHF-Quote wurde dafür separat über EODHD validiert. Es wurden **keine** Position, Cashreserve, Buchung, Watchlist, Preisreihe oder Handelsaktion verändert.

## Test- und Schutzumfang

Die Regression deckt den Ausschluss sektorfremder Industrials, das Renditeband, gehaltene Ticker und Aliasvarianten, Kantonalbank-Priorisierung, Globalkandidaten aus der exakten Branche, Mehrfachlistings der Quellgesellschaft und Wertgleichheit mit FX-Rate ab. Die bestehende Demo-Tauschmutation bleibt weiterhin serverseitig auf Eigentümerschaft, Demo-Status, fehlendes Live-Tracking, fehlende Ledgerzeilen, bestätigte Vorschauwerte sowie Cashneutralität begrenzt.

> Ein Klick auf „Tausch vorbereiten“ bleibt nur eine Vorschau. Erst die sichtbare Bestätigung im Dialog darf die bereits bestehenden, eng begrenzten Demo-Mutationspfade auslösen.

## Abschliessende technische Verifikation

Die fokussierte Regression für Branchenfilter, globales Screening und Cashneutralität bestand mit **18 Tests in 3 Testdateien**. Die vollständige Projektsuite bestand mit **220 Testdateien / 1’590 Tests**; **5 Testdateien / 11 Tests** bleiben bewusst übersprungen. TypeScript ist fehlerfrei, `git diff --check` ist ohne Befund und die Entwicklungsroute `/portfolios/4020001` lieferte HTTP 200.
