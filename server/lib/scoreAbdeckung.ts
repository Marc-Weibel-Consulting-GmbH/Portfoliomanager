/**
 * Mindestabdeckung für gewichtete Scores — eine Stelle, eine Schwelle.
 *
 * Mehrere Scores im System mitteln gewichtete Teilscores und normalisieren auf
 * das tatsächlich belegte Gewicht. Das ist für sich richtig: Fehlt eine
 * Kennzahl, sollen die übrigen entsprechend stärker zählen.
 *
 * Ohne Untergrenze führt es aber dazu, dass eine einzelne Kennzahl den ganzen
 * Score bestimmt — und das Ergebnis sieht aus wie eine belegte Beurteilung.
 * Gemessen am Universum (289 Titel, 2026-08-03):
 *
 *  - GLD.US (Gold-ETF): Score 87.5 «ausgezeichnet», allein aus Beta 0.41 —
 *    20 % der Gewichtung.
 *  - VBTC.SW (Bitcoin-ETN): Score 0 «schwach», aus gar keiner Kennzahl.
 *  - 63 von 289 Titeln (21.8 %) waren zu weniger als 70 % belegt.
 *
 * Dieselbe Konsequenz wie beim Regime-Verlauf (PR #235): Unterhalb der Schwelle
 * gibt es keinen Score, sondern «nicht beurteilbar». Eine Lücke ist ehrlicher
 * als ein Wert, der nur die Datenlage abbildet.
 *
 * 0.60 gewählt, weil 88.2 % der Titel diese Marke erreichen. Betroffen sind
 * überwiegend ETF, Anleihen- und Rohstoffvehikel, für die KGV und
 * Dividendenrendite gar nicht erhoben werden — bei denen also nicht die Messung
 * fehlschlug, sondern die Kennzahl schlicht nicht existiert.
 */
export const MIN_ABDECKUNG_SCORE = 0.60;
