
## Wertbasierter Positionsregler im Demodepot (2026-10-22)
- [x] Dialog «Position bearbeiten» zeigt für nicht aktivierte, ledgerfreie Demoportfolios zusätzlich die Positionsgrösse in CHF, aktuelle CHF-Kursbasis, verfügbare Cash-Reserve und eine Stückvorschau in Echtzeit.
- [x] Der Regler ist strikt auf `aktueller Positionswert + verfügbare Cash-Reserve` begrenzt. CHF-Zielwert und Stückzahl verwenden die servergleiche Genauigkeit von sechs Dezimalstellen; manuelle Stückzahlanpassungen halten die CHF-Vorschau synchron.
- [x] Erst «Speichern» führt die bestehende serverseitige Cash-Gegenbuchung aus. Reduktionen erhöhen Cash, Aufstockungen belasten Cash; keine Orders, Zahlungen, Ledgerbuchungen oder Live-Portfolioänderungen. Bei Liveportfolios sowie bei Ledgerbuchungen bleibt der Regler bewusst verborgen.
- [x] Reine Stückzahländerungen erkennen nun auch eine unveränderte ISIN und das reversible Portfolio-Startdatum korrekt, sodass der geschützte Cash-Pfad nicht versehentlich umgangen wird.
- [x] Neue Regressionen für CHF→Stück, finanzierbare Obergrenzen und Metadatenvergleich. Vollsuite: 264 Testdateien/1'780 Tests bestanden, 5/11 übersprungen; TypeScript und Diffcheck fehlerfrei. Dev-Browserzugriff bis zum Login-Gate geprüft, keine Konsolenfehler; die echte Dialoginteraktion braucht weiterhin eine authentisierte Dev-Sitzung.
