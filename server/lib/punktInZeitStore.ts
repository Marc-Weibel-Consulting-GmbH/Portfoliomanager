/**
 * Ablage der rekonstruierten Scores je Titel und Stichtag.
 *
 * `stock_scores` hält einen Wert je Titel und überschreibt ihn — für einen
 * Backtest braucht es die Reihe. Eigene Tabelle statt neuer Spalten, und
 * selbstheilend angelegt: Der Deploy führt `drizzle-kit migrate` nicht aus.
 *
 * Die Zeilen sind ausdrücklich als REKONSTRUKTION gekennzeichnet, nicht als
 * Messung: `meldefristTage` hält fest, mit welcher Annahme über die
 * Veröffentlichung gerechnet wurde, `belegt`, auf wie vielen Kennzahlen der
 * Wert beruht. Ohne diese beiden Angaben liesse sich später nicht mehr sagen,
 * ob eine Zahl belastbar war oder aus zwei Kennzahlen hochgerechnet.
 */

/**
 * Fassung der Rechnung, die eine Zeile erzeugt hat.
 *
 * 1 — erste Rekonstruktion. Der Bewertungs-Score steht dort für die meisten
 *     Titel auf `null`: Er braucht 60 % Abdeckung, das bereinigte PEG trägt
 *     0.45 davon und ist rückwirkend nicht zu haben. FCF-Rendite und Dividende
 *     ergeben 0.55 — knapp zu wenig. Nur Finanzwerte kamen über ihren eigenen
 *     Zweig durch. Aus 212 Titeln je Stichtag wurden so 20 bis 40.
 * 2 — Bewertung als `scoreGemessen` (dieselbe Rechnung ohne die Schätzfaktoren,
 *     auf die übrigen normiert) und die Roh-Kennzahlen daneben.
 * 3 — KGV als eigener Bewertungs-Faktor für Nicht-Finanzwerte (Gewicht 0.15,
 *     PEG 0.45 → 0.35, FCF 0.35 → 0.30): Das PEG bestrafte billige
 *     Wenig-Wächser, ohne dass die Billigkeit selbst je Punkte bekam — der
 *     KGV-Deckel wirkte nur nach oben.
 * 4 — Gewinnstabilität robust (`gewinnStabilitaet`): nur benachbarte
 *     Geschäftsjahre gepaart, Raten bei ±100 % gekappt — Lückenraten und
 *     Artefaktjahre nullten den Faktor (Befund 1 der Scoring-Prüfung).
 * 5 — Gewinnstabilität: Raten-Kappung ±100 % → ±50 %. Beleg Lauf #150001:
 *     167 von 296 berechneten Werten exakt 0 — der Faktor war praktisch
 *     binär. Ein einzelnes Extremjahr zählt jetzt als 50-%-Ereignis;
 *     nur wiederholte grosse Sprünge treiben den Score auf 0.
 * 6 — Gewinnwachstum als siebter Niveau-Faktor (robustes Raten-Mittel,
 *     Anker 0 % → 0 P., 20 % → 100 P., Gewicht 15; EQ 20→15, Stabilität
 *     15→10, Brutto 10→5). Die Wachstums-HÖHE kam vorher nur als
 *     PEG-Nenner vor; ein stabiler Null-Wächser holte Bestnoten.
 * 7 — ROIC-Wächter (Expedia-Befund): Kapitalrendite über der Obergrenze
 *     150 % gilt als Nenner-Artefakt (Rückkäufe/Netto-Cash schrumpfen das
 *     investierte Kapital auf einen Restposten) und wird ausgeblendet
 *     (Renormierung) statt mit Bestnote belohnt.
 *
 * Ersetzt die frühere Behelfsprüfung «hat die Zeile ein Regime». Bei der
 * nächsten Formeländerung genügt eine neue Nummer.
 */
export const FASSUNG = 7;

let tabelleGeprueft = false;

/** JSON aus der Datenbank — MySQL liefert je nach Treiber Objekt oder Text. */
function leseKennzahlen(v: unknown): Record<string, number | null> | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return v as Record<string, number | null>;
  try {
    return JSON.parse(String(v));
  } catch {
    return null;
  }
}

/**
 * Spalten, die nach der ersten Fassung dazugekommen sind.
 *
 * MySQL kennt kein `ADD COLUMN IF NOT EXISTS`, und `drizzle-kit migrate` läuft
 * beim Deploy nicht. Deshalb erst fragen, dann ergänzen — für die Tabelle, die
 * bereits 25 000 Zeilen trägt. Neuinstallationen bekommen die Spalten schon
 * aus dem CREATE oben.
 */
const NACHGETRAGENE_SPALTEN: { name: string; ddl: string }[] = [
  { name: "timing", ddl: "ADD `timing` decimal(6,2)" },
  { name: "timingAbdeckung", ddl: "ADD `timingAbdeckung` decimal(4,3)" },
  { name: "regime", ddl: "ADD `regime` varchar(24)" },
  // Fassung 2: Bewertung als `scoreGemessen` und die Roh-Kennzahlen daneben.
  { name: "fassung", ddl: "ADD `fassung` tinyint" },
  { name: "kennzahlen", ddl: "ADD `kennzahlen` json" },
];

async function stelleTabelleSicher(db: any): Promise<void> {
  if (tabelleGeprueft) return;
  const { sql } = await import("drizzle-orm");
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`stock_scores_history\` (
    \`ticker\` varchar(24) NOT NULL,
    \`datum\` varchar(10) NOT NULL,
    \`qualitaet\` decimal(6,2),
    \`bewertung\` decimal(6,2),
    \`fScore\` tinyint,
    \`fScoreBerechenbar\` tinyint,
    \`kurs\` decimal(18,6),
    \`timing\` decimal(6,2),
    \`timingAbdeckung\` decimal(4,3),
    \`regime\` varchar(24),
    \`fassung\` tinyint,
    \`kennzahlen\` json,
    \`belegt\` tinyint NOT NULL DEFAULT 0,
    \`meldefristTage\` smallint NOT NULL DEFAULT 90,
    \`erfasstAm\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY (\`ticker\`, \`datum\`),
    KEY \`ix_stock_scores_history_datum\` (\`datum\`)
  )`));

  for (const spalte of NACHGETRAGENE_SPALTEN) {
    const res: any = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'stock_scores_history'
        AND COLUMN_NAME = ${spalte.name}`);
    const liste = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
    if (Number((liste as any[])[0]?.cnt ?? 0) === 0) {
      await db.execute(sql.raw(`ALTER TABLE \`stock_scores_history\` ${spalte.ddl}`));
    }
  }

  tabelleGeprueft = true;
}

export interface HistorienSatz {
  ticker: string;
  datum: string;
  qualitaet: number | null;
  bewertung: number | null;
  fScore: number;
  fScoreBerechenbar: number;
  kurs: number | null;
  /** Timing-Score 0–100 aus der Kursreihe; null, wenn zu wenig Kurshistorie. */
  timing: number | null;
  /** Anteil des belegten Timing-Gewichts, 0–1. Ohne Blasensignal höchstens 0.90. */
  timingAbdeckung: number | null;
  /** Regime-Schlüssel der Engine an diesem Stichtag, oder `default`. */
  regime: string | null;
  /**
   * Fassung der Rechnung, die diese Zeile erzeugt hat.
   *
   * 1 = erste Rekonstruktion, 2 = Bewertung als `scoreGemessen` mit
   * Roh-Kennzahlen. Ersetzt die frühere Behelfsprüfung «hat die Zeile ein
   * Regime»: Bei der nächsten Formeländerung genügt eine neue Nummer.
   */
  fassung: number;
  /**
   * Die Roh-Kennzahlen dieses Stichtags.
   *
   * Der eigentliche Grund für diese Spalte: Bisher standen nur die fertigen
   * Scores in der Tabelle. Jede Änderung an einer Score-Formel zwang deshalb
   * zu einem vollständigen neuen Abruf über alle Titel — beim
   * Bewertungs-Fehler genau einmal zu viel. Mit den Eingangsgrössen daneben
   * ist eine Formeländerung künftig eine reine Neuberechnung.
   *
   * Als JSON und nicht als zwölf Spalten: Eine weitere Kennzahl soll keine
   * Wanderung durch Schema, Schreib- und Lesepfad auslösen.
   */
  kennzahlen: Record<string, number | null> | null;
  belegt: number;
  meldefristTage: number;
}

/** Schreibt Sätze; vorhandene Ticker/Datum-Paare werden überschrieben. */
export async function haltefestHistorie(saetze: HistorienSatz[]): Promise<number> {
  if (!saetze.length) return 0;
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return 0;
    await stelleTabelleSicher(db);
    const { sql } = await import("drizzle-orm");

    let geschrieben = 0;
    // In Blöcken, damit eine lange Reihe nicht in einer Riesenanweisung landet.
    const BLOCK = 200;
    for (let i = 0; i < saetze.length; i += BLOCK) {
      const teil = saetze.slice(i, i + BLOCK);
      const werte = teil.map((s) =>
        sql`(${s.ticker}, ${s.datum}, ${s.qualitaet}, ${s.bewertung}, ${s.fScore},
             ${s.fScoreBerechenbar}, ${s.kurs}, ${s.timing ?? null},
             ${s.timingAbdeckung ?? null}, ${s.regime ?? null},
             ${s.fassung}, ${s.kennzahlen ? JSON.stringify(s.kennzahlen) : null},
             ${s.belegt}, ${s.meldefristTage})`);
      await db.execute(sql`
        INSERT INTO stock_scores_history
          (ticker, datum, qualitaet, bewertung, fScore, fScoreBerechenbar, kurs,
           timing, timingAbdeckung, regime, fassung, kennzahlen, belegt, meldefristTage)
        VALUES ${sql.join(werte, sql`, `)}
        ON DUPLICATE KEY UPDATE
          qualitaet = VALUES(qualitaet), bewertung = VALUES(bewertung),
          fScore = VALUES(fScore), fScoreBerechenbar = VALUES(fScoreBerechenbar),
          kurs = VALUES(kurs), timing = VALUES(timing),
          timingAbdeckung = VALUES(timingAbdeckung), regime = VALUES(regime),
          fassung = VALUES(fassung), kennzahlen = VALUES(kennzahlen),
          belegt = VALUES(belegt),
          meldefristTage = VALUES(meldefristTage), erfasstAm = now()`);
      geschrieben += teil.length;
    }
    return geschrieben;
  } catch (e) {
    console.warn("[PunktInZeit] Schreiben fehlgeschlagen (non-fatal):", (e as Error).message);
    return 0;
  }
}

/**
 * Alle Reihen, nach Titel gebündelt — Eingang für den Gewichts-Backtest.
 *
 * Nur Zeilen mit Regime: Die Zeilen der ersten Fassung tragen kein Timing, und
 * eine Auswertung, die sie mitnimmt, misst ein Zweidrittelmodell. Lieber eine
 * kürzere Reihe als eine, die stillschweigend etwas anderes auswertet.
 *
 * Rund 25 000 Zeilen — für einen Ausleseauftrag auf Knopfdruck vertretbar; der
 * Aufrufer soll sie NICHT in einer Schleife holen.
 */
export async function leseAlleReihen(): Promise<Map<string, HistorienSatz[]>> {
  const aus = new Map<string, HistorienSatz[]>();
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return aus;
    await stelleTabelleSicher(db);
    const { sql } = await import("drizzle-orm");
    const rows: any = await db.execute(sql`
      SELECT ticker, datum, qualitaet, bewertung, fScore, fScoreBerechenbar, kurs,
             timing, timingAbdeckung, regime, fassung, kennzahlen, belegt, meldefristTage
      FROM stock_scores_history
      WHERE fassung >= ${FASSUNG}
      ORDER BY ticker ASC, datum ASC`);
    const liste = Array.isArray(rows) ? (rows[0] ?? rows) : (rows?.rows ?? []);
    const num = (v: unknown) => (v === null || v === undefined ? null : parseFloat(String(v)));
    for (const r of liste as any[]) {
      const ticker = String(r.ticker);
      if (!aus.has(ticker)) aus.set(ticker, []);
      aus.get(ticker)!.push({
        ticker,
        datum: String(r.datum),
        qualitaet: num(r.qualitaet),
        bewertung: num(r.bewertung),
        fScore: Number(r.fScore ?? 0),
        fScoreBerechenbar: Number(r.fScoreBerechenbar ?? 0),
        kurs: num(r.kurs),
        timing: num(r.timing),
        timingAbdeckung: num(r.timingAbdeckung),
        regime: r.regime === null || r.regime === undefined ? null : String(r.regime),
        fassung: Number(r.fassung ?? 1),
        kennzahlen: leseKennzahlen(r.kennzahlen),
        belegt: Number(r.belegt ?? 0),
        meldefristTage: Number(r.meldefristTage ?? 90),
      });
    }
    return aus;
  } catch (e) {
    console.warn("[PunktInZeit] Gesamtabfrage fehlgeschlagen (non-fatal):", (e as Error).message);
    return aus;
  }
}

/** Liest die Reihe eines Titels, aufsteigend nach Datum. */
export async function leseHistorie(ticker: string): Promise<HistorienSatz[]> {
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return [];
    await stelleTabelleSicher(db);
    const { sql } = await import("drizzle-orm");
    const rows: any = await db.execute(sql`
      SELECT ticker, datum, qualitaet, bewertung, fScore, fScoreBerechenbar, kurs,
             timing, timingAbdeckung, regime, fassung, kennzahlen, belegt, meldefristTage
      FROM stock_scores_history WHERE ticker = ${ticker} ORDER BY datum ASC`);
    const liste = Array.isArray(rows) ? (rows[0] ?? rows) : (rows?.rows ?? []);
    const num = (v: unknown) => (v === null || v === undefined ? null : parseFloat(String(v)));
    return (liste as any[]).map((r) => ({
      ticker: String(r.ticker),
      datum: String(r.datum),
      qualitaet: num(r.qualitaet),
      bewertung: num(r.bewertung),
      fScore: Number(r.fScore ?? 0),
      fScoreBerechenbar: Number(r.fScoreBerechenbar ?? 0),
      kurs: num(r.kurs),
      timing: num(r.timing),
      timingAbdeckung: num(r.timingAbdeckung),
      regime: r.regime === null || r.regime === undefined ? null : String(r.regime),
      fassung: Number(r.fassung ?? 1),
      kennzahlen: leseKennzahlen(r.kennzahlen),
      belegt: Number(r.belegt ?? 0),
      meldefristTage: Number(r.meldefristTage ?? 90),
    }));
  } catch (e) {
    console.warn("[PunktInZeit] Lesen fehlgeschlagen (non-fatal):", (e as Error).message);
    return [];
  }
}

/**
 * Wie viele Zeilen liegen vor und über welchen Zeitraum — für die Admin-Anzeige.
 *
 * `titelMitRegime` zeigt, wie weit der Nachtrag des dritten Scores gediehen
 * ist: Titel aus der ersten Fassung tragen kein Regime. Ohne diese Zahl sähe
 * eine Reihe, die für die Gewichtsoptimierung noch gar nicht taugt, genauso
 * vollständig aus wie eine fertige.
 */
export async function historienUmfang(): Promise<{
  zeilen: number; titel: number; von: string | null; bis: string | null;
  titelMitRegime: number; zeilenMitTiming: number;
  /** Zeilen der AKTUELLEN Fassung — nur die zählen für Diagnose und Messung. */
  zeilenAktuell: number;
  /**
   * Alt-Fassungs-Zeilen von Titeln OHNE Datenreihe (`stock_scores_ohne_reihe`)
   * — die kann kein Nachlegen je aktualisieren. Ohne diese Zahl hielt das
   * Selbst-Nachlegen 67 solcher Zeilen für «veraltet» und startete endlos
   * neue Läufe für 3 Titel, die die Quelle nachweislich nicht führt (266×).
   */
  zeilenNichtNachziehbar: number;
}> {
  const leer = {
    zeilen: 0, titel: 0, von: null, bis: null,
    titelMitRegime: 0, zeilenMitTiming: 0, zeilenAktuell: 0,
    zeilenNichtNachziehbar: 0,
  };
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return leer;
    await stelleTabelleSicher(db);
    await stelleLeerTabelleSicher(db);
    const { sql } = await import("drizzle-orm");
    const rows: any = await db.execute(sql`
      SELECT COUNT(*) AS zeilen, COUNT(DISTINCT ticker) AS titel,
             MIN(datum) AS von, MAX(datum) AS bis,
             COUNT(DISTINCT CASE WHEN fassung >= 2 THEN ticker END) AS titelMitRegime,
             SUM(CASE WHEN timing IS NOT NULL THEN 1 ELSE 0 END) AS zeilenMitTiming,
             SUM(CASE WHEN fassung >= ${FASSUNG} THEN 1 ELSE 0 END) AS zeilenAktuell,
             SUM(CASE WHEN fassung < ${FASSUNG} AND EXISTS (
               SELECT 1 FROM stock_scores_ohne_reihe o WHERE o.ticker = stock_scores_history.ticker
             ) THEN 1 ELSE 0 END) AS zeilenNichtNachziehbar
      FROM stock_scores_history`);
    const liste = Array.isArray(rows) ? (rows[0] ?? rows) : (rows?.rows ?? []);
    const r = (liste as any[])[0];
    if (!r) return leer;
    return {
      zeilen: Number(r.zeilen ?? 0),
      titel: Number(r.titel ?? 0),
      von: r.von ? String(r.von) : null,
      bis: r.bis ? String(r.bis) : null,
      titelMitRegime: Number(r.titelMitRegime ?? 0),
      zeilenMitTiming: Number(r.zeilenMitTiming ?? 0),
      zeilenAktuell: Number(r.zeilenAktuell ?? 0),
      zeilenNichtNachziehbar: Number(r.zeilenNichtNachziehbar ?? 0),
    };
  } catch {
    return leer;
  }
}

/**
 * Ticker, die im gewünschten Zeitraum bereits eine ausreichend dichte Reihe haben.
 *
 * Damit lässt sich ein abgebrochener Lauf fortsetzen, statt ihn von vorn zu
 * beginnen: Ein Lauf über 246 Titel, der bei 150 stehen bleibt, holte sonst
 * 150-mal Daten, die schon in der Datenbank stehen — und läuft mit demselben
 * Zeitaufwand ins selbe Problem.
 *
 * `mindestZeilen` schützt vor halb gefüllten Titeln: Wer nur drei Stichtage
 * hat, weil der vorige Lauf mitten in ihm abbrach, soll erneut geholt werden.
 *
 * `regime IS NOT NULL` unterscheidet die Zeilen der ersten Fassung von denen
 * mit Timing-Score. Die alten zählen nicht als fertig und werden ein einziges
 * Mal nachgeholt — ein eigener Nachtragslauf wäre dieselbe Arbeit mit doppelter
 * Maschinerie.
 *
 * Warum `regime` und nicht `timing`: `regime` wird IMMER geschrieben, notfalls
 * als `default`. `timing` bleibt bei dünner Kurshistorie zu Recht leer — als
 * Merkmal genommen, stünde so ein Titel bei jedem Lauf erneut vorn in der
 * Schlange und der Lauf käme nie durch. Genau diese Falle hat #262 schon
 * einmal zugeschnappt.
 */
export async function tickerMitReihe(
  von: string,
  bis: string,
  mindestZeilen: number,
): Promise<Set<string>> {
  const aus = new Set<string>();
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return aus;
    await stelleTabelleSicher(db);
    const { sql } = await import("drizzle-orm");
    const rows: any = await db.execute(sql`
      SELECT ticker, COUNT(*) AS n FROM stock_scores_history
      WHERE datum >= ${von} AND datum <= ${bis} AND fassung >= ${FASSUNG}
      GROUP BY ticker HAVING n >= ${mindestZeilen}`);
    const liste = Array.isArray(rows) ? (rows[0] ?? rows) : (rows?.rows ?? []);
    for (const r of liste as any[]) aus.add(String(r.ticker));
    return aus;
  } catch (e) {
    // Ohne diese Auskunft wird eben alles neu geholt — langsamer, nicht falsch.
    console.warn("[PunktInZeit] Bestandsabfrage fehlgeschlagen (non-fatal):", (e as Error).message);
    return aus;
  }
}

/**
 * Titel, die geprüft wurden und keine Reihe liefern können.
 *
 * ETFs, Fonds und Indexprodukte haben keine Bilanz und kein EPS. Ohne dieses
 * Gedächtnis stehen sie bei jedem Lauf erneut vorn in der Warteschlange, und
 * der Lauf kommt nie vom Fleck — genau das ist passiert: 22 von 25 Titeln
 * eines Häppchens waren ETFs, zwei Läufe hintereinander mit identischem
 * Ergebnis.
 *
 * Eigene Tabelle statt eines Merkmals am Titel: Die Aussage gilt für einen
 * Zeitraum, nicht für den Titel an sich. Ein Titel, der 2016 noch nicht
 * kotiert war, kann für ein späteres Fenster sehr wohl eine Reihe haben.
 */
let leerGeprueft = false;

async function stelleLeerTabelleSicher(db: any): Promise<void> {
  if (leerGeprueft) return;
  const { sql } = await import("drizzle-orm");
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`stock_scores_ohne_reihe\` (
    \`ticker\` varchar(24) NOT NULL,
    \`von\` varchar(10) NOT NULL,
    \`bis\` varchar(10) NOT NULL,
    \`geprueftAm\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY (\`ticker\`, \`von\`, \`bis\`)
  )`));
  leerGeprueft = true;
}

export async function merkeOhneReihe(tickers: string[], von: string, bis: string): Promise<number> {
  if (!tickers.length) return 0;
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return 0;
    await stelleLeerTabelleSicher(db);
    const { sql } = await import("drizzle-orm");
    const werte = tickers.map((t) => sql`(${t}, ${von}, ${bis})`);
    await db.execute(sql`
      INSERT INTO stock_scores_ohne_reihe (ticker, von, bis) VALUES ${sql.join(werte, sql`, `)}
      ON DUPLICATE KEY UPDATE geprueftAm = now()`);
    return tickers.length;
  } catch (e) {
    console.warn("[PunktInZeit] Leer-Vermerk fehlgeschlagen (non-fatal):", (e as Error).message);
    return 0;
  }
}

/**
 * Titel, deren Abruf scheiterte — Zeitüberschreitung, HTTP-Fehler, keine Antwort.
 *
 * Der Unterschied zu `stock_scores_ohne_reihe` ist der ganze Punkt: Dort steht
 * «kann keine Reihe haben», hier «hat es diesmal nicht geklappt». Ein
 * Fehlversuch darf einen Titel deshalb NICHT ausschliessen — er verschiebt ihn
 * nur ans Ende der Warteschlange.
 *
 * Ohne dieses Gedächtnis stand ein gescheiterter Titel bei jedem Lauf wieder
 * ganz vorn: `alleOffen.slice(0, 25)` nimmt immer dieselben ersten 25. Scheitern
 * die, verarbeitet jeder weitere Lauf exakt dieselben 25 Titel und der
 * Fortschritt bleibt stehen — bei 107 von 212, ohne dass irgendwo ein Fehler
 * sichtbar würde. Dieselbe Falle wie #262, damals nur für ETFs geschlossen.
 */
let fehlversuchGeprueft = false;

async function stelleFehlversuchTabelleSicher(db: any): Promise<void> {
  if (fehlversuchGeprueft) return;
  const { sql } = await import("drizzle-orm");
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`stock_scores_fehlversuch\` (
    \`ticker\` varchar(24) NOT NULL,
    \`von\` varchar(10) NOT NULL,
    \`bis\` varchar(10) NOT NULL,
    \`versuche\` smallint NOT NULL DEFAULT 1,
    \`grund\` varchar(255),
    \`zuletzt\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY (\`ticker\`, \`von\`, \`bis\`)
  )`));
  fehlversuchGeprueft = true;
}

export async function merkeFehlversuche(
  eintraege: { ticker: string; grund: string }[],
  von: string,
  bis: string,
): Promise<number> {
  if (!eintraege.length) return 0;
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return 0;
    await stelleFehlversuchTabelleSicher(db);
    const { sql } = await import("drizzle-orm");
    const werte = eintraege.map((e) => sql`(${e.ticker}, ${von}, ${bis}, 1, ${e.grund.slice(0, 250)})`);
    await db.execute(sql`
      INSERT INTO stock_scores_fehlversuch (ticker, von, bis, versuche, grund)
      VALUES ${sql.join(werte, sql`, `)}
      ON DUPLICATE KEY UPDATE
        versuche = versuche + 1, grund = VALUES(grund), zuletzt = now()`);
    return eintraege.length;
  } catch (e) {
    console.warn("[PunktInZeit] Fehlversuch-Vermerk fehlgeschlagen (non-fatal):", (e as Error).message);
    return 0;
  }
}

/** Gescheiterte Titel mit Zahl der Versuche — je öfter gescheitert, desto weiter hinten. */
export async function fehlversuche(
  von: string,
  bis: string,
): Promise<Map<string, { versuche: number; grund: string | null }>> {
  const aus = new Map<string, { versuche: number; grund: string | null }>();
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return aus;
    await stelleFehlversuchTabelleSicher(db);
    const { sql } = await import("drizzle-orm");
    const rows: any = await db.execute(sql`
      SELECT ticker, versuche, grund FROM stock_scores_fehlversuch
      WHERE von = ${von} AND bis = ${bis}`);
    const liste = Array.isArray(rows) ? (rows[0] ?? rows) : (rows?.rows ?? []);
    for (const r of liste as any[]) {
      aus.set(String(r.ticker), {
        versuche: Number(r.versuche ?? 1),
        grund: r.grund === null || r.grund === undefined ? null : String(r.grund),
      });
    }
    return aus;
  } catch {
    return aus;
  }
}

/** Vermerk löschen, sobald ein Titel doch durchkam — sonst bliebe er ewig nachrangig. */
export async function loescheFehlversuche(
  tickers: string[],
  von: string,
  bis: string,
): Promise<void> {
  if (!tickers.length) return;
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return;
    await stelleFehlversuchTabelleSicher(db);
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      DELETE FROM stock_scores_fehlversuch
      WHERE von = ${von} AND bis = ${bis}
        AND ticker IN (${sql.join(tickers.map((t) => sql`${t}`), sql`, `)})`);
  } catch (e) {
    console.warn("[PunktInZeit] Fehlversuch-Loeschung fehlgeschlagen (non-fatal):", (e as Error).message);
  }
}

export async function tickerOhneReihe(von: string, bis: string): Promise<Set<string>> {
  const aus = new Set<string>();
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return aus;
    await stelleLeerTabelleSicher(db);
    const { sql } = await import("drizzle-orm");
    const rows: any = await db.execute(sql`
      SELECT ticker FROM stock_scores_ohne_reihe WHERE von = ${von} AND bis = ${bis}`);
    const liste = Array.isArray(rows) ? (rows[0] ?? rows) : (rows?.rows ?? []);
    for (const r of liste as any[]) aus.add(String(r.ticker));
    return aus;
  } catch {
    return aus;
  }
}
