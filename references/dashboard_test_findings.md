# Dashboard Live-Test Findings (28.06.2026)

## Was funktioniert:
- Header: "SONNTAG, 28. JUNI 2026" + "Guten Tag, Marc" ✓
- Quick Actions: Alle 7 Buttons sichtbar (Portfolio erstellen, Meine Portfolios, Aktienempfehlungen, Aktiensuche, Portfolio optimieren, Copilot fragen, Preisalarm setzen) ✓
- KI-Analyse: Tagesbericht/Wochenbericht Toggle ✓
- KI-Analyse: Badges (KI-TAGESANALYSE, Defensive Rotation) ✓
- Szenarien: NEBENEINANDER (Bulle 30%, Basis 50%, Bär 20%) ✓
- Jetzt analysieren Button ✓

## Aktualisiert nach Scroll:
- TickerBar: SMI 14'173 -0.42%, S&P 500 7'354 -0.05%, MSCI 197 -0.97%, Gold 374 +1.13% ✓
- PortfolioCompact: 4 Portfolios sichtbar, Gesamtwert CHF 1'267'291 ✓
- MarktPuls: 10 Sektoren (alle +0.0% weil Wochenende), Top-Gewinner/Verlierer ✓
- Quick Actions: Alle 7 Buttons ✓
- Szenarien: NEBENEINANDER (Bulle 30%, Basis 50%, Bär 20%) ✓

## NOCH ZU BEHEBEN:
1. KI-Analyse Sektoren: Zeigt ALLE 11 Sektoren statt nur die wichtigsten 5-7
2. Sektoren: Nur 1 Satz Beschreibung statt 4-5 Sätze gemäss Mockup
3. Sektoren: Keine 3 Aktien mit Performance darunter
4. Sektoren: Kein KAUFEN/ABWARTEN Badge rechts
5. Anstehende Termine: "Keine Termine gefunden" - EODHD Economic Calendar API liefert nichts
6. Tagesperformance: -8.9% / CHF 123'900 - scheint zu hoch, muss geprüft werden
7. Portfolios zeigen "0 Pos." obwohl sie Positionen haben

## Ursachen:
- Punkte 1-4: Die KI-Analyse wurde VOR dem Prompt-Update generiert. Muss neu getriggert werden.
- Punkt 5: EODHD Economic Calendar API gibt möglicherweise am Wochenende nichts zurück
- Punkt 6: Tagesperformance-Berechnung basiert auf Freitag vs. Donnerstag (Wochenende-Fix)
- Punkt 7: getPortfolioCompact gibt numberOfPositions nicht korrekt zurück
