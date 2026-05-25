/**
 * Swissquote PDF Parser
 *
 * Clean-room implementation inspired by Portfolio Performance's SwissquotePDFExtractor.java
 * Supports: Buy, Sell, Dividend, Deposit, Withdrawal, Fee transactions
 *
 * Swissquote PDF formats:
 * - German: Börsentransaktion: Kauf / Verkauf
 * - English: Stock-Exchange Transaction: Buy / Sell
 * - Dividende / Dividends
 * - Einzahlung / Auszahlung
 * - Depotgebühr / Kontoführungsgebühr
 */

export type SwissquoteTransactionType =
  | 'BUY'
  | 'SELL'
  | 'DIVIDEND'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'FEE'
  | 'INTEREST'
  | 'UNKNOWN';

export interface ParsedSwissquoteTransaction {
  type: SwissquoteTransactionType;
  date: string | null;           // ISO date string YYYY-MM-DD
  ticker: string | null;         // Ticker symbol (if derivable)
  isin: string | null;
  securityName: string | null;
  shares: number | null;
  pricePerShare: number | null;
  priceCurrency: string | null;
  totalAmount: number;           // Always positive
  totalCurrency: string;
  fxRate: number | null;         // e.g. 0.8912 for USD/CHF
  fxCurrencyFrom: string | null; // e.g. 'USD'
  fxCurrencyTo: string | null;   // e.g. 'CHF'
  fees: number;                  // In totalCurrency
  taxes: number;                 // Verrechnungssteuer / withholding tax
  rawText: string;               // For debugging
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  warnings: string[];
}

export interface SwissquoteParseResult {
  transactions: ParsedSwissquoteTransaction[];
  parseErrors: string[];
  rawText: string;
  pageCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse Swiss-formatted numbers: 1'234.56 → 1234.56 */
function parseSwissNumber(s: string): number {
  return parseFloat(s.replace(/'/g, '').replace(/,/g, '.'));
}

/** Parse DD.MM.YYYY to YYYY-MM-DD */
function parseSwissDate(s: string): string | null {
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Extract ISIN from text */
function extractISIN(text: string): string | null {
  const m = text.match(/\b([A-Z]{2}[A-Z0-9]{9}[0-9])\b/);
  return m ? m[1] : null;
}

/** Derive ticker from ISIN + exchange info (best-effort) */
function deriveTickerFromLine(line: string): string | null {
  // Pattern: "APPLE ORD ISIN: US0378331005 NASDAQ New York"
  // Try to extract the first word(s) before ISIN as a ticker hint
  const m = line.match(/^([A-Z0-9.]+(?:\s+[A-Z0-9]+)?)\s+(?:ISIN:|ORD|N\s|AG\s|SA\s|SE\s)/i);
  if (m) return m[1].trim().split(/\s+/)[0];
  return null;
}

// ─── Transaction Block Splitter ───────────────────────────────────────────────

/**
 * Split full PDF text into individual transaction blocks.
 * Each block starts with a transaction type header.
 */
function splitIntoBlocks(text: string): string[] {
  const blockHeaders = [
    // German
    /(?:Börsen|Derivate)transaktion:\s*(?:Kauf|Verkauf)/,
    /^Kauf$/m,
    /^Verkauf$/m,
    /^Dividende$/m,
    /^Kapitalrückzahlung$/m,
    /^Coupon$/m,
    /^Einzahlung$/m,
    /^Auszahlung$/m,
    /^Depotgebühr$/m,
    /^Kontoführungsgebühr$/m,
    /^Zinsen$/m,
    // English
    /Stock-Exchange Transaction:\s*(?:Buy|Sell)/,
    /^Buy$/m,
    /^Sell$/m,
    /^Dividends$/m,
    /^Deposit$/m,
    /^Withdrawal$/m,
  ];

  // Build a combined pattern to find block start positions
  const combinedPattern = new RegExp(
    blockHeaders.map(r => r.source).join('|'),
    'gm'
  );

  const blocks: string[] = [];
  const matches: Array<{ index: number }> = [];

  let match;
  while ((match = combinedPattern.exec(text)) !== null) {
    matches.push({ index: match.index });
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    blocks.push(text.slice(start, end).trim());
  }

  // If no blocks found, treat entire text as one block
  if (blocks.length === 0 && text.trim().length > 0) {
    blocks.push(text.trim());
  }

  return blocks;
}

// ─── Block Parser ─────────────────────────────────────────────────────────────

function parseBlock(block: string): ParsedSwissquoteTransaction {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
  const warnings: string[] = [];

  let type: SwissquoteTransactionType = 'UNKNOWN';
  let date: string | null = null;
  let isin: string | null = null;
  let securityName: string | null = null;
  let ticker: string | null = null;
  let shares: number | null = null;
  let pricePerShare: number | null = null;
  let priceCurrency: string | null = null;
  let totalAmount = 0;
  let totalCurrency = 'CHF';
  let fxRate: number | null = null;
  let fxCurrencyFrom: string | null = null;
  let fxCurrencyTo: string | null = null;
  let fees = 0;
  let taxes = 0;
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

  // ── Step 1: Detect transaction type ──────────────────────────────────────
  const headerLine = lines[0] || '';
  const fullText = block;

  if (/(?:Börsen|Derivate)transaktion:\s*Kauf|^Kauf$|Stock-Exchange Transaction:\s*Buy|^Buy$/m.test(fullText)) {
    type = 'BUY';
  } else if (/(?:Börsen|Derivate)transaktion:\s*Verkauf|^Verkauf$|Stock-Exchange Transaction:\s*Sell|^Sell$/m.test(fullText)) {
    type = 'SELL';
  } else if (/^Dividende$|^Dividends$|Kapitalrückzahlung|^Coupon$/m.test(fullText)) {
    type = 'DIVIDEND';
  } else if (/^Einzahlung$|^Deposit$/m.test(fullText)) {
    type = 'DEPOSIT';
  } else if (/^Auszahlung$|^Withdrawal$/m.test(fullText)) {
    type = 'WITHDRAWAL';
  } else if (/Depotgebühr|Kontoführungsgebühr|Custody fee|Account fee/i.test(fullText)) {
    type = 'FEE';
  } else if (/^Zinsen$|^Interest$/m.test(fullText)) {
    type = 'INTEREST';
  }

  // ── Step 2: Extract security info (ISIN line) ─────────────────────────────
  for (const line of lines) {
    // Pattern: "APPLE ORD ISIN: US0378331005 NASDAQ New York"
    const isinMatch = line.match(/^(.+?)\s+ISIN:\s*([A-Z]{2}[A-Z0-9]{9}[0-9])\s*(.*)$/);
    if (isinMatch) {
      securityName = isinMatch[1].trim();
      isin = isinMatch[2];
      // Try to extract ticker from security name
      ticker = securityName.split(/\s+/)[0];
      break;
    }
  }

  // Fallback: look for bare ISIN
  if (!isin) {
    isin = extractISIN(block);
  }

  // ── Step 3: Extract shares + price line ──────────────────────────────────
  // Pattern: "15 193 USD 2'895.00"  (shares price currency total)
  // Pattern: "100 3.00 CHF 300.00"
  for (const line of lines) {
    const m = line.match(/^([\d'.,]+)\s+([\d'.,]+)\s+([A-Z]{3})\s+([\d'.,]+)$/);
    if (m) {
      shares = parseSwissNumber(m[1]);
      pricePerShare = parseSwissNumber(m[2]);
      priceCurrency = m[3];
      // m[4] is the line total (shares * price)
      break;
    }
  }

  // ── Step 4: Extract date ──────────────────────────────────────────────────
  // German: "Gemäss Ihrem Kaufauftrag vom 05.08.2019 haben wir..."
  // German: "Am 15.11.2024 haben wir folgende Transaktionen vorgenommen:"
  // English: "In accordance with your buy order of 06.02.2025..."
  const datePatterns = [
    /(?:Kaufauftrag|Verkaufsauftrag) vom (\d{2}\.\d{2}\.\d{4})/,
    /^Am (\d{2}\.\d{2}\.\d{4}) haben wir/m,
    /your (?:buy|sell) order of (\d{2}\.\d{2}\.\d{4})/,
    /Datum[:\s]+(\d{2}\.\d{2}\.\d{4})/i,
    /Date[:\s]+(\d{2}\.\d{2}\.\d{4})/i,
    /Valuta[:\s]+(\d{2}\.\d{2}\.\d{4})/i,
    // Fallback: first standalone date in block
    /\b(\d{2}\.\d{2}\.\d{4})\b/,
  ];

  for (const pattern of datePatterns) {
    const m = block.match(pattern);
    if (m) {
      date = parseSwissDate(m[1]);
      break;
    }
  }

  // ── Step 5: Extract total amount ─────────────────────────────────────────
  const totalPatterns = [
    // "Zu Ihren Lasten USD 2'900.60" (debit = buy)
    // "Zu Ihren Gunsten CHF 8'198.70" (credit = sell/dividend)
    /Zu Ihren (?:Lasten|Gunsten)\s+([A-Z]{3})\s+([\d'.,]+)/,
    /Total (?:gutgeschrieben|belastet)\s+([A-Z]{3})\s+([\d'.,]+)/,
    /To your (?:debit|credit)\s+([A-Z]{3})\s+([\d'.,]+)/,
    // "Total USD 1'285.61"
    /^Total\s+([A-Z]{3})\s+([\d'.,]+)$/m,
    // "Nettobetrag CHF 285.00"
    /Nettobetrag\s+([A-Z]{3})\s+([\d'.,]+)/,
    /Net amount\s+([A-Z]{3})\s+([\d'.,]+)/i,
  ];

  for (const pattern of totalPatterns) {
    const m = block.match(pattern);
    if (m) {
      totalCurrency = m[1];
      totalAmount = parseSwissNumber(m[2]);
      break;
    }
  }

  // ── Step 6: Extract FX rate ───────────────────────────────────────────────
  // "Wechselkurs USD/CHF 0.8912"
  // "Exchange rate USD/CHF 0.8912"
  const fxMatch = block.match(/(?:Wechselkurs|Exchange rate)\s+([A-Z]{3})\/([A-Z]{3})\s+([\d'.,]+)/i);
  if (fxMatch) {
    fxCurrencyFrom = fxMatch[1];
    fxCurrencyTo = fxMatch[2];
    fxRate = parseSwissNumber(fxMatch[3]);
  }

  // ── Step 7: Extract fees ─────────────────────────────────────────────────
  // "Courtage CHF 9.00"
  // "Börsenabgabe CHF 0.60"
  // "Transaktionsgebühr CHF 5.00"
  const feePatterns = [
    /Courtage\s+[A-Z]{3}\s+([\d'.,]+)/,
    /Börsenabgabe\s+[A-Z]{3}\s+([\d'.,]+)/,
    /Transaktionsgebühr\s+[A-Z]{3}\s+([\d'.,]+)/,
    /Brokerage fee\s+[A-Z]{3}\s+([\d'.,]+)/i,
    /Commission\s+[A-Z]{3}\s+([\d'.,]+)/i,
    /Stamp duty\s+[A-Z]{3}\s+([\d'.,]+)/i,
  ];

  for (const pattern of feePatterns) {
    const m = block.match(pattern);
    if (m) {
      fees += parseSwissNumber(m[1]);
    }
  }

  // ── Step 8: Extract withholding tax ──────────────────────────────────────
  // "Verrechnungssteuer CHF 35.00"
  // "Quellensteuer CHF 45.00"
  const taxPatterns = [
    /Verrechnungssteuer\s+[A-Z]{3}\s+([\d'.,]+)/,
    /Quellensteuer\s+[A-Z]{3}\s+([\d'.,]+)/,
    /Withholding tax\s+[A-Z]{3}\s+([\d'.,]+)/i,
    /Rückforderbare Quellensteuer\s+[A-Z]{3}\s+([\d'.,]+)/,
  ];

  for (const pattern of taxPatterns) {
    const m = block.match(pattern);
    if (m) {
      taxes += parseSwissNumber(m[1]);
    }
  }

  // ── Step 9: Validate and set confidence ──────────────────────────────────
  if (type === 'UNKNOWN') {
    warnings.push('Transaction type could not be determined');
    confidence = 'LOW';
  } else if (!date) {
    warnings.push('Transaction date could not be extracted');
    confidence = 'LOW';
  } else if (totalAmount === 0) {
    warnings.push('Total amount is zero or could not be extracted');
    confidence = 'LOW';
  } else if ((type === 'BUY' || type === 'SELL') && !isin) {
    warnings.push('ISIN could not be extracted for buy/sell transaction');
    confidence = 'MEDIUM';
  } else if ((type === 'BUY' || type === 'SELL') && !shares) {
    warnings.push('Share count could not be extracted');
    confidence = 'MEDIUM';
  } else {
    confidence = 'HIGH';
  }

  return {
    type,
    date,
    ticker,
    isin,
    securityName,
    shares,
    pricePerShare,
    priceCurrency,
    totalAmount,
    totalCurrency,
    fxRate,
    fxCurrencyFrom,
    fxCurrencyTo,
    fees,
    taxes,
    rawText: block,
    confidence,
    warnings,
  };
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

/**
 * Parse a Swissquote PDF buffer and extract all transactions.
 * Uses pdf-parse for text extraction, then applies regex patterns.
 */
export async function parseSwissquotePDF(pdfBuffer: Buffer): Promise<SwissquoteParseResult> {
  const parseErrors: string[] = [];
  let rawText = '';
  let pageCount = 0;

  try {
    // Dynamic import to avoid issues with pdf-parse's test file check
        const pdfParseModule = await import('pdf-parse');
        const pdfParse = (pdfParseModule as any).default || pdfParseModule;
        const data = await pdfParse(pdfBuffer, {
      // Disable test file check
      max: 0,
    });
    rawText = data.text;
    pageCount = data.numpages;
  } catch (err: any) {
    parseErrors.push(`PDF text extraction failed: ${err.message}`);
    return { transactions: [], parseErrors, rawText: '', pageCount: 0 };
  }

  // Validate it's a Swissquote document
  if (
    !rawText.includes('Swissquote') &&
    !rawText.includes('swissquote') &&
    !rawText.toLowerCase().includes('swissquote bank')
  ) {
    parseErrors.push('Document does not appear to be a Swissquote statement (missing "Swissquote" identifier)');
    return { transactions: [], parseErrors, rawText, pageCount };
  }

  // Split into transaction blocks and parse each
  const blocks = splitIntoBlocks(rawText);
  const transactions: ParsedSwissquoteTransaction[] = [];

  for (const block of blocks) {
    try {
      const tx = parseBlock(block);
      // Only include transactions with at least some data
      if (tx.type !== 'UNKNOWN' || tx.totalAmount > 0) {
        transactions.push(tx);
      }
    } catch (err: any) {
      parseErrors.push(`Failed to parse block: ${err.message}`);
    }
  }

  return { transactions, parseErrors, rawText, pageCount };
}

/**
 * Convert a ParsedSwissquoteTransaction to the format expected by the
 * portfolioTransactions.create endpoint.
 */
export function toPortfolioTransaction(
  tx: ParsedSwissquoteTransaction,
  portfolioId: number
): {
  portfolioId: number;
  type: string;
  ticker: string | null;
  isin: string | null;
  shares: number | null;
  pricePerShare: number | null;
  currency: string;
  totalAmountCHF: number;
  date: string;
  fees: number;
  notes: string;
} | null {
  if (!tx.date) return null;
  if (tx.type === 'UNKNOWN') return null;

  // Map our types to the app's transaction types
  const typeMap: Record<SwissquoteTransactionType, string> = {
    BUY: 'buy',
    SELL: 'sell',
    DIVIDEND: 'dividend',
    DEPOSIT: 'deposit',
    WITHDRAWAL: 'withdrawal',
    FEE: 'fee',
    INTEREST: 'interest',
    UNKNOWN: 'unknown',
  };

  // Convert total to CHF if needed
  let totalAmountCHF = tx.totalAmount;
  if (tx.totalCurrency !== 'CHF' && tx.fxRate && tx.fxCurrencyTo === 'CHF') {
    totalAmountCHF = tx.totalAmount * tx.fxRate;
  } else if (tx.totalCurrency !== 'CHF' && tx.fxRate && tx.fxCurrencyFrom === 'CHF') {
    totalAmountCHF = tx.totalAmount / tx.fxRate;
  }

  return {
    portfolioId,
    type: typeMap[tx.type],
    ticker: tx.ticker,
    isin: tx.isin,
    shares: tx.shares,
    pricePerShare: tx.pricePerShare,
    currency: tx.priceCurrency || tx.totalCurrency,
    totalAmountCHF,
    date: tx.date,
    fees: tx.fees,
    notes: `Swissquote Import${tx.securityName ? ` - ${tx.securityName}` : ''}${tx.warnings.length > 0 ? ` [${tx.warnings.join(', ')}]` : ''}`,
  };
}
