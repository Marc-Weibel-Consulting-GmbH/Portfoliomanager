// Swiss Canton Capital Withdrawal Tax Calculator
// Based on 2024 tax rates for pension capital withdrawal

export type Canton = 
  | 'AG' | 'AI' | 'AR' | 'BE' | 'BL' | 'BS' | 'FR' | 'GE' | 'GL' | 'GR' 
  | 'JU' | 'LU' | 'NE' | 'NW' | 'OW' | 'SG' | 'SH' | 'SO' | 'SZ' | 'TG' 
  | 'TI' | 'UR' | 'VD' | 'VS' | 'ZG' | 'ZH';

export type Religion = 'reformiert' | 'katholisch' | 'konfessionslos';

interface TaxRate {
  base: number; // Base tax rate in %
  churchTax: number; // Church tax multiplier (0 for konfessionslos)
}

// Simplified tax rates by canton (average rates for CHF 500k withdrawal)
// In reality, these are progressive and depend on marital status
const CANTON_TAX_RATES: Record<Canton, TaxRate> = {
  'ZH': { base: 5.2, churchTax: 0.5 },
  'BE': { base: 4.8, churchTax: 0.6 },
  'LU': { base: 3.9, churchTax: 0.4 },
  'UR': { base: 2.1, churchTax: 0.3 },
  'SZ': { base: 2.3, churchTax: 0.2 },
  'OW': { base: 1.9, churchTax: 0.3 },
  'NW': { base: 2.0, churchTax: 0.2 },
  'GL': { base: 3.2, churchTax: 0.4 },
  'ZG': { base: 1.5, churchTax: 0.1 }, // Lowest
  'FR': { base: 4.5, churchTax: 0.5 },
  'SO': { base: 4.3, churchTax: 0.5 },
  'BS': { base: 6.8, churchTax: 0.7 },
  'BL': { base: 5.5, churchTax: 0.6 },
  'SH': { base: 4.1, churchTax: 0.4 },
  'AR': { base: 3.5, churchTax: 0.4 },
  'AI': { base: 2.5, churchTax: 0.3 },
  'SG': { base: 4.0, churchTax: 0.5 },
  'GR': { base: 3.8, churchTax: 0.4 },
  'AG': { base: 4.6, churchTax: 0.5 },
  'TG': { base: 4.2, churchTax: 0.5 },
  'TI': { base: 5.8, churchTax: 0.3 },
  'VD': { base: 5.1, churchTax: 0.0 }, // No church tax
  'VS': { base: 4.7, churchTax: 0.4 },
  'NE': { base: 5.3, churchTax: 0.0 }, // No church tax
  'GE': { base: 7.2, churchTax: 0.0 }, // Highest, no church tax
  'JU': { base: 5.6, churchTax: 0.5 },
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

export function calculateCapitalWithdrawalTax(
  amount: number,
  canton: Canton,
  religion: Religion
): { taxAmount: number; taxRate: number; netAmount: number } {
  const rates = CANTON_TAX_RATES[canton];
  
  // Calculate total tax rate
  let totalRate = rates.base;
  
  // Add church tax if applicable
  if (religion !== 'konfessionslos') {
    totalRate += rates.churchTax;
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
  
  for (const canton of Object.keys(CANTON_TAX_RATES) as Canton[]) {
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

