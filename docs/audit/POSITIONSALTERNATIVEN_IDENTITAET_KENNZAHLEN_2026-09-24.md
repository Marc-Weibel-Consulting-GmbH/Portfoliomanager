# Positionsalternativen: Emittentenidentität, Kennzahlen und Regionalpriorität

**Datum:** 24. September 2026  
**Geltungsbereich:** Dialog «Alternativen» für nicht aktivierte Demoportfolios  
**Autor:** Manus AI

## Ergebnis

Die Alternativenliste begrenzt nun **jeden wirtschaftlichen Emittenten auf genau einen Vorschlag**. Mehrfachlistings, ADRs und bekannte abweichende Anbieterbezeichnungen werden vor der Anzeige zusammengeführt. Gleichzeitig erhalten Kandidaten aus dem globalen Screener die gleichen verfügbaren Vergleichskennzahlen wie lokale Kandidaten: **Dividendenrendite, Sharpe Ratio, Qualität, Bewertung und Timing**.

Die Auswahl bleibt auf die verifizierte Branche und eine Dividendenrendite innerhalb von ±1 Prozentpunkt begrenzt. Sie priorisiert Titel mit gleicher Handelsregion und Währung. Erst wenn dafür zu wenige gültige Peer-Titel vorliegen, ergänzt sie ausländische Werte aus dem globalen Screener. Jeder Vorschlag bleibt eine schreibgeschützte Vergleichsvorschau. Ein Portfolio-, Cash-, Transaktions- oder Handelsvorgang entsteht erst nach einer separaten, sichtbaren Bestätigung.

## Behobene Ursachen

Die globale Peer-Suche lieferte zunächst nur Kurs, Handelswährung und Dividendenrendite. Die Felder für Sharpe Ratio, Qualität, Bewertung und Timing waren deshalb als Datenlücken angezeigt. Die Anreicherung berechnet diese Kennzahlen nun beim Anzeigen der finalen, höchstens fünf globalen Kandidaten. Sie verwendet EODHD-Fundamentaldaten für Qualität und Bewertung sowie eine abrufbasierte, fünfjährige Adjusted-Close-Reihe für Sharpe und Timing. Die Berechnung erfolgt ausschliesslich im Speicher und schreibt weder Kursreihen noch Scorezeilen oder Watchlist-Einträge in die Datenbank. [1]

Die bisherige Deduplizierung kannte nur Handelssymbole. Dadurch konnten unterschiedliche Handelslinien desselben Emittenten gemeinsam erscheinen. Die neue Emittentenidentität normalisiert Akzente, Rechtsformen und geprüfte Anbieterabweichungen. Sie deckt beispielsweise **Münchener Rück / Muenchener Rueckver**, **Hannover Rück / Hannover Re**, **Swiss Re / Swiss Reinsurance** und **SCOR SE / SCOR PK** ab. Bereits im Portfolio enthaltene Emittenten werden ebenfalls ausgeschlossen, wenn sie unter einem anderen Listing vorliegen.

## Swiss-Re-Liveprüfung

Die schreibgeschützte Prüfung für `SREN.SW` im Portfolio 4020001 ergab vier gültige Rückversicherungs-Peers. Ein Schweizer CHF-Peer war im geprüften Universum nicht verfügbar. Der lokale EUR-Titel wurde deshalb vor ausländischen Kandidaten priorisiert. Die Liste enthielt keine doppelten Ticker und keine doppelten Emittenten. Alle angezeigten Kandidaten enthielten die fünf Kernkennzahlen.

| Ticker | Emittent | Währung | Herkunft | Dividendenrendite | Sharpe | Qualität | Bewertung | Timing |
|---|---|---:|---|---:|---:|---:|---:|---:|
| MUV2.DE | Münchener Rück | EUR | Lokales Universum | 4.78 % | -0.11 | 58.9 | 78.5 | 57.8 |
| HVRRY | Hannover Re | USD | Globaler Screener | 5.10 % | 0.58 | 67.0 | 70.6 | 53.6 |
| SZCRF | SCOR SE | USD | Globaler Screener | 4.97 % | 1.23 | 43.3 | 88.7 | 29.6 |
| COFAF | Coface | USD | Globaler Screener | 6.63 % | 0.97 | 71.4 | 88.2 | 41.0 |

Die alternative SCOR-Handelslinie `SCRYY` wurde als derselbe Emittent erkannt und nicht zusätzlich dargestellt. Die vorher ebenfalls sichtbare zweite Münchener-Rück-Handelslinie `MURGY` wird ebenfalls ausgeschlossen.

## Prüfungen

Die fokussierte Regression umfasst 21 Tests. Sie deckt die exakte Branchenbindung, die Renditebandbreite, den Ausschluss vorhandener Positionen, die Erkennung von Mehrfachlistings, die Regional- und Währungspriorität, die globale Kennzahlenberechnung und die Cashneutralität eines bestätigten Demo-Tauschs ab. Die vollständige Projektsuite war ebenfalls grün: **221 Testdateien und 1'593 Tests bestanden**, fünf Testdateien und elf Tests waren bewusst übersprungen. TypeScript kompiliert ohne Fehler. Die Entwicklungsroute `/portfolios/4020001` antwortete mit HTTP 200. Die Liveprüfung war rein lesend; Portfolio 4020001, Cashbestand, Ledger und Positionen blieben unverändert.

## Grenzen

Die Reihenfolge ist ein transparenter Datenvergleich und keine Kaufempfehlung. Fehlen Fundamentaldaten oder eine ausreichend lange Preisreihe, zeigt die Oberfläche weiterhin eine Datenlücke statt einer geschätzten Zahl. Ein ausländischer Kandidat bleibt als solcher gekennzeichnet. Er wird nur ergänzt, wenn die gleiche Branche lokal keine ausreichende Anzahl validierter Titel liefert.

## References

[1]: https://eodhd.com/financial-apis/stock-etfs-fundamental-data-feeds "EODHD Stock ETFs Fundamental Data Feeds"
