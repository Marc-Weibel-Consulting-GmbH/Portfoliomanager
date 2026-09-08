# Watchlisttitel im Positionsdialog — Diagnose

**Datum:** 8. September 2026  
**Prüfkontext:** Entwicklungsansicht, Portfolio `Mami` (`#4020001`), ausschliesslich lesende Dialoginteraktion

## Befund

Die Suche im Dialog **«Neue Position hinzufügen»** verwendet den vollständigen lokalen Stammaktienbestand (`stocks.getAll` → `getAllStocks`). Swiss Life ist darin vorhanden: `SLHN.SW — Swiss Life Holding`. Der Titel war zugleich bereits mit 3,0 % als Position im aktuell geöffneten Portfolio `Mami` enthalten.

Die aktuelle Filterlogik blendet jede bereits enthaltene Position aus, damit keine doppelte Tickerzeile und damit keine widersprüchliche Cash- oder Gewichtsbuchung entstehen kann. Bei Eingabe von `Swiss Life` blieb die Ergebnisliste deshalb leer. Die fachliche Sperre ist korrekt, die fehlende Erklärung im Dialog ist jedoch irreführend: Sie wirkt wie ein nicht gefundener Watchlisttitel.

## Daten- und Sicherheitsgrenze

Bei der Reproduktion wurden weder ein Suchresultat ausgewählt noch Gewichte geändert, gespeichert, Cash bewegt, eine Buchung angelegt oder eine Handelsfunktion verwendet.

## Korrektur und Live-Nachweis

Die Suchlogik trennt Treffer nun in **hinzufügbar** und **bereits im Portfolio**. Der zweite Fall wird sichtbar, aber nicht auswählbar dargestellt. Damit bleibt der Schutz vor einer doppelten Tickerposition erhalten, und der Nutzer erhält den konkreten nächsten Schritt: das Gewicht der vorhandenen Position anzupassen.

Nach dem Hot-Reload wurde im geöffneten Dialog nochmals `Swiss Life` eingegeben. Sichtbar erschien: `SLHN.SW · Swiss Life Holding ist bereits im Portfolio. Passen Sie unten das Gewicht der bestehenden Position an.` Der Dialog wurde nicht gespeichert; es entstanden keine Position, Cashbewegung, Buchung oder Handelsaktion.
