/**
 * Einmaliger Import des Swissquote-Bestands als Live-Portfolio «Marc Swissquote».
 *
 * Datenlage: Der Bestand wurde aus der Swissquote-App abgelesen (Stückzahl,
 * aktueller Wert, Gesamt-Performance in %). Daraus abgeleitet:
 *
 *     aktueller Kurs = Wert / Stückzahl
 *     Einstandskurs  = aktueller Kurs / (1 + Performance/100)
 *
 * Was NICHT aus den Daten hervorgeht, ist das echte Kaufdatum. Es gibt pro
 * Position nur einen Durchschnittseinstand, keine Einzeltranchen. Das Skript
 * verlangt deshalb ein explizites --date und legt pro Position genau eine
 * Kauf-Transaktion zu diesem Datum an. Konsequenz: Kostenbasis und aktuelle
 * G/V stimmen, der zeitliche Verlauf VOR diesem Datum ist fiktiv.
 *
 * Aufruf (Dry-Run, schreibt nichts):
 *   DATABASE_URL=... npx tsx scripts/oneoff/import-swissquote-portfolio.ts \
 *     --email marc.weibel@weibel-mueller.ch --date 2026-01-02
 *
 * Schreiben:
 *   ... --email ... --date 2026-01-02 --commit
 */

import { drizzle } from "drizzle-orm/mysql2";
import { and, eq } from "drizzle-orm";
import {
  savedPortfolios,
  portfolioTransactions,
  exchangeRates,
  stocks,
  users,
} from "../../drizzle/schema";

const PORTFOLIO_NAME = "Marc Swissquote";

type Row = {
  ticker: string;
  name: string;
  shares: number;
  value: number;
  currency: "USD" | "CHF" | "EUR";
  perfPct: number;
};

/** Bestand laut Swissquote-App (Screenshots vom 2026-07-25, 21:08–21:09). */
const POSITIONS: Row[] = [
  { ticker: "NVDA", name: "NVIDIA", shares: 70, value: 14478.8, currency: "USD", perfPct: 66.76 },
  { ticker: "CRDO", name: "Credo Technology", shares: 20, value: 4263.0, currency: "USD", perfPct: 63.95 },
  { ticker: "HOOD", name: "Robinhood Markets", shares: 55, value: 5220.05, currency: "USD", perfPct: 15.07 },
  { ticker: "NOW", name: "ServiceNow", shares: 32.546, value: 3214.89, currency: "USD", perfPct: 8.72 },
  { ticker: "DLO", name: "DLocal", shares: 150, value: 2173.5, currency: "USD", perfPct: 8.22 },
  { ticker: "AMZN", name: "Amazon.com", shares: 30.744, value: 7135.99, currency: "USD", perfPct: 3.21 },
  { ticker: "APP", name: "AppLovin", shares: 7, value: 2743.86, currency: "USD", perfPct: 0.84 },
  { ticker: "EOSER", name: "Eos Energy (Rights)", shares: 250, value: 1.63, currency: "USD", perfPct: 0.0 },
  { ticker: "RDDT", name: "Reddit", shares: 29.8232, value: 5032.07, currency: "USD", perfPct: -2.48 },
  { ticker: "MSFT", name: "Microsoft", shares: 20, value: 7634.0, currency: "USD", perfPct: -3.0 },
  { ticker: "ZETA", name: "Zeta Global", shares: 220, value: 4208.6, currency: "USD", perfPct: -3.41 },
  { ticker: "AMD", name: "Advanced Micro Devices", shares: 1.3715, value: 715.85, currency: "USD", perfPct: -3.52 },
  { ticker: "TSLA", name: "Tesla", shares: 37.7922, value: 11830.09, currency: "USD", perfPct: -4.31 },
  { ticker: "PLTR", name: "Palantir Technologies", shares: 30.8965, value: 3797.8, currency: "USD", perfPct: -5.35 },
  { ticker: "DUOL", name: "Duolingo", shares: 50, value: 6112.0, currency: "USD", perfPct: -5.58 },
  { ticker: "AVGO", name: "Broadcom", shares: 10, value: 3819.2, currency: "USD", perfPct: -6.7 },
  { ticker: "META", name: "Meta Platforms", shares: 9.8139, value: 5841.14, currency: "USD", perfPct: -7.17 },
  { ticker: "MU", name: "Micron Technology", shares: 2.9834, value: 2747.56, currency: "USD", perfPct: -11.93 },
  { ticker: "MRVL", name: "Marvell Technology", shares: 10, value: 1942.3, currency: "USD", perfPct: -20.5 },
  { ticker: "ARM", name: "Arm Holdings", shares: 3.6994, value: 961.88, currency: "USD", perfPct: -30.07 },
  { ticker: "IREN", name: "IREN Ltd", shares: 110, value: 4077.7, currency: "USD", perfPct: -35.73 },
  { ticker: "MSTR", name: "Strategy (MicroStrategy)", shares: 170, value: 15583.9, currency: "USD", perfPct: -72.02 },
  { ticker: "EOSE", name: "Eos Energy Enterprises", shares: 250, value: 867.5, currency: "USD", perfPct: -76.25 },
  { ticker: "SOL", name: "Solana", shares: 230.43968369, value: 14066.37, currency: "CHF", perfPct: -52.67 },
];

/**
 * Drei EUR-Papiere aus der Swissquote-Liste werden bewusst NICHT importiert:
 * «AMERIA I 19PREF» (7), «AMERIA I 19» (7) und «COMTRSERXVII DRC BR» (10'000)
 * stehen dort mit 0.00 EUR und 0.00 %. Sie haben keinen handelbaren Ticker und
 * keinen Kurs — ein Import mit Preis 0 würde nur eine Karteileiche erzeugen.
 */
const SKIPPED = ["AMERIA I 19PREF", "AMERIA I 19", "COMTRSERXVII DRC BR"];

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("--email");
  const date = arg("--date");
  const commit = process.argv.includes("--commit");

  if (!email || !date) {
    console.error("Aufruf: --email <adresse> --date <YYYY-MM-DD> [--commit]");
    process.exit(1);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(`Ungültiges Datum: ${date} (erwartet YYYY-MM-DD)`);
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL fehlt.");
    process.exit(1);
  }

  const db = drizzle(process.env.DATABASE_URL);

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) throw new Error(`Kein Nutzer mit E-Mail ${email}`);

  const existing = await db
    .select({ id: savedPortfolios.id })
    .from(savedPortfolios)
    .where(and(eq(savedPortfolios.userId, user.id), eq(savedPortfolios.name, PORTFOLIO_NAME)));
  if (existing.length > 0) {
    throw new Error(
      `Portfolio «${PORTFOLIO_NAME}» existiert bereits (id=${existing[0].id}). ` +
        `Vor einem erneuten Lauf löschen — das Skript legt bewusst kein Duplikat an.`,
    );
  }

  // USD/CHF-Kurs zum Kaufdatum. Kein Fallback auf 1.0 (siehe R-10): ohne Kurs
  // wird abgebrochen, statt einen falschen CHF-Wert zu persistieren.
  const [fxRow] = await db
    .select()
    .from(exchangeRates)
    .where(and(eq(exchangeRates.date, date), eq(exchangeRates.currencyPair, "USDCHF")));
  if (!fxRow) throw new Error(`Kein USD/CHF-Kurs für ${date} in exchangeRates.`);
  const usdChf = parseFloat(fxRow.rate);

  console.log(`Nutzer: ${user.email} (id=${user.id})`);
  console.log(`Kaufdatum: ${date} | USD/CHF: ${usdChf}\n`);

  const planned = [];
  const unknownTickers: string[] = [];

  for (const p of POSITIONS) {
    const price = p.value / p.shares;
    const avgBuy = price / (1 + p.perfPct / 100);
    const fx = p.currency === "CHF" ? 1 : usdChf;
    const totalAmount = avgBuy * p.shares;

    const [dbStock] = await db.select({ ticker: stocks.ticker }).from(stocks).where(eq(stocks.ticker, p.ticker));
    if (!dbStock) unknownTickers.push(p.ticker);

    planned.push({
      ...p,
      price,
      avgBuy,
      fx,
      totalAmount,
      totalAmountCHF: totalAmount * fx,
      currentValueCHF: p.value * fx,
      known: !!dbStock,
    });
  }

  const totalCostCHF = planned.reduce((s, p) => s + p.totalAmountCHF, 0);
  const totalValueCHF = planned.reduce((s, p) => s + p.currentValueCHF, 0);

  for (const p of planned) {
    console.log(
      `${p.known ? " " : "!"} ${p.ticker.padEnd(6)} ${p.shares.toFixed(4).padStart(13)} ` +
        `@ ${p.avgBuy.toFixed(2).padStart(9)} ${p.currency}  =  ` +
        `${p.totalAmountCHF.toFixed(2).padStart(11)} CHF Einsatz`,
    );
  }

  console.log(`\nEinsatz total:  ${totalCostCHF.toFixed(2)} CHF`);
  console.log(`Wert aktuell:   ${totalValueCHF.toFixed(2)} CHF`);
  console.log(`G/V:            ${(totalValueCHF - totalCostCHF).toFixed(2)} CHF ` +
    `(${(((totalValueCHF / totalCostCHF) - 1) * 100).toFixed(2)} %)`);
  console.log(`\nNicht importiert (kein Kurs, 0.00 EUR): ${SKIPPED.join(", ")}`);

  if (unknownTickers.length > 0) {
    console.log(
      `\nACHTUNG — diese Ticker fehlen in der stocks-Tabelle und werden in der\n` +
        `App nicht angezeigt (getHoldingsWithChfPerformance überspringt sie):\n` +
        `  ${unknownTickers.join(", ")}\n` +
        `Erst über die Aktien-Verwaltung anlegen, dann dieses Skript laufen lassen.`,
    );
  }

  if (!commit) {
    console.log("\n— Dry-Run, nichts geschrieben. Mit --commit ausführen. —");
    process.exit(0);
  }

  const portfolioData = JSON.stringify({
    stocks: planned.map((p) => ({
      ticker: p.ticker,
      companyName: p.name,
      weight: ((p.currentValueCHF / totalValueCHF) * 100).toFixed(2),
      shares: p.shares.toString(),
      currentPrice: p.price.toFixed(4),
      avgBuyPrice: p.avgBuy.toFixed(4),
      totalValue: p.currentValueCHF.toFixed(2),
      currency: p.currency,
    })),
  });

  await db.insert(savedPortfolios).values({
    userId: user.id,
    name: PORTFOLIO_NAME,
    description: `Bestand Swissquote, erfasst per ${date}`,
    portfolioData,
    portfolioType: "live",
    status: "live",
    investmentAmount: totalCostCHF.toFixed(2),
    startCapital: totalCostCHF.toFixed(2),
    isLive: 1,
    liveStartDate: new Date(`${date}T00:00:00Z`),
    inceptionDate: new Date(`${date}T00:00:00Z`),
  });

  const [created] = await db
    .select({ id: savedPortfolios.id })
    .from(savedPortfolios)
    .where(and(eq(savedPortfolios.userId, user.id), eq(savedPortfolios.name, PORTFOLIO_NAME)));

  for (const p of planned) {
    await db.insert(portfolioTransactions).values({
      portfolioId: created.id,
      transactionType: "buy",
      ticker: p.ticker,
      shares: p.shares.toString(),
      pricePerShare: p.avgBuy.toFixed(4),
      currency: p.currency,
      totalAmount: p.totalAmount.toFixed(2),
      fxRate: p.fx.toFixed(4),
      totalAmountCHF: p.totalAmountCHF.toFixed(2),
      fees: "0",
      notes: `Swissquote-Bestand, Einstand aus Gesamtperformance ${p.perfPct} % abgeleitet`,
      source: "import",
      transactionDate: new Date(`${date}T00:00:00Z`),
    });
  }

  console.log(`\nPortfolio «${PORTFOLIO_NAME}» angelegt (id=${created.id}) mit ${planned.length} Kauf-Transaktionen.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
