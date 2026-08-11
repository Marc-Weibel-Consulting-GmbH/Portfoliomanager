/**
 * Ablage des Watchlist-Screeners.
 *
 * Zwei Tabellen: `screener_lauf` (ein Protokollkopf je Durchlauf) und
 * `screener_kandidat` (jeder gesichtete Titel mit Ergebnis und Entscheidung).
 * Das Protokoll ist bewusst vollständig — auch Titel, die schon in der
 * Watchlist stehen, werden festgehalten. So entsteht mit jedem Lauf ein
 * Punkt-in-Zeit-Universum: Welche Titel standen an diesem Tag zur Auswahl,
 * mit welchen Scores? Das ist die unverzerrte Vorwärtsmessung, die dem
 * Rückwärts-Backtest fehlt (Überlebensauswahl, STRATEGIE_DREI_SCORES.md §1).
 *
 * Eigene Tabellen statt neuer Spalten, selbstheilend angelegt: Der Deploy
 * führt `drizzle-kit migrate` nicht aus.
 */

let tabellenGeprueft = false;

async function stelleTabellenSicher(db: any): Promise<void> {
  if (tabellenGeprueft) return;
  const { sql } = await import("drizzle-orm");
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`screener_lauf\` (
    \`id\` int NOT NULL AUTO_INCREMENT,
    \`gestartetAm\` timestamp NOT NULL DEFAULT (now()),
    \`parameter\` json,
    \`status\` varchar(16) NOT NULL DEFAULT 'sammelt',
    \`universum\` int NOT NULL DEFAULT 0,
    \`fehler\` varchar(500),
    PRIMARY KEY (\`id\`)
  )`));
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`screener_kandidat\` (
    \`laufId\` int NOT NULL,
    \`ticker\` varchar(24) NOT NULL,
    \`name\` varchar(255),
    \`boerse\` varchar(12),
    \`sektor\` varchar(64),
    \`waehrung\` varchar(8),
    \`marktKap\` decimal(20,0),
    \`dividendenrendite\` decimal(8,4),
    \`inWatchlist\` tinyint NOT NULL DEFAULT 0,
    \`status\` varchar(16) NOT NULL DEFAULT 'wartend',
    \`qualitaet\` decimal(6,2),
    \`bewertung\` decimal(6,2),
    \`signalScore\` decimal(6,2),
    \`signalLabel\` varchar(16),
    \`fehler\` varchar(255),
    \`berechnetAm\` timestamp NULL,
    PRIMARY KEY (\`laufId\`, \`ticker\`)
  )`));
  tabellenGeprueft = true;
}

async function dbOderFehler() {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) throw new Error("Datenbank nicht verfügbar");
  await stelleTabellenSicher(db);
  return db;
}

export interface ScreenerKandidat {
  laufId: number;
  ticker: string;
  name: string | null;
  boerse: string | null;
  sektor: string | null;
  waehrung: string | null;
  marktKap: number | null;
  dividendenrendite: number | null;
  inWatchlist: number;
  /** wartend | berechnet | fehler | vorhanden | uebernommen | abgelehnt */
  status: string;
  qualitaet: number | null;
  bewertung: number | null;
  signalScore: number | null;
  signalLabel: string | null;
  fehler: string | null;
}

function zahl(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

export async function neuerLauf(parameter: unknown): Promise<number> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  const res: any = await db.execute(sql`INSERT INTO screener_lauf (parameter, status) VALUES (${JSON.stringify(parameter)}, 'sammelt')`);
  // insertId direkt aus dem INSERT-Ergebnis — ein separates
  // SELECT LAST_INSERT_ID() kann im Verbindungs-Pool auf einer ANDEREN
  // Verbindung landen und eine fremde ID liefern.
  const kopf = Array.isArray(res) ? res[0] : res;
  const id = Number(kopf?.insertId ?? 0);
  if (id > 0) return id;
  const idRes: any = await db.execute(sql`SELECT MAX(id) AS id FROM screener_lauf`);
  const liste = Array.isArray(idRes) ? (idRes[0] ?? idRes) : (idRes?.rows ?? []);
  return Number((liste as any[])[0]?.id ?? 0);
}

export async function setzeLaufStatus(
  laufId: number,
  status: "sammelt" | "rechnet" | "fertig" | "fehler",
  felder?: { universum?: number; fehler?: string },
): Promise<void> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`
    UPDATE screener_lauf
    SET status = ${status},
        universum = COALESCE(${felder?.universum ?? null}, universum),
        fehler = ${felder?.fehler ?? null}
    WHERE id = ${laufId}`);
}

/**
 * Kandidaten eines Laufs anlegen (Duplikate je Lauf werden ignoriert).
 *
 * Zeilenfehler werden übersprungen und gezählt statt den ganzen Lauf zu
 * kippen — beim ersten Live-Lauf liess EIN gescheiterter INSERT den Lauf
 * dauerhaft im Zustand «sammelt» hängen, und die Fehlerursache war in der
 * gekürzten Drizzle-Meldung nicht erkennbar. `ersterFehler` trägt deshalb
 * die volle Ursache (cause) nach oben.
 */
export async function ergaenzeKandidaten(
  laufId: number,
  kandidaten: Array<Omit<ScreenerKandidat, "laufId" | "qualitaet" | "bewertung" | "signalScore" | "signalLabel" | "fehler">>,
): Promise<{ eingefuegt: number; zeilenFehler: number; ersterFehler: string | null }> {
  if (kandidaten.length === 0) return { eingefuegt: 0, zeilenFehler: 0, ersterFehler: null };
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  let eingefuegt = 0;
  let zeilenFehler = 0;
  let ersterFehler: string | null = null;
  for (const k of kandidaten) {
    try {
      const res: any = await db.execute(sql`
        INSERT IGNORE INTO screener_kandidat
          (laufId, ticker, name, boerse, sektor, waehrung, marktKap, dividendenrendite, inWatchlist, status)
        VALUES (${laufId}, ${k.ticker}, ${k.name}, ${k.boerse}, ${k.sektor}, ${k.waehrung},
                ${k.marktKap}, ${k.dividendenrendite}, ${k.inWatchlist}, ${k.status})`);
      const betroffen = Array.isArray(res) ? (res[0]?.affectedRows ?? 0) : (res?.affectedRows ?? 0);
      if (Number(betroffen) > 0) eingefuegt++;
    } catch (err: any) {
      zeilenFehler++;
      if (!ersterFehler) {
        const ursache = err?.cause?.message ? ` — ${err.cause.message}` : "";
        ersterFehler = `${k.ticker}: ${err?.message ?? "unbekannt"}${ursache}`.slice(0, 400);
      }
    }
  }
  return { eingefuegt, zeilenFehler, ersterFehler };
}

/** Nächste unberechnete Kandidaten (nur die, die nicht schon in der Watchlist stehen). */
export async function offeneKandidaten(laufId: number, maxTitel: number): Promise<ScreenerKandidat[]> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  const res: any = await db.execute(sql`
    SELECT * FROM screener_kandidat
    WHERE laufId = ${laufId} AND status = 'wartend'
    ORDER BY marktKap DESC
    LIMIT ${maxTitel}`);
  const liste = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
  return (liste as any[]).map(mappeKandidat);
}

export async function schreibeErgebnis(
  laufId: number,
  ticker: string,
  ergebnis: {
    status: "berechnet" | "fehler";
    qualitaet?: number | null;
    bewertung?: number | null;
    signalScore?: number | null;
    signalLabel?: string | null;
    fehler?: string;
  },
): Promise<void> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`
    UPDATE screener_kandidat
    SET status = ${ergebnis.status},
        qualitaet = ${ergebnis.qualitaet ?? null},
        bewertung = ${ergebnis.bewertung ?? null},
        signalScore = ${ergebnis.signalScore ?? null},
        signalLabel = ${ergebnis.signalLabel ?? null},
        fehler = ${ergebnis.fehler?.slice(0, 250) ?? null},
        berechnetAm = now()
    WHERE laufId = ${laufId} AND ticker = ${ticker}`);
}

/** Entscheidung des Admins festhalten (uebernommen | abgelehnt). */
export async function setzeEntscheidung(
  laufId: number,
  ticker: string,
  entscheidung: "uebernommen" | "abgelehnt",
): Promise<void> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`
    UPDATE screener_kandidat SET status = ${entscheidung}
    WHERE laufId = ${laufId} AND ticker = ${ticker} AND status IN ('berechnet', 'uebernommen', 'abgelehnt')`);
}

export interface LaufUebersicht {
  id: number;
  gestartetAm: string;
  status: string;
  universum: number;
  fehler: string | null;
  wartend: number;
  berechnet: number;
  fehlgeschlagen: number;
  vorhanden: number;
  uebernommen: number;
  abgelehnt: number;
}

/** Jüngster Lauf mit Zählern je Status. */
export async function letzterLauf(): Promise<LaufUebersicht | null> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  const res: any = await db.execute(sql`SELECT * FROM screener_lauf ORDER BY id DESC LIMIT 1`);
  const liste = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
  const lauf = (liste as any[])[0];
  if (!lauf) return null;
  const zres: any = await db.execute(sql`
    SELECT status, COUNT(*) AS anzahl FROM screener_kandidat
    WHERE laufId = ${lauf.id} GROUP BY status`);
  const zliste = Array.isArray(zres) ? (zres[0] ?? zres) : (zres?.rows ?? []);
  const zaehler: Record<string, number> = {};
  for (const z of zliste as any[]) zaehler[z.status] = Number(z.anzahl);
  return {
    id: Number(lauf.id),
    gestartetAm: String(lauf.gestartetAm),
    status: String(lauf.status),
    universum: Number(lauf.universum),
    fehler: lauf.fehler ?? null,
    wartend: zaehler["wartend"] ?? 0,
    berechnet: zaehler["berechnet"] ?? 0,
    fehlgeschlagen: zaehler["fehler"] ?? 0,
    vorhanden: zaehler["vorhanden"] ?? 0,
    uebernommen: zaehler["uebernommen"] ?? 0,
    abgelehnt: zaehler["abgelehnt"] ?? 0,
  };
}

/** Beste berechnete Kandidaten eines Laufs, sortiert nach Signal-Score. */
export async function besteKandidaten(laufId: number, limit: number): Promise<ScreenerKandidat[]> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  const res: any = await db.execute(sql`
    SELECT * FROM screener_kandidat
    WHERE laufId = ${laufId} AND status IN ('berechnet', 'uebernommen', 'abgelehnt')
    ORDER BY (signalScore IS NULL), signalScore DESC, bewertung DESC
    LIMIT ${limit}`);
  const liste = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
  return (liste as any[]).map(mappeKandidat);
}

function mappeKandidat(r: any): ScreenerKandidat {
  return {
    laufId: Number(r.laufId),
    ticker: String(r.ticker),
    name: r.name ?? null,
    boerse: r.boerse ?? null,
    sektor: r.sektor ?? null,
    waehrung: r.waehrung ?? null,
    marktKap: zahl(r.marktKap),
    dividendenrendite: zahl(r.dividendenrendite),
    inWatchlist: Number(r.inWatchlist ?? 0),
    status: String(r.status),
    qualitaet: zahl(r.qualitaet),
    bewertung: zahl(r.bewertung),
    signalScore: zahl(r.signalScore),
    signalLabel: r.signalLabel ?? null,
    fehler: r.fehler ?? null,
  };
}
