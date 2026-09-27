# Vorschlag: Robuste Kursdatenbasis für Portfolio-Risikokennzahlen

**Stichtag:** 27.09.2026  
**Betroffen:** Portfolio «Test» (ID 5160001), 5J-Rendite, Volatilität, Sharpe, VaR, Beta und Max.-Drawdown.

## Kurzfazit

Die gegenwärtige Alles-oder-Nichts-Sperre ist **zu streng als Nutzererlebnis**. Sie war richtig, um keine ADRs als identische Aktien zu erfinden, aber sie muss durch eine kontrollierte **Mehrquellen- und Instrumentidentitätsarchitektur** ersetzt werden.

Die technische Lösung ist verfügbar: EODHD bleibt Primärquelle. Falls EODHD die **native** Heimatbörse nicht führt, wird eine klar protokollierte Sekundärquelle **nur für exakt dieselbe Handelslinie** zugelassen. ADRs und Auslandsnotierungen bleiben ausgeschlossen, solange keine Ratio aus Primärquelle belegt ist.

## Reproduzierter Befund

| Position | lokale Basis | EODHD-Historie | native Sekundärreihe geprüft | Befund |
|---|---:|---|---|---|
| Horiba, `6856.T` | JPY | nur Frankfurt-Proxylinie in EUR | `6856.T`, JPY, 1’225 Handelstage, 21.09.2021–25.09.2026 | **native Reihe verfügbar** |
| DBS, `D05.SI` | SGD | nur US-ADR in USD | `D05.SI`, SGD, 1’262 Handelstage, 20.09.2021–25.09.2026 | **native Reihe verfügbar** |
| Snam, `SRG.MI` | EUR | US-OTC in USD | `SRG.MI`, EUR, 1’276 Handelstage, 20.09.2021–25.09.2026 | **native Reihe verfügbar** |
| Bravida, gespeicherter ISIN-Ticker | Portfolio sagt EUR | Stockholm-Primärlinie in SEK | `BRAV.ST`, SEK, 1’262 Handelstage, 20.09.2021–25.09.2026 | **Instrumentbasis im Portfolio ist fehlerhaft/ungeklärt** |

Die ersten drei Reihen erfüllen alle die Anforderung von mindestens 1’000 Beobachtungen über fünf Kalenderjahre. Ihre Währung stimmt mit der jeweiligen Heimatlinie überein; die Tageswerte können mit den vorhandenen FX-Reihen nach CHF konvertiert werden.

Bei Bravida darf die Reihe nicht einfach als EUR weitergeführt werden: ISIN `SE0007491303` verweist auf den schwedischen Titel, während der Portfolioeintrag EUR und einen nicht schwedischen Ticker enthält. Eine Umstellung ohne Abgleich des tatsächlich gehaltenen Instruments würde sowohl Marktwert als auch Risikoreihe verfälschen.

## Empfohlene Zielarchitektur

### 1. Instrument Master statt Ticker-Mapping

Jede Position erhält eine versionierte Instrumentidentität:

| Feld | Zweck |
|---|---|
| `isin` | wirtschaftliche Identität / Dublettenprüfung |
| `primaryTicker`, `primaryExchange`, `nativeCurrency` | verbindliche Handelslinie für Bewertung und Risiko |
| `priceSource` | `EODHD_PRIMARY`, `SECONDARY_NATIVE`, `VALIDATED_PROXY` oder `UNRESOLVED` |
| `sourceSymbol`, `sourceCurrency`, `retrievedAt` | genaue Herkunft jeder Preisreihe |
| `conversionRatio`, `ratioSource` | nur für belegte ADR-/GDR-Verhältnisse |
| `identityConfidence` | `verified`, `needs_review`, `blocked` |

Damit wird nie mehr aus einer Ticker-Endung implizit geschlossen, welche Aktie oder Währung gemeint ist.

### 2. Quellkaskade pro Handelslinie

1. **EODHD-native Linie** – Standard.
2. **Sekundärquelle derselben Primärlinie** – nur wenn Symbol, Börse und Währung exakt passen; Antwortschema, Währung, Beobachtungszahl und Zeitfenster werden geprüft.
3. **Validierter ADR-/GDR-Proxy** – nur wenn Ratio, Corporate-Action-Historie und Währungsumrechnung aus Primärquelle dokumentiert sind.
4. **Kein validierter Ersatz** – Position als Datenlücke markieren; niemals Preis oder Rendite schätzen.

Alle Quellen werden zeilenweise gespeichert, nicht vermischt. Die Risiko-Engine verwendet je Position **genau eine** qualifizierte, homogene Reihe.

### 3. Risikoausgabe mit zwei klar getrennten Ebenen

| Ebene | Wann sichtbar | Aussage |
|---|---|---|
| **Vollständig validiert** | 100% Marktwert mit qualifizierten Reihen | offizielle Portfolio-Kennzahl (5J) |
| **Abgedeckte Sleeve-Analyse** | mindestens 90% Marktwert; fehlende Positionen einzeln ausgewiesen | operative Orientierung, nie als vollständige Portfoliozahl bezeichnet |

Unter 90% wird nur die Datenqualität samt konkreter Behebungsaktion gezeigt. So blockiert ein einzelner kleiner Titel nicht jedes Insight, aber eine 20%-Lücke wird nicht stillschweigend als vollständiges Risiko ausgegeben.

### 4. Datenqualitäts-UX

Statt fünf Gedankenstriche erscheinen je Portfolio:

- **Abdeckung:** z.B. `96.2% des Marktwerts mit 5J-validierter Kursreihe`.
- **Kennzahlstatus:** `validiert`, `Sleeve (96.2%)` oder `Datenprüfung erforderlich`.
- **Konkrete Aktion:** «Native Linie nachladen», «Instrument überprüfen» oder «Ratio belegen».
- **Keine versteckten Ersatzwerte:** ADR-/Auslandsproxies sind immer mit Börse, Währung und Begründung sichtbar.

## Umsetzungsvorschlag

### Phase A – sofort umsetzbar (empfohlen)

1. Einen `nativeHistoryProvider` einführen, der EODHD zuerst und eine native Sekundärreihe nur nach strengen Symbol-/Währungschecks abruft.
2. Horiba, DBS und Snam kontrolliert mit ihren nativen Reihen ergänzen; jede Zeile erhält Quelle, Quellsymbol, Quellwährung und Abrufzeitpunkt.
3. FX-Konvertierung in CHF über die bestehenden zeitpunktgenauen FX-Reihen.
4. Risikokennzahlen danach über 100% der **bereinigten** 25 validierten Positionen plus Bravida-Status berechnen; solange Bravida offen ist, zusätzlich eine klar bezeichnete Sleeve-Abdeckung ausweisen.
5. Tests: Währungsgleichheit, identischer Instrumentkey, keine Mischreihe, 5J-Abdeckung, FX-Tage, Corporate-Action-Schutz und Abdeckungslabel.

### Phase B – Bravida korrekt auflösen

1. Anhand der ursprünglichen Buchung/Depotquelle klären, ob die gehaltene Linie tatsächlich `BRAV.ST` (SEK) oder ein EUR-Derivat/anderer Titel ist.
2. Erst nach diesem Nachweis Instrumentmaster, aktuelle Bewertung und historische Kursreihe harmonisieren.
3. Vorher/Nachher für Preis, CHF-Marktwert, Währung und Portfolioanteil als Audit vorlegen; keine stille Portfolioänderung.

### Option: sofortige vollständige Kennzahl

Nach Phase A + bestätigter Bravida-Identität kann die 5J-Reihe über **alle** Positionen berechnet werden. Dies ist der fachlich saubere Weg und meine Empfehlung.

Eine schnellere Partiallösung ohne Bravida-Abgleich ist möglich, wäre aber bewusst als `Sleeve-Risiko (ca. 95% abgedeckt)` gekennzeichnet – **nicht** als vollständige Portfolio-Kennzahl.

## Entscheidungsempfehlung

**Empfehlung: Phase A sofort implementieren und für Bravida einen präzisen Identitätsabgleich als kurze, bestätigungspflichtige Korrekturvorlage erstellen.** Das löst die drei echten Datenlücken technisch, verhindert künftige Blockaden und korrigiert Bravida nicht auf Verdacht.

## Daten- und Methodenhinweis

- **Zeitbasis:** 20./21.09.2021 bis 25.09.2026; tägliche Schlusskurse, mindestens 1’000 Beobachtungen.
- **Definition:** Rendite p.a. geometrisch; Volatilität und Sharpe annualisiert; Max.-Drawdown aus derselben CHF-Allokationsreihe.
- **Quellenvertrauen:** EODHD bevorzugt; die hier nachgewiesenen nativen Sekundärreihen dienen nur als kontrollierte Fallbacks, nicht als pauschaler Ersatz.
- **Compliance:** Research und Analyse, keine persönliche Anlageberatung.
