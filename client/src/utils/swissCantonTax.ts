// Swiss Canton Capital Withdrawal Tax Calculator
// Based on 2024/2025 tax rates from finpension.ch (September 2024)
// Source: https://finpension.ch/de/wissen/vergleich-kapitalbezugssteuer/

export type Canton = 
  | 'AG' | 'AI' | 'AR' | 'BE' | 'BL' | 'BS' | 'FR' | 'GE' | 'GL' | 'GR' 
  | 'JU' | 'LU' | 'NE' | 'NW' | 'OW' | 'SG' | 'SH' | 'SO' | 'SZ' | 'TG' 
  | 'TI' | 'UR' | 'VD' | 'VS' | 'ZG' | 'ZH';

export type Religion = 'reformiert' | 'katholisch' | 'konfessionslos';

interface TaxBracket {
  threshold: number; // Amount in CHF
  rate: number; // Tax rate in %
}

// Progressive tax rates by canton (main city, 65 years, single, no religion)
// Data from finpension.ch September 2024
const CANTON_TAX_BRACKETS: Record<Canton, TaxBracket[]> = {
  'AG': [ // Aarau
    { threshold: 0, rate: 3.2 },
    { threshold: 100000, rate: 4.9 },
    { threshold: 250000, rate: 7.2 },
    { threshold: 500000, rate: 8.3 },
    { threshold: 1000000, rate: 8.8 },
  ],
  'AI': [ // Appenzell
    { threshold: 0, rate: 2.4 },
    { threshold: 100000, rate: 3.3 },
    { threshold: 250000, rate: 4.6 },
    { threshold: 500000, rate: 5.2 },
    { threshold: 1000000, rate: 5.3 },
  ],
  'AR': [ // Herisau
    { threshold: 0, rate: 7.6 },
    { threshold: 100000, rate: 8.0 },
    { threshold: 250000, rate: 9.0 },
    { threshold: 500000, rate: 9.9 },
    { threshold: 1000000, rate: 11.1 },
  ],
  'BE': [ // Bern
    { threshold: 0, rate: 3.6 },
    { threshold: 100000, rate: 4.7 },
    { threshold: 250000, rate: 6.6 },
    { threshold: 500000, rate: 8.4 },
    { threshold: 1000000, rate: 9.7 },
  ],
  'BL': [ // Liestal
    { threshold: 0, rate: 3.5 },
    { threshold: 100000, rate: 3.9 },
    { threshold: 250000, rate: 4.9 },
    { threshold: 500000, rate: 6.7 },
    { threshold: 1000000, rate: 9.6 },
  ],
  'BS': [ // Basel
    { threshold: 0, rate: 3.7 },
    { threshold: 100000, rate: 5.3 },
    { threshold: 250000, rate: 8.3 },
    { threshold: 500000, rate: 9.5 },
    { threshold: 1000000, rate: 10.0 },
  ],
  'FR': [ // Fribourg
    { threshold: 0, rate: 2.0 },
    { threshold: 100000, rate: 3.3 },
    { threshold: 250000, rate: 7.0 },
    { threshold: 500000, rate: 9.3 },
    { threshold: 1000000, rate: 10.4 },
  ],
  'GE': [ // Genève
    { threshold: 0, rate: 2.9 },
    { threshold: 100000, rate: 4.6 },
    { threshold: 250000, rate: 6.7 },
    { threshold: 500000, rate: 7.8 },
    { threshold: 1000000, rate: 8.5 },
  ],
  'GL': [ // Glarus - Fixed rate
    { threshold: 0, rate: 4.8 },
    { threshold: 100000, rate: 5.2 },
    { threshold: 250000, rate: 6.2 },
    { threshold: 500000, rate: 6.7 },
    { threshold: 1000000, rate: 6.9 },
  ],
  'GR': [ // Chur
    { threshold: 0, rate: 2.9 },
    { threshold: 100000, rate: 3.2 },
    { threshold: 250000, rate: 4.3 },
    { threshold: 500000, rate: 5.7 },
    { threshold: 1000000, rate: 5.9 },
  ],
  'JU': [ // Delémont
    { threshold: 0, rate: 5.4 },
    { threshold: 100000, rate: 6.2 },
    { threshold: 250000, rate: 8.6 },
    { threshold: 500000, rate: 9.7 },
    { threshold: 1000000, rate: 10.1 },
  ],
  'LU': [ // Luzern
    { threshold: 0, rate: 3.8 },
    { threshold: 100000, rate: 5.1 },
    { threshold: 250000, rate: 7.0 },
    { threshold: 500000, rate: 8.0 },
    { threshold: 1000000, rate: 8.4 },
  ],
  'NE': [ // Neuchâtel
    { threshold: 0, rate: 4.9 },
    { threshold: 100000, rate: 5.7 },
    { threshold: 250000, rate: 7.9 },
    { threshold: 500000, rate: 8.5 },
    { threshold: 1000000, rate: 8.8 },
  ],
  'NW': [ // Stans
    { threshold: 0, rate: 2.7 },
    { threshold: 100000, rate: 3.7 },
    { threshold: 250000, rate: 5.0 },
    { threshold: 500000, rate: 5.6 },
    { threshold: 1000000, rate: 5.7 },
  ],
  'OW': [ // Sarnen
    { threshold: 0, rate: 5.4 },
    { threshold: 100000, rate: 5.8 },
    { threshold: 250000, rate: 6.8 },
    { threshold: 500000, rate: 7.3 },
    { threshold: 1000000, rate: 7.5 },
  ],
  'SG': [ // St. Gallen - Fixed rate
    { threshold: 0, rate: 5.5 },
    { threshold: 100000, rate: 5.9 },
    { threshold: 250000, rate: 6.9 },
    { threshold: 500000, rate: 7.5 },
    { threshold: 1000000, rate: 7.6 },
  ],
  'SH': [ // Schaffhausen
    { threshold: 0, rate: 2.1 },
    { threshold: 100000, rate: 3.3 },
    { threshold: 250000, rate: 5.0 },
    { threshold: 500000, rate: 5.5 },
    { threshold: 1000000, rate: 5.7 },
  ],
  'SO': [ // Solothurn
    { threshold: 0, rate: 3.5 },
    { threshold: 100000, rate: 5.0 },
    { threshold: 250000, rate: 7.0 },
    { threshold: 500000, rate: 7.7 },
    { threshold: 1000000, rate: 7.8 },
  ],
  'SZ': [ // Schwyz
    { threshold: 0, rate: 1.3 },
    { threshold: 100000, rate: 2.4 },
    { threshold: 250000, rate: 5.7 },
    { threshold: 500000, rate: 8.5 },
    { threshold: 1000000, rate: 10.4 },
  ],
  'TG': [ // Frauenfeld - Fixed rate
    { threshold: 0, rate: 6.2 },
    { threshold: 100000, rate: 6.6 },
    { threshold: 250000, rate: 7.7 },
    { threshold: 500000, rate: 8.2 },
    { threshold: 1000000, rate: 8.4 },
  ],
  'TI': [ // Bellinzona
    { threshold: 0, rate: 4.0 },
    { threshold: 100000, rate: 4.4 },
    { threshold: 250000, rate: 5.4 },
    { threshold: 500000, rate: 7.3 },
    { threshold: 1000000, rate: 8.1 },
  ],
  'UR': [ // Altdorf - Fixed rate
    { threshold: 0, rate: 3.9 },
    { threshold: 100000, rate: 4.3 },
    { threshold: 250000, rate: 5.3 },
    { threshold: 500000, rate: 5.8 },
    { threshold: 1000000, rate: 6.0 },
  ],
  'VD': [ // Lausanne
    { threshold: 0, rate: 3.4 },
    { threshold: 100000, rate: 4.6 },
    { threshold: 250000, rate: 7.0 },
    { threshold: 500000, rate: 8.4 },
    { threshold: 1000000, rate: 9.1 },
  ],
  'VS': [ // Sion
    { threshold: 0, rate: 4.4 },
    { threshold: 100000, rate: 4.8 },
    { threshold: 250000, rate: 6.3 },
    { threshold: 500000, rate: 9.1 },
    { threshold: 1000000, rate: 10.3 },
  ],
  'ZG': [ // Zug - Lowest
    { threshold: 0, rate: 1.8 },
    { threshold: 100000, rate: 2.9 },
    { threshold: 250000, rate: 4.6 },
    { threshold: 500000, rate: 5.8 },
    { threshold: 1000000, rate: 6.3 },
  ],
  'ZH': [ // Zürich
    { threshold: 0, rate: 4.5 },
    { threshold: 100000, rate: 4.9 },
    { threshold: 250000, rate: 5.9 },
    { threshold: 500000, rate: 7.2 },
    { threshold: 1000000, rate: 11.2 },
    { threshold: 2000000, rate: 15.8 },
  ],
};

// Church tax multipliers (additional % on top of base rate)
const CHURCH_TAX_MULTIPLIER: Record<Canton, number> = {
  'AG': 0.5, 'AI': 0.3, 'AR': 0.4, 'BE': 0.6, 'BL': 0.6, 'BS': 0.7,
  'FR': 0.5, 'GE': 0.0, 'GL': 0.4, 'GR': 0.4, 'JU': 0.5, 'LU': 0.4,
  'NE': 0.0, 'NW': 0.2, 'OW': 0.3, 'SG': 0.5, 'SH': 0.4, 'SO': 0.5,
  'SZ': 0.2, 'TG': 0.5, 'TI': 0.3, 'UR': 0.3, 'VD': 0.0, 'VS': 0.4,
  'ZG': 0.1, 'ZH': 0.5,
};

export const CANTONS: { value: Canton; label: string }[] = [
  { value: 'ZH', label: 'Zürich' },
  { value: 'BE', label: 'Bern' },
  { value: 'LU', label: 'Luzern' },
  { value: 'UR', label: 'Uri' },
  { value: 'SZ', label: 'Schwyz' },
  { value: 'OW', label: 'Obwalden' },
  { value: 'NW', label: 'Nidwalden' },
  { value: 'GL', label: 'Glarus' },
  { value: 'ZG', label: 'Zug' },
  { value: 'FR', label: 'Freiburg' },
  { value: 'SO', label: 'Solothurn' },
  { value: 'BS', label: 'Basel-Stadt' },
  { value: 'BL', label: 'Basel-Landschaft' },
  { value: 'SH', label: 'Schaffhausen' },
  { value: 'AR', label: 'Appenzell Ausserrhoden' },
  { value: 'AI', label: 'Appenzell Innerrhoden' },
  { value: 'SG', label: 'St. Gallen' },
  { value: 'GR', label: 'Graubünden' },
  { value: 'AG', label: 'Aargau' },
  { value: 'TG', label: 'Thurgau' },
  { value: 'TI', label: 'Tessin' },
  { value: 'VD', label: 'Waadt' },
  { value: 'VS', label: 'Wallis' },
  { value: 'NE', label: 'Neuenburg' },
  { value: 'GE', label: 'Genf' },
  { value: 'JU', label: 'Jura' },
];

function getProgressiveTaxRate(amount: number, canton: Canton): number {
  const brackets = CANTON_TAX_BRACKETS[canton];
  
  // Find the applicable bracket
  let applicableRate = brackets[0].rate;
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (amount >= brackets[i].threshold) {
      applicableRate = brackets[i].rate;
      break;
    }
  }
  
  // Interpolate between brackets for smoother progression
  for (let i = 0; i < brackets.length - 1; i++) {
    if (amount >= brackets[i].threshold && amount < brackets[i + 1].threshold) {
      const lowerBracket = brackets[i];
      const upperBracket = brackets[i + 1];
      const range = upperBracket.threshold - lowerBracket.threshold;
      const position = amount - lowerBracket.threshold;
      const ratio = position / range;
      applicableRate = lowerBracket.rate + (upperBracket.rate - lowerBracket.rate) * ratio;
      break;
    }
  }
  
  return applicableRate;
}

export function calculateCapitalWithdrawalTax(
  amount: number,
  canton: Canton,
  religion: Religion
): { taxAmount: number; taxRate: number; netAmount: number } {
  // Get base tax rate using progressive brackets
  let totalRate = getProgressiveTaxRate(amount, canton);
  
  // Add church tax if applicable
  if (religion !== 'konfessionslos') {
    totalRate += CHURCH_TAX_MULTIPLIER[canton];
  }
  
  // Calculate tax amount
  const taxAmount = (amount * totalRate) / 100;
  const netAmount = amount - taxAmount;
  
  return {
    taxAmount,
    taxRate: totalRate,
    netAmount,
  };
}

export function findLowestTaxCanton(
  amount: number,
  religion: Religion
): { canton: Canton; cantonName: string; taxRate: number; taxAmount: number } {
  let lowestTax = Infinity;
  let bestCanton: Canton = 'ZG';
  
  for (const canton of Object.keys(CANTON_TAX_BRACKETS) as Canton[]) {
    const result = calculateCapitalWithdrawalTax(amount, canton, religion);
    if (result.taxAmount < lowestTax) {
      lowestTax = result.taxAmount;
      bestCanton = canton;
    }
  }
  
  const result = calculateCapitalWithdrawalTax(amount, bestCanton, religion);
  const cantonInfo = CANTONS.find(c => c.value === bestCanton);
  
  return {
    canton: bestCanton,
    cantonName: cantonInfo?.label || bestCanton,
    taxRate: result.taxRate,
    taxAmount: result.taxAmount,
  };
}

