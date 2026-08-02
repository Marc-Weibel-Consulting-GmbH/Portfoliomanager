/**
 * Zusatzangaben zur Wirkungsmessung eines Vorschlags.
 *
 * `portfolioProposalLog` hält Brutto-Rendite, Benchmark und Alpha. Drei Dinge
 * fehlen dort, und alle drei entscheiden, wie eine Alpha-Zahl zu lesen ist:
 *
 *  - WELCHER MASSSTAB galt. Seit dem Klassen-Composite kann das entweder das
 *    passiv umgesetzte Anlegerprofil sein oder — bei zu geringer Abdeckung —
 *    der Rückfall auf den Aktienindex. Ohne diese Angabe stünden zwei
 *    verschiedene Messungen ununterscheidbar nebeneinander.
 *  - WIE VIEL davon abgedeckt war.
 *  - WAS DER AUFBAU GEKOSTET HÄTTE, und was nach Abzug übrig bleibt.
 *
 * Eigene Tabelle statt neuer Spalten: Der manus-Deploy führt
 * `drizzle-kit migrate` nicht aus. Sie legt sich selbst an — dasselbe Muster
 * wie `combined_score_history` und `regime_blend_shadow`.
 *
 * Die Bruttowerte in `portfolioProposalLog` bleiben unberührt. Die Nettozahl
 * steht daneben, weil die Kostensätze Annahmen sind und keine Abrechnung.
 */

let tabelleGeprueft = false;

async function stelleTabelleSicher(db: any): Promise<void> {
  if (tabelleGeprueft) return;
  const { sql } = await import("drizzle-orm");
  await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS \`proposal_outcome_detail\` (
    \`proposalId\` int NOT NULL,
    \`benchmarkArt\` varchar(32),
    \`klassenAbdeckungPct\` decimal(6,2),
    \`kostenEinmaligPct\` decimal(8,4),
    \`kostenLaufendPct\` decimal(8,4),
    \`kostenGesamtPct\` decimal(8,4),
    \`nettoReturnPct\` decimal(9,4),
    \`nettoAlphaPct\` decimal(9,4),
    \`erfasstAm\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`proposal_outcome_detail_pk\` PRIMARY KEY(\`proposalId\`)
  )`));
  tabelleGeprueft = true;
}

export interface WirkungsDetail {
  proposalId: number;
  /** «profil-composite» oder «aktienindex» — siehe klassenBenchmark.ts. */
  benchmarkArt: string;
  klassenAbdeckungPct: number | null;
  kostenEinmaligPct: number | null;
  kostenLaufendPct: number | null;
  kostenGesamtPct: number | null;
  nettoReturnPct: number | null;
  nettoAlphaPct: number | null;
}

/** Non-fatal: Schlägt es fehl, bleibt die Bruttomessung unberührt bestehen. */
export async function haltefestWirkung(detail: WirkungsDetail): Promise<boolean> {
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return false;
    await stelleTabelleSicher(db);

    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      INSERT INTO proposal_outcome_detail
        (proposalId, benchmarkArt, klassenAbdeckungPct, kostenEinmaligPct,
         kostenLaufendPct, kostenGesamtPct, nettoReturnPct, nettoAlphaPct)
      VALUES
        (${detail.proposalId}, ${detail.benchmarkArt}, ${detail.klassenAbdeckungPct},
         ${detail.kostenEinmaligPct}, ${detail.kostenLaufendPct}, ${detail.kostenGesamtPct},
         ${detail.nettoReturnPct}, ${detail.nettoAlphaPct})
      ON DUPLICATE KEY UPDATE
        benchmarkArt = VALUES(benchmarkArt),
        klassenAbdeckungPct = VALUES(klassenAbdeckungPct),
        kostenEinmaligPct = VALUES(kostenEinmaligPct),
        kostenLaufendPct = VALUES(kostenLaufendPct),
        kostenGesamtPct = VALUES(kostenGesamtPct),
        nettoReturnPct = VALUES(nettoReturnPct),
        nettoAlphaPct = VALUES(nettoAlphaPct)
    `);
    return true;
  } catch (e) {
    console.warn("[vorschlagWirkung] Detail nicht abgelegt (non-fatal):", (e as Error).message);
    return false;
  }
}

export interface WirkungsBilanz {
  /** Anzahl Vorschläge mit Detailangaben. */
  erfasst: number;
  /** Wie viele gegen das Profil-Composite gemessen wurden. */
  mitComposite: number;
  /** Wie viele auf den Aktienindex zurückfallen mussten. */
  mitRueckfall: number;
  /** Ø modellierte Kosten in Prozent. */
  avgKostenPct: number | null;
  /** Ø Alpha vor und nach Kosten — die Differenz IST der Kostenblock. */
  avgBruttoAlphaPct: number | null;
  avgNettoAlphaPct: number | null;
}

/**
 * Stand der Netto-Messung.
 *
 * Liefert Brutto und Netto nebeneinander. Wer die Kostenannahmen nicht teilt,
 * liest die Bruttospalte — deshalb steht sie weiterhin da.
 */
export async function wirkungsBilanz(): Promise<WirkungsBilanz> {
  const leer: WirkungsBilanz = {
    erfasst: 0, mitComposite: 0, mitRueckfall: 0,
    avgKostenPct: null, avgBruttoAlphaPct: null, avgNettoAlphaPct: null,
  };
  try {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (!db) return leer;
    await stelleTabelleSicher(db);

    const { sql } = await import("drizzle-orm");
    const res: any = await db.execute(sql`
      SELECT d.benchmarkArt, d.kostenGesamtPct, d.nettoAlphaPct, p.realizedAlpha30dPct
      FROM proposal_outcome_detail d
      JOIN portfolioProposalLog p ON p.id = d.proposalId
    `);
    const rows: any[] = Array.isArray(res) ? (res[0] ?? res) : (res?.rows ?? []);
    if (!rows.length) return leer;

    const zahl = (v: any) => (v == null ? null : parseFloat(String(v)));
    const mittel = (werte: (number | null)[]) => {
      const g = werte.filter((v): v is number => v !== null && Number.isFinite(v));
      return g.length ? parseFloat((g.reduce((s, v) => s + v, 0) / g.length).toFixed(3)) : null;
    };

    return {
      erfasst: rows.length,
      mitComposite: rows.filter((r) => r.benchmarkArt === "profil-composite").length,
      mitRueckfall: rows.filter((r) => r.benchmarkArt === "aktienindex").length,
      avgKostenPct: mittel(rows.map((r) => zahl(r.kostenGesamtPct))),
      avgBruttoAlphaPct: mittel(rows.map((r) => zahl(r.realizedAlpha30dPct))),
      avgNettoAlphaPct: mittel(rows.map((r) => zahl(r.nettoAlphaPct))),
    };
  } catch (e) {
    console.warn("[vorschlagWirkung] Bilanz fehlgeschlagen (non-fatal):", (e as Error).message);
    return leer;
  }
}
