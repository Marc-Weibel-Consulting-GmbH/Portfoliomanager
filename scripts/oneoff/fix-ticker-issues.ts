/**
 * One-off script to fix remaining ticker issues:
 * 1. ROG.SW → RO.SW (Roche Holding AG, EODHD uses RO.SW)
 * 2. HELN.SW → HBAN.SW (Helvetia Baloise, merged Dec 2025)
 * 3. MESA.US → deactivate (delisted Nov 2025, merged with Republic Airways)
 * 4. LVMUY → backfill historical prices
 * 5. RO.SW → backfill historical prices
 * 6. HBAN.SW → backfill historical prices (if not already present)
 *
 * Usage: npx tsx scripts/oneoff/fix-ticker-issues.ts [--apply]
 */

import mysql from "mysql2/promise";
import https from "https";

const DRY_RUN = !process.argv.includes("--apply");

async function fetchEODHD(ticker: string, from: string, to: string): Promise<Array<{date: string; close: number; adjusted_close: number}>> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) throw new Error("EODHD_API_KEY not set");
  
  // EODHD uses .US suffix for US stocks without exchange
  const eodhTicker = ticker.includes('.') ? ticker : `${ticker}.US`;
  const url = `https://eodhd.com/api/eod/${eodhTicker}?api_token=${apiKey}&fmt=json&from=${from}&to=${to}&period=d`;
  
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          if (Array.isArray(j)) resolve(j);
          else resolve([]);
        } catch(e) { reject(new Error(`Parse error for ${ticker}: ${data.substring(0,100)}`)); }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log(DRY_RUN ? "🔍 DRY RUN (use --apply to execute)" : "🚀 APPLYING CHANGES");
  
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  
  // ─── 1. Fix ROG.SW → RO.SW ───────────────────────────────────────────
  console.log("\n━━━ 1. ROG.SW → RO.SW (Roche) ━━━");
  const [rogRows] = await conn.execute("SELECT id, ticker, companyName FROM watchlistStocks WHERE ticker = 'ROG.SW'") as any;
  if (rogRows.length > 0) {
    console.log(`  Found: id=${rogRows[0].id} ticker=${rogRows[0].ticker} name=${rogRows[0].companyName}`);
    if (!DRY_RUN) {
      await conn.execute("UPDATE watchlistStocks SET ticker = 'RO.SW' WHERE ticker = 'ROG.SW'");
      console.log("  ✅ Updated ticker to RO.SW");
    } else {
      console.log("  → Would update ticker to RO.SW");
    }
  } else {
    console.log("  ℹ️ ROG.SW not found in watchlist (already fixed?)");
  }
  
  // ─── 2. Fix HELN.SW → HBAN.SW ────────────────────────────────────────
  console.log("\n━━━ 2. HELN.SW → HBAN.SW (Helvetia Baloise) ━━━");
  const [helnRows] = await conn.execute("SELECT id, ticker, companyName FROM watchlistStocks WHERE ticker = 'HELN.SW'") as any;
  if (helnRows.length > 0) {
    console.log(`  Found: id=${helnRows[0].id} ticker=${helnRows[0].ticker} name=${helnRows[0].companyName}`);
    // Check if HBAN.SW already exists
    const [hbanRows] = await conn.execute("SELECT id FROM watchlistStocks WHERE ticker = 'HBAN.SW'") as any;
    if (hbanRows.length > 0) {
      console.log("  ⚠️ HBAN.SW already exists — will delete HELN.SW duplicate");
      if (!DRY_RUN) {
        await conn.execute("DELETE FROM watchlistStocks WHERE ticker = 'HELN.SW'");
        console.log("  ✅ Deleted HELN.SW (duplicate)");
      }
    } else {
      if (!DRY_RUN) {
        await conn.execute("UPDATE watchlistStocks SET ticker = 'HBAN.SW', companyName = 'Helvetia Baloise Holding AG' WHERE ticker = 'HELN.SW'");
        console.log("  ✅ Updated ticker to HBAN.SW");
      } else {
        console.log("  → Would update ticker to HBAN.SW");
      }
    }
  } else {
    console.log("  ℹ️ HELN.SW not found in watchlist (already fixed?)");
  }
  
  // ─── 3. Deactivate MESA.US (delisted) ────────────────────────────────
  console.log("\n━━━ 3. MESA.US → deactivate (delisted Nov 2025) ━━━");
  const [mesaRows] = await conn.execute("SELECT id, ticker, companyName, isActive FROM watchlistStocks WHERE ticker = 'MESA.US'") as any;
  if (mesaRows.length > 0) {
    console.log(`  Found: id=${mesaRows[0].id} ticker=${mesaRows[0].ticker} active=${mesaRows[0].isActive}`);
    if (!DRY_RUN) {
      await conn.execute("UPDATE watchlistStocks SET isActive = 0, notes = 'Delisted Nov 2025 - merged with Republic Airways' WHERE ticker = 'MESA.US'");
      console.log("  ✅ Deactivated MESA.US");
    } else {
      console.log("  → Would deactivate MESA.US");
    }
  } else {
    console.log("  ℹ️ MESA.US not found in watchlist");
  }
  
  // ─── 4. Backfill historical prices ────────────────────────────────────
  console.log("\n━━━ 4. Backfill historical prices ━━━");
  const tickersToBackfill = ['LVMUY', 'RO.SW', 'HBAN.SW'];
  const from = '2026-01-01';
  const to = new Date().toISOString().split('T')[0];
  
  for (const ticker of tickersToBackfill) {
    console.log(`\n  📊 ${ticker}:`);
    
    // Check existing data
    const [existing] = await conn.execute(
      "SELECT COUNT(*) as cnt FROM historicalPrices WHERE ticker = ? AND date >= ?",
      [ticker, from]
    ) as any;
    const existingCount = existing[0].cnt;
    console.log(`    Existing records since ${from}: ${existingCount}`);
    
    if (existingCount >= 100) {
      console.log(`    ℹ️ Already has sufficient data, skipping`);
      continue;
    }
    
    // Fetch from EODHD
    const eodhTicker = ticker.includes('.') ? ticker : `${ticker}.US`;
    console.log(`    Fetching from EODHD (${eodhTicker})...`);
    const prices = await fetchEODHD(ticker, from, to);
    console.log(`    Got ${prices.length} records from EODHD`);
    
    if (prices.length === 0) {
      console.log(`    ⚠️ No data from EODHD for ${ticker}`);
      continue;
    }
    
    if (!DRY_RUN) {
      let inserted = 0;
      for (const p of prices) {
        try {
          await conn.execute(
            "INSERT IGNORE INTO historicalPrices (ticker, date, close, adjustedClose) VALUES (?, ?, ?, ?)",
            [ticker, p.date, p.close, p.adjusted_close || p.close]
          );
          inserted++;
        } catch (e: any) {
          // Skip duplicates
        }
      }
      console.log(`    ✅ Inserted ${inserted} price records`);
    } else {
      console.log(`    → Would insert ${prices.length} price records`);
    }
  }
  
  // ─── 5. Also update historicalPrices for ROG.SW → RO.SW ───────────────
  console.log("\n━━━ 5. Rename ROG.SW → RO.SW in historicalPrices ━━━");
  const [rogPrices] = await conn.execute("SELECT COUNT(*) as cnt FROM historicalPrices WHERE ticker = 'ROG.SW'") as any;
  console.log(`  ROG.SW records in historicalPrices: ${rogPrices[0].cnt}`);
  if (rogPrices[0].cnt > 0 && !DRY_RUN) {
    await conn.execute("UPDATE historicalPrices SET ticker = 'RO.SW' WHERE ticker = 'ROG.SW'");
    console.log("  ✅ Renamed ROG.SW → RO.SW in historicalPrices");
  } else if (rogPrices[0].cnt > 0) {
    console.log("  → Would rename ROG.SW → RO.SW in historicalPrices");
  }
  
  // ─── 6. Also update HELN.SW → HBAN.SW in historicalPrices ─────────────
  console.log("\n━━━ 6. Rename HELN.SW → HBAN.SW in historicalPrices ━━━");
  const [helnPrices] = await conn.execute("SELECT COUNT(*) as cnt FROM historicalPrices WHERE ticker = 'HELN.SW'") as any;
  console.log(`  HELN.SW records in historicalPrices: ${helnPrices[0].cnt}`);
  if (helnPrices[0].cnt > 0 && !DRY_RUN) {
    // Check if HBAN.SW already has data
    const [hbanPrices] = await conn.execute("SELECT COUNT(*) as cnt FROM historicalPrices WHERE ticker = 'HBAN.SW'") as any;
    if (hbanPrices[0].cnt > 0) {
      console.log(`  HBAN.SW already has ${hbanPrices[0].cnt} records — deleting HELN.SW duplicates`);
      await conn.execute("DELETE FROM historicalPrices WHERE ticker = 'HELN.SW'");
      console.log("  ✅ Deleted HELN.SW records from historicalPrices");
    } else {
      await conn.execute("UPDATE historicalPrices SET ticker = 'HBAN.SW' WHERE ticker = 'HELN.SW'");
      console.log("  ✅ Renamed HELN.SW → HBAN.SW in historicalPrices");
    }
  } else if (helnPrices[0].cnt > 0) {
    console.log("  → Would rename HELN.SW → HBAN.SW in historicalPrices");
  }
  
  // ─── 7. Also fix ROG.SW in stocks table ───────────────────────────────
  console.log("\n━━━ 7. Fix stocks table ━━━");
  const [rogStocks] = await conn.execute("SELECT ticker FROM stocks WHERE ticker = 'ROG.SW'") as any;
  if (rogStocks.length > 0) {
    if (!DRY_RUN) {
      await conn.execute("UPDATE stocks SET ticker = 'RO.SW' WHERE ticker = 'ROG.SW'");
      console.log("  ✅ Updated ROG.SW → RO.SW in stocks table");
    } else {
      console.log("  → Would update ROG.SW → RO.SW in stocks table");
    }
  }
  const [helnStocks] = await conn.execute("SELECT ticker FROM stocks WHERE ticker = 'HELN.SW'") as any;
  if (helnStocks.length > 0) {
    const [hbanStocks] = await conn.execute("SELECT ticker FROM stocks WHERE ticker = 'HBAN.SW'") as any;
    if (hbanStocks.length > 0) {
      if (!DRY_RUN) {
        await conn.execute("DELETE FROM stocks WHERE ticker = 'HELN.SW'");
        console.log("  ✅ Deleted HELN.SW from stocks (HBAN.SW already exists)");
      }
    } else {
      if (!DRY_RUN) {
        await conn.execute("UPDATE stocks SET ticker = 'HBAN.SW' WHERE ticker = 'HELN.SW'");
        console.log("  ✅ Updated HELN.SW → HBAN.SW in stocks table");
      }
    }
  }
  
  // ─── 8. Fix portfolioData in savedPortfolios ──────────────────────────
  console.log("\n━━━ 8. Fix portfolioData in savedPortfolios ━━━");
  const [portfolios] = await conn.execute("SELECT id, name, portfolioData FROM savedPortfolios WHERE portfolioData LIKE '%ROG.SW%'") as any;
  for (const p of portfolios) {
    const newData = p.portfolioData.replace(/ROG\.SW/g, 'RO.SW');
    if (!DRY_RUN) {
      await conn.execute("UPDATE savedPortfolios SET portfolioData = ? WHERE id = ?", [newData, p.id]);
      console.log(`  ✅ Fixed ROG.SW → RO.SW in portfolio "${p.name}" (id=${p.id})`);
    } else {
      console.log(`  → Would fix ROG.SW → RO.SW in portfolio "${p.name}" (id=${p.id})`);
    }
  }
  
  await conn.end();
  console.log("\n✅ Done!");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
