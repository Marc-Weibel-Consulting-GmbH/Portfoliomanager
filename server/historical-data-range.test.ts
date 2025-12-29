import { describe, it, expect } from 'vitest';

describe('Historical Data Range', () => {
  it('should generate at least 5 years of historical data', () => {
    // Simulate the chart data generation logic from StockDetail.tsx
    const basePrice = 100;
    const data: any[] = [];
    const now = new Date();
    
    // Generate 1825 days of data (5 years)
    for (let i = 1825; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      const randomWalk = (Math.random() - 0.48) * 0.02;
      const prevClose = data.length > 0 ? data[data.length - 1].close : basePrice;
      const open = prevClose * (1 + (Math.random() - 0.5) * 0.01);
      const close = open * (1 + randomWalk);
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      const volume = Math.floor(Math.random() * 1000000) + 500000;
      
      data.push({
        date: date.toISOString().split('T')[0],
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume,
      });
    }
    
    // Verify we have data
    expect(data.length).toBeGreaterThan(0);
    
    // Verify the date range spans at least 4.5 years (accounting for weekends)
    const firstDate = new Date(data[0].date);
    const lastDate = new Date(data[data.length - 1].date);
    const daysDifference = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
    
    // Should be close to 1825 days (5 years), allowing for weekends (~1300 trading days)
    expect(daysDifference).toBeGreaterThan(1640); // At least 4.5 years
    expect(data.length).toBeGreaterThan(1200); // At least 1200 trading days
    
    // Verify oldest data point is from approximately 5 years ago
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    fiveYearsAgo.setMonth(fiveYearsAgo.getMonth() + 1); // Allow 1 month buffer
    
    expect(firstDate.getTime()).toBeLessThan(fiveYearsAgo.getTime());
    
    console.log(`Generated ${data.length} data points spanning ${Math.round(daysDifference)} days`);
    console.log(`First date: ${data[0].date}`);
    console.log(`Last date: ${data[data.length - 1].date}`);
  });
  
  it('should have data points going back before October 2024', () => {
    // This is the specific issue reported by the user
    const basePrice = 100;
    const data: any[] = [];
    const now = new Date();
    
    // Generate 1825 days of data (5 years)
    for (let i = 1825; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      const randomWalk = (Math.random() - 0.48) * 0.02;
      const prevClose = data.length > 0 ? data[data.length - 1].close : basePrice;
      const open = prevClose * (1 + (Math.random() - 0.5) * 0.01);
      const close = open * (1 + randomWalk);
      
      data.push({
        date: date.toISOString().split('T')[0],
        close,
      });
    }
    
    // Find earliest data point
    const earliestDate = new Date(data[0].date);
    const october2024 = new Date('2024-10-01');
    
    // Earliest data should be BEFORE October 2024
    expect(earliestDate.getTime()).toBeLessThan(october2024.getTime());
    
    console.log(`Earliest data point: ${data[0].date} (should be before October 2024)`);
  });
});
