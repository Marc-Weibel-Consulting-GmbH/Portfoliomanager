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

// ─── Depotauszug (Portfolio Snapshot) Parser ─────────────────────────────────

export interface DepotauszugPosition {
  name: string;
  isin: string | null;
  currency: string;
  quantity: number;
  avgPurchasePrice: number | null;  // Durchschnittspreis
  marketPrice: number | null;       // Marktpreis
  marketValueCHF: number | null;    // Bewertung in CHF
  assetType: 'stock' | 'crypto' | 'cash';
}

export interface DepotauszugParseResult {
  positions: DepotauszugPosition[];
  parseErrors: string[];
  rawText: string;
  pageCount: number;
  reportDate: string | null;        // YYYY-MM-DD
  accountHolder: string | null;
  totalValueCHF: number | null;
}

/**
 * Parse a Swissquote Depotauszug (portfolio snapshot) PDF.
 * Extracts current positions (stocks + crypto) with quantity and average purchase price.
 */
export async function parseSwissquoteDepotauszug(pdfBuffer: Buffer): Promise<DepotauszugParseResult> {
  const parseErrors: string[] = [];
  let rawText = '';
  let pageCount = 0;

  try {
    // Use pdf-parse (pure Node.js, no system binary required — works in all environments)
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = (pdfParseModule as any).default || pdfParseModule;
    const data = await pdfParse(pdfBuffer, { max: 0 });
    rawText = data.text;
    pageCount = data.numpages;
  } catch (err: any) {
    parseErrors.push(`PDF text extraction failed: ${err.message}`);
    return { positions: [], parseErrors, rawText: '', pageCount: 0, reportDate: null, accountHolder: null, totalValueCHF: null };
  }

  // Debug: log the raw text around the Aktien section
  const aktienDebugIdx = rawText.indexOf('Aktien');
  if (aktienDebugIdx >= 0) {
    console.log('[Depot DEBUG] Aktien section preview (pdf-parse):', JSON.stringify(rawText.slice(aktienDebugIdx, aktienDebugIdx + 600)));
  } else {
    console.log('[Depot DEBUG] No Aktien found in pdf-parse output. First 500 chars:', JSON.stringify(rawText.slice(0, 500)));
  }

  if (!rawText.toLowerCase().includes('swissquote')) {
    parseErrors.push('Document does not appear to be a Swissquote statement');
    return { positions: [], parseErrors, rawText, pageCount, reportDate: null, accountHolder: null, totalValueCHF: null };
  }

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  // ── Extract report date ──────────────────────────────────────────────────
  let reportDate: string | null = null;
  const dateMatch = rawText.match(/Portfolio-Performance zum (\d{2}\.\d{2}\.\d{4})/);
  if (dateMatch) reportDate = parseSwissDate(dateMatch[1]);

  // ── Extract account holder ───────────────────────────────────────────────
  let accountHolder: string | null = null;
  const holderMatch = rawText.match(/Portfolio-Performance zum \d{2}\.\d{2}\.\d{4} - (?:Herrn|Frau|Mr\.|Mrs\.) (.+?)(?:\n|$)/);
  if (holderMatch) accountHolder = holderMatch[1].trim();

  // ── Extract total portfolio value ────────────────────────────────────────
  let totalValueCHF: number | null = null;
  const totalMatch = rawText.match(/Totalwert Portfolio[\s\S]{0,50}?([\d']+\.\d{2})\s*CHF/);
  if (totalMatch) totalValueCHF = parseSwissNumber(totalMatch[1]);

  const positions: DepotauszugPosition[] = [];

  // ── Parse Kryptowährung section ──────────────────────────────────────────
  // Format: Symbol  Beschreibung  Anzahl  Kurs  Bewertung in CHF  %
  // e.g.: "RND  Render  300.000000  6.633676  1'990.10  2.21"
  const cryptoSectionMatch = rawText.match(/Kryptow[äa]hrung\s*\n([\s\S]*?)(?=Aktien|Swissquote Bank AG|$)/);
  if (cryptoSectionMatch) {
    const cryptoText = cryptoSectionMatch[1];
    // Each crypto line: SYMBOL  Name  Quantity  Price  ValueCHF  %
    const cryptoLineRe = /^\s*([A-Z]{2,10})\s+(.+?)\s+([\d'.,]+)\s+([\d'.,]+)\s+([\d'.,]+)\s+[\d.,]+\s*$/gm;
    let m;
    while ((m = cryptoLineRe.exec(cryptoText)) !== null) {
      const symbol = m[1].trim();
      const name = m[2].trim();
      const qty = parseSwissNumber(m[3]);
      const price = parseSwissNumber(m[4]);
      const valueCHF = parseSwissNumber(m[5]);
      if (qty > 0 && name && !name.includes('Kryptow')) {
        positions.push({
          name,
          isin: null,
          currency: symbol, // crypto uses symbol as currency
          quantity: qty,
          avgPurchasePrice: null,
          marketPrice: price,
          marketValueCHF: valueCHF,
          assetType: 'crypto',
        });
      }
    }
  }

  // ── Parse Aktien section ─────────────────────────────────────────────────
  // The PDF uses a wide-column layout with large whitespace between columns.
  // Format per position (3 lines in raw text, but with lots of spaces):
  //   Line 1: <Name> (e.g. "MICROSTRATEGY CL A ORD") - may have leading spaces
  //   Line 2: <Qty>  [lots of spaces]  <AvgPrice>  <Date>  <MarketPrice>  <MarketValue>  <PnL>  <ValueCHF>  <%>
  //   Line 3: <ISIN> (e.g. "US5949724083") - may have leading spaces
  // Currency blocks appear before their positions: "EUR" or "USD" on its own line
  //
  // We parse from the raw (non-trimmed) text to preserve column positions.
  // Match the actual Aktien table (which has 'Anzahl' header), not the table-of-contents entry
  const aktienSectionMatch = rawText.match(/Aktien\s*\n\s*Anzahl([\s\S]*?)(?=Informationen|$)/);
  if (aktienSectionMatch) {
    const aktienText = aktienSectionMatch[1];
    // Use raw lines (not trimmed) to detect indentation patterns
    const rawAktienLines = aktienText.split('\n');
    const aktienLines = rawAktienLines.map(l => l.trim()).filter(Boolean);

    let currentCurrency = 'CHF';
    let i = 0;

    // Skip header lines
    while (i < aktienLines.length && (
      aktienLines[i].includes('Anzahl') ||
      aktienLines[i].includes('Instrumente') ||
      aktienLines[i].includes('Durchschnitts') ||
      aktienLines[i].includes('Treuhandanteil') ||
      aktienLines[i].includes('Total aktien') ||
      aktienLines[i].includes('preis')
    )) i++;

    while (i < aktienLines.length) {
      const line = aktienLines[i];

      // Currency block header: single 3-letter currency code on its own line
      if (/^[A-Z]{3}$/.test(line) && ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'].includes(line)) {
        currentCurrency = line;
        i++;
        continue;
      }

      // Skip currency subtotal lines (contain multiple numbers)
      if (/^[A-Z]{3}\s+[\d'.,]+/.test(line)) {
        i++;
        continue;
      }

      // Skip Swissquote footer lines
      if (line.includes('Swissquote Bank') || line.includes('Seite ') || line.includes('Portfolio-Performance zum')) {
        i++;
        continue;
      }

      // Check if this looks like a security name (not a number line, not ISIN)
      const isIsin = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(line);
      // A numbers line starts with a number (the quantity)
      const isNumberLine = /^[\d'.,]+\s/.test(line);
      const isName = !isIsin && !isNumberLine && line.length > 3 && /[A-Za-z]/.test(line);

      if (isName) {
        const securityName = line;
        // Next line should be the numbers line
        const numbersLine = aktienLines[i + 1] || '';
        const isinLine = aktienLines[i + 2] || '';

        // Parse the wide-column numbers line.
        // Format: <Qty>  [spaces]  <AvgPrice>  <Date DD.MM.YYYY>  <MarketPrice>  <MarketValue>  <PnL>  <ValueCHF>  <%>
        // Extract all numbers and the date from the line
        const allNumbers = numbersLine.match(/[\d'][\d'.,']*(?:\.[\d]+)?/g) || [];
        const dateInLine = numbersLine.match(/(\d{2}\.\d{2}\.\d{4})/);

        const isin = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isinLine) ? isinLine : null;

        // We need at least: qty, avgPrice, marketPrice, valueCHF
        // The numbers appear in order: qty, avgPrice, marketPrice, marketValue, pnl, valueCHF, %
        // Filter out the date parts from numbers
        const cleanNumbers = allNumbers
          .map(n => parseSwissNumber(n))
          .filter(n => !isNaN(n) && n >= 0);

        if (cleanNumbers.length >= 1 && dateInLine) {
          const qty = cleanNumbers[0];
          const avgPrice = cleanNumbers.length > 1 ? cleanNumbers[1] : null;
          // After date: marketPrice, marketValue, pnl, valueCHF, %
          // Find position of date in the string, then extract numbers after it
          const datePos = numbersLine.indexOf(dateInLine[1]);
          const afterDate = numbersLine.slice(datePos + dateInLine[1].length);
          const afterDateNums = (afterDate.match(/[\d'][\d'.,']*(?:\.[\d]+)?/g) || [])
            .map(n => parseSwissNumber(n))
            .filter(n => !isNaN(n) && n >= 0);

          // afterDateNums: [marketPrice, marketValue, pnl, valueCHF, %]
          const marketPrice = afterDateNums[0] ?? null;
          // valueCHF is the 4th number after date (index 3), fallback to index 2
          const valueCHF = afterDateNums.length > 3 ? afterDateNums[3] : (afterDateNums.length > 2 ? afterDateNums[2] : null);

          if (qty > 0) {
            positions.push({
              name: securityName,
              isin,
              currency: currentCurrency,
              quantity: qty,
              avgPurchasePrice: avgPrice > 0 ? avgPrice : null,
              marketPrice: marketPrice && marketPrice > 0 ? marketPrice : null,
              marketValueCHF: valueCHF && valueCHF > 0 ? valueCHF : null,
              assetType: 'stock',
            });
          }
          i += isin ? 3 : 2;
        } else {
          i++;
        }
      } else {
        i++;
      }
    }
  }

  return { positions, parseErrors, rawText, pageCount, reportDate, accountHolder, totalValueCHF };
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
