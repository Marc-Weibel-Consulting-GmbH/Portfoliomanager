# Positionsdialog: bestätigungspflichtige Löschung

**Datum:** 24. September 2026  
**Umfang:** Positionsbearbeitungsdialog in der Portfolioansicht  
**Änderungsart:** UI-Ergänzung; keine Datenmigration

## Bedienung

Der Dialog **«Position bearbeiten»** enthält für zulässige Positionen nun einen roten Button **«Löschen»**. Ein Klick öffnet zwingend einen zweiten Bestätigungsdialog. Dieser nennt Ticker und Firmenname, beschreibt die Cash-Gegenbuchung und macht ausdrücklich klar, dass keine Börsenorder, Zahlung oder Ledgerbuchung ausgelöst wird.

Erst die zweite Aktion **«Position löschen»** setzt die Stückzahl technisch auf null und verwendet den bereits bestehenden, serverseitig gesicherten `updateDemoPositionShares`-Pfad. Dieser entfernt die Position aus `portfolioData`, schreibt ihren aktuellen CHF-Gegenwert der Cashreserve gut, aktualisiert Marktinformationen und invalidiert Portfolio-, Dashboard- und Performancecaches.

## Schutzmechanismen

| Schutz | Umsetzung |
|---|---|
| Eigentümerschaft | Geschützter tRPC-Endpunkt lädt das Portfolio ausschließlich für `ctx.user.id`. |
| Zulässiger Scope | Der Button erscheint nur für nicht aktivierte Demoportfolios des Eigentümers. |
| Serverseitige Absicherung | Der Endpunkt lehnt Liveportfolios und Portfolios mit Ledgerzeilen ab, auch wenn die UI umgangen würde. |
| Cashintegrität | Der aktuelle CHF-Gegenwert der entfernten Position erhöht Cash; die Kapitalbasis bleibt erhalten. |
| Fehlerfälle | Fehlende Kurs- oder CHF-FX-Basis führt zum Abbruch statt zu einer geschätzten Buchung. |
| Keine Handelsaktion | Es gibt keinen Order-, Zahlungs-, Transfer- oder Ledgerpfad. |

## Testnachweis

Die vorhandene Rebalancing-Regression deckt explizit ab, dass der volle Wert einer gelöschten Position als Cash gutgeschrieben wird und die Kapitalbasis gleich bleibt. Die fokussierte Prüfung umfasste die sichere Stückzahlrekonstruktion, reine Positionsänderungen und die Cash-Gegenbuchung.

| Prüfung | Ergebnis |
|---|---|
| Löschung → vollständige Cash-Gutschrift | Bestanden |
| Kapitalbasis nach Löschung | Bestanden |
| Fehlende Stückzahlbasis wird sicher rekonstruiert | Bestanden |
| TypeScript | Fehlerfrei |
| Mutation durch die Prüfung | Keine |

Die Aktion wurde bewusst nicht am Portfolio «Mami» ausgelöst; die konkrete Löschung bleibt eine vom Nutzer im Dialog bestätigte Portfolioänderung.
