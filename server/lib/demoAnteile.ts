/**
 * Stückzahlen einer Position, wenn keine gespeichert sind.
 *
 * Drei Stellen bewerteten Portfolios und beantworteten diese Frage
 * VERSCHIEDEN, wenn `shares` in `portfolioData` fehlt:
 *
 *  - Depotseite (`getWithCurrency`) und `portfolios.list`:
 *    Allokation ÷ HEUTIGER Preis. Damit ist der Positionswert per Definition
 *    gleich der Allokation — das Portfolio klebt am Einstand, «Seit Kauf»
 *    misst nur noch die Positionen mit gespeicherten Stückzahlen.
 *  - Dashboard-Karte (`getPortfolioCompact`):
 *    Allokation ÷ KAUFPREIS. Der Wert bewegt sich mit dem Markt.
 *
 * Ergebnis: Dieselbe Depotsumme hiess auf der Karte 158'520 und auf der
 * Depotseite 149'262. Ein Kommentar im Code behauptete, diese Diskrepanz sei
 * behoben — angeglichen war aber nur der Vorrang gespeicherter Stückzahlen,
 * nicht die Ersatzformel dahinter.
 *
 * Fachlich richtig ist der Kaufpreis: Ein Demo mit Einstand 150'000 vom
 * 5. August hält seither FESTE Anteile. Die Teilung durch den heutigen Preis
 * würde die Anteile täglich neu setzen und jede Marktbewegung wegdefinieren.
 *
 * Diese Funktion ist die eine Antwort für alle Aufrufer. Sie ist rein und
 * kennt keine Datenbank — die Aufrufer liefern die Preise.
 */

export interface AnteilsEingabe {
  /** `parseFloat(stock.shares)` — 0 oder NaN heisst «nicht gespeichert». */
  gespeicherteStueck: number;
  /** Einstand des Portfolios in CHF. */
  investmentAmount: number;
  /** Gewicht der Position, 0–100. */
  gewichtPct: number;
  /**
   * Kaufpreis je Stück in CHF, sofern bekannt (`avgBuyPriceCHF`, sonst
   * `avgBuyPrice` — seit R-CHF-PRICE standardisiert als CHF gespeichert).
   */
  kaufpreisCHF: number | null;
  /** Heutiger Preis je Stück in CHF. */
  heutigerPreisCHF: number;
}

export interface AnteilsErgebnis {
  stueck: number;
  /**
   * Woher die Zahl stammt — für Diagnose und Datenqualitäts-Anzeige.
   * `heutiger_preis` heisst: kein Kaufpreis bekannt, der Positionswert
   * entspricht der Allokation und trägt KEINE Marktbewegung.
   */
  herkunft: "gespeichert" | "kaufpreis" | "heutiger_preis" | "keine";
}

export function anteileFuerPosition(e: AnteilsEingabe): AnteilsErgebnis {
  const gespeichert = Number.isFinite(e.gespeicherteStueck) ? e.gespeicherteStueck : 0;
  if (gespeichert > 0) return { stueck: gespeichert, herkunft: "gespeichert" };

  const allokation = (e.investmentAmount || 0) * ((e.gewichtPct || 0) / 100);
  if (allokation <= 0) return { stueck: 0, herkunft: "keine" };

  if (e.kaufpreisCHF !== null && Number.isFinite(e.kaufpreisCHF) && e.kaufpreisCHF > 0) {
    return { stueck: allokation / e.kaufpreisCHF, herkunft: "kaufpreis" };
  }
  if (Number.isFinite(e.heutigerPreisCHF) && e.heutigerPreisCHF > 0) {
    return { stueck: allokation / e.heutigerPreisCHF, herkunft: "heutiger_preis" };
  }
  return { stueck: 0, herkunft: "keine" };
}
