/**
 * Migration: totalAmountCHF auf kanonische Semantik bringen (R-02).
 *
 * Kanonisch (siehe server/lib/transactionSemantics.ts):
 *   totalAmountCHF = BRUTTO-Handelswert in CHF, EXKL. Gebühren.
 *
 * Der manuelle Erfassungspfad (TransactionModal) hat historisch die Fees in
 * totalAmountCHF eingerechnet (Buy: brutto + fees, Sell: brutto − fees),
 * der CSV-Import und der Edit-Pfad dagegen nicht. Dieses Skript findet
 * Buy/Sell-Zeilen, deren totalAmountCHF dem Muster «brutto ± fees»
 * entspricht, und schreibt sie auf den reinen Bruttowert zurück.
 *
 * Erkennungslogik pro Zeile (nur buy/sell mit fees > 0):
 *   gross = shares × pricePerShare × fxRate   (fxRate fehlt → 1.0)
 *   - |totalAmountCHF| ≈ gross            → bereits kanonisch, unangetastet
 *   - |totalAmountCHF| ≈ gross + fees (buy) bzw. gross − fees (sell)
 *                                          → auf gross zurückschreiben
 *   - alles andere                         → als «ambiguous» geloggt, unangetastet
 *
 * Toleranz: CHF 0.05 (Rundung auf 2 Nachkommastellen im Schreibpfad).
 *
 * Ausführung:
 *   Dry-Run (Default, ändert NICHTS):  npx tsx scripts/migrate-fee-semantics.ts
 *   Wirklich schreiben:                npx tsx scripts/migrate-fee-semantics.ts --apply
 */
import { getDb } from "../server/db";
import { portfolioTransactions } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";

const TOLERANCE_CHF = 0.05;
const DRY_RUN = !process.argv.includes("--apply");

function num(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  console.log(`[migrate-fee-semantics] Mode: ${DRY_RUN ? "DRY-RUN (keine Änderungen)" : "APPLY"}`);

  const rows = await db
    .select()
    .from(portfolioTransactions)
    .where(inArray(portfolioTransactions.transactionType, ["buy", "sell"]));

  let alreadyCanonical = 0;
  let migrated = 0;
  let ambiguous = 0;
  let skipped = 0;

  for (const row of rows) {
    const shares = num(row.shares);
    const price = num(row.pricePerShare);
    const fees = num(row.fees) ?? 0;
    const totalCHF = num(row.totalAmountCHF);
    const fxRate = num(row.fxRate) ?? 1.0;

    // Ohne Stückzahl/Preis/CHF-Betrag oder ohne Fees ist nichts zu erkennen/ändern.
    if (shares == null || price == null || totalCHF == null || fees === 0) {
      skipped++;
      continue;
    }

    const gross = shares * price * fxRate;
    const absTotal = Math.abs(totalCHF);

    if (Math.abs(absTotal - gross) <= TOLERANCE_CHF) {
      alreadyCanonical++;
      continue;
    }

    // Manueller Pfad: Buy speicherte gross + fees, Sell gross − fees.
    const feeFolded =
      row.transactionType === "buy" ? gross + fees : gross - fees;

    if (Math.abs(absTotal - feeFolded) <= TOLERANCE_CHF) {
      const newValue = gross.toFixed(2);
      console.log(
        `[migrate] id=${row.id} ${row.transactionType} ${row.ticker ?? "?"} ` +
          `${row.transactionDate?.toISOString?.().split("T")[0] ?? row.transactionDate}: ` +
          `totalAmountCHF ${row.totalAmountCHF} -> ${newValue} (fees=${fees.toFixed(2)}, fx=${fxRate})`
      );
      if (!DRY_RUN) {
        await db
          .update(portfolioTransactions)
          .set({ totalAmountCHF: newValue })
          .where(eq(portfolioTransactions.id, row.id));
      }
      migrated++;
    } else {
      // Weder brutto noch brutto±fees — vermutlich R-15/R-12-Altlast (FX-Drift o. ä.).
      // Bewusst NICHT anfassen, nur ausweisen.
      console.log(
        `[ambiguous] id=${row.id} ${row.transactionType} ${row.ticker ?? "?"}: ` +
          `totalAmountCHF=${row.totalAmountCHF}, erwartet gross=${gross.toFixed(2)} ` +
          `oder feeFolded=${feeFolded.toFixed(2)} — unangetastet`
      );
      ambiguous++;
    }
  }

  console.log(
    `[migrate-fee-semantics] Fertig: ${rows.length} buy/sell-Zeilen geprüft, ` +
      `${alreadyCanonical} bereits kanonisch, ${migrated} ${DRY_RUN ? "würden migriert (Dry-Run)" : "migriert"}, ` +
      `${ambiguous} ambiguous (unangetastet), ${skipped} ohne Fees/Daten übersprungen.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate-fee-semantics] Fehler:", err);
  process.exit(1);
});
