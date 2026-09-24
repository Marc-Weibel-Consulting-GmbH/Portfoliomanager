# Positionsalternativen: Versichererpeers und lesende Detailansicht

**Datum:** 24. September 2026  
**Umfang:** Korrektur der Alternativensuche für Zurich Insurance (`ZURN.SW`) sowie eine reine Informationsansicht für alle aktuell zulässigen Alternativen.

## Anlass und Ursache

Im Alternativen-Dialog für `ZURN.SW` erschien `ZFIN.DE`. Das ist keine eigenständige Alternative, sondern eine ausländische Handelslinie desselben Emittenten. Die unmittelbare Ursache war eine abgekürzte lokale Positionsbezeichnung („Zurich Insurance G“) gegenüber der vom Datenanbieter gelieferten juristischen Bezeichnung „Zurich Insurance Group AG“. Der vorherige Emittentenabgleich behandelte beide Strings deshalb fälschlich als unterschiedliche Unternehmen.

Die offizielle Investor-Relations-Seite von Zurich bestätigt `ZURN` als in CHF an der SIX Swiss Exchange gehandelte registrierte Aktie mit ISIN `CH0011075394` und Valor `1107539`.[^zurich]

## Implementierter Vergleichsvertrag

Die Auswahl bleibt strikt und zeigt **keine** bereits vorhandenen Titel, keine Tickeraliasse und keine weitere Handelslinie desselben Emittenten. Die neue Normalisierung vereint ausdrücklich „Zurich Insurance G“ und „Zurich Insurance Group AG“. Die vorhandenen Roche- und SCOR-Guards bleiben unverändert aktiv.

Für Versicherer ist die nach EODHD verifizierte Vergleichsgruppe bewusst präzise, aber wirtschaftlich sinnvoll erweitert: `Insurance - Diversified`, `Insurance - Life` und `Insurance - Reinsurance`. Banken, Vermögensverwalter und sonstige Finanzwerte werden weiterhin ausgeschlossen. Für alle anderen Branchen bleibt es beim exakten EODHD-Industrieabgleich; es gibt keinen sektorweiten Ersatz.

Die Priorisierung bleibt unverändert: zuerst gleiche Region und Handelswährung, danach erst geprüfte ausländische Titel mit gültigem CHF-Wechselkurs. Die Dividendenrendite muss weiterhin innerhalb von ±1 Prozentpunkt zur Ausgangsposition liegen. Bereits im Portfolio enthaltene Schweizer Versicherer bleiben bewusst ausgeschlossen. Werden vor Ort nicht genügend zulässige Titel gefunden, durchsucht der Prozess das gleiche EODHD-Börsenuniversum wie der Watchlist-Screener, ohne einen Titel, eine Watchlist oder historische Preisreihen allein für eine Vorschau anzulegen.

Die zusätzliche globale Kennzahlenanreicherung ist optional und strikt zeitbegrenzt. Lädt eine externe Kennzahl nicht rechtzeitig, wird ein Gedankenstrich angezeigt; es werden keine Ersatzwerte erzeugt und die Alternativenliste bleibt bedienbar.

## Neue Informationsansicht

Jede Alternative hat neu eine **Details**-Schaltfläche. Sie öffnet einen separaten, ausschliesslich lesenden Dialog mit folgenden Elementen:

- verfügbare Kurs-, Dividenden-, KGV-, PEG-, Beta- und Sharpe-Daten;
- Qualität, Bewertung, Timing und Signal, falls tatsächlich berechnet;
- einem 1-Jahres-Chart aus EODHD-adjusted-close-Daten;
- einer transparent berechneten Periodenrendite aus dem ersten und letzten beobachteten Kurspunkt;
- klaren Datenlücken anstelle von simulierten Charts oder Kennzahlen.

Der Dialog akzeptiert nur Titel, die in der frisch berechneten Alternativenliste enthalten sind. Er kann weder Positionen anlegen noch einen Tausch bestätigen oder eine Börsenorder auslösen. Der eigentliche 1:1-Demo-Tausch bleibt weiterhin nur nach der bestehenden separaten Bestätigung möglich.

## Verifikation

Die neue Regression deckt den Ausschluss der Zürcher Auslandshandelslinie, die eng begrenzte Versichererfamilie, den Ausschluss von Banken sowie die sichere Chartdatenformung ab. Fokussiert bestanden **4 Testdateien mit 24 Tests**. TypeScript wurde ohne Fehler geprüft. Die Prüfung arbeitet nur lesend; es wurden keine Position, Cashreserve, Ledgerbuchung, Transaktion, Preisreihe oder Handelsaktion verändert.

## Datenbasis und Grenzen

Aktuelle Instrumentidentitäten und Einzelwertkennzahlen stammen von EODHD; die Emittentenidentität von `ZURN` wurde zusätzlich gegen Zurich Investor Relations abgeglichen. Preisverläufe verwenden ausschliesslich die verfügbare, adjusted-close-basierte EODHD-Reihe. Bei fehlender oder unvollständiger Historie zeigt die Oberfläche eine Datenlücke.

> Die Alternativenliste ist ein Datenvergleich, keine Kauf- oder Tauschempfehlung. Dies ist Research und Analyse, keine persönliche Anlageberatung.

[^zurich]: [Zurich Insurance Group Ltd registered share data](https://www.zurich.com/investor-relations/our-shares/registered-share-data), abgerufen am 24. September 2026.
