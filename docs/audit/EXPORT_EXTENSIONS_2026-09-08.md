# Exporterweiterungen — Live-Prüfung

**Stand:** 8. September 2026, 14:03 Uhr (CEST)  
**Umfang:** Nicht verändernde Excel-/PDF-Exporte und druckbare Watchlist

## Watchlist-PDF

Die neue Aktion **„Watchlist PDF“** wurde in der lokalen, authentifizierten Verwaltungsansicht direkt neben „Aktualisieren“ ausgelöst. Der Browser bestätigte die Erzeugung und speicherte `aktienliste-watchlist-2026-09-08.pdf`. Der Report wird aus der aktuell gefilterten Liste erzeugt und enthält Ticker, Unternehmen, Sektor, Währung, Kurs, Dividendenrendite, KGV, YTD, Signal, Score und Datenstatus. Fehlende Kurs- oder FX-Daten werden als Datenlücke statt als Nullwert dargestellt. Der Export verändert weder Watchlist noch Portfolios oder Transaktionen.

## Portfolio-PDF

Der erweiterte PDF-Report für Portfolio „Mami“ wurde live erstellt und als `mami-2026-09-08-portfolio-report.pdf` heruntergeladen. Seite 1 zeigt Depotwert, Gewinn/Verlust, zeitgewichtete Rendite, Dividendenrendite, Sharpe Ratio und annualisierte Volatilität sowie Depotentwicklung, Sektorallokation und einen Methodenhinweis. Die Titelliste auf den Folgeseiten enthält zusätzlich YTD- und Seit-Kauf-Werte.

Bei der visuellen Prüfung war der historische Max-Drawdown trotz eines im Dashboard vorhandenen Werts nicht in der Kennzahlenübersicht sichtbar. Dieser Restpunkt bleibt offen: Er wird erst nach einer Datenmodellprüfung so ergänzt, dass kein unsourced Wert in den Export gelangt.

Nach der Erweiterung der Risikometadaten und des dynamischen PDF-Layouts wurde der Report erneut erzeugt. Die Kennzahlenübersicht enthält jetzt auch **Max. Drawdown −11,2 %** vollständig und ohne Überlappung; Sharpe Ratio, Volatilität und Dividendenrendite sind auf derselben Seite sichtbar.

Die anschliessende Live-Prüfung des Excel-Exports bestätigte zwar alle gewünschten Kennzahlen und die korrigierte Swissquote-YTD-Zeile (−16,7 %), zeigte aber einen unabhängigen Formatierungsfehler: Bereits in Prozentpunkten gespeicherte Werte wurden zusätzlich mit einem Excel-Prozentformat belegt, etwa 9,827 % als 982,7 % und −11,2 % als −1'120 %. Dieser Fehler wird vor Release auf eine einheitliche Prozentbasis korrigiert; die zugrunde liegenden Portfolio- und Risikodaten sind nicht betroffen.

Nach der testgetriebenen Excel-Korrektur wurde der Report erneut erstellt. Er weist Liquiditätsanteil 9,8 %, Dividendenrendite 3,0 %, Volatilität 13,0 % und Max. Drawdown −11,2 % korrekt aus; die Titelliste zeigt zudem die Swissquote-YTD-Performance von −16,7 % statt des früheren Splitartefakts. Die erwarteten drei Arbeitsblätter (Übersicht, Titelliste, Depotentwicklung) sind vorhanden.

Der Watchlist-PDF-Report wurde ebenfalls visuell geprüft. Die erste Seite zeigt ein druckbares Tabellenlayout mit Datenstand, Filterhinweis und 200 Titeln sowie Ticker, Unternehmen, Sektor, Währung, Kurs, Dividendenrendite, KGV, YTD, Signal, Score und Datenstatus. Mehrseitige Fortsetzung ist vorhanden. Kennzahlen- und Momentaufnahmenhinweis stehen im Fussbereich; es werden keine Anlageempfehlungen oder fiktiven Daten ausgegeben.

## Cash-Quote im Demoportfolio

Im Einstellungsdialog des nicht aktivierten Demoportfolios „Mami“ ist die gespeicherte Cash-Quote nun explizit sichtbar (10 % des Startkapitals). Der Dialog erklärt den Rechenvertrag: Wertpapiergewichte und Demo-Stückzahlen werden proportional auf den verbleibenden Investitionsanteil skaliert, Liquidität wird anschliessend als Residuum geführt. Der separate Button „Cash-Quote speichern“ war in der Sichtprüfung ohne Werteänderung deaktiviert; es erfolgte keine Portfolio-, Cash- oder Transaktionsmutation. Der Serverpfad ist zusätzlich auf Eigentümer, Demoportfolio, deaktiviertes Live-Tracking und leeres Ledger beschränkt.

## Regressionsnachweis

Die vollständige Projektsuite nach den Rendite-, Cash- und Exportänderungen schloss mit **206 bestandenen Testdateien**, **1'539 bestandenen Tests**, **5 übersprungenen Testdateien** und **11 übersprungenen Tests** ab. Der TypeScript-Check war zuvor ebenfalls fehlerfrei. Keine der Live-Prüfungen löste eine Portfolioänderung, Einzahlung, Aktivierung oder Transaktion aus.
