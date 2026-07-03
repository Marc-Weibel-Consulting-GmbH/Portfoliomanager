/**
 * Backfill/Recompute realizedGains from the transaction ledger — R-03/R-19 fix.
 *
 * Corrected version of the legacy server/backfill-realized-gains.mjs, which
 * used the old (wrong) logic: cost basis averaged over ALL buys ever (prior
 * sells ignored, R-03) and the FIRST buy's date for the buy FX rate (R-19).
 *
 * New logic (mirrors the sell branch of createPortfolioTransaction in
 * server/db.ts after the R-03/R-19 fix):
 *   - Per (portfolioId, ticker): replay ALL buy+sell transactions
 *     chronologically (transactionDate, then id) with a running
 *     moving-average position.
 *   - Buy: totalShares += s, totalCost += s×price (local currency, fees
 *     excluded — R-24/E3 stays open), totalCostChf += s×price×buyFx where
 *     buyFx prefers the stored per-transaction fxRate and falls back to the
 *     historical rate at the buy date.
 *   - Sell: cost basis = totalCost/totalShares at that point; buy FX rate =
 *     cost-weighted average over the remaining position (totalCostChf /
 *     totalCost); then the position is reduced proportionally.
 *   - Oversell / no prior buys → basis 0 (R-20 stays open).
 *
 * Recomputes EVERY sell: existing realizedGains rows are compared and
 * (with --apply) updated; sells without a row get one inserted.
 *
 * Usage:
 *   npx tsx scripts/backfill-realized-gains.ts           # dry-run (default): logs old→new only
 *   npx tsx scripts/backfill-realized-gains.ts --apply   # actually writes changes
 */

import { drizzle } from "drizzle-orm/mysql2";
import { eq, or } from "drizzle-orm";
import { portfolioTransactions, realizedGains } from "../drizzle/schema";
import { getStockCurrency, getFxRate } from "../server/fxHelper";

const APPLY = process.argv.includes("--apply");

function num(v: string | null | undefined): number {
  const n = parseFloat(v || "0");
  return Number.isFinite(n) ? n : 0;
}

function dateStr(d: Date | string): string {
  return new Date(d).toISOString().split("T")[0];
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const db = drizzle(process.env.DATABASE_URL);

  console.log(`=== Recomputing realizedGains (R-03/R-19) — ${APPLY ? "APPLY" : "DRY-RUN"} ===\n`);

  const trades = await db
    .select()
    .from(portfolioTransactions)
    .where(
      or(
        eq(portfolioTransactions.transactionType, "buy"),
        eq(portfolioTransactions.transactionType, "sell")
      )
    );

  const existingRows = await db.select().from(realizedGains);
  const existingByTxId = new Map(existingRows.map((r) => [r.transactionId, r]));

  // Group by portfolio + ticker
  const groups = new Map<string, typeof trades>();
  for (const t of trades) {
    if (!t.ticker) continue;
    const key = `${t.portfolioId}::${t.ticker}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  let changed = 0;
  let unchanged = 0;
  let inserted = 0;

  for (const [key, rows] of groups) {
    const [portfolioIdStr, ticker] = key.split("::");
    const portfolioId = Number(portfolioIdStr);

    rows.sort(
      (a, b) =>
        new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime() ||
        a.id - b.id
    );
    if (!rows.some((r) => r.transactionType === "sell")) continue;

    const currency = await getStockCurrency(ticker);
    const currencyPair = currency === "CHF" ? "CHFCHF" : currency + "CHF";

    // Running moving-average position (local basis excl. fees, CHF-weighted parallel)
    let totalShares = 0;
    let totalCost = 0;
    let totalCostChf = 0;

    for (const tx of rows) {
      const shares = num(tx.shares);
      if (shares <= 0) continue;

      if (tx.transactionType === "buy") {
        const price = num(tx.pricePerShare);
        const storedFx = parseFloat(tx.fxRate || "");
        const buyFx =
          Number.isFinite(storedFx) && storedFx > 0
            ? storedFx
            : await getFxRate(dateStr(tx.transactionDate), currencyPair);
        totalShares += shares;
        totalCost += shares * price;
        totalCostChf += shares * price * buyFx;
        continue;
      }

      // Sell: compute realized gain at this point in the ledger
      const avgCostBasis = totalShares > 0 ? totalCost / totalShares : 0;
      const sellPrice = num(tx.pricePerShare);
      const sellFxRate = await getFxRate(dateStr(tx.transactionDate), currencyPair);
      const buyFxRate = totalCost > 0 ? totalCostChf / totalCost : sellFxRate;

      const stockGainLocal = (sellPrice - avgCostBasis) * shares;
      const avgCostBasisCHF = avgCostBasis * buyFxRate;
      const sellPriceCHF = sellPrice * sellFxRate;
      const totalGainCHF = (sellPriceCHF - avgCostBasisCHF) * shares;
      const stockGainCHF = stockGainLocal * sellFxRate;
      const fxGain = totalGainCHF - stockGainCHF;
      const realizedGainPercent =
        avgCostBasis > 0 ? ((sellPrice - avgCostBasis) / avgCostBasis) * 100 : 0;

      const newValues = {
        portfolioId,
        transactionId: tx.id,
        ticker,
        shares: tx.shares!,
        avgCostBasis: avgCostBasis.toFixed(2),
        sellPrice: sellPrice.toFixed(2),
        realizedGain: totalGainCHF.toFixed(2),
        realizedGainPercent: realizedGainPercent.toFixed(2),
        transactionDate: tx.transactionDate,
        stockGainLocal: stockGainLocal.toFixed(2),
        fxGain: fxGain.toFixed(2),
        currency,
        buyFxRate: buyFxRate.toFixed(4),
        sellFxRate: sellFxRate.toFixed(4),
      };

      const existing = existingByTxId.get(tx.id);
      if (!existing) {
        inserted++;
        console.log(
          `[MISSING] tx ${tx.id} ${ticker} (portfolio ${portfolioId}) ${dateStr(tx.transactionDate)}: ` +
            `no realizedGains row → NEW gain ${newValues.realizedGain} CHF ` +
            `(basis ${newValues.avgCostBasis}, buyFx ${newValues.buyFxRate}, fxGain ${newValues.fxGain})`
        );
        if (APPLY) await db.insert(realizedGains).values(newValues);
      } else {
        const fields = [
          "avgCostBasis",
          "realizedGain",
          "realizedGainPercent",
          "stockGainLocal",
          "fxGain",
          "buyFxRate",
          "sellFxRate",
          "currency",
        ] as const;
        const diffs = fields.filter((f) => (existing[f] ?? "") !== (newValues[f] ?? ""));
        if (diffs.length === 0) {
          unchanged++;
        } else {
          changed++;
          console.log(
            `[CHANGE] tx ${tx.id} ${ticker} (portfolio ${portfolioId}) ${dateStr(tx.transactionDate)}:`
          );
          for (const f of diffs) {
            console.log(`  ${f}: ${existing[f]} → ${newValues[f]}`);
          }
          if (APPLY) {
            await db.update(realizedGains).set(newValues).where(eq(realizedGains.id, existing.id));
          }
        }
      }

      // Reduce the position proportionally (avg cost stays constant across a
      // sell). Oversell clamps to zero — R-20 stays open.
      const factor = totalShares > 0 ? Math.max(0, (totalShares - shares) / totalShares) : 0;
      totalCost *= factor;
      totalCostChf *= factor;
      totalShares = Math.max(0, totalShares - shares);
    }
  }

  console.log(
    `\n=== Done (${APPLY ? "APPLIED" : "dry-run — nothing written"}): ` +
      `${changed} changed, ${inserted} missing/inserted, ${unchanged} unchanged ===`
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
