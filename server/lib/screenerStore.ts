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
    \`primaerTicker\` varchar(24),
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
    \`qualitaetFaktoren\` json,
    \`bewertungFaktoren\` json,
    \`qualitaetNiveau\` decimal(6,2),
    \`qualitaetRichtung\` decimal(6,2),
    \`fScore\` tinyint,
    \`fehler\` varchar(255),
    \`retryCount\` int NOT NULL DEFAULT 0,
    \`berechnetAm\` timestamp NULL,
    PRIMARY KEY (\`laufId\`, \`ticker\`)
  )`));

  // Nachträglich dazugekommene Spalten — ohne sie lassen sich die
  // Kandidaten-Scores nicht nachprüfen (nur Endzahlen, keine Herleitung; die
  // Qualitäts-Kopfzahl braucht Niveau UND Richtung, Befund 3 der
  // Scoring-Prüfung). Selbstheilend, weil der Deploy keine Migrationen ausführt.
  const nachgetragen: Array<[string, string]> = [
    ["qualitaetFaktoren", "json"],
    ["bewertungFaktoren", "json"],
    ["qualitaetNiveau", "decimal(6,2)"],
    ["qualitaetRichtung", "decimal(6,2)"],
    ["fScore", "tinyint"],
    ["primaerTicker", "varchar(24)"],
    // Sitzland (ISO-2) aus den EODHD-Stammdaten — macht die Länder-
    // Konzentration («zu viele China-Titel») sichtbar und prüfbar.
    ["land", "varchar(2)"],
    // ISIN als quellenunabhängiger Emittentenschlüssel — 84 berechnete Titel
    // des Laufs #150001 hatten keinen EODHD-Primärticker (Manus-Restpunkt).
    ["isin", "varchar(12)"],
    // Begrenzter Wiederanlauf für transiente Titel-Level-Timeouts.
    ["retryCount", "int NOT NULL DEFAULT 0"],
    ["dividendenValidierung", "varchar(32)"],
    ["externeDividendenrendite", "decimal(8,4)"],
    ["dividendenPruefgrund", "varchar(255)"],
  ];
  for (const [name, typ] of nachgetragen) {
    const res: any = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'screener_kandidat'
        AND COLUMN_NAME = ${name}`);
    const liste = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
    if (Number((liste as any[])[0]?.cnt ?? 0) === 0) {
      await db.execute(sql.raw(`ALTER TABLE \`screener_kandidat\` ADD \`${name}\` ${typ}`));
    }
  }
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
  /** Kanonische EODHD-Hauptnotiz als prüfbarer Emittentenschlüssel. */
  primaerTicker: string | null;
  /** ISIN — quellenunabhängiger Emittentenschlüssel, nur informativ. */
  isin: string | null;
  sektor: string | null;
  waehrung: string | null;
  marktKap: number | null;
  dividendenrendite: number | null;
  /** Sitzland ISO-2 aus den EODHD-Stammdaten, z. B. "US", "CN". */
  land: string | null;
  inWatchlist: number;
  /** wartend | berechnet | fehler | vorhanden | uebernommen | abgelehnt | zweitkotierung | ausgeschlossen */
  status: string;
  qualitaet: number | null;
  bewertung: number | null;
  signalScore: number | null;
  signalLabel: string | null;
  /** Faktorwerte hinter den Scores (Name, Rohwert, Punkte, Gewicht) — die Herleitung zum Nachprüfen. */
  qualitaetFaktoren: unknown[] | null;
  bewertungFaktoren: unknown[] | null;
  /** Die zwei Säulen der Qualität (Niveau 60 %, Richtung 40 %) — nötig, um die Kopfzahl nachzurechnen. */
  qualitaetNiveau: number | null;
  qualitaetRichtung: number | null;
  fScore: number | null;
  fehler: string | null;
  /** Bereits verbrauchte Wiederanläufe für transiente Titel-Level-Timeouts. */
  retryCount: number;
  dividendenValidierung: string | null;
  externeDividendenrendite: number | null;
  dividendenPruefgrund: string | null;
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
  kandidaten: Array<Omit<ScreenerKandidat,
    "laufId" | "qualitaet" | "bewertung" | "signalScore" | "signalLabel"
    | "qualitaetFaktoren" | "bewertungFaktoren" | "qualitaetNiveau" | "qualitaetRichtung" | "fScore" | "fehler" | "retryCount" | "dividendenValidierung" | "externeDividendenrendite" | "dividendenPruefgrund" | "land" | "primaerTicker" | "isin">>,
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

/**
 * Nächste unberechnete Kandidaten — börsenweise ABWECHSELND (je Börse nach
 * Marktkapitalisierung absteigend). Vorher strikt nach Marktkapitalisierung
 * über alle Börsen: Die US-Riesen kamen zuerst dran, und bis der Lauf durch
 * war, zeigten die «besten Kandidaten» ausschliesslich US-Titel.
 */
export async function offeneKandidaten(laufId: number, maxTitel: number): Promise<ScreenerKandidat[]> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  const res: any = await db.execute(sql`
    SELECT * FROM (
      SELECT k.*, ROW_NUMBER() OVER (PARTITION BY boerse ORDER BY marktKap DESC) AS rangJeBoerse
      FROM screener_kandidat k
      WHERE laufId = ${laufId} AND status = 'wartend'
    ) t
    ORDER BY rangJeBoerse, marktKap DESC
    LIMIT ${maxTitel}`);
  const liste = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
  return (liste as any[]).map(mappeKandidat);
}

/**
 * Alle BERECHNETEN Kandidaten zurück in die Warteschlange legen — das
 * Nachlegen rechnet sie mit dem aktuellen Stand neu (Faktor-Herleitung,
 * ADR-/Zweitkotierungs-Prüfung). Nötig, wenn ein Lauf begann, bevor eine
 * dieser Regeln deployed war. Entscheidungen (übernommen/abgelehnt) bleiben
 * unangetastet; der Fundamentaldaten-Cache macht den zweiten Durchgang
 * deutlich schneller als den ersten.
 */
export async function stelleBerechneteZurueck(laufId: number): Promise<number> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  const res: any = await db.execute(sql`
    UPDATE screener_kandidat
    SET status = 'wartend', qualitaet = NULL, bewertung = NULL,
        signalScore = NULL, signalLabel = NULL,
        qualitaetFaktoren = NULL, bewertungFaktoren = NULL,
        fehler = NULL, berechnetAm = NULL
    WHERE laufId = ${laufId} AND status = 'berechnet'`);
  const kopf = Array.isArray(res) ? res[0] : res;
  return Number(kopf?.affectedRows ?? 0);
}

/** Wie viele berechnete Kandidaten tragen keine Faktor-Herleitung? */
export async function zaehleOhneHerleitung(laufId: number): Promise<number> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  const res: any = await db.execute(sql`
    SELECT COUNT(*) AS anzahl FROM screener_kandidat
    WHERE laufId = ${laufId} AND status = 'berechnet' AND qualitaetFaktoren IS NULL`);
  const liste = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
  return Number((liste as any[])[0]?.anzahl ?? 0);
}

/**
 * Verteilung der bereits berechneten Kandidaten je Börse — damit sichtbar ist,
 * ob ein einseitiges Zwischenbild («nur US») schlicht Rechenreihenfolge ist.
 */
export async function verteilungJeBoerse(laufId: number): Promise<Array<{ boerse: string; berechnet: number; wartend: number }>> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  const res: any = await db.execute(sql`
    SELECT boerse,
           SUM(CASE WHEN status = 'berechnet' THEN 1 ELSE 0 END) AS berechnet,
           SUM(CASE WHEN status = 'wartend' THEN 1 ELSE 0 END) AS wartend
    FROM screener_kandidat
    WHERE laufId = ${laufId}
    GROUP BY boerse
    ORDER BY berechnet DESC`);
  const liste = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
  return (liste as any[]).map((r) => ({
    boerse: String(r.boerse ?? "?"),
    berechnet: Number(r.berechnet ?? 0),
    wartend: Number(r.wartend ?? 0),
  }));
}

export interface AbdeckungJeBoerse {
  boerse: string;
  berechnet: number;
  mitQualitaet: number;
  mitBewertung: number;
  mitSignal: number;
}

/**
 * Score-Abdeckung der BERECHNETEN Kandidaten je Börse — der Frühwarn-KPI aus
 * den Prüfungen (KIMI Punkt 6, Manus Release-Gate 1): Der Lauf #150001 hatte
 * 63 % tote Zeilen, und niemand sah es, bis ein Mensch das Excel durchging.
 * Eine Börse mit 0 % Bewertungsabdeckung ist ein Datenpfad-Problem, kein
 * Marktbefund — das gehört auf die Karte, nicht in die Nachanalyse.
 */
export async function abdeckungJeBoerse(laufId: number): Promise<AbdeckungJeBoerse[]> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  const res: any = await db.execute(sql`
    SELECT boerse,
           COUNT(*) AS berechnet,
           SUM(CASE WHEN qualitaet IS NOT NULL THEN 1 ELSE 0 END) AS mitQualitaet,
           SUM(CASE WHEN bewertung IS NOT NULL THEN 1 ELSE 0 END) AS mitBewertung,
           SUM(CASE WHEN signalScore IS NOT NULL THEN 1 ELSE 0 END) AS mitSignal
    FROM screener_kandidat
    WHERE laufId = ${laufId} AND status IN ('berechnet', 'uebernommen', 'abgelehnt')
    GROUP BY boerse
    ORDER BY berechnet DESC`);
  const liste = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
  return (liste as any[]).map((r) => ({
    boerse: String(r.boerse ?? "?"),
    berechnet: Number(r.berechnet ?? 0),
    mitQualitaet: Number(r.mitQualitaet ?? 0),
    mitBewertung: Number(r.mitBewertung ?? 0),
    mitSignal: Number(r.mitSignal ?? 0),
  }));
}

export async function schreibeErgebnis(
  laufId: number,
  ticker: string,
  ergebnis: {
    status: "wartend" | "berechnet" | "fehler" | "zweitkotierung" | "ausgeschlossen";
    land?: string | null;
    waehrung?: string | null;
    primaerTicker?: string | null;
    isin?: string | null;
    qualitaet?: number | null;
    bewertung?: number | null;
    signalScore?: number | null;
    signalLabel?: string | null;
    qualitaetFaktoren?: unknown[] | null;
    bewertungFaktoren?: unknown[] | null;
    qualitaetNiveau?: number | null;
    qualitaetRichtung?: number | null;
    fScore?: number | null;
    fehler?: string;
    retryCount?: number;
    dividendenValidierung?: string | null;
    externeDividendenrendite?: number | null;
    dividendenPruefgrund?: string | null;
  },
): Promise<void> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  await db.execute(sql`
    UPDATE screener_kandidat
    SET status = ${ergebnis.status},
        land = COALESCE(${ergebnis.land ?? null}, land),
        waehrung = COALESCE(${ergebnis.waehrung ?? null}, waehrung),
        primaerTicker = COALESCE(${ergebnis.primaerTicker ?? null}, primaerTicker),
        isin = COALESCE(${ergebnis.isin ?? null}, isin),
        qualitaet = ${ergebnis.qualitaet ?? null},
        bewertung = ${ergebnis.bewertung ?? null},
        signalScore = ${ergebnis.signalScore ?? null},
        signalLabel = ${ergebnis.signalLabel ?? null},
        qualitaetFaktoren = ${ergebnis.qualitaetFaktoren ? JSON.stringify(ergebnis.qualitaetFaktoren) : null},
        bewertungFaktoren = ${ergebnis.bewertungFaktoren ? JSON.stringify(ergebnis.bewertungFaktoren) : null},
        qualitaetNiveau = ${ergebnis.qualitaetNiveau ?? null},
        qualitaetRichtung = ${ergebnis.qualitaetRichtung ?? null},
        fScore = ${ergebnis.fScore ?? null},
        fehler = ${ergebnis.fehler?.slice(0, 250) ?? null},
        retryCount = COALESCE(${ergebnis.retryCount ?? null}, retryCount),
        dividendenValidierung = ${ergebnis.dividendenValidierung ?? null},
        externeDividendenrendite = ${ergebnis.externeDividendenrendite ?? null},
        dividendenPruefgrund = ${ergebnis.dividendenPruefgrund?.slice(0, 250) ?? null},
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
  /** Aussortierte Zweitkotierungen (Hauptbörse liegt selbst im Universum). */
  zweitkotierungen: number;
  /** Kein Stammtitel an regulärer Börse: Vorzugsaktien, Fonds, OTC-Notizen. */
  ausgeschlossen: number;
  vorhanden: number;
  uebernommen: number;
  abgelehnt: number;
}

/** Ergebnis der Anzeigeauswahl: Ein fehlerhafter neuer Lauf darf die zuletzt
 * verfügbaren, bereits berechneten Kandidaten nicht aus dem Admin verdrängen. */
export interface AnzeigbarerLauf {
  lauf: LaufUebersicht | null;
  ausgeblendeterFehlerLauf: LaufUebersicht | null;
}

/** Menschlich lesbarer, vollständiger Grund für Export und Admin-Prüfung. */
export function screenerStatusGrund(status: string, fehler: string | null): string | null {
  if (fehler?.trim()) return fehler;
  if (status === "vorhanden") return "Bereits in der Watchlist";
  if (status === "wartend") return "Noch nicht berechnet";
  return null;
}

export function waehleAnzeigbarenLauf(
  neuesterLauf: LaufUebersicht | null,
  letzterLaufMitErgebnissen: LaufUebersicht | null,
): AnzeigbarerLauf {
  if (neuesterLauf?.status === "fehler" && letzterLaufMitErgebnissen) {
    return { lauf: letzterLaufMitErgebnissen, ausgeblendeterFehlerLauf: neuesterLauf };
  }
  return { lauf: neuesterLauf, ausgeblendeterFehlerLauf: null };
}

async function mappeLaufUebersicht(db: any, lauf: any): Promise<LaufUebersicht | null> {
  if (!lauf) return null;
  const { sql } = await import("drizzle-orm");
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
    zweitkotierungen: zaehler["zweitkotierung"] ?? 0,
    ausgeschlossen: zaehler["ausgeschlossen"] ?? 0,
    vorhanden: zaehler["vorhanden"] ?? 0,
    uebernommen: zaehler["uebernommen"] ?? 0,
    abgelehnt: zaehler["abgelehnt"] ?? 0,
  };
}

/** Jüngster Lauf mit Zählern je Status. */
export async function letzterLauf(): Promise<LaufUebersicht | null> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  const res: any = await db.execute(sql`SELECT * FROM screener_lauf ORDER BY id DESC LIMIT 1`);
  const liste = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
  return mappeLaufUebersicht(db, (liste as any[])[0]);
}

/** Letzter Lauf mit tatsächlich sichtbaren berechneten/entschiedenen Titeln. */
export async function letzterLaufMitErgebnissen(): Promise<LaufUebersicht | null> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  const res: any = await db.execute(sql`
    SELECT l.* FROM screener_lauf l
    WHERE EXISTS (
      SELECT 1 FROM screener_kandidat k
      WHERE k.laufId = l.id
        AND k.status IN ('berechnet', 'uebernommen', 'abgelehnt')
    )
    ORDER BY l.id DESC
    LIMIT 1`);
  const liste = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
  return mappeLaufUebersicht(db, (liste as any[])[0]);
}

/**
 * Beste berechnete Kandidaten eines Laufs — SEKTORWEISE ABWECHSELND (je
 * Sektor nach Signal-Score absteigend), gleiches Muster wie das börsenweise
 * Rechnen. Vorher strikt nach Signal-Score über alles: Die Spitze der Liste
 * war dann ein Klumpen des gerade günstigsten Sektors (Energie), und alles
 * andere kam nie ins Blickfeld. Die Scores selbst bleiben unangetastet —
 * nur die Reihenfolge der Anzeige mischt die Sektoren.
 */
export async function besteKandidaten(laufId: number, limit: number): Promise<ScreenerKandidat[]> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  // ACHTUNG: KEIN Fragezeichen irgendwo im SQL-TEXT — weder in Literalen noch
  // in SQL-Kommentaren. Der mysql2-Treiber ersetzt Platzhalter rein textuell
  // und quote-blind: Ein Fragezeichen im COALESCE-Literal frass den
  // laufId-Parameter (leere Screener-Karte, Befund 16.08.), und der zuerst als
  // SQL-Kommentar formulierte Warnhinweis enthielt selbst eines und
  // reproduzierte den Fehler gleich nochmal.
  const res: any = await db.execute(sql`
    SELECT * FROM (
      SELECT k.*, ROW_NUMBER() OVER (
        PARTITION BY COALESCE(sektor, '')
        ORDER BY (signalScore IS NULL), signalScore DESC, bewertung DESC
      ) AS rangJeSektor
      FROM screener_kandidat k
      WHERE laufId = ${laufId} AND status IN ('berechnet', 'uebernommen', 'abgelehnt')
    ) t
    ORDER BY rangJeSektor, (signalScore IS NULL), signalScore DESC, bewertung DESC
    LIMIT ${limit}`);
  const liste = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
  return (liste as any[]).map(mappeKandidat);
}

/**
 * ALLE Kandidaten eines Laufs für den Excel-Export — inklusive der
 * aussortierten (Zweitkotierung/ausgeschlossen/Fehler), damit die externe
 * Prüfung auch sieht, WAS aussortiert wurde und warum.
 */
export async function alleKandidaten(laufId: number): Promise<ScreenerKandidat[]> {
  const db = await dbOderFehler();
  const { sql } = await import("drizzle-orm");
  const res: any = await db.execute(sql`
    SELECT * FROM screener_kandidat
    WHERE laufId = ${laufId}
    ORDER BY (signalScore IS NULL), signalScore DESC, marktKap DESC`);
  const liste = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
  return (liste as any[]).map(mappeKandidat);
}

/** JSON-Spalten kommen je nach Treiber als Objekt oder Text zurück. */
function leseJson(v: unknown): unknown[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : null; } catch { return null; }
  }
  return null;
}

function mappeKandidat(r: any): ScreenerKandidat {
  return {
    laufId: Number(r.laufId),
    ticker: String(r.ticker),
    name: r.name ?? null,
    boerse: r.boerse ?? null,
    primaerTicker: r.primaerTicker ?? null,
    isin: r.isin ?? null,
    sektor: r.sektor ?? null,
    waehrung: r.waehrung ?? null,
    marktKap: zahl(r.marktKap),
    dividendenrendite: zahl(r.dividendenrendite),
    land: r.land ?? null,
    inWatchlist: Number(r.inWatchlist ?? 0),
    status: String(r.status),
    qualitaet: zahl(r.qualitaet),
    bewertung: zahl(r.bewertung),
    signalScore: zahl(r.signalScore),
    signalLabel: r.signalLabel ?? null,
    qualitaetFaktoren: leseJson(r.qualitaetFaktoren),
    bewertungFaktoren: leseJson(r.bewertungFaktoren),
    qualitaetNiveau: zahl(r.qualitaetNiveau),
    qualitaetRichtung: zahl(r.qualitaetRichtung),
    fScore: zahl(r.fScore),
    fehler: r.fehler ?? null,
    retryCount: Number(r.retryCount ?? 0),
    dividendenValidierung: r.dividendenValidierung ?? null,
    externeDividendenrendite: zahl(r.externeDividendenrendite),
    dividendenPruefgrund: r.dividendenPruefgrund ?? null,
  };
}
