# Positionsalternativen: Alphabet-Aktienklassen und Sekundärlistings

**Datum:** 24. September 2026  
**Umfang:** Alternativenvorschau für bestehende Aktienpositionen  
**Änderungsart:** Korrektur des Emittenten-Deduplizierungsfilters; keine Portfolio- oder Handelsmutation

## Befund

Die Vorschau für die bestehende Position **GOOGL / Alphabet Inc** zeigte zuvor die Klasse **GOOG / Alphabet C (Google)** sowie die italienische Sekundärlisting-Variante **1GOOGL.MI**. Beide Instrumente repräsentieren keine unabhängigen Unternehmen und dürfen daher nicht als alternative Aktie erscheinen. Alphabet selbst beschreibt die separat gehandelten Klassen A und C als GOOGL beziehungsweise GOOG.[1]

Die Ursache lag an zwei unterschiedlichen Normalisierungen: Die finale Auswahl verglich Emittentenbezeichnungen nur als exakte Zeichenfolge, während der globale Screener eine davon abweichende Firmenname-Normalisierung verwendete. Unterschiede wie „Alphabet C (Google)“ und „N Akt Alphabet Inc USD 0.001“ wurden dadurch nicht zuverlässig als derselbe Emittent wie „Alphabet Inc“ erkannt.

## Korrektur

Die Emittentenidentität wird nun in beiden Stufen über eine gemeinsame, konservative Logik abgeleitet. Sie erkennt verifizierte Aktienklassen und Sekundärlistings von Alphabet als **einen Emittenten**. Zusätzlich vergleicht der Filter ganze aussagekräftige Emittentenphrasen, statt lediglich Ticker oder beliebige Teilwörter zu vergleichen. Dadurch bleiben echte Unternehmen getrennt, während alternative Aktienklassen, ADRs und andere Handelslinien des bereits gehaltenen Emittenten ausgeschlossen werden.

Die Prüfung greift sowohl am Screener-Rand — bevor globale Kandidaten mit Datenabrufen angereichert werden — als auch bei der finalen Zusammenstellung der Liste. Damit bleibt eine zweite Schutzschicht aktiv, falls eine Quelle ihre Handelslinie unterschiedlich beschreibt.

## Nachweis

Ein neuer Regressionstest reproduziert den Fehler mit **GOOGL**, **GOOG** und **1GOOGL.MI**. Der Test verifiziert, dass nur ein unabhängiger Kandidat wie META verbleibt. Ein zweiter Test prüft, dass eine Alphabet-Klasse bereits beim globalen Screenerfilter verworfen wird.

Eine schreibgeschützte Vorschau des tatsächlichen Portfolios 4020001 für die GOOGL-Position lieferte danach ausschließlich **META** und **RCRRF**. Der Zähler gleichartiger Emittenten betrug **0**. Es wurden keine Positionen, Cashreserven, Transaktionen, Watchlists, Preise oder Handelsaufträge verändert.

## Referenzen

[1]: https://abc.xyz/ "Alphabet Investor Relations"
