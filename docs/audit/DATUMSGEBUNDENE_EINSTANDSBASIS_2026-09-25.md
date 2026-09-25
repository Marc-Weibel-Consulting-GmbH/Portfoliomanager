# Datumsgebundene Einstandsbasis für Demoportfolios

**Datum:** 25. September 2026  
**Portfolio:** Mami (ID 4020001)  
**Autor:** Manus AI

## Ergebnis

Nicht aktivierte Demoportfolios erhalten für Positionen ohne gespeicherten Kaufbeleg eine **klar ausgewiesene Portfolio-Startbasis**. Diese Basis verwendet das Erstellungsdatum des Portfolios und den dazugehörigen kompatiblen historischen Schlusskurs in CHF. Sie ersetzt weder einen bestätigten Kauf noch Transaktionsdaten. Bei einer tatsächlichen Transaktion oder einem manuell gespeicherten Einstand bleibt deren Basis vorrangig.

Für Portfolio «Mami» ist das Portfolio-Startdatum der **8. September 2026**. Der beispielhaft geprüfte Titel **PST.MI** erhält deshalb einen abgeleiteten Einstand von **CHF 24.5410**. Der zugehörige EODHD-Schlusskurs beträgt **EUR 26.0880**; mit der historischen EUR/CHF-Rate von **0.940700** ergibt sich der CHF-Wert. Die Positionsrendite bezieht sich dadurch auf dieselbe Datums- und Kursbasis wie die Kopfkennzahl «Rendite seit Portfolio-Start».

## Dialogverhalten

Der Positionsdialog zeigt den abgeleiteten Betrag als **Ø-Einstandspreis (CHF)** und das Datum 08.09.2026. Der gespeicherte Status lautet «Einstand aus Portfolio-Start». Diese Anzeige ist bis zum Klick auf **Speichern** rein lesend und verändert keine Portfoliodaten.

Wird das Datum geändert, fragt der Dialog den historischen Schlusskurs und den historischen FX-Kurs für den gewählten Handelstag ab. Als praktische Regel verwendet er bei Wochenenden oder Feiertagen den letzten verfügbaren Handelstag davor. Der neu berechnete CHF-Betrag wird nur im Dialog eingesetzt. Die Nutzerin oder der Nutzer muss die Änderung weiterhin ausdrücklich speichern. Fehlt ein kompatibler Kurs oder FX-Satz, bleibt der Wert eine transparente Datenlücke.

## Datenintegrität

Die Änderung mutiert weder Positionen, Cash noch Buchungen. Der bekannte DBS-Fall mit historisch inkompatibler ADR-/Währungsreihe bleibt ausdrücklich ausgeschlossen: D05.SI erhält keine künstliche Portfolio-Startbasis.

| Live-Prüfung | Ergebnis |
|---|---:|
| Positionen mit Portfolio-Startbasis | 30 |
| Positionen mit begründeter Datenlücke | 1 (D05.SI, inkompatible historische Währungsbasis) |
| PST.MI Startdatum / CHF-Basis | 08.09.2026 / CHF 24.5410 |
| PST.MI manuell gewähltes Datum / CHF-Basis | 07.09.2026 / CHF 24.7095 |
| Portfolio-, Cash- oder Ledger-Mutation im Test | 0 |

## Verifikation

Der neue Code wurde mit den gezielten Tests für historische Einstandspreise, Einstandsstatus, Startdatum und manuelle Positionsbearbeitung geprüft. Die vollständige Testausführung bestand mit **227 Testdateien** und **1'626 Tests**; 5 Dateien beziehungsweise 11 Tests sind bewusst übersprungen. TypeScript war fehlerfrei. Die Live-Prüfung im Entwicklungsserver bestätigte sowohl die Standardbasis am 08.09.2026 als auch die automatische, nicht persistierende Kursneuberechnung nach einer Änderung auf den 07.09.2026.

## References

[1]: https://eodhd.com/financial-apis/stock-market-historical-data-api "EODHD Historical End-of-Day Data API"
