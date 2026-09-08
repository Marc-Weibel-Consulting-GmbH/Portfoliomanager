# Vollständige Aktien-Neuoptimierung und Swissquote-Split — Arbeitsnachweis

**Stand:** 8. September 2026  
**Referenzportfolio:** `Mami` / ID `4020001`  
**Charakter:** Technische Funktions- und Datenvalidierung; keine Anlageentscheidung, keine Order, keine Zahlung und keine Portfolioänderung.

## Live-Nachweis: geschützte Neuoptimierung

Die vollständige Aktien-Neuoptimierung wurde im Optimierungstab als **reine Vorschau** gestartet. Der Lauf nutzt nur ein nach Preisabdeckung und gemeinsamer Handelsdatenbasis gefiltertes Aktienuniversum. Das bisherige Fehlerbild „zu wenig gemeinsame Handelstage“ wurde nach dem Datenüberlappungs-Gate nicht erneut ausgelöst.

Die reale, nicht persistierte Vorschau mit 20 Kandidaten bestätigte die Schutzgrenzen: Aktienbudget 76,190556 %, feste Sleeves 14,0 %, Cash 9,809444 % und zusammen 100,0 %. Für die vom Nutzer gesetzten Testziele ergab die Serverantwort eine historische Aktienkomponenten-Dividendenrendite von 2,1 % gegenüber 3,0 % Ziel (nicht erreicht), Sharpe 1,926 gegenüber 0,50, historischen Max-Drawdown 18,94 % gegenüber 25,0 % sowie CHF-Aktienanteil 45,34 % gegenüber 40,0 % (jeweils erreicht). Es wurde keine Vorschau übernommen.

Bei der visuellen Prüfung wurde eine ausschliessliche Darstellungsabweichung entdeckt: Der Dezimalwert 0,1636 der Serverantwort wurde als 0,2 % statt 16,4 % Volatilität gezeigt. Ein zentraler, testbarer Prozentformatierer korrigiert diese Anzeige; die Daten- und Optimierungsberechnung blieben unverändert.

Nach der abschliessenden UI-Prüfung werden alle gesetzten Ziele direkt als Soft-Constraint-Vergleich angezeigt. Im geprüften Lauf waren Dividendenrendite 2,1 % gegenüber mindestens 3,0 % **nicht erreicht**, Sharpe 1,93 gegenüber mindestens 0,50, historischer Max-Drawdown 18,9 % gegenüber maximal 25,0 % und CHF-Aktienanteil 45,3 % gegenüber mindestens 40,0 % dagegen **erreicht**. Die Darstellung benennt ausserdem die gemeinsame Preisbasis von 487 Handelstagen seit 2023-08-01. Sie bleibt klar auf die Aktienkomponente begrenzt, nicht auf das Gesamtportfolio und nicht als Prognose.

## Swissquote-YTD-Korrektur

Die persistierte Swissquote-Zeile `SQN.SW` hatte 2026-01 einen Kurs von rund CHF 497 und danach nach dem 1:10-Split Kurse um CHF 41, ohne dass die späten Tageszeilen über `adjustedClose` verfügten. Der ursprüngliche Fallback verwendete deshalb CHF 477.59 als Jahresstart und zeigte fälschlich −91,32 %. Der korrigierte YTD-Helfer akzeptiert eine adjusted-close-Basis nur dann, wenn der **letzte** verfügbare Bewertungstag ebenfalls bereinigt vorliegt. Andernfalls erkennt er nur grosse, nahezu ganzzahlige Faktoren zwischen 1:5 und 1:20 in Rohkursreihen und korrigiert den Jahresstart rückwirkend. Normale Tagesbewegungen und 1:2-Crashs bleiben ausdrücklich ausgeschlossen.

Der bestehende tägliche, idempotente YTD-Abgleich wurde nach dem Fix einmal ausgeführt. Er aktualisierte 281 Reihen und übersprang 29 Reihen mit unzureichender Datenbasis; es wurden weder Portfolios noch Positionen, Cashbestände oder Transaktionen geändert. Für `SQN.SW` ist der Startpreis nun CHF 49.74 und die gespeicherte YTD-Performance −16,65 %. Die zuvor sichtbare −91,32-%-Anzeige ist damit beseitigt. Die vollständige Regression schloss mit 200 bestanden Testdateien und 1'528 bestandenen Tests ab; 5 Testdateien und 11 Tests sind bewusst übersprungen.

| Kennzahl der sichtbaren Optimiererausgabe | Ergebnis |
|---|---:|
| Methode | Max. Sharpe |
| Historisch geschätzte Rendite p.a. | 16,7 % |
| Historisch geschätzte Volatilität p.a. | 7,5 % |
| Historischer Sharpe | 2,03 |
| Historischer täglicher CVaR 95 % | −0,78 % |
| Historisches Fenster | 3 Jahre, in CHF |

Die Werte betreffen die historische Optimiererausgabe und sind **keine Prognose**. Die vollständige Vorschau bewahrt Cash und die nicht-aktienbezogenen Sleeves (Obligationen, Gold, Rohstoffe, Immobilien, Krypto) und erzeugt weder Positionsänderungen noch Buchungen oder Orders. Die zuvor gesetzten Beispielziele (3,0 % Dividendenrendite, Sharpe 0,50, max. Drawdown 25 %, CHF-Aktienanteil 40 %) waren nur lokale Eingaben zur UI-Prüfung und wurden nicht übernommen.

## Datenursache des ursprünglichen Fehlers

Die frühere Vorschau kombinierte Kandidaten mit ausreichender Einzelhistorie, aber ohne ausreichende **gemeinsame** Preisdatumsbasis. Zusätzlich bestehen bei älteren US-Preisreihen sowohl Legacy-Schlüssel ohne `.US` als auch kanonische Schlüssel. Der neue Lesepfad berücksichtigt beide Varianten lesend und bevorzugt die vollständigere Reihe. Das Universums-Gate schliesst ferner Kandidaten aus, deren validierte Preisdatumsbasis mit der bereits gewählten Menge weniger als 31 gemeinsame Preiswerte (mindestens 30 Renditen) aufweist.

## Swissquote-Corporate-Action-Befund

Der im Portfolio sichtbare YTD-Ausreisser von rund −90 % beruht auf dem bestätigten **1:10-Aktiensplit** von Swissquote Ende Mai 2026: Eine unbereinigte historische Basis von CHF 477,59 wurde gegen einen nach-Split-Kurs um CHF 41 verglichen. Der gemeinsame YTD-Pfad verwendet nun `adjustedClose` und fällt nur bei dessen Fehlen auf `close` zurück, sodass Start- und Endwert derselben Bereinigungsbasis folgen. Der tägliche Preisupdater schreibt keinen abweichenden YTD-Wert mehr; der tägliche YTD-Abgleich berechnet die Kennzahl idempotent aus den gespeicherten Tagesreihen.

> **Nicht-Handelsgrenze:** Dieser Arbeitsstand hat weder das Portfolio `Mami` verändert noch eine Umschichtung, einen Geldtransfer, eine Einzahlung, eine Order oder eine Live-Aktivierung ausgelöst.
