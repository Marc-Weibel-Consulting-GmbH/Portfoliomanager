# Live-Tracking: Depotwert-Doppelzählung — Worklog

**Status:** Ursache bestätigt; Codefix und kontrollierter Live-Übergang getestet, Restregression folgt.

## Beobachtung und Ursache

Beim Testportfolio **«Test KI»** lagen vor der Korrektur CHF 49’999.93 Cash bei einem Einstand von CHF 250’000, einer im Portfolio gespeicherten Cash-Quote von 10 % und Positionsgewichten von 90 %. Die korrekte Reserve beträgt damit CHF 25’000. Beim früheren Aktivierungspfad wurde das Startkapital erneut als Einzahlung gebucht und anschliessend wurden die 90 %-Positionen als Käufe angelegt. Aus CHF 25’000 bestehendem Cash plus CHF 250’000 Einzahlung minus rund CHF 225’000 Käufe wurden rund CHF 50’000 Cash. Der Depotwert war daher um rund CHF 25’000 überhöht.

Der Fix ersetzt Einzahlung und anfängliche Käufe durch cash-neutrale `entry`-Buchungen. Sie bilden den bestehenden Anfangsbestand für die Live-Performance ab, verändern aber weder `cashBalance` noch `investmentAmount`.

## Kontrollierte Datenkorrektur und Live-Test

Die historische Doppelzählung wurde ausschliesslich im Testportfolio unter engen Bedingungen korrigiert: `cashBalance` von CHF 49’999.93 auf die konfigurierte Reserve von CHF 25’000. Positionen, Einstand und vorhandene Transaktionen blieben unverändert.

Danach wurde «Test KI» mit CHF 250’000 als Startkapital über den normalen Dialog aktiviert. Der sichtbare Wert blieb bei CHF 250’015; es entstand kein Sprung um CHF 25’000. Die Datenbank bestätigte 28 `entry`-Buchungen und weiterhin CHF 25’000 Cash. Eine zusätzlich sichtbare Fehlkennzeichnung der `entry`-Buchungen als «Verkauf» wurde testgetrieben korrigiert und wird in der Restprüfung nochmals im Browser kontrolliert.

Die anschliessende Browserprüfung bestätigte den weiterhin unveränderten Wert von CHF 250’015, 28 korrekt als **«Anfangsbestand»** ausgewiesene Zugänge mit positivem Stückzahlvorzeichen und die vollständige Transaktionstabelle mit dem Typ **«Eingang»**. Nach der Aktivierung zunächst fehlende historische Punkte wurden ebenfalls behoben: Die Ansicht «Wertentwicklung seit Ersterfassung» zeigt wieder den gewichtsbasierten, hypothetischen Verlauf der gespeicherten Allokation vor dem heutigen Go-live. Die Rendite «seit Kauf» beginnt korrekt bei 0.0 %, weil der kontrollierte Start heute erfolgt ist.

Der kontrollierte Testlauf hat das Portfolio aktuell im Live-Zustand mit 28 cash-neutralen `entry`-Buchungen belassen. Eine Rückkehr in den ursprünglichen Demo-Zustand würde diese Testbuchungen wieder entfernen; sie wird daher erst nach ausdrücklicher Bestätigung vorgenommen.

## Bestätigte Rücksetzung und Endzustand

Nach ausdrücklicher Bestätigung wurde die Rücksetzung am 29. August 2026 über den normalen Deaktivierungsdialog ausgeführt. Die Anwendung meldete die Entfernung der Live-Tracking-Transaktionen bei unverändert erhaltenen Positionen. Die anschliessende Datenbankprüfung bestätigt den Endzustand: `isLive=0`, `investmentAmount=250000.00`, `cashBalance=25000.00`, `startCapital=250000` und `transaction_count=0`/`entry_count=0`. Damit ist «Test KI» wieder im gewünschten Demo-Zustand; die fehlerhafte doppelte Cash-Reserve und alle ausschliesslich für den kontrollierten Test erstellten Buchungen sind entfernt.

## Implementierungs- und Testnachweis

| Teil | Ergebnis |
|---|---|
| Aktivierungsledger | Bestehende Stückzahlen werden als cash-neutrale `entry`-Buchungen geführt; keine zweite Einzahlung und kein Cash-Abzug für bereits vorhandene Bestände |
| Cash-Korrektur | Die nachweislich doppelte Reserve des Testportfolios wurde einmalig und gezielt von rund CHF 50’000 auf CHF 25’000 zurückgeführt |
| Aktivitätsdarstellung | `entry` erscheint als «Anfangsbestand» mit positivem Vorzeichen statt als Verkauf |
| Transaktionstabelle | `entry` erscheint als «Eingang»; 28 Einträge im kontrollierten Live-Test visuell bestätigt |
| Historie | Der gewichtete hypothetische Verlauf vor Go-live bleibt für Live-Portfolios sichtbar; die tatsächliche Live-Rendite beginnt am Startdatum bei 0.0 % |
| Fokussierte Regression | 7 Testdateien, 31 Tests bestanden; TypeScript ohne Fehler |
| Vollständige Regression | 183 Testdateien bestanden, 5 übersprungen; 1’474 Tests bestanden, 11 bewusst übersprungen |
| Abschliessende Datenprüfung | Demo-Modus, CHF-25’000-Cash, CHF-250’000-Einstand und keine Testbuchungen bestätigt |

Die Korrektur verändert keine Titel, Positionsmengen, reale Käufe oder Verkäufe. Sie verhindert ausschliesslich, dass der Wechsel vom bestehenden Demo-Bestand ins Live-Tracking die bereits vorhandene Liquiditätsreserve nochmals als neues Kapital behandelt.
