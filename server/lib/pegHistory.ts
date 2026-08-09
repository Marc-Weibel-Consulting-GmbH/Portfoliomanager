/**
 * Rückwärtsgerichteter (Trailing-)PEG als Zeitreihe — punkt-in-zeit-sauber.
 *
 * WARUM ES DIESES MODUL BRAUCHT
 *
 * `punktInZeitKennzahlen` setzt `adjustedPeg` bewusst auf null: Der live
 * verwendete PEG beruht auf Analystenschätzungen, und was 2024 geschätzt
 * wurde, steht in keiner heutigen Datenquelle — forward ist historisch nicht
 * rekonstruierbar, ohne die Rückschau zu begehen, die das ganze Punkt-in-
 * Zeit-Projekt vermeiden soll.
 *
 * Aber: Ein TRAILING-PEG braucht keine Schätzung. KGV_t (Kurs von damals ÷
 * EPS von damals) und das Wachstum g_t (EPS-CAGR der zurückliegenden Jahre
 * bzw. TTM-Wachstum) sind zum Stichtag bekannt. `punktInZeitKennzahlen`
 * berechnet beide Bausteine bereits (`bewertung.kgv`, `bewertung.epsWachstum5j`,
 * `bewertung.epsWachstumTTM`) — dieses Modul setzt sie zur Zeitreihe zusammen.
 *
 * DREI REGELN, BEWUSST VON ANDERWARTIG ENTSCHIEDENEM ÜBERNOMMEN
 *
 *  - AUSBLENDEN STATT DIVIDIEREN (aus `qualityMetricsService`): Unter 2 % p.a.
 *    Wachstum ist der PEG keine Aussage, sondern eine Division durch fast
 *    null — ein Zehntelprozent Messfehler im Nenner halbiert oder verdoppelt
 *    das Ergebnis. Die richtige Antwort ist dann nicht «PEG 47», sondern
 *    «PEG sagt hier nichts»; die Aussage «kaum Wachstum» steht im
 *    Wachstumsfeld daneben.
 *  - KEIN ERGEBNIS UNTER 70 % ABDECKUNG (aus `klassenBenchmark.berechneComposite`):
 *    Eine Auswertung über eine Zeitreihe, in der zwei Drittel der Stichtage
 *    keinen gültigen Wert haben, wäre keine Messung, sondern eine
 *    Hochrechnung. Unter der Schwelle gibt es kein zusammengefasstes Ergebnis
 *    — die Rohzeilen bleiben zur Diagnose sichtbar.
 *  - 5-JAHRES-CAGR VOR TTM (wie `qualityMetricsService.forwardPeg`): Das
 *    glattere Langzeit-Wachstum zuerst, TTM nur als Fallback.
 *
 * FOLGE, DIE MAN KENNEN MUSS: Diese Reihe ist NICHT identisch mit dem live
 * angezeigten PEG (EODHD `PEGRatio`, eigene Definition, Tageswert). Wer
 * historische und live gerechnete PEG-Werte nebeneinanderstellt, vergleicht
 * zwei Definitionen. Die rückwärtsgerichtete Variante ist die einzige, die
 * für Backtests und Regime-Auswertungen sauber ist — genau dafür ist sie da.
 */

/**
 * Unteres Wachstum im Nenner, in % p.a. — derselbe Wert wie
 * `MIN_WACHSTUM_FUER_PEG` in `qualityMetricsService`. Bewusst nachgebildet
 * statt importiert: Dort ist die Konstante nicht exportiert, und ein Import
 * des ganzen Service (inkl. Cache, ENV, Netzabruf) für eine Zahl wäre die
 * schlechtere Kopplung. Ändert sich der Schwellenwert dort, muss er hier
 * mitgeführt werden — der Test `haelt denselben Schwellenwert wie
 * qualityMetricsService` schlägt sonst an.
 */
export const MIN_WACHSTUM_FUER_PEG = 2; // % p.a.

/** Felder, wie sie `punktInZeitKennzahlen.kennzahlenPerStichtag` unter `bewertung` liefert. */
export interface PegEingabe {
  /** KGV zum Stichtag: Kurs von damals ÷ EPS von damals. null wenn EPS ≤ 0 oder Kurs fehlt. */
  kgv: number | null;
  /** EPS-CAGR über 5 Jahre, in % p.a. — bevorzugte Wachstumsmasszahl. */
  epsWachstum5j: number | null;
  /** EPS-Wachstum Jahr gegen Vorjahr, in % — Fallback, wenn kein 5j-CAGR reicht. */
  epsWachstumTTM: number | null;
}

export type PegAusblendgrund =
  | "kgv_fehlt"             // kein Kurs oder EPS ≤ 0 zum Stichtag
  | "kgv_nicht_positiv"     // übergebenes KGV ≤ 0 (Vorzeichen-Artefakt)
  | "wachstum_fehlt"        // weder 5j-CAGR noch TTM-Wachstum belegt
  | "wachstum_zu_gering";   // unter MIN_WACHSTUM_FUER_PEG — Division durch fast null

export interface PegErgebnis {
  /** Trailing-PEG = kgv ÷ wachstum, oder null mit begründetem Ausblendgrund. */
  peg: number | null;
  /** Das tatsächlich verwendete Wachstum in % p.a. (null wenn nicht belegt). */
  wachstum: number | null;
  /** Welche Wachstumsreihe genommen wurde — für Transparenz neben dem Wert. */
  wachstumsQuelle: "5j" | "ttm" | null;
  /** Warum kein Wert ausgegeben wird; null, wenn `peg` belegt ist. */
  grund: PegAusblendgrund | null;
}

/**
 * Trailing-PEG zu einem Stichtag (rein, getestet).
 *
 * Kein Clamping, keine erfundenen Nenner: Jede Konstellation, in der die
 * Division keine Aussage trägt, wird ausgeblendet — mit Grund, damit die
 * Oberfläche «kein Wert» von «kein Wert, weil…» unterscheiden kann.
 */
export function trailingPeg(e: PegEingabe): PegErgebnis {
  const leer = (grund: PegAusblendgrund, wachstum: number | null, quelle: PegErgebnis["wachstumsQuelle"]): PegErgebnis =>
    ({ peg: null, wachstum, wachstumsQuelle: quelle, grund });

  if (e.kgv === null || !Number.isFinite(e.kgv)) return leer("kgv_fehlt", null, null);
  if (e.kgv <= 0) return leer("kgv_nicht_positiv", null, null);

  const wachstum = e.epsWachstum5j ?? e.epsWachstumTTM;
  const quelle: PegErgebnis["wachstumsQuelle"] = e.epsWachstum5j !== null ? "5j" : e.epsWachstumTTM !== null ? "ttm" : null;

  if (wachstum === null || !Number.isFinite(wachstum)) return leer("wachstum_fehlt", null, null);
  if (wachstum < MIN_WACHSTUM_FUER_PEG) return leer("wachstum_zu_gering", wachstum, quelle);

  return { peg: e.kgv / wachstum, wachstum, wachstumsQuelle: quelle, grund: null };
}

export interface PegStichtag extends PegEingabe {
  /** Stichtag, ISO-Format — dient nur der Durchreichung in die Zeile. */
  datum: string;
}

export interface PegZeile extends PegErgebnis {
  datum: string;
}

export interface PegReihe {
  /** Alle Stichtage mit Ergebnis oder Ausblendgrund — auch die ungültigen. */
  zeilen: PegZeile[];
  /** Anzahl Stichtage mit gültigem PEG. */
  gueltig: number;
  /** Anteil gültiger Stichtage, 0–100. */
  abdeckungPct: number;
  /** true, wenn die Abdeckung die Mindestschwelle erreicht (Default 70 %). */
  auswertbar: boolean;
  /**
   * Mittelwert der gültigen PEG-Werte — nur wenn `auswertbar`, sonst null.
   * Lieber keine Zahl als eine aus dünner Reihe geschätzte.
   */
  mittelPeg: number | null;
}

/**
 * PEG-Zeitreihe über viele Stichtage mit Abdeckungsregel (rein, getestet).
 *
 * Eingabe sind die `bewertung`-Blöcke von `punktInZeitKennzahlen` plus Datum —
 * keine neue Datenbeschaffung, kein Netzabruf.
 */
export function pegZeitreihe(
  stichtage: PegStichtag[],
  minAbdeckungPct = 70,
): PegReihe {
  const zeilen: PegZeile[] = stichtage.map((s) => ({ datum: s.datum, ...trailingPeg(s) }));
  const gueltig = zeilen.filter((z) => z.peg !== null);

  const abdeckungPct = zeilen.length > 0
    ? parseFloat(((gueltig.length / zeilen.length) * 100).toFixed(2))
    : 0;
  const auswertbar = zeilen.length > 0 && abdeckungPct >= minAbdeckungPct;

  const mittelPeg = auswertbar
    ? gueltig.reduce((s, z) => s + z.peg!, 0) / gueltig.length
    : null;

  return { zeilen, gueltig: gueltig.length, abdeckungPct, auswertbar, mittelPeg };
}
