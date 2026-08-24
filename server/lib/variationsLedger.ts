/**
 * K13 — Kandidaten-Ledger des Variations-Loops.
 *
 * Additive Labor-Tabelle (gleiche Selbstverwaltung wie `punktInZeitStore`):
 * jeder je gemessene Parametersatz eine Zeile, mit Herkunftslinie
 * (`elternSchluessel`), Messwerten und Status. Der Status trägt das
 * L3-Gate: `vorgeschlagen` wartet auf den Projektleiter, `freigegeben` und
 * `verworfen` sind SEINE Entscheide — der Loop selbst schreibt nur
 * `gemessen` und `vorgeschlagen`.
 *
 * Nichts hier wird vom Kundenpfad gelesen. Die Betriebs-Gewichte bleiben
 * die im Code deklarierten `DEFAULT_SIGNAL_GEWICHTE` (eine Wahrheit, L1);
 * eine Freigabe dokumentiert den Entscheid, die Übernahme in den Code läuft
 * als gewöhnliche Regel-1-Änderung.
 */
import type { SignalGewichte } from "./dreiScoreSignal";

export type KandidatStatus = "gemessen" | "vorgeschlagen" | "freigegeben" | "verworfen";

export interface LedgerZeile {
  id: number;
  laufId: number;
  schluessel: string;
  elternSchluessel: string | null;
  beschreibung: string;
  horizontMonate: number;
  status: KandidatStatus;
  taugt: boolean;
  hinweis: string | null;
  gewichte: Record<string, SignalGewichte> | null;
  /** Kompakte Messwerte des Prüfzeitraums plus Kontext. */
  messwerte: Record<string, number | string | null> | null;
  erstelltAm: string | null;
}

let tabelleGeprueft = false;

async function stelleTabelleSicher(db: any): Promise<void> {
  if (tabelleGeprueft) return;
  const { sql } = await import("drizzle-orm");
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`variations_kandidaten\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`laufId\` int NOT NULL,
    \`schluessel\` varchar(64) NOT NULL,
    \`elternSchluessel\` varchar(64),
    \`beschreibung\` varchar(255) NOT NULL DEFAULT '',
    \`horizontMonate\` tinyint NOT NULL DEFAULT 1,
    \`status\` varchar(16) NOT NULL DEFAULT 'gemessen',
    \`taugt\` tinyint NOT NULL DEFAULT 0,
    \`hinweis\` text,
    \`gewichte\` json,
    \`messwerte\` json,
    \`erstelltAm\` timestamp NOT NULL DEFAULT (now()),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`ux_variations_schluessel\` (\`schluessel\`, \`horizontMonate\`),
    KEY \`ix_variations_status\` (\`status\`)
  )`));
  tabelleGeprueft = true;
}

function leseJson(v: unknown): any {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return v;
  try { return JSON.parse(String(v)); } catch { return null; }
}

function zeile(r: any): LedgerZeile {
  return {
    id: Number(r.id),
    laufId: Number(r.laufId),
    schluessel: String(r.schluessel),
    elternSchluessel: r.elternSchluessel ? String(r.elternSchluessel) : null,
    beschreibung: String(r.beschreibung ?? ""),
    horizontMonate: Number(r.horizontMonate ?? 1),
    status: String(r.status) as KandidatStatus,
    taugt: Number(r.taugt ?? 0) === 1,
    hinweis: r.hinweis ? String(r.hinweis) : null,
    gewichte: leseJson(r.gewichte),
    messwerte: leseJson(r.messwerte),
    erstelltAm: r.erstelltAm ? new Date(r.erstelltAm).toISOString() : null,
  };
}

/** Alle Zeilen eines Horizonts — Grundlage für Dedupe, Lineage und Lage. */
export async function leseLedger(horizontMonate: number): Promise<LedgerZeile[]> {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return [];
  await stelleTabelleSicher(db);
  const { sql } = await import("drizzle-orm");
  const rows: any = await db.execute(sql`
    SELECT id, laufId, schluessel, elternSchluessel, beschreibung, horizontMonate,
           status, taugt, hinweis, gewichte, messwerte, erstelltAm
    FROM variations_kandidaten
    WHERE horizontMonate = ${horizontMonate}
    ORDER BY id ASC`);
  const liste = Array.isArray(rows) ? (rows[0] ?? rows) : (rows?.rows ?? []);
  return (liste as any[]).map(zeile);
}

/** Eine Zeile über die id — für den Entscheid des Projektleiters. */
export async function leseKandidat(id: number): Promise<LedgerZeile | null> {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return null;
  await stelleTabelleSicher(db);
  const { sql } = await import("drizzle-orm");
  const rows: any = await db.execute(sql`
    SELECT id, laufId, schluessel, elternSchluessel, beschreibung, horizontMonate,
           status, taugt, hinweis, gewichte, messwerte, erstelltAm
    FROM variations_kandidaten WHERE id = ${id} LIMIT 1`);
  const liste = Array.isArray(rows) ? (rows[0] ?? rows) : (rows?.rows ?? []);
  const r = (liste as any[])[0];
  return r ? zeile(r) : null;
}

export interface NeueZeile {
  laufId: number;
  schluessel: string;
  elternSchluessel: string | null;
  beschreibung: string;
  horizontMonate: number;
  status: KandidatStatus;
  taugt: boolean;
  hinweis: string | null;
  gewichte: Record<string, SignalGewichte>;
  messwerte: Record<string, number | string | null>;
}

/** Gemessene Kandidaten ablegen; ein bereits bekannter Schlüssel bleibt stehen. */
export async function schreibeKandidaten(zeilen: NeueZeile[]): Promise<void> {
  if (!zeilen.length) return;
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return;
  await stelleTabelleSicher(db);
  const { sql } = await import("drizzle-orm");
  for (const z of zeilen) {
    await db.execute(sql`
      INSERT INTO variations_kandidaten
        (laufId, schluessel, elternSchluessel, beschreibung, horizontMonate,
         status, taugt, hinweis, gewichte, messwerte)
      VALUES (${z.laufId}, ${z.schluessel}, ${z.elternSchluessel}, ${z.beschreibung},
              ${z.horizontMonate}, ${z.status}, ${z.taugt ? 1 : 0}, ${z.hinweis},
              ${JSON.stringify(z.gewichte)}, ${JSON.stringify(z.messwerte)})
      ON DUPLICATE KEY UPDATE laufId = laufId`);
  }
}

/**
 * Statuswechsel — nur die zwei Entscheide des Projektleiters (L3) plus das
 * Zurückstufen überholter Vorschläge durch einen neuen Lauf.
 */
export async function setzeStatus(id: number, status: KandidatStatus): Promise<void> {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return;
  await stelleTabelleSicher(db);
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`UPDATE variations_kandidaten SET status = ${status} WHERE id = ${id}`);
}

/** Offene Vorschläge (alle Horizonte), jüngste zuerst — für Lage-Seite und Cockpit. */
export async function leseOffeneVorschlaege(): Promise<LedgerZeile[]> {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return [];
  await stelleTabelleSicher(db);
  const { sql } = await import("drizzle-orm");
  const rows: any = await db.execute(sql`
    SELECT id, laufId, schluessel, elternSchluessel, beschreibung, horizontMonate,
           status, taugt, hinweis, gewichte, messwerte, erstelltAm
    FROM variations_kandidaten
    WHERE status = 'vorgeschlagen'
    ORDER BY id DESC`);
  const liste = Array.isArray(rows) ? (rows[0] ?? rows) : (rows?.rows ?? []);
  return (liste as any[]).map(zeile);
}

/** Offene Vorschläge (alle Horizonte) — fürs Cockpit. */
export async function zaehleOffeneVorschlaege(): Promise<number> {
  const { getDb } = await import("../db");
  const db = await getDb();
  if (!db) return 0;
  await stelleTabelleSicher(db);
  const { sql } = await import("drizzle-orm");
  const rows: any = await db.execute(sql`
    SELECT COUNT(*) AS n FROM variations_kandidaten WHERE status = 'vorgeschlagen'`);
  const liste = Array.isArray(rows) ? (rows[0] ?? rows) : (rows?.rows ?? []);
  return Number((liste as any[])[0]?.n ?? 0);
}
