/**
 * Gewinnstabilität aus der Jahres-EPS-Reihe — Befund 1 der Scoring-Prüfung.
 *
 * Misst die Streuung der jährlichen EPS-Wachstumsraten (bis 5 pp sehr
 * gleichmässig = 100, ab 50 pp sehr sprunghaft = 0, linear dazwischen).
 * Gegenüber der früheren Fassung zwei Robustheits-Regeln:
 *
 *  1. NUR BENACHBARTE GESCHÄFTSJAHRE werden gepaart. Vorher wurden
 *     Null-Platzhalterjahre (EODHD liefert 0 für nicht berichtete Jahre)
 *     herausgefiltert und die verbleibenden Werte als aufeinanderfolgend
 *     behandelt — eine «Jahresrate» über eine mehrjährige Lücke blähte die
 *     Streuung künstlich auf. Gleiches Muster wie bei den Kursreihen
 *     (keine Rendite über eine Datenlücke).
 *  2. RATEN WERDEN BEI ±100 % GEKAPPT (winsorisiert). Ein einzelnes
 *     Artefaktjahr — Split-Inkonsistenz, Basiseffekt nahe null — trieb die
 *     Standardabweichung sonst allein über die 50-pp-Schwelle und nullte
 *     den Faktor. Die Information «extremes Jahr» bleibt erhalten, ihr
 *     Hebel wird begrenzt.
 *
 * Null-Semantik unverändert: zu wenig zusammenhängende Jahre → null
 * («nicht berechenbar»), niemals eine erfundene 0. Der `hinweis` nennt die
 * verwendeten Raten und die Streuung — damit ist die Zahl nachprüfbar.
 *
 * Eine Implementierung für Live-Pfad (`qualityMetricsService`) und
 * Punkt-in-Zeit-Rekonstruktion (`punktInZeitKennzahlen`) — die frühere
 * bewusste Duplikation entfällt, weil die Rechnung jetzt rein und ohne
 * Service-Ballast importierbar ist.
 */

/** Bis zu dieser Streuung (Prozentpunkte) gilt die Reihe als sehr gleichmässig. */
export const STREUUNG_SEHR_GLEICHMAESSIG_PP = 5;
/** Ab dieser Streuung (Prozentpunkte) gilt die Reihe als sehr sprunghaft. */
export const STREUUNG_SEHR_SPRUNGHAFT_PP = 50;
/** Kappung der einzelnen Jahresrate (±100 %) — Anteil, nicht Prozent. */
export const RATEN_KAPPUNG = 1.0;
/** Mindestzahl zusammenhängender Jahresraten für eine Streuungsaussage. */
export const MIN_RATEN = 4;

export interface StabilitaetsErgebnis {
  /** 0–100, oder null wenn nicht berechenbar. */
  score: number | null;
  /** Streuung der gekappten Raten in Prozentpunkten; null ohne Aussage. */
  streuungPp: number | null;
  /** Mittel der gekappten Raten (Anteil); null ohne Aussage. */
  mittel: number | null;
  /** Verwendete, gekappte Jahresraten (Anteile, z. B. 0.21 = +21 %). */
  raten: number[];
  /** Belegtext für die Anzeige — macht die Zahl nachprüfbar. */
  hinweis: string | null;
}

export function stabilitaetAusJahresEps(
  reihe: Array<{ jahr: number; eps: number | null }>,
): StabilitaetsErgebnis {
  const leer: StabilitaetsErgebnis = { score: null, streuungPp: null, mittel: null, raten: [], hinweis: null };

  // Gültige Punkte: endlich und nicht 0 (EODHD-Platzhalter). Negative EPS
  // bleiben drin — ein Verlustjahr ist Information, kein Datenfehler.
  const punkte = reihe
    .filter((p): p is { jahr: number; eps: number } =>
      p.eps !== null && Number.isFinite(p.eps) && p.eps !== 0 && Number.isFinite(p.jahr))
    .sort((a, b) => a.jahr - b.jahr);

  const raten: number[] = [];
  for (let i = 1; i < punkte.length; i++) {
    // Nur direkt benachbarte Geschäftsjahre — keine Rate über eine Lücke.
    if (punkte[i].jahr - punkte[i - 1].jahr !== 1) continue;
    const vorjahr = punkte[i - 1].eps;
    if (Math.abs(vorjahr) <= 0.001) continue;
    const roh = (punkte[i].eps - vorjahr) / Math.abs(vorjahr);
    raten.push(Math.max(-RATEN_KAPPUNG, Math.min(RATEN_KAPPUNG, roh)));
  }

  if (raten.length < MIN_RATEN) {
    // Auch das «Warum nicht» gehört in die Anzeige — sonst steht dort nur ein
    // Strich, und niemand sieht, ob Daten fehlen oder die Rechnung klemmt.
    return {
      ...leer,
      raten,
      hinweis: `zu wenig zusammenhängende Jahres-EPS (${raten.length} Jahresraten, benötigt ${MIN_RATEN})`,
    };
  }

  const mittel = raten.reduce((a, b) => a + b, 0) / raten.length;
  const varianz = raten.reduce((s, v) => s + (v - mittel) ** 2, 0) / (raten.length - 1);
  const streuungPp = Math.sqrt(varianz) * 100;

  const OBEN = STREUUNG_SEHR_GLEICHMAESSIG_PP;
  const UNTEN = STREUUNG_SEHR_SPRUNGHAFT_PP;
  const anteil = (UNTEN - Math.max(OBEN, Math.min(UNTEN, streuungPp))) / (UNTEN - OBEN);
  const score = Math.round(anteil * 100);

  const ratenText = raten.map((r) => `${r >= 0 ? "+" : ""}${Math.round(r * 100)}`).join(" / ");
  return {
    score,
    streuungPp,
    mittel,
    raten,
    hinweis: `Streuung ${streuungPp.toFixed(0)} pp aus ${raten.length} Jahresraten (${ratenText} %)`,
  };
}
