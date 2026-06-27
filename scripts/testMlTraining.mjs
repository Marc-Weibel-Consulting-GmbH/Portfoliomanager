/**
 * ML Training Test mit echten Daten aus der DB
 * Lädt historische Kurse aus der Datenbank und sendet sie an den Analytics Service
 */
import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";

const DB_URL = process.env.DATABASE_URL;
const ANALYTICS_URL = process.env.ANALYTICS_SERVICE_URL || "http://127.0.0.1:8001";

if (!DB_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function main() {
  console.log("=== ML Trainer Test mit echten Daten ===\n");
  
  // 1. Verbindung zur DB
  const conn = await createConnection(DB_URL);
  console.log("✓ DB-Verbindung hergestellt");

  // 2. Verfügbare Tickers mit genug Daten laden
  const [tickerRows] = await conn.execute(`
    SELECT ticker, COUNT(*) as cnt, MIN(date) as minDate, MAX(date) as maxDate
    FROM historical_prices
    GROUP BY ticker
    HAVING cnt >= 200
    ORDER BY cnt DESC
    LIMIT 30
  `);
  
  console.log(`\n✓ ${tickerRows.length} Tickers mit ≥200 Handelstagen gefunden:`);
  console.log("  Ticker | Datenpunkte | Von | Bis");
  console.log("  " + "-".repeat(60));
  tickerRows.forEach(r => {
    console.log(`  ${r.ticker.padEnd(12)} | ${String(r.cnt).padStart(4)} | ${r.minDate} | ${r.maxDate}`);
  });

  // 3. Preisreihen laden
  const seriesByTicker = {};
  let totalRows = 0;
  
  for (const row of tickerRows) {
    const [priceRows] = await conn.execute(`
      SELECT date, COALESCE(adjustedClose, close) as price
      FROM historical_prices
      WHERE ticker = ? AND COALESCE(adjustedClose, close) > 0
      ORDER BY date ASC
    `, [row.ticker]);
    
    if (priceRows.length >= 150) {
      seriesByTicker[row.ticker] = {
        dates: priceRows.map(r => r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date),
        prices: priceRows.map(r => parseFloat(r.price))
      };
      totalRows += priceRows.length;
    }
  }
  
  await conn.end();
  
  const universeSize = Object.keys(seriesByTicker).length;
  console.log(`\n✓ ${universeSize} Tickers mit ≥150 Datenpunkten für Training geladen`);
  console.log(`  Gesamt: ${totalRows.toLocaleString()} Preispunkte`);

  // 4. Analytics Service Health Check
  console.log(`\n✓ Analytics Service: ${ANALYTICS_URL}`);
  const healthRes = await fetch(`${ANALYTICS_URL}/health`);
  const health = await healthRes.json();
  console.log(`  Status: ${health.status} | Service: ${health.service} | Version: ${health.version}`);

  // 5. Training starten
  console.log(`\n=== Starte ML Training ===`);
  console.log(`  Modell: gb_signal (Gradient Boosting Classifier)`);
  console.log(`  Features: ret_1d, ret_5d, ret_20d, mom_60d, vol_20d, rsi_14, px_vs_sma50`);
  console.log(`  Lookahead: 20 Tage`);
  console.log(`  Promotion Gate: HitRate ≥52%, OverfitRatio ≤5.0, Alpha ≥1%`);
  console.log(`  Universe: ${universeSize} Aktien`);
  console.log(`  Walk-Forward: 5 Folds (expanding window)\n`);
  
  const startTime = Date.now();
  
  const trainRes = await fetch(`${ANALYTICS_URL}/analytics/train`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "gb_signal",
      seriesByTicker,
      lookahead: 20,
      minHitRate: 0.52,
      maxOverfitRatio: 5.0,
      minAlpha: 0.01
    })
  });
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  if (!trainRes.ok) {
    const err = await trainRes.text();
    console.error(`✗ Training fehlgeschlagen (HTTP ${trainRes.status}): ${err}`);
    process.exit(1);
  }
  
  const result = await trainRes.json();
  
  // 6. Ergebnisse ausgeben
  console.log(`=== Training abgeschlossen in ${elapsed}s ===\n`);
  console.log("📊 OOS Metriken (Out-of-Sample Walk-Forward):");
  console.log(`  HitRate:      ${(result.metrics.hitRate * 100).toFixed(2)}%  (Ziel: ≥52%)`);
  console.log(`  Alpha:        ${(result.metrics.alpha * 100).toFixed(2)}%   (Ziel: ≥1%)`);
  console.log(`  OverfitRatio: ${result.metrics.overfitRatio?.toFixed(3)}  (Ziel: ≤5.0)`);
  console.log(`  Folds:        ${result.metrics.folds}`);
  
  const gateStatus = result.passedGate ? "✅ BESTANDEN" : "❌ NICHT BESTANDEN";
  console.log(`\n🎯 Promotion Gate: ${gateStatus}`);
  
  if (result.notes?.length > 0) {
    console.log(`\n📝 Hinweise:`);
    result.notes.forEach(n => console.log(`  - ${n}`));
  }
  
  if (result.onnxBase64) {
    const onnxSize = Math.round(result.onnxBase64.length * 3 / 4 / 1024);
    console.log(`\n💾 ONNX Modell: ${onnxSize} KB`);
    console.log(`  Feature Spec (${result.featureSpec.features.length} Features):`);
    result.featureSpec.features.forEach(f => {
      console.log(`    ${f.name.padEnd(15)} mean=${f.mean.toFixed(4).padStart(9)}  std=${f.std.toFixed(4).padStart(8)}`);
    });
  } else {
    console.log(`\n⚠️  Kein ONNX Modell exportiert`);
  }
  
  // 7. Interpretation
  console.log("\n=== Interpretation ===");
  const hr = result.metrics.hitRate;
  if (hr >= 0.55) {
    console.log(`✅ Sehr gutes Modell: ${(hr*100).toFixed(1)}% HitRate - deutlich über Zufallsniveau`);
  } else if (hr >= 0.52) {
    console.log(`✅ Gutes Modell: ${(hr*100).toFixed(1)}% HitRate - statistisch signifikant über 50%`);
  } else if (hr >= 0.50) {
    console.log(`⚠️  Schwaches Modell: ${(hr*100).toFixed(1)}% HitRate - kaum über Zufallsniveau`);
  } else {
    console.log(`❌ Schlechtes Modell: ${(hr*100).toFixed(1)}% HitRate - unter Zufallsniveau`);
  }
  
  console.log(`\n✓ Test abgeschlossen`);
}

main().catch(e => {
  console.error("Fehler:", e.message);
  process.exit(1);
});
