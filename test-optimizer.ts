/**
 * Portfolio Optimizer Validation Tests
 * 
 * Tests all edge cases and validates optimizer logic:
 * 1. Weight sum = 100%
 * 2. Min/max weight limits respected
 * 3. Handles insufficient stocks
 * 4. Handles extreme values
 */

interface Stock {
  ticker: string;
  companyName: string;
  category: string;
  currentPrice: string;
  dividendYield: string;
  ytdPerformance: string;
  peRatio: string;
}

interface OptimizedPosition {
  ticker: string;
  shares: number;
  investmentAmount: number;
  portfolioWeight: number;
}

interface TestCase {
  name: string;
  investmentAmount: number;
  numberOfPositions: number;
  expectedDividendYield: number;
  investorType: "conservative" | "balanced" | "dynamic";
  stocks: Stock[];
}

const testCases: TestCase[] = [
  {
    name: "Small Portfolio (<20k) - Should allow 0-10% weights",
    investmentAmount: 10000,
    numberOfPositions: 10,
    expectedDividendYield: 3.0,
    investorType: "balanced",
    stocks: [] // Will use real stocks from DB
  },
  {
    name: "Large Portfolio (>20k) - Should enforce 1-5% weights",
    investmentAmount: 50000,
    numberOfPositions: 20,
    expectedDividendYield: 3.5,
    investorType: "balanced",
    stocks: []
  },
  {
    name: "Insufficient Stocks - Request 30 positions but only 15 available",
    investmentAmount: 30000,
    numberOfPositions: 30,
    expectedDividendYield: 3.0,
    investorType: "balanced",
    stocks: []
  },
  {
    name: "Extreme Dividend - Very high target (8%)",
    investmentAmount: 20000,
    numberOfPositions: 15,
    expectedDividendYield: 8.0,
    investorType: "conservative",
    stocks: []
  },
  {
    name: "Extreme Dividend - Very low target (0.5%)",
    investmentAmount: 20000,
    numberOfPositions: 15,
    expectedDividendYield: 0.5,
    investorType: "dynamic",
    stocks: []
  },
  {
    name: "Negative Performance - All stocks with negative YTD",
    investmentAmount: 15000,
    numberOfPositions: 10,
    expectedDividendYield: 3.0,
    investorType: "conservative",
    stocks: []
  }
];

function validatePortfolio(positions: OptimizedPosition[], investmentAmount: number, minWeight: number, maxWeight: number): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Test 1: Weight sum should be close to 100% (allowing for cash)
  const totalWeight = positions.reduce((sum, p) => sum + p.portfolioWeight, 0);
  if (totalWeight < 95) {
    errors.push(`Total weight ${totalWeight.toFixed(2)}% is below 95% (too much cash)`);
  } else if (totalWeight > 100.1) {
    errors.push(`Total weight ${totalWeight.toFixed(2)}% exceeds 100%`);
  } else if (totalWeight < 98) {
    warnings.push(`Total weight ${totalWeight.toFixed(2)}% is below 98% target`);
  }
  
  // Test 2: Individual weights within limits
  positions.forEach(p => {
    if (p.portfolioWeight < minWeight * 100 - 0.1) { // Allow 0.1% tolerance
      errors.push(`${p.ticker}: Weight ${p.portfolioWeight.toFixed(2)}% below minimum ${(minWeight * 100).toFixed(2)}%`);
    }
    if (p.portfolioWeight > maxWeight * 100 + 0.1) {
      errors.push(`${p.ticker}: Weight ${p.portfolioWeight.toFixed(2)}% exceeds maximum ${(maxWeight * 100).toFixed(2)}%`);
    }
  });
  
  // Test 3: Investment amounts sum correctly
  const totalInvested = positions.reduce((sum, p) => sum + p.investmentAmount, 0);
  const calculatedTotalWeight = (totalInvested / investmentAmount) * 100;
  if (Math.abs(calculatedTotalWeight - totalWeight) > 0.5) {
    errors.push(`Weight mismatch: Calculated ${calculatedTotalWeight.toFixed(2)}% vs reported ${totalWeight.toFixed(2)}%`);
  }
  
  // Test 4: All positions have shares > 0
  positions.forEach(p => {
    if (p.shares <= 0) {
      errors.push(`${p.ticker}: Invalid shares count ${p.shares}`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

console.log("Portfolio Optimizer Validation Tests");
console.log("=====================================\n");

// Note: This script would need to be run in the actual app context
// to access the optimizer logic and real stock data.
// For now, it serves as documentation of test cases.

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`  Investment: CHF ${testCase.investmentAmount.toLocaleString()}`);
  console.log(`  Positions: ${testCase.numberOfPositions}`);
  console.log(`  Target Dividend: ${testCase.expectedDividendYield}%`);
  console.log(`  Investor Type: ${testCase.investorType}`);
  
  const minWeight = testCase.investmentAmount < 20000 ? 0 : 0.01;
  const maxWeight = testCase.investmentAmount < 20000 ? 0.10 : 0.05;
  console.log(`  Expected Limits: ${(minWeight * 100).toFixed(0)}-${(maxWeight * 100).toFixed(0)}%`);
  console.log();
});

console.log("\nTo run these tests:");
console.log("1. Open the app in browser");
console.log("2. Navigate to Portfolio Optimizer");
console.log("3. For each test case, enter the parameters");
console.log("4. Verify:");
console.log("   - Total weight ≥ 95%");
console.log("   - Individual weights within limits");
console.log("   - No errors in console");
console.log("   - Reasonable diversification");

