/**
 * Emittenten-Identität für die Dedup-Logik im Vorschlags-Universum.
 *
 * Hintergrund: das Universum wurde bisher nur über den Basis-Ticker (Teil vor
 * dem Punkt) entdoppelt. Das fängt «NESN» vs. «NESN.SW» ab, aber NICHT den
 * häufigeren Fall zweier Notierungen desselben Unternehmens unter verschiedenen
 * Symbolen — etwa «BATS.L» (London) und «BTI» (US-ADR) für British American
 * Tobacco. Beide landeten im selben Vorschlag, was das Klumpenrisiko verdeckt:
 * zwei Positionen à 0.5 % sind faktisch eine Position à 1 %.
 *
 * Der Firmenname ist der einzige Identitätsanker, der für alle Titel gefüllt
 * ist (ISIN gibt es nur in der Watchlist-Tabelle). Normalisiert wird deshalb
 * über den Namen: Rechtsformzusätze und Interpunktion raus, Rest kleingeschrieben.
 */

/** Rechtsform- und Notierungszusätze, die dieselbe Firma unterschiedlich benennen. */
const LEGAL_SUFFIXES = [
  "plc", "p l c", "ag", "sa", "s a", "nv", "n v", "inc", "incorporated",
  "corp", "corporation", "co", "company", "ltd", "limited", "llc", "lp",
  "holding", "holdings", "group", "se", "spa", "s p a", "oyj", "ab", "asa",
  "adr", "ads", "class a", "class b", "cl a", "cl b", "the",
];

/**
 * Firmenname → stabiler Identitäts-Schlüssel.
 * «British American Tobacco p.l.c.» und «British American Tobacco» ergeben
 * beide `british american tobacco`.
 */
export function issuerKey(companyName: string | null | undefined): string {
  if (!companyName) return "";
  let s = String(companyName)
    .toLowerCase()
    .replace(/[.,&'`’-]/g, " ")   // Interpunktion → Leerzeichen (p.l.c. → p l c)
    .replace(/\s+/g, " ")
    .trim();

  // Zusätze wiederholt vom Ende abtragen («… Group Holdings plc»).
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of LEGAL_SUFFIXES) {
      if (s === suffix) continue;               // Name besteht NUR daraus → stehen lassen
      if (s.endsWith(` ${suffix}`)) {
        s = s.slice(0, -(suffix.length + 1)).trim();
        changed = true;
      }
    }
  }
  // Führendes «the» (nach obiger Schleife nur am Ende entfernt).
  if (s.startsWith("the ")) s = s.slice(4).trim();

  return s;
}
