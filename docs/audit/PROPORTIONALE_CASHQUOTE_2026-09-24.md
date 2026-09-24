# Proportionale Cashquotenanpassung

**Datum:** 24. September 2026  
**Umfang:** Nicht aktivierte Demoportfolios ohne Ledgerbuchungen  
**Portfolio-Referenz für die Lesebestätigung:** `4020001` («Mami»)

## Ziel und Bedienung

Die Cash-Zeile im Positions-Tab besitzt nun die sichtbare Aktion **«Cash anpassen»**. Sie öffnet eine eigenständige, bestätigungspflichtige Vorschau. Die Aktion ist ausschließlich für den Portfolioeigentümer eines nicht aktivierten Demoportfolios sichtbar. Geteilte Leser und Liveportfolios erhalten weder eine Aktion noch einen Schreibpfad.

Die Zielquote bezieht sich auf den **aktuellen Gesamtwert** des Portfolios, nicht auf das ursprüngliche Startkapital. Vor einer Ausführung zeigt der Dialog aktuellen Gesamtwert und Cashbestand, die Zielwerte für Cash und Wertpapiere sowie den einheitlichen Stückzahlfaktor. Der Nutzer muss die technische Neugewichtung ausdrücklich bestätigen.

> Die Anpassung ist eine lokale Demo-Neugewichtung. Sie erzeugt keine Börsenorder, keine Zahlung, keine Überweisung und keine Ledgerbuchung.

## Rechenvertrag

Für jede bewertbare Position — Aktien, ETFs/ETPs und andere Wertpapiere — wird die aktuelle Stückzahl mit demselben Faktor multipliziert:

\[
\text{Faktor} = \frac{\text{aktueller Gesamtwert} \times (1 - \text{Ziel-Cashquote})}{\text{aktueller Wert aller Wertschriften}}
\]

Damit bleiben die Gewichte **innerhalb des Wertpapieranteils** unverändert. Nach Rundung auf sechs Nachkommastellen wird Cash als CHF-Residuum bestimmt; die aktuelle Kapitalbasis bleibt erhalten. Die serverseitige Ausführung prüft nochmals Eigentümerschaft, Demo-/Live-Status, Ledgerfreiheit, marktnahe Kurse und CHF-Wechselkurse. Für einen vorübergehend fehlenden aktuellen FX-Satz greift sie ausschließlich auf den vorhandenen, positiven gespeicherten CHF-Kurs derselben Position zurück; fehlt auch dieser, wird die Mutation abgebrochen.

## Lesende Praxisprüfung «Mami»

Die Prüfung verwendete ausschließlich eine Lesekopie der aktuellen Daten. Sie führte keine Mutation aus. Zum Prüfzeitpunkt lagen 35 Wertpapierpositionen vor; das Portfolio war ein nicht aktiviertes Demoportfolio ohne Änderung an Portfolio, Cash oder Ledger.

| Kennzahl | Ergebnis |
|---|---:|
| Aktueller Gesamtwert aus den aktuellen Positionen und Cash | CHF 512'423.36 |
| Aktueller Wert der Wertpapiere | CHF 463'376.14 |
| Aktueller Cashbestand | CHF 49'047.22 |
| Beispiel-Zielquote | 15.0 % |
| Vorschau Wertpapiere | CHF 435'559.86 |
| Vorschau Cash | CHF 76'863.50 |
| Einheitlicher Stückzahlfaktor | 0.9399704187 |
| Kapitalbasis erhalten | Ja |
| Positionen in der Vorschau | 35 von 35 |

Die Basis ergibt sich vor Rundung aus aktuellen DB-Kursen und der gespeicherten Cashreserve. Der Beispielwert dient nur der Prüfung der Rechenlogik und wurde **nicht** übernommen.

## Test- und Integritätsnachweis

| Prüfung | Ergebnis |
|---|---|
| Red/Green-Test der proportionalen Skalierung einschließlich Fremdwährungsposition | Bestanden |
| Fehlerpfad bei fehlendem Kurs | Bestanden |
| Bestehende manuelle Cash-/Positionsrebalancing-Regression | Bestanden |
| Vollständige Projektregression | 1'600 bestanden, 11 bewusst übersprungen |
| TypeScript | Fehlerfrei |
| Entwicklungsroute `/portfolios/4020001` | HTTP 200 |
| Portfolio-/Cash-/Ledger-Mutation durch die Prüfung | Keine |

Die bestehende Cashquote im allgemeinen Portfolio-Einstellungsdialog verwendet ebenfalls den aktualisierten, aktuellen Rechenvertrag. Die direkte Aktion in der Cash-Zeile ist jedoch der klarere, sichtbare Einstiegspunkt.
