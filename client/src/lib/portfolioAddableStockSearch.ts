export interface PortfolioSearchStock {
  ticker?: string | null;
  companyName?: string | null;
  [key: string]: unknown;
}

/**
 * Trennt Suchtreffer im Positionsdialog bewusst in neue und bereits gehaltene
 * Titel. Doppelte Ticker würden den Cash-/Gewichtsvertrag verletzen; sie dürfen
 * deshalb nicht auswählbar sein, müssen dem Nutzer aber sichtbar erklärt werden.
 */
export function classifyPortfolioStockSearch<T extends PortfolioSearchStock>(input: {
  query: string;
  allStocks: T[] | undefined;
  portfolioTickers: string[];
}): { addable: T[]; alreadyIncluded: T[] } {
  const query = input.query.trim().toLocaleLowerCase("de-CH");
  if (query.length < 2 || !input.allStocks) return { addable: [], alreadyIncluded: [] };

  const heldTickers = new Set(input.portfolioTickers.map((ticker) => ticker.trim().toUpperCase()));
  const matches = input.allStocks.filter((stock) => {
    const ticker = String(stock.ticker ?? "").toLocaleLowerCase("de-CH");
    const companyName = String(stock.companyName ?? "").toLocaleLowerCase("de-CH");
    return ticker.includes(query) || companyName.includes(query);
  });

  return {
    addable: matches.filter((stock) => !heldTickers.has(String(stock.ticker ?? "").trim().toUpperCase())).slice(0, 10),
    alreadyIncluded: matches.filter((stock) => heldTickers.has(String(stock.ticker ?? "").trim().toUpperCase())).slice(0, 10),
  };
}
