# Portfolio «Test» (5160001) – Implementierte Lösung für 5J-Risikokennzahlen

**Stichtag:** 27.09.2026  
**Umsetzung:** Phase A und B der beschlossenen Datenquellenstrategie  
**Geltungsbereich:** Historische Risikoanalyse – keine Handels-, Cash-, Ledger-, Bestands- oder aktuelle Bewertungsänderung.

## Ergebnis

Die zuvor blockierten fünf Kennzahlen werden für das Portfolio «Test» jetzt aus einer **vollständigen, konsistenten Fünfjahresreihe** berechnet:

| Kennzahl | Ergebnis | Einheitliche Basis |
|---|---:|---|
| Rendite p.a. | **+4,9 %** | geometrisch annualisierte CHF-Allokationsreihe |
| Volatilität p.a. | **16,0 %** | annualisierte tägliche Renditen derselben Reihe |
| Sharpe Ratio | **0,24** | identische 5J-Reihe, risikofreier Satz 2 % p.a. |
| Max. Drawdown | **−26,2 %** | Peak-to-Trough derselben 5J-Reihe |
| VaR 95 %, 1 Tag | **−1,6 %** | tägliche Renditen derselben 5J-Reihe |
| Beta | **0,73** | tagesgleich zum SPI gepaarte Renditen |

**Validierungsfenster:** 27.09.2021–25.09.2026, 1’302 qualifizierte Beobachtungen. Der SPI-Krisennachweis ist erfüllt (max. Drawdown −29,3 %; 28.12.2021–27.10.2023).

> Bei einem neu erstellten Demoportfolio ist dies ein **historischer Allokations-/Risikoproxy**: Die heutige Allokation wird mit festen Stückzahlen und konstanter Cash-Reserve rückwirkend in CHF bewertet. Es ist keine vor dem Portfolio-Start existierende Depot- oder Transaktionshistorie.

## Ursache der früheren Datenlücke

Die bisherige Sperre war fachlich sicher, aber zu grob: Vier Positionen hatten keine nutzbare EODHD-Historie in ihrer nativen Handelslinie. Die Anwendung blockierte deshalb das gesamte 5J-Fenster, statt eine verifizierte native Ersatzreihe zu verwenden. Das war bewusst besser als die gefährliche Alternative, etwa einen USD-ADR oder eine EUR-Proxylinie als identische Aktie auszugeben.

| Position | Problem vorher | Geprüfte historische Linie | Währung | Abrufbare 5J-Schlusskurse |
|---|---|---|---|---:|
| Horiba, `6856.T` | EODHD nur EUR-Proxylinie | `6856.T` (Tokyo) | JPY | 1’225 |
| DBS, `D05.SI` | EODHD nur USD-ADR | `D05.SI` (Singapore) | SGD | 1’262 |
| Snam, `SRG.MI` | EODHD nur USD-OTC | `SRG.MI` (Borsa Italiana) | EUR | 1’276 |
| Bravida, `SE0007491303.SG` | gespeicherte EUR-Linie, Primärmarkt separat | `BRAV.ST` (Nasdaq Stockholm) | SEK | 1’262 |

## Umgesetzte Schutzmechanismen

1. **EODHD bleibt Primärquelle.** Eine Sekundärquelle wird nicht allgemein oder opportunistisch verwendet.
2. **Strikte Allow-list je Handelslinie.** Nur vier konkret belegte native Linien dürfen für die Risikohistorie ergänzt werden.
3. **Kein Quellen-Mixing.** Die Risiko-Engine wählt je Position genau **eine** homogene Zeitreihe: EODHD-native oder die vollständig gespeicherte geprüfte Sekundärreihe – niemals tageweise gemischt.
4. **Währungscheck vor Speicherung.** Die Antwortwährung der Sekundärquelle muss zur dokumentierten nativen Handelswährung passen.
5. **Bravida nur wegen identischer ISIN.** Die Primärlinie `BRAV.ST` ist als 1:1-Aktie zur ISIN `SE0007491303` verifiziert. Die Reihe wird historisch via `SEKCHF` nach CHF umgerechnet.
6. **Strikte Abgrenzung der Wirkung.** Die neue Tabelle `native_historical_prices` enthält nur historische Risikopreise samt Quellsymbol, Währung, Identitätsart, Ratio und Abrufzeit. Sie verändert **nicht** `historical_prices`, den aktuellen EUR-Preis der Stuttgarter Linie, Portfolioanteile, Cash, Ledger oder Transaktionen.
7. **Transparenz im Risiko-Tab.** Jede genutzte Sekundärreihe wird als native Handelslinie bzw. als ISIN-verifizierte Primärlinie ausgewiesen.

## Automatisierung

- Bei Neuanlage und kontrolliertem Max-Backfill wird zuerst die additive EODHD-Historie geladen.
- Falls ein Symbol auf der engen verifizierten Ausnahmeliste liegt, ergänzt der separate Native-History-Provider nur seine dokumentierte Reihe.
- Der reguläre Preisimport aktualisiert diese geprüften Reihen fortlaufend, ohne Primär- und Sekundärpreise zusammenzuführen.
- Für unbekannte, ADR- oder fremdwährungsbasierte Auslandsnotierungen gibt es weiterhin **keinen** Ersatzwert: Sie bleiben als Datenlücke sichtbar, bis ISIN, Ratio und Handelslinie belegt sind.

## Nachweise und Tests

| Kontrolle | Resultat |
|---|---|
| DB-Nachweis | 4 getrennte Quellreihen gespeichert; Währungen JPY/SGD/EUR/SEK, je 1:1 bzw. identische ISIN dokumentiert |
| 5J-Gate im Devserver | erfüllt: 1’302 qualifizierte Beobachtungen, keine offene Abdeckungsissue |
| Browser-Livecheck | Die Portfolioansicht zeigt Rendite p.a., Volatilität, Sharpe, Max.-Drawdown, VaR und Beta statt Datenlücken |
| TDD | Tests für native Währung, Bravida-ISIN/1:1-Basis, keine unbestätigte Auslandsnotierung und vollständige Quellenauswahl |
| Regression | fokussiert 31 Tests bestanden; TypeScript fehlerfrei |

## Grenzen und nächste Qualitätsstufe

Die Umsetzung löst die konkrete Sperre robust. Die Ausnahmeliste ist absichtlich klein. Für zusätzliche ausländische Linien wird erst nach einem gleichwertigen Identitäts- und Währungsnachweis eine neue Quelle zugelassen; eine blosse Symbolähnlichkeit genügt nicht.

**Research und Analyse, keine persönliche Anlageberatung.**
