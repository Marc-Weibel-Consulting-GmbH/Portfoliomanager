import { readFileSync } from 'fs';
import pdfParseModule from 'pdf-parse';
const pdfParse = pdfParseModule.default || pdfParseModule;

const buf = readFileSync('/home/ubuntu/upload/WeibelMarc,SwissquoteDepotauszug2024.pdf');
const data = await pdfParse(buf, { max: 0 });
const rawText = data.text;

function parseSwissNumber(s) {
  return parseFloat(s.replace(/'/g, '').replace(/,/g, '.'));
}

// Simulate the new parser logic
const aktienHeaderMatch = rawText.match(/Aktien\s*\nAnzahl\s*\nInstrumente/);
if (!aktienHeaderMatch) {
  console.log('ERROR: No Aktien header found!');
  process.exit(1);
}

const aktienStartIdx = rawText.indexOf(aktienHeaderMatch[0]);
const aktienEndIdx = rawText.indexOf('Informationen', aktienStartIdx);
const aktienText = rawText.slice(aktienStartIdx, aktienEndIdx > aktienStartIdx ? aktienEndIdx : rawText.length);

const aktienLines = aktienText.split('\n').map(l => l.trim()).filter(Boolean);
console.log('Total aktienLines:', aktienLines.length);

// Now run the full parser simulation
const currencyCodes = new Set(['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK']);
const headerKeywords = new Set([
  'Aktien', 'Anzahl', 'Instrumente', 'Durchschnitts', 'preis', 'Valuta-Datum',
  'Marktpreis', 'Marktwert', 'Bewertung in CHF', '%', 'Offene P&L',
  'ISIN', 'Treuhandanteil', 'e', 'Treuhandanteile', 'Total aktien'
]);
const isinRegex = /([A-Z]{2}[A-Z0-9]{10})$/;

let currentCurrency = 'CHF';
let i = 0;
const positions = [];

while (i < aktienLines.length) {
  const line = aktienLines[i];

  if (headerKeywords.has(line)) { i++; continue; }
  if (line.includes('Swissquote Bank') || line.includes('Seite ') || line.includes('Portfolio-Performance')) { i++; continue; }

  if (currencyCodes.has(line)) {
    currentCurrency = line;
    // Überspringe genau 4 Subtotal-Zeilen: totalMarketValue, totalCHF, pct, openPL
    i += 5; // +1 für Währungscode + 4 Subtotal-Felder
    continue;
  }

  const isQuantityLine = /^\d[\d']*$/.test(line);

  if (isQuantityLine) {
    const qty = parseSwissNumber(line);
    const nameIsinLine = aktienLines[i + 1] || '';

    const isinMatch = nameIsinLine.match(isinRegex);
    const isin = isinMatch ? isinMatch[1] : null;
    const securityName = isin
      ? nameIsinLine.slice(0, nameIsinLine.length - 12).trim()
      : nameIsinLine.trim();

    const avgPriceStr = aktienLines[i + 2] || '';
    const dateStr = aktienLines[i + 3] || '';
    const marketPriceStr = aktienLines[i + 4] || '';
    const marketValueStr = aktienLines[i + 5] || '';
    const openPLStr = aktienLines[i + 6] || '';
    const valueCHFStr = aktienLines[i + 7] || '';
    // Zeile i+8 kann pct sein ODER die nächste Anzahl-Zeile
    const possiblePctOrNext = aktienLines[i + 8] || '';

    const avgPrice = parseSwissNumber(avgPriceStr);
    const marketPrice = parseSwissNumber(marketPriceStr);
    const valueCHF = parseSwissNumber(valueCHFStr);

    // Bestimme dynamisch wie viele Zeilen diese Position belegt:
    // Wenn Zeile i+8 eine Anzahl-Zeile ist (nächste Position), dann hat diese Position nur 8 Felder
    const isNextQty = /^\d[\d']*$/.test(possiblePctOrNext) && 
      !currencyCodes.has(possiblePctOrNext) &&
      !headerKeywords.has(possiblePctOrNext);
    const fieldsCount = isNextQty ? 8 : 9;

    console.log(`\nParsing position at line ${i} (fieldsCount=${fieldsCount}):`);
    console.log(`  qty=${qty}, nameIsin="${nameIsinLine}"`);
    console.log(`  isin=${isin}, name="${securityName}"`);
    console.log(`  avgPrice=${avgPrice}, date="${dateStr}", marketPrice=${marketPrice}`);
    console.log(`  marketValue="${marketValueStr}", openPL="${openPLStr}", valueCHF=${valueCHF}`);
    console.log(`  possiblePctOrNext="${possiblePctOrNext}" isNextQty=${isNextQty}`);

    if (marketPrice > 0 && qty > 0) {
      positions.push({ name: securityName, isin, currency: currentCurrency, quantity: qty, avgPrice, marketPrice, valueCHF });
      console.log(`  => ADDED`);
    } else {
      console.log(`  => SKIPPED (marketPrice=${marketPrice})`);
    }

    i += fieldsCount;
  } else {
    i++;
  }
}

console.log('\n=== FINAL POSITIONS ===');
positions.forEach(p => console.log(JSON.stringify(p)));
console.log(`\nTotal: ${positions.length} positions`);
