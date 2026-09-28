# Globale Policy für historische Watchlistdaten

**Stichtag der Inventur:** 27. September 2026  
**Prüfgrundlage:** 25-Titel-Paritätsstichprobe (5 Termine je Titel) und Watchlist-Historieninventur  
**Geltungsbereich:** alle 268 Watchlisttitel  
**Autor:** Manus AI

## Entscheidung

Die Watchlist benötigt eine **provenienzgebundene Drei-Reihen-Policy**. Ein Rohkurs, eine splitbereinigte Kursreihe und eine Brutto-Gesamtrenditereihe sind drei unterschiedliche Datenprodukte. Sie dürfen weder wechselseitig ersetzt noch über einen generischen „adjusted“-Wert vermischt werden. Bestehende Rohdaten bleiben unverändert; Abweichungen und Lücken erzeugen einen Status, ein Review-Ticket oder eine Sperre, aber **keine automatische Überschreibung**.

Die Policy ist bewusst konservativ. In der Inventur existiert zwar für alle 268 Titel eine Rohpreisreihe, aber nur für 23 Titel eine getrennte splitbereinigte Reihe und für 84 Titel eine getrennte Brutto-Gesamtrenditereihe. 246 Titel (91,8 %) tragen mindestens ein Auditproblem. Die 25-Titel-Stichprobe bestätigt zudem, dass „Close“ und „Adjusted Close“ zwischen Quellen nicht stets dieselbe Methodik, Quoteinheit oder Corporate-Action-Behandlung repräsentieren. [1] [2]

> **Leitsatz:** Ein plausibler Wert ist kein freigegebener Wert. Ohne bestätigte Instrumentidentität, Quoteinheit, Reihenart, Corporate-Action-Behandlung, FX-Pfad und zeitliche Abdeckung bleibt die betroffene Kennzahl gesperrt oder als nicht verifiziert gekennzeichnet.

## 1. Evidenzbasis und Grenzen

Dieser Bericht leitet Regeln **nur** aus den drei mitgegebenen Auditdateien ab. Es wurde kein externer Einzelwert abgeglichen, keine Quelle nachrecherchiert und keine Roh-, Kurs-, Corporate-Action-, FX- oder Score-Daten geändert.

| Evidenz-ID | Feststellung aus den Eingabedateien | Bedeutung für die Policy |
|---|---|---|
| **E1** | Die Paritätsdatei vergleicht Arbeitsmappen-Rohschluss und Total-Return-Feld ausdrücklich getrennt; Provider-`close` und Provider-`adjusted close` werden nicht vermischt. Die Toleranz beträgt 0,5 %. [1] | Die Trennung der Reihen ist ein zwingendes Datenmodell-Prinzip, nicht nur ein Darstellungswunsch. |
| **E2** | In 125 Stichprobenpunkten sind bei `eodhdClose` 113 Matches, 11 Mismatches und ein kalendergetragenes Ergebnis dokumentiert. Bei `eodhdAdjusted` sind es 101 Matches und 24 Mismatches; bei `yahooAdjusted` 81 Matches und 44 Mismatches. [1] | Ein Lieferantenfeld mit der Bezeichnung „adjusted“ ist nicht ohne Definition austauschbar. Kalenderübertragene Kurse sind von echten Handelstagsbeobachtungen zu unterscheiden. |
| **E3** | Das Inventar umfasst 268 Titel, 516.188 Rohzeilen, 29.105 splitbereinigte Zeilen und 80.953 Total-Return-Zeilen. Splitreihen fehlen bei 245 Titeln, Brutto-Gesamtrenditereihen bei 184. [2] | Score-, Risiko- und Renditefunktionen dürfen fehlende Reihen nicht stillschweigend aus anderen Reihen ableiten. |
| **E4** | 109 Rohhistorien beginnen nach dem Beginn des 5-Jahres-Stichprobenfensters; die Rohserien enden zum Inventurstichtag je nach Titel zwischen 21. und 25. September 2026. [2] | Alter, Länge und Stichtagsausrichtung jeder Eingabereihe müssen pro Berechnung geprüft werden. |
| **E5** | Das Inventar führt native und quotierte Währung getrennt. Zehn Titel haben abweichende native und quotierte Währung; bei mehreren ist die historische Proxyreihe ohne dokumentierte Ratio ausdrücklich nicht mit dem nativen Instrument vergleichbar. [2] | Eine andere Handelslinie, ADR/GDR oder FX-Proxy darf nicht als dieselbe Preisreihe gelten. |
| **E6** | `GBp` kommt als native Einheit bei fünf und als Quoteinheit bei sieben Titeln vor, während der FX-Bestand ein Paar `GBPCHF`, aber kein Paar `GBpCHF` enthält. [2] | Quoteinheit und ISO-Währung müssen getrennte Felder sein; GBp darf nicht als eigenständige FX-Währung behandelt werden. |
| **E7** | FX-Reihen nach CHF bestehen für AUD, CAD, DKK, EUR, GBP, NOK, PLN, SEK und USD, jeweils ab 2016-09-07 bis 2026-09-27. JPYCHF und SGDCHF fehlen, obwohl JPY und SGD als native Währungen vorkommen. [2] | Eine Base-Currency-Kennzahl in CHF benötigt einen expliziten, datierten FX-Pfad; fehlende Paare sperren die betroffene Umrechnung. |
| **E8** | Die Corporate-Action-Review enthält 25 Ergebnispositionen. 24 sind mit Identität, Börsenplatz, Währung, Primär- und unabhängigen Historienquellen erfolgreich dokumentiert; eine Ergebnisposition ist wegen eines internen Workflow-Fehlers nicht auswertbar. [3] | Eine Stichprobe ist kein universeller Freigabenachweis. Fehlende oder nicht eindeutig zuordenbare Identitätsprüfung sperrt die Weiterverwendung für identitätsabhängige Berechnungen. |
| **E9** | Die erfolgreichen Reviews dokumentieren Bardividenden, Splits bzw. Negativfeststellungen dazu, Kapitalherabsetzungen/Rückkäufe sowie Prüfungen auf Spin-offs, Bezugsrechte, ADR/GDR und Linienwechsel. Die Reviews betonen zugleich, dass sie keine tägliche 5-Jahres-Reconciliation ersetzen. [3] | Corporate Actions brauchen ein Ereignis-Gate und eine explizite Reihenbehandlung; eine Negativfeststellung in einem begrenzten Quellenbestand ist keine vollständige Feed-Abdeckung. |
| **E10** | Die Inventur weist 59 unvollständige Qualitäts-/Bewertungsscores und 20 fehlende Timing-Scores aus. Dennoch sind bei problembehafteten Titeln zum Teil Labels wie BUY, SELL oder STRONG BUY gespeichert. [2] | Ein gespeichertes Label ist kein Freigabebeweis. Fehlende Komponenten oder gesperrte Marktdaten müssen Score und abgeleitetes Risiko blockieren. |

Die 25-Titel-Parität ist eine punktuelle Prüfung an fünf Daten je Titel; sie ist **kein** Volltest der täglichen Historie. Auch die Corporate-Action-Reviews zeigen eine begrenzte öffentliche Quellenabdeckung und dürfen nicht als Ersatz für einen vollständigen Corporate-Actions-Feed verstanden werden. [1] [3]

## 2. Verbindliches Ziel-Datenmodell

Jede Beobachtung und jede abgeleitete Reihe muss mindestens die folgenden Metadaten tragen:

- **Instrumentidentität:** interne Instrument-ID, ISIN soweit vorhanden, Emittent, Anteilsklasse, Börsenplatz/MIC, primärer Ticker und konkret verwendete Handelslinie.
- **Preisidentität:** `price_currency`, `quote_unit`, `unit_factor_to_currency`, Handelstag, Börsenkalender, Schlusskursart und Quellenzeitstempel.
- **Reihenidentität:** `RAW_CLOSE`, `SPLIT_ADJUSTED_CLOSE` oder `GROSS_TOTAL_RETURN_INDEX`; keine Mehrdeutigkeit durch ein unqualifiziertes Feld `adjusted`.
- **Provenienz:** Quelle, Quellensymbol, Originalwert, Abrufzeit, Methodik-/Definitionsversion, Corporate-Action-Ledger-Version und FX-Reihen-ID.
- **Status:** `verified`, `pending_review`, `blocked` oder `not_available`; Status und Begründung gehören zur Beobachtung oder zur abgeleiteten Kennzahl, nicht als Überschreibung in den Rohwert.

Der **Rohwert** ist unveränderlich zu speichern. Korrekturen, Alternative-Quellen, Umrechnungen und bereinigte Reihen sind neue, versionierte Ableitungen mit Rückverweis auf den unveränderten Originalwert.

## 3. Die drei Reihen sind fachlich und technisch getrennt

| Reihe | Zulässiger Inhalt | Unzulässiger Inhalt | Mindest-Gate vor Nutzung | Evidenz |
|---|---|---|---|---|
| **Rohkursreihe (`RAW_CLOSE`)** | Tatsächlich quotierter Schlusskurs der identifizierten Handelslinie in der originalen Quoteinheit. Ex-Dividenden-Abschläge bleiben sichtbar. | Dividendenreinvestition, rückwirkende Splitfaktoren, FX-Umrechnung im selben Feld, Ersatz durch `adjusted close`, Ersatz durch einen anderen Listing-Kurs. | Instrument, Börsenplatz, Handelstag, Preiswährung und Quoteinheit sind bestätigt; die Beobachtung stammt vom zulässigen Handelstag. | E1, E2, E5, E6, E9 |
| **Splitbereinigte Preisreihe (`SPLIT_ADJUSTED_CLOSE`)** | Rohkurs, ausschließlich für bestätigte Split-/Reverse-Split-Verhältnisse derselben Anteilsklasse rückwirkend skaliert. Die Skalierungsfaktoren sind je Ereignis und Datum protokolliert. | Dividenden, Sonderausschüttungen, Kapitalherabsetzungen/Rückkäufe ohne bestätigtes Umtauschverhältnis, Rechte, Spin-offs oder ein undokumentierter Provider-`adjusted close`. | Vollständiges, bestätigtes Split-Ledger für den benötigten Zeitraum; keine offene komplexe Corporate Action. | E3, E9 |
| **Brutto-Gesamtrenditereihe (`GROSS_TOTAL_RETURN_INDEX`)** | Splitkontinuität sowie Wiederanlage aller **brutto** je Anteil zustehenden Barausschüttungen am dokumentierten Ex-Tag bzw. nach festgelegter, einheitlicher Konvention. Brutto bedeutet vor individuellen Quellensteuern, Depotgebühren und Anlegerkosten. | Rohkurs als Ersatz, Netzto-Gesamtrendite ohne Kennzeichnung, vermischte Anbieter-`adjusted close`-Definitionen oder unbestätigte Sach-/Rechteausschüttungen. | Vollständiges Ausschüttungs- und Corporate-Action-Ledger samt Methodik, Startwert und Reinvestitionskonvention für den vollständigen Messzeitraum. | E1, E2, E3, E9 |

**Regel R1 – Keine Feldsubstitution.** `RAW_CLOSE`, `SPLIT_ADJUSTED_CLOSE` und `GROSS_TOTAL_RETURN_INDEX` sind separate, versionierte Serien. Ein `adjusted close` eines Providers darf erst nach dokumentierter Methodikzuordnung einer dieser Reihen zugeordnet werden. Bis dahin bleibt er ein separates Lieferantenfeld und ist nicht score- oder risikowirksam. Dies folgt direkt aus der unterschiedlichen Parität der angepassten Felder gegenüber Rohschlussfeldern. [1]

**Regel R2 – Keine implizite Rekonstruktion.** Fehlt die separate Split- oder Brutto-Gesamtrenditereihe, wird die fehlende Reihe als `not_available` geführt. Insbesondere darf sie nicht anhand der vorhandenen Rohreihe, eines fremden `adjusted close` oder einer Rendite eines anderen Listings synthetisch gefüllt werden. Die Inventur zeigt, dass diese Lücken nicht Einzelfälle sind: 245 bzw. 184 Titel sind betroffen. [2]

**Regel R3 – Berechnung entlang der fachlichen Frage.** Preisniveau, technische Signale ohne Dividendenannahme und Corporate-Action-Prüfung verwenden `RAW_CLOSE` oder, wenn Splitkontinuität zwingend ist, `SPLIT_ADJUSTED_CLOSE`. Langfristige Wertentwicklung einschließlich Ausschüttungen verwendet ausschließlich `GROSS_TOTAL_RETURN_INDEX`. Die verwendete Reihenart ist mit jedem Ergebnis auszugeben. [1] [3]

## 4. Quoteinheiten und Währungen

### 4.1 Quoteinheit ist nicht gleich Währung

Die Felder `price_currency` und `quote_unit` sind verpflichtend zu trennen. Beispiele:

| Darstellung | Zu speichernde Bedeutung | FX-Behandlung | Freigabezustand |
|---|---|---|---|
| `CHF`, `USD`, `EUR` usw. | Währung und Quoteinheit sind identisch; `unit_factor_to_currency = 1`, sofern die Quelle keinen anderen Multiplikator ausweist. | Direkter FX-Pfad `Währung/CHF`, falls eine CHF-Kennzahl verlangt wird. | Nur mit bestätigter Instrument- und Einheitenmetadaten. |
| **`GBp`** | Eine **Quoteinheit**, nicht eine zusätzliche ISO-FX-Währung. Sie ist getrennt von `GBP` zu speichern. Die Normalisierung `GBp → GBP` mit Faktor `0,01` ist nur zulässig, wenn die Quellen-/Börsenmetadaten die Notierung ausdrücklich als Pence bestätigen. | Nach bestätigter Einheitenumrechnung ist `GBPCHF` zu verwenden; `GBpCHF` darf nicht künstlich erzeugt oder als Währungspaar geführt werden. | Bis zur Quellbestätigung der Einheitenbedeutung: `pending_review`; keine automatische Faktor-100-Korrektur. |
| Abweichende Handelslinie oder Proxy | `native_currency`, `quote_currency`, Listing, Ratio und eventuelle ADR/GDR-Relation werden getrennt gespeichert. | Nur bei bestätigter, datierter Ratio und vollständigem FX-Pfad. | Ohne Ratio bzw. exakte Identität: `blocked` für vergleichende Preis-, Rendite- und Risikoanwendungen. |

**Regel R4 – Einheit vor Preisvergleich.** Ein Preisvergleich, eine Rendite oder ein Paritätstest ist erst zulässig, nachdem Währung **und** Quoteinheit beider Seiten identisch beziehungsweise nachvollziehbar umgerechnet sind. Die großen, wiederkehrenden Paritätsabweichungen einzelner Stichprobentitel zeigen, dass ein numerisch plausibler Close ohne Einheiten- und Corporate-Action-Kontext nicht genügt. [1]

**Regel R5 – GBp konservativ behandeln.** Die Inventur nutzt `GBp` separat von `GBP` und enthält nur `GBPCHF`. Deshalb wird keine pauschale Umrechnung bereits gespeicherter GBp-Rohwerte vorgenommen. Für neue Ableitungen ist der Faktor 0,01 nur mit bestätigter Pence-Metadatenquelle erlaubt; andernfalls werden CHF-Wert, Rendite, Score und Risiko, soweit sie diese Quote verwenden, gesperrt. [2]

**Regel R6 – Native und quotierte Handelslinie nicht vermengen.** `nativeCurrency != quoteCurrency` ist ein Identitäts- und Vergleichs-Gate, kein Signal zur automatischen FX-Konversion. Das gilt besonders für die zehn inventarisierten Abweichungen. Bei mehreren davon dokumentiert das Inventar ausdrücklich eine fehlende Ratio und die Nichtvergleichbarkeit der Proxyhistorie mit dem nativen Instrument. [2]

## 5. Quellenhierarchie und Paritätsverfahren

### 5.1 Quellenhierarchie

| Priorität | Zulässige Rolle | Regel |
|---|---|---|
| **1 – Primärnachweis** | Börse/Handelsplatz für Instrument, Handelskalender, Kurs- und Einheitenmetadaten; Emittent, Verwahrstelle oder offizieller Corporate-Action-Nachweis für Dividenden, Splits, Rechte, Spin-offs, Umtauschrelationen und Kapitalmaßnahmen. | Maßgeblich für Instrumentidentität, Corporate-Action-Entscheidungen und die Definition der zugrunde liegenden Handelslinie. |
| **2 – Vertrags-/Marktdatenlieferant** | Lizenzierter oder dokumentierter Vendor für historische Tageswerte, sofern Symbol, Börsenplatz, Währung, Quoteinheit und Felddefinition erhalten bleiben. | Als operative Zeitreihe zulässig; an Primärnachweisen und den definierten Reihenarten zu validieren. |
| **3 – Unabhängige Kontrollquelle** | Unabhängige Historienquelle zur Plausibilisierung von Instrumentzuordnung, Kurskontinuität und Anbieterdefinition. | Nur Kontroll- und Eskalationsquelle. Sie überschreibt weder Rohwerte noch Corporate-Action-Ledger automatisch. |

Die Hierarchie folgt der Stichprobe: Die Identitätsreviews verbinden offizielle Emittenten-/Börsenbelege mit unabhängigen Historienquellen, während die Paritätsprüfung EODHD und Yahoo als Vergleichsquellen nutzt. Die Reviews weisen außerdem ausdrücklich darauf hin, dass öffentliche Historienansichten keine vollständige tägliche Reconciliation oder vollständigen Corporate-Action-Feed ersetzen. [1] [3]

**Regel R7 – Rohdaten bleiben append-only.** Jede Quelle wird mit Originalwert, Symbol, Definition und Abrufzeit gespeichert. Ein Match bestätigt nur den Prüfstatus; ein Mismatch erzeugt eine Abweichung. Weder Match noch Mismatch darf einen vorhandenen Rohwert automatisch durch einen anderen Providerwert ersetzen. [1]

**Regel R8 – Parität prüft Gleichartiges.** Rohschluss wird nur gegen Rohschluss derselben identifizierten Handelslinie, Einheit und Währung geprüft. Splitbereinigt wird nur gegen Splitbereinigt mit kompatibler Splitdefinition geprüft. Brutto-Gesamtrendite wird nur gegen eine methodisch gleich definierte Brutto-Gesamtrenditereihe geprüft. Provider-`adjusted close` bleibt ausgeschlossen, bis seine genaue Behandlung von Dividenden, Splits, Kapitalrückzahlungen und sonstigen Ausschüttungen dokumentiert ist. [1] [3]

**Regel R9 – Mismatch ist ein Gate, keine Korrekturanweisung.** Die in der Stichprobe verwendete 0,5-%-Toleranz kann als technische Warnschwelle dienen, aber nicht als Freigabe für das Universum. Ein Mismatch oberhalb der Schwelle, ein fehlender Wert, ein fehlendes Quellen-Datum oder `calendar_carried` setzt mindestens `pending_review`. Bleibt die Abweichung nach Prüfung von Einheit, Listing, Kalender und Corporate Action offen, wird die betroffene Reihe für neue Scores und Risikokennzahlen `blocked`. [1]

**Regel R10 – Kalenderdaten nicht erfinden.** Eine Beobachtung darf nur an ihrem tatsächlichen Quellen-Handelstag verwendet werden. Ein auf einen Vortag zurückgetragenes Ergebnis kann zur Anzeige als „letzter verfügbarer Kurs“ markiert werden, darf aber keine Rendite, Volatilität, Drawdown-, Timing- oder Paritätsberechnung für den Zieltag erzeugen. Die Stichprobe enthält einen explizit als `calendar_carried` gekennzeichneten Fall. [1]

## 6. Corporate-Action-Gates

Vor jeder Ableitung über ein Corporate-Action-Datum muss ein Instrument- und Ereignis-Gate durchlaufen werden. Das Gate gilt nicht nur für bekannte Ereignisse. Auch das Fehlen eines vollständigen Nachweises ist ein Ergebnisstatus.

| Corporate Action / Zustand | Rohkurs | Splitbereinigter Kurs | Brutto-Gesamtrendite | Gate und Folge |
|---|---|---|---|---|
| **Ordentliche Bardividende** | Unverändert; Ex-Tag-Drop bleibt Rohmarktbeobachtung. | Unverändert, sofern die Reihe wirklich nur splitsbereinigt ist. | Bruttobetrag je Anteil nach dokumentierter Reinvestitionskonvention einbeziehen. | Ohne bestätigten Bruttobetrag, Ex-Tag oder methodische Konvention keine TR-Freigabe über das Ereignis. |
| **Split / Reverse Split** | Originale historische Notierungen bleiben unverändert. | Ausschließlich mit bestätigtem Ratio und Wirksamkeitsdatum skalieren. | Anteilzahl-/Indexkontinuität mit demselben bestätigten Ratio abbilden. | Bei offenem Ratio, Ex-Tag oder Anteilsklasse: SA, TR sowie kontinuierliche technische Kennzahlen sperren. |
| **Kapitalherabsetzung, Aktienrückkauf, Einziehung eigener Aktien** | Unverändert. | Kein Splitfaktor allein aufgrund einer veränderten Aktienzahl. | Nur einbeziehen, wenn eine klar als je gehaltenen Anteil zustehende Ausschüttung nachgewiesen ist. | Ereignis klassifizieren; nicht automatisch als Split oder Dividende umdeuten. |
| **Sonderdividende, Sachdividende, Spin-off** | Originalwert behalten. | Nicht automatisch bereinigen. | Nur nach dokumentierter Bewertungs-/Reinvestitionsmethode und exakter Zuordnung. | Bis zur manuellen Ereignisbewertung SA/TR über das Datum und davon abhängige Kennzahlen sperren. |
| **Bezugsrechte, Kapitalerhöhung, Fusion, Umtausch, Delisting, Linien- oder Anteilsklassenwechsel** | Kein automatisches Fortsetzen über die alte/neue Linie. | Kein generischer Faktor. | Kein automatischer Kontinuitätswert. | Exakte Instrumentnachfolge, Ratio, effektives Datum und Behandlung der Rechte sind Pflicht; andernfalls alle kontinuierlichen Kennzahlen sperren. |
| **ADR/GDR oder andere Cross-Listing-Relation** | Nicht mit der Heimatlinie mischen. | Nicht über ADR/GDR-Verhältnis ableiten, solange Ratio und Änderungsverlauf nicht bestätigt sind. | Nicht mit einer anderen Linie verketten. | Ohne dokumentierte, datierte Ratio und identische wirtschaftliche Berechtigung: Vergleich, FX-Umrechnung und Risiko sperren. |
| **Kein Ereignis bestätigt, aber Quellenabdeckung begrenzt** | Rohwert darf als Rohwert bestehen bleiben. | Keine Aussage über Vollständigkeit der Bereinigung. | Keine Aussage über Vollständigkeit der Ausschüttungsreinvestition. | Status `pending_review`, wenn die Kennzahl eine lückenlose Corporate-Action-Abdeckung voraussetzt. |

**Regel R11 – Ereignis-Ledger vor Berechnung.** Jede Corporate Action erhält eine unveränderliche Ledger-Zeile mit Instrument-ID, Ereignistyp, Ex-/Wirksamkeitsdatum, Verhältnis bzw. Bruttobetrag, Quelle, Quellenrang, Entscheidung und angewandter Reihenwirkung. Nur bestätigte Ledger-Einträge dürfen eine abgeleitete Reihe verändern. [3]

**Regel R12 – Kapitalstruktur ist nicht automatisch Preisfaktor.** Rückkäufe, Einziehungen und Kapitalherabsetzungen sind getrennt von Splits zu behandeln. Die Corporate-Action-Stichprobe enthält mehrere solche Maßnahmen und beschreibt sie ausdrücklich als keine Splitfaktoren, sofern sie keine je gehaltene Aktie betreffende Ausschüttung oder Umtauschrelation darstellen. [3]

**Regel R13 – Negative Evidenz eng auslegen.** „Kein Split“ oder „kein Spin-off identifiziert“ aus einem begrenzten öffentlichen Review schließt ein Ereignis nicht universell aus. Für eine neue oder nachträgliche historische Ableitung ist deshalb entweder eine ausreichende Primär-/Feed-Abdeckung über den benötigten Zeitraum oder ein Status `pending_review` erforderlich. [3]

**Regel R14 – Corporate-Action-Review darf nicht still übergehen.** Ein offenes, unklassifiziertes oder widersprüchliches Ereignis sperrt nicht den Rohwert, aber jede bereinigte, Total-Return-, kontinuierliche Rendite-, Volatilitäts-, Drawdown- und Timing-Berechnung, deren Fenster das Ereignis überschreitet. [3]

## 7. FX-Policy und CHF-Abdeckung

Die vorhandenen FX-Reihen sind ausdrücklich ein **Bestand**, nicht der Nachweis einer lückenlosen universellen Währungsabdeckung. Für CHF sind AUD, CAD, DKK, EUR, GBP, NOK, PLN, SEK und USD abgedeckt; für JPY und SGD besteht im Inventar kein direkter `JPYCHF`- bzw. `SGDCHF`-Pfad. [2]

**Regel R15 – FX-Pfad als eigene Zeitreihe.** Eine CHF-basierte Kennzahl benötigt für jeden verwendeten Preis- oder Cashflow-Tag eine datierte FX-Beobachtung aus einer qualifizierten FX-Reihe. Der FX-Wert wird nicht in `RAW_CLOSE` eingebettet, sondern als eigene Ableitung mit Paar, Datum, Richtung, Spot-/Fixing-Konvention und Quelle gespeichert. [2]

**Regel R16 – Einheit vor FX.** Zuerst wird eine bestätigte Quoteinheit in die bestätigte Preiswährung überführt; erst danach erfolgt die FX-Umrechnung. Bei GBp heißt dies: bestätigte Pence-Einheit → GBP → GBPCHF. Eine direkte, undokumentierte GBp/CHF-Rate ist unzulässig. [2]

**Regel R17 – Kein stiller Dreiecks-FX-Ersatz.** Fehlt das erforderliche direkte Paar, zum Beispiel JPYCHF oder SGDCHF, wird nicht automatisch über USD, EUR oder die Währung einer Proxy-Handelslinie trianguliert. Eine Triangulation ist nur nach expliziter Policy-Freigabe möglich, wenn beide Beine, Tageskonvention, Richtung und Datenverfügbarkeit dokumentiert sind; bis dahin ist die CHF-Kennzahl `blocked`. [2]

**Regel R18 – Nativerisiko braucht native FX.** Risiko oder Rendite in der nativen wirtschaftlichen Währung benötigt den FX-Pfad dieser nativen Währung, nicht den Pfad einer abweichenden Quote-/Proxywährung. Liegen native und quotierte Währung auseinander oder fehlt der native FX-Pfad, bleibt natives Risiko gesperrt, auch wenn ein Preis in einer anderen Währung verfügbar ist. [2]

## 8. Datenlücken, Aktualität und Score-/Risikosperren

### 8.1 Datenlücken sind explizite Zustände

| Zustand | Zulässige Anzeige | Nicht zulässig | Status |
|---|---|---|---|
| Rohkurs vorhanden, aber Zeitfenster zu kurz | Letzter Rohkurs mit erstem/letztem Datum und Coverage-Hinweis. | 5-Jahres-Rendite, 5-Jahres-Volatilität oder ein darauf gestützter Timing-Score. | `not_available` für die nicht abgedeckte Kennzahl. |
| Splitreihe fehlt | Rohkursanzeige. | Splitkontinuierliche Chart-, Rendite-, Risiko- oder Timing-Kennzahl über mögliche Splits. | `blocked`, falls Splitkontinuität erforderlich ist. |
| Brutto-Gesamtrenditereihe fehlt | Rohpreisrendite, klar als Preisrendite bezeichnet. | Total-Return-Rendite, ausschüttungsbereinigter Vergleich oder TR-basierter Score. | `not_available` für TR-basierte Kennzahlen. |
| Quellen-/Paritätsabweichung offen | Rohdaten mit Quellenkennzeichnung; Vergleichsbefund. | Automatische Wahl einer „richtigen“ Quelle oder Score/Risiko aus der strittigen Reihe. | `pending_review` bzw. `blocked` nach ungelöster Prüfung. |
| Letzter Kurs nicht auf zulässigem Zielhandelstag | Letzter verfügbarer Kurs mit Quellendatum. | Tagesrendite, frisches Timing, Stichtagsranking oder Risiko für den Zieltag. | `stale` und `blocked` für tagesaktuelle Kennzahlen. |
| Identität, Listing, Ratio, Einheit oder Corporate Action offen | Stammdaten-/Review-Hinweis. | Linienübergreifende Preis- oder FX-Vergleiche und sämtliche davon abgeleiteten Kennzahlen. | `blocked`. |

**Regel R19 – Zeitfenster ist eine harte Voraussetzung.** Für jede Kennzahl sind benötigter Starttag, Endtag, Handelstagskalender und Mindestanzahl Beobachtungen vorab festzulegen. Beginnt eine Roh- oder erforderliche abgeleitete Reihe später, wird der Wert nicht hochgerechnet und nicht mit einem Ersatzlisting aufgefüllt. 109 Rohreihen starten erst nach Beginn des 5-Jahres-Fensters. [2]

**Regel R20 – Aktualität ist marktbezogen zu prüfen.** „Aktuell“ heißt: Beobachtung am Zieltag oder am ausdrücklich zugeordneten letzten Handelstag **derselben** Börse. Die Bestandsenddaten der Rohreihen liegen zum Inventurstichtag gestreut zwischen 21. und 25. September 2026; ohne dokumentierte Kalenderzuordnung ist kein einheitlicher Stichtagsvergleich zulässig. [2]

**Regel R21 – Fehlende Komponenten sperren den zusammengesetzten Score.** Fehlt Qualität, Bewertung, Timing, Timing-Abdeckung oder das zulässige Marktdatensubstrat einer gewichteten Scorekomponente, wird kein Gesamtscore und kein BUY/HOLD/SELL-Signal neu berechnet oder aktualisiert. Ein bereits gespeichertes Label darf sichtbar bleiben, muss aber mit `blocked`/`stale` und Ursache gekennzeichnet werden. Die Inventur weist 59 unvollständige Qualitäts-/Bewertungsscores und 20 fehlende Timing-Scores aus. [2]

**Regel R22 – Risiko folgt der strengsten Eingabe.** Volatilität, Drawdown, VaR-ähnliche Kennzahlen, Korrelation, Exposure und Timing-Risiko sind gesperrt, wenn irgendeine hierfür verwendete Preis-, Split-, TR-, Corporate-Action-, FX-, Einheiten- oder Identitätsbedingung gesperrt ist. Teilreihen dürfen nicht durch Auffüllen mit anderen Listings, Rücktragen von Preisen oder implizite FX-Annahmen geschlossen werden. [1] [2] [3]

### 8.2 Freigabematrix für Scores und Risiko

| Berechnung | Freigabe nur wenn | Muss gesperrt werden wenn |
|---|---|---|
| **Rohpreisbasierter kurzfristiger Indikator** | `RAW_CLOSE` der exakten Handelslinie, bestätigte Einheit/Währung, zulässiger Handelstag, kein offener Preis-/Identitätsmismatch. | letzter Wert nur kalendergetragen oder stale ist; Einheit/Listing streitig ist; Preisparität offen ist. |
| **Splitkontinuierliches Timing, Volatilität, Drawdown** | vollständige `SPLIT_ADJUSTED_CLOSE` für das benötigte Fenster und kein offenes Ereignis-Gate. | Splitreihe fehlt; Split/Reverse-Split oder komplexe Action offen ist; Zeitraum nicht vollständig ist. |
| **Brutto-Gesamtrendite und TR-Risiko** | vollständige `GROSS_TOTAL_RETURN_INDEX`, vollständiges Ausschüttungs-/Action-Ledger, konsistente Brutto-Definition. | TR-Reihe fehlt; Dividende/Sonderausschüttung/Rechte/Spin-off nicht klassifiziert sind; eine Netto-/Bruttomischung droht. |
| **CHF-Rendite, CHF-Risiko, Währungsbeitrag** | zulässige Ausgangsreihe, bestätigte Einheit, für jeden relevanten Tag vollständiger FX-Pfad und dokumentierte Richtung. | FX-Paar, FX-Tag, Einheit oder native/quotierte Ratio fehlt; nur Proxy-FX verfügbar ist. |
| **Gesamtscore / Signal** | alle verpflichtenden Komponenten sind vorhanden, frisch und gemäß ihrer Reihenanforderung freigegeben; Gewichtung und Stichtag sind dokumentiert. | irgendeine Pflichtkomponente fehlt, stale/pending/blockiert ist oder die zugrunde liegende Reihenart nicht zur Komponente passt. |

## 9. Operative Reihenfolge ohne Datenüberschreibung

1. **Identifizieren:** Instrument, Anteilsklasse, ISIN, Börsenplatz, Handelslinie, Preiswährung und Quoteinheit prüfen. Keine Cross-Listing- oder Proxy-Annahme.
2. **Rohdaten bewahren:** Quellwert und Metadaten unverändert speichern; keine Korrektur im Rohfeld.
3. **Corporate Action klassifizieren:** Ereignis im Ledger erfassen, Quelle und Reihenwirkung bestätigen oder Review-Sperre setzen.
4. **Reihe ableiten:** Split- und TR-Reihen ausschließlich aus bestätigten Ledger- und Reihenregeln erzeugen; Quelle, Version und Konvention mitführen.
5. **FX anwenden:** Nur nach bestätigter Einheit und auf einem vollständigen, datierten FX-Pfad.
6. **Parität prüfen:** Nur gleichartige Reihen, gleiche Einheit, gleiche Linie und gleicher Handelstag gegen die Quellenhierarchie prüfen. Abweichungen dokumentieren, nicht überschreiben.
7. **Kennzahl freigeben oder sperren:** Der Status der schwächsten erforderlichen Eingabe bestimmt den Status von Score, Signal und Risiko.

## 10. Konkrete universumsweite Konsequenz zum Stichtag

Für das gesamte Universum ist eine pauschale Freigabe von splitkontinuierlichen, Brutto-Total-Return- oder CHF-basierten Risiko-/Scorekennzahlen nicht vertretbar. Die Lückenquote ist dafür zu hoch: Splitreihen fehlen bei 91,4 % und Brutto-Gesamtrenditereihen bei 68,7 % der Titel. Ebenso darf die erfolgreiche Identitätsprüfung der meisten Titel in der 25er-Stichprobe nicht als Nachweis für die restlichen 243 Titel dienen; eine der 25 Review-Positionen ist zudem selbst nicht auswertbar. [2] [3]

Die unmittelbare Policy-Entscheidung lautet daher:

- **Bestehende Rohdaten nicht überschreiben, löschen, skalieren oder durch Providerdaten ersetzen.**
- **Alle drei Reihen separat führen und jede Ausgabe mit Reihenart, Währung, Quoteinheit, Quelle und Status versehen.**
- **Scores und Risiken gezielt sperren, statt fehlende Daten, Corporate-Action-Faktoren, FX-Paare oder Instrumentrelationen zu schätzen.**
- **Abweichungen in einer Review-Queue dokumentieren; erst ein bestätigter, versionierter Nachweis darf eine neue abgeleitete Reihe erzeugen.**

Damit bleibt der Rohdatenbestand prüfbar, während Nutzende klar erkennen können, ob ein Preis nur angezeigt, eine Rendite berechnet oder ein Score/Risiko fachlich freigegeben werden darf.

## References

[1]: file:///home/ubuntu/portfolio_analysis_website/audit_runs/mami_historical_2026-09-27/external_price_parity_2026-09-28.json "25-title external price parity audit, generated 2026-09-28"

[2]: file:///home/ubuntu/portfolio_analysis_website/audit_runs/watchlist_historical_2026-09-27/watchlist_historical_inventory_2026-09-27.json "Watchlist historical inventory, as of 2026-09-27"

[3]: file:///home/ubuntu/portfolio_analysis_website/audit_runs/mami_historical_2026-09-27/external_title_identity_corporate_actions_2026-09-28.json "25-title identity and corporate-actions review, generated 2026-09-28"
