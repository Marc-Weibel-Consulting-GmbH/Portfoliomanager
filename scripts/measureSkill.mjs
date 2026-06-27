/**
 * Schritt 0: Basisrate messen und echten Skill berechnen
 * Skill = OOS-hitRate − OOS-Basisrate
 * Basisrate = Anteil der positiven Forward-Returns im OOS-Testset
 */
import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = join(__dirname, "../.env");
let DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  try {
    const env = readFileSync(envPath, "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^DATABASE_URL=(.+)$/);
      if (m) DATABASE_URL = m[1].replace(/^["']|["']$/g, "");
    }
  } catch {}
}

if (!DATABASE_URL) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);

// Get all tickers with enough data
const [rows] = await conn.execute(`
  SELECT ticker, COUNT(*) as cnt
  FROM historicalPrices
  WHERE adjustedClose IS NOT NULL AND adjustedClose > 0
  GROUP BY ticker
  HAVING cnt >= 300
  ORDER BY cnt DESC
  LIMIT 40
`);

console.log(`\nUniverse: ${rows.length} tickers with ≥300 days of data`);

// For each ticker, fetch prices
const allPrices = {};
for (const row of rows) {
  const [prices] = await conn.execute(
    `SELECT date, adjustedClose FROM historicalPrices 
     WHERE ticker = ? AND adjustedClose > 0 
     ORDER BY date ASC`,
    [row.ticker]
  );
  if (prices.length >= 300) {
    allPrices[row.ticker] = prices.map((p) => parseFloat(p.adjustedClose));
  }
}

await conn.end();

console.log(`Loaded prices for ${Object.keys(allPrices).length} tickers`);

// Write Python evaluation script
const pyScript = `
import sys, json, numpy as np
from sklearn.ensemble import GradientBoostingClassifier

LOOKAHEAD = 20
TRAIN_WINDOW = 252
TEST_WINDOW = 63
EMBARGO = LOOKAHEAD  # Correct: embargo = lookahead days (not 5!)

def features_at(prices, i):
    if i < 60: return None
    w = prices[:i+1]
    px = w[-1]
    if px <= 0: return None
    ret_1d = w[-1]/w[-2] - 1
    ret_5d = w[-1]/w[-6] - 1
    ret_20d = w[-1]/w[-21] - 1
    mom_60d = w[-1]/w[-61] - 1 if len(w) > 61 else 0.0
    rets = np.diff(w[-21:]) / w[-21:-1]
    vol_20d = float(np.std(rets)) if len(rets) > 1 else 0.0
    deltas = np.diff(w[-(15+1):])
    gains = deltas[deltas > 0].sum() / 14
    losses = -deltas[deltas < 0].sum() / 14
    rsi = (100.0 - 100.0/(1.0 + gains/losses)) / 100.0 if losses > 0 else 1.0
    sma50 = float(np.mean(w[-50:]))
    px_vs_sma50 = px/sma50 - 1 if sma50 > 0 else 0.0
    return [ret_1d, ret_5d, ret_20d, mom_60d, vol_20d, rsi, px_vs_sma50]

def build_features_labels(prices):
    X, y = [], []
    n = len(prices)
    for i in range(60, n - LOOKAHEAD):
        f = features_at(prices, i)
        if f is None: continue
        fwd = prices[i + LOOKAHEAD] / prices[i] - 1
        X.append(f)
        y.append(1 if fwd > 0 else 0)
    return np.array(X, dtype=np.float64), np.array(y, dtype=np.int64)

# Load data
data = json.loads(sys.stdin.read())

# Build combined dataset
all_X, all_y = [], []
for ticker, prices in data.items():
    prices = np.array(prices, dtype=np.float64)
    X, y = build_features_labels(prices)
    all_X.append(X)
    all_y.append(y)

X = np.concatenate(all_X)
y = np.concatenate(all_y)
print(f"Total samples: {len(X)}", flush=True)

# Walk-forward with CORRECT embargo = lookahead
n = len(X)
oos_hits, oos_bases, is_hits = [], [], []
splits = []
start = 0
while start + TRAIN_WINDOW + TEST_WINDOW <= n:
    tr = (start, start + TRAIN_WINDOW)
    te = (start + TRAIN_WINDOW, start + TRAIN_WINDOW + TEST_WINDOW)
    splits.append((tr, te))
    start += TEST_WINDOW

print(f"Walk-forward splits: {len(splits)}", flush=True)

for i, ((a, b), (c, d)) in enumerate(splits):
    # Correct embargo: drop last EMBARGO rows from training
    b_purged = max(a + 10, b - EMBARGO)
    X_tr, y_tr = X[a:b_purged], y[a:b_purged]
    X_te, y_te = X[c:d], y[c:d]
    
    if len(np.unique(y_tr)) < 2 or len(y_te) == 0:
        continue
    
    model = GradientBoostingClassifier(
        n_estimators=80, max_depth=2, learning_rate=0.05,
        subsample=0.8, min_samples_leaf=20, random_state=42
    )
    model.fit(X_tr, y_tr)
    
    # IS accuracy
    is_pred = model.predict(X_tr)
    is_hits.append(float(np.mean(y_tr == is_pred)))
    
    # OOS accuracy
    oos_pred = model.predict(X_te)
    oos_hits.append(float(np.mean(y_te == oos_pred)))
    
    # BASE RATE: fraction of positive labels in OOS test set
    oos_bases.append(float(np.mean(y_te)))

if not oos_hits:
    print("ERROR: No valid splits")
    sys.exit(1)

oos_hr = float(np.mean(oos_hits))
is_hr = float(np.mean(is_hits))
base_rate = float(np.mean(oos_bases))

# True skill = OOS hitRate - base rate
# (base rate is what a naive "always predict majority class" achieves)
naive_skill = max(base_rate, 1.0 - base_rate)  # majority-class baseline
skill = oos_hr - naive_skill

# Overfit ratio using skill (not raw accuracy)
oos_skill = oos_hr - 0.5
is_skill = is_hr - 0.5
overfit_ratio = (is_skill / max(oos_skill, 1e-6)) if oos_skill > 0 else 99.0

print("\\n" + "="*60)
print("SCHRITT 0: MODELL-QUALITÄTSBEWERTUNG")
print("="*60)
print(f"Folds:           {len(oos_hits)}")
print(f"OOS HitRate:     {oos_hr*100:.2f}%")
print(f"IS  HitRate:     {is_hr*100:.2f}%")
print(f"Basisrate:       {base_rate*100:.2f}%  (Anteil pos. Returns im OOS-Set)")
print(f"Majority-Class:  {naive_skill*100:.2f}%  (naiver Baseline-Classifier)")
print(f"Echter Skill:    {skill*100:+.2f} pp  (OOS - Majority-Class)")
print(f"OverfitRatio:    {overfit_ratio:.2f}  (IS-Skill / OOS-Skill)")
print("="*60)
if skill >= 0.02:
    print(f"ERGEBNIS: ✅ MODELL HAT ECHTEN EDGE (Skill={skill*100:+.2f}pp >= +2pp)")
    if overfit_ratio < 1.6:
        print("         ✅ KEIN OVERFITTING (Ratio < 1.6)")
    else:
        print(f"         ⚠️  OVERFITTING MÖGLICH (Ratio={overfit_ratio:.2f} >= 1.6)")
elif skill > 0:
    print(f"ERGEBNIS: ⚠️  SCHWACHER EDGE (Skill={skill*100:+.2f}pp, Ziel: >= +2pp)")
else:
    print(f"ERGEBNIS: ❌ KEIN EDGE (Skill={skill*100:+.2f}pp <= 0)")
    print("         → Embargo auf 20 Tage korrigieren + neu messen")
print("="*60)
`;

// Write the Python script
import { writeFileSync } from "fs";
writeFileSync("/tmp/measure_skill.py", pyScript);

// Run with real data piped in
import { spawnSync } from "child_process";
const jsonData = JSON.stringify(allPrices);
writeFileSync("/tmp/price_data.json", jsonData);

console.log("\nRunning walk-forward evaluation (this takes ~60s)...\n");
const result = spawnSync(
  "python3",
  ["-c", `import sys, json; exec(open('/tmp/measure_skill.py').read())`],
  {
    input: jsonData,
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 10 * 1024 * 1024,
  }
);

if (result.error) {
  console.error("Error:", result.error);
} else {
  if (result.stdout) console.log(result.stdout);
  if (result.stderr) console.error("stderr:", result.stderr.slice(0, 500));
}
