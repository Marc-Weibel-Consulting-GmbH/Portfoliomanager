# Audit: Fünfjahres-Volatilität mit homogener Preisbasis

**Datum:** 25. September 2026  
**Autor:** Manus AI  
**Geltungsbereich:** Positionstabelle und Excel-Export des Demoportfolios „Mami“; reine Datenqualitäts- und Berechnungsänderung. Es wurden keine Positionen, Portfolio- oder Cashwerte, Transaktionen, Rohkurse oder Corporate Actions verändert.

## Ergebnis

Die Aussage, dass für viele Positionen keine fünfjährige Kursgeschichte verfügbar sei, trifft für die lokale EODHD-Preisreihe **nicht** zu. Für alle 31 Titel liegt im Zeitraum 25. September 2021 bis 24. September 2026 eine Rohkursreihe mit 1’250 bis 1’274 Handelstagen vor. Die zuvor unklare Datenlage betraf die Spalte `adjustedClose`, nicht die Schusskursreihe.

Die Anwendung berechnete bisher die Volatilität zeilenweise mit `adjustedClose ?? close`. Das ist nur dann korrekt, wenn die adjusted-close-Werte über das gesamte Fenster vorliegen. Bei einer Teilabdeckung entsteht an der Umschaltstelle ein wirtschaftlich nicht interpretierbarer Tagesertrag. Die Kennzahl konnte dadurch insbesondere bei Splits verfälscht werden.

Die Berechnung verwendet nun pro Titel genau **eine homogene Basis**. Bei einer vollständigen adjusted-close-Serie wird die Gesamtrenditevolatilität ausgegeben. Bei lückenhafter adjusted-close-Serie wird die vollständige Rohkursreihe als Preisrenditevolatilität verwendet, sofern sie keinen Split-ähnlichen Sprung enthält. Bei einem solchen Sprung zeigt die Oberfläche bewusst `—` an und nennt die Datenlücke im Tooltip. Diese konservative Behandlung vermeidet eine scheinpräzise Volatilität.

> EODHD definiert `close` als nicht bereinigten Schlusskurs und `adjusted_close` als um Splits und Dividenden bereinigten Schlusskurs. Ein Mischen beider Felder innerhalb einer Renditereihe ist deshalb methodisch nicht zulässig.[1]

## Datenabdeckung am Stichtag

| Prüfpunkt | Ergebnis |
|---|---:|
| Positionen im Portfolio | 31 |
| Vollständige 5J-Rohkursreihen | 31 von 31 |
| Handelstage je Rohkursreihe | 1’250 bis 1’274 |
| adjusted-close-Abdeckung | 25,4 % bis 96,6 % je Titel |
| Homogene, splitfreie Rohkursbasis | 25 Titel |
| Konservative Datenlücke wegen Split-Hinweis | 6 Titel |
| Sichtbarer Basis-Hinweis im UI | `Kurs` für Preisrendite; Tooltip für Methode und Datenlücke |

Die teilweise fehlenden adjusted-close-Werte lassen sich aus der Importhistorie erklären. Der tägliche additive Import speichert absichtlich nur neue Rohschlusskurse. Dadurch ersetzt ein späterer Abruf ältere Reihen nicht stillschweigend. Das schützt die Datenintegrität, bedeutet aber auch, dass nachträglich verfügbare adjusted-close-Werte nicht in bereits bestehende Tageszeilen geschrieben werden.

## Aktueller Provider-Check ohne Datenmutation

Ein erneuter, rein lesender Abruf bei EODHD am 25. September 2026 bestätigte für alle sechs durch den Split-Guard gesperrten Instrumente eine vollständige aktuelle adjusted-close-Reihe. GOOGL, NVDA, TSLA und ISRG lieferten jeweils 1’254 Tageszeilen, NOVO-B.CO 1’252 und ABTC.SW 1’256 Zeilen. Bei jeder Reihe war `adjusted_close` auf 100,0 % der zurückgegebenen Handelstage vorhanden. Dies zeigt, dass die Lücke in der lokalen Datenbank eine **Speicher-/Importhistorie** und keine gegenwärtige Providerlücke ist.

Der Abruf war ausdrücklich nicht schreibend. Die sechs sichtbaren Datenlücken bleiben daher aktiv, bis eine separate Entscheidung einen versionierten Import mit Vergleich der bisherigen und neuen Werte erlaubt. Der aktuelle Schutz verhindert, dass eine scheinbar vollständige Kennzahl aus nachträglich veränderten adjusted-close-Werten entsteht, ohne dass deren Auswirkung auf historische Renditen und Volatilität auditiert wurde.

## Kontrollierte Anreicherung nach Vergleich

Nach expliziter Freigabe wurde ausschließlich für Reihen mit vollständiger Zeilenübereinstimmung eine additive Anreicherung der **fehlenden** localen `adjustedClose`-Werte ausgeführt. Die Prüfung sperrte eine gesamte Reihe, sobald ein bestehender positiver adjusted-close-Wert oder ein Rohschlusskurs vom aktuellen EODHD-Wert abwich. Sie fügte weder neue Handelstage ein noch überschrieb sie Rohkurse oder bereits vorhandene positive Adjustierungswerte.

| Ticker | Ergänzte `adjustedClose`-Werte | Nachprüfung der Basis | Ergebnis |
|---|---:|---|---|
| GOOGL | 935 | 1’254 von 1’254 positiv; 32,2362 % p.a. | Gesamtrenditebasis verfügbar |
| NVDA | 935 | 1’254 von 1’254 positiv; 52,0282 % p.a. | Gesamtrenditebasis verfügbar |
| TSLA | 935 | 1’254 von 1’254 positiv; 59,8937 % p.a. | Gesamtrenditebasis verfügbar |
| ISRG | 552 | 1’254 von 1’254 positiv; 34,5805 % p.a. | Gesamtrenditebasis verfügbar |
| NOVO-B.CO | 550 | 1’251 von 1’251 positiv; 39,4274 % p.a. | Gesamtrenditebasis verfügbar |
| ABTC.SW | 0 | 1 vorhandener Adjustierungswert wich um −9,6037 % ab; 13 Rohkurstage weichen ebenfalls ab | **gesperrt, keine Änderung** |

Insgesamt wurden **3’907** fehlende Adjustierungswerte ergänzt. Die Anwendung zeigt jetzt bei den fünf freigegebenen Titeln die Kennzeichnung `Gesamt`; ABTC.SW bleibt eine sichtbare Datenlücke. NVIDIA wurde anschließend zusätzlich geprüft: Eine veraltete `NVDA.US`-Aliasreihe hatte die aktuelle kanonische `NVDA`-Reihe im Positionsrouter tagweise überlagert. Der Router wählt nun für jede Volatilitätskennzahl genau eine aktuelle, vollständigste Aliasreihe statt Daten aus beiden Reihen zu vermischen. Dadurch erscheint NVIDIA korrekt mit 52,0 % Gesamtrenditevolatilität.

## Titel mit bewusstem Split-Gate

| Ticker | Split-Hinweis am | Behandlung |
|---|---|---|
| GOOGL | 18.07.2022 | Keine 5J-Volatilität, bis eine vollständige homogene Adjustierungsbasis geprüft vorliegt |
| NVDA | 10.06.2024 | Keine 5J-Volatilität, bis eine vollständige homogene Adjustierungsbasis geprüft vorliegt |
| TSLA | 25.08.2022 | Keine 5J-Volatilität, bis eine vollständige homogene Adjustierungsbasis geprüft vorliegt |
| ISRG | 05.10.2021 | Keine 5J-Volatilität, bis eine vollständige homogene Adjustierungsbasis geprüft vorliegt |
| NOVO-B.CO | 13.09.2023 | Keine 5J-Volatilität, bis eine vollständige homogene Adjustierungsbasis geprüft vorliegt |
| ABTC.SW | 04.03.2026 | Möglicher Split- oder Instrumentensprung; keine Annahme über die Ursache und keine Kennzahl |

DBS (`D05.SI`) bleibt zusätzlich durch den bestehenden Währungs-/Handelslinien-Kompatibilitätsguard als Datenlücke markiert. Der Guard verhindert, dass eine nicht kompatible Preisbasis nur wegen einer numerisch vollständigen Rohreihe als verlässlich erscheint.

## Sichtbare Umsetzung

Die Positionsansicht zeigt hinter einer verfügbaren Kennzahl nun `Kurs`, wenn sie als Preisrenditevolatilität aus einer vollständigen Rohkursreihe berechnet wurde. Der Spalten-Tooltip erläutert die einheitliche Preisbasis. Für einen Split-Hinweis erscheint `—` statt eines künstlich erhöhten Werts. Der Excel-Export enthält in der Titelliste zusätzlich die Spalte **Vol.-Basis**, beispielsweise „Preisrendite · Rohkurs, Split-Guard“ oder „Datenlücke · möglicher Split“.

Die reine Schattenprüfung ergab beispielsweise für NVIDIA bei der bisherigen Mischreihe 410,7 % annualisierte Volatilität. Der Wert wird nicht mehr angezeigt, weil der Rohkurs am 10. Juni 2024 einen Split-Sprung enthält und die adjusted-close-Reihe nicht vollständig ist. Für die 25 unauffälligen Reihen weichen bisherige und homogene Preisrenditevolatilität meist nur moderat voneinander ab; die neue Methode macht die verwendete Basis explizit.

## Weiteres Vorgehen ohne Datenüberschreibung

Die aktuelle Änderung ist eine Bereinigungs- und Offenlegungsregel. Sie ändert keine historische Marktdatenzeile. Erst in einem separaten, prüfbaren Schritt kann entschieden werden, ob für die sechs gesperrten Reihen ein versionierter EODHD-Refresh der adjusted-close-Reihe sinnvoll ist. Vor einer solchen Entscheidung braucht es pro Titel einen Vergleich der neu geladenen Reihen, der Corporate-Action-Ereignisse und der daraus resultierenden Volatilität. Ein vorhandener Rohkurs darf dabei nicht still überschrieben werden; ein Audit der alten und neuen Werte ist erforderlich.

## Validierung

Die reine Preisbasislogik ist mit vier gezielten Tests abgedeckt. Diese prüfen die Auswahl einer vollständigen Rohkursbasis, die Auswahl einer vollständig bereinigten Gesamtrenditebasis, das Split-Gate und die Datenlücke bei zu wenigen Beobachtungen. Zusammen mit den bestehenden Fünfjahresvolatilitäts- und Exportmodelltests waren 18 fokussierte Tests erfolgreich. Die TypeScript-Prüfung war fehlerfrei. Im Devserver wurde die Positionstabelle ohne Mutation geladen; die sichtbaren Werte zeigen die Kennzeichnung `Kurs`, während GOOGL, NVDA, NOVO-B.CO, ISRG, TSLA und ABTC.SW bewusst `—` ausweisen. Der aktualisierte Excel-Export enthält die neue Spalte **Vol.-Basis** sowie die Split-Datenlücke.

## References

[1]: https://eodhd.com/financial-apis/api-for-historical-data-and-volumes "End-Of-Day Historical Stock Market Data API"
