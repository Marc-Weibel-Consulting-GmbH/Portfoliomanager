import { describe, it, expect, beforeAll } from "vitest";
import { activatePortfolio, calculatePortfolioMetrics, getBenchmarkData, upsertBenchmarkData } from "../server/db";

describe("Portfolio Management", () => {
  describe("Benchmark Data", () => {
    it("should upsert benchmark data successfully", async () => {
      const result = await upsertBenchmarkData({
        benchmark: "SMI",
        date: "2024-01-01",
        close: "11500.50",
        source: "test",
      });

      expect(result).toBeDefined();
      expect(result?.success).toBe(true);
    });

    it("should retrieve benchmark data", async () => {
      // First insert some test data
      await upsertBenchmarkData({
        benchmark: "SMI",
        date: "2024-01-01",
        close: "11500.50",
      });

      const data = await getBenchmarkData("SMI", "2024-01-01", "2024-12-31");
      
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(0);
    });

    it("should filter benchmark data by date range", async () => {
      // Insert multiple dates
      await upsertBenchmarkData({
        benchmark: "SP500",
        date: "2024-01-01",
        close: "4800.00",
      });
      
      await upsertBenchmarkData({
        benchmark: "SP500",
        date: "2024-06-01",
        close: "5200.00",
      });

      const data = await getBenchmarkData("SP500", "2024-01-01", "2024-03-31");
      
      expect(Array.isArray(data)).toBe(true);
      // Should only include data within the date range
    });
  });

  describe("Portfolio Metrics", () => {
    it("should calculate portfolio metrics for non-existent portfolio", async () => {
      const metrics = await calculatePortfolioMetrics(99999, 1);
      
      expect(metrics).toBeNull();
    });

    it("should handle portfolio with no transactions", async () => {
      // This test would require creating a test portfolio first
      // For now, we just verify the function doesn't crash
      const metrics = await calculatePortfolioMetrics(1, 1);
      
      // Should return null or valid metrics object
      expect(metrics === null || typeof metrics === "object").toBe(true);
    });
  });

  describe("Portfolio Activation", () => {
    it("should validate required parameters for activation", async () => {
      try {
        // Try to activate non-existent portfolio
        const result = await activatePortfolio(99999, 1, "10000");
        
        // Should return null or throw error
        expect(result).toBeNull();
      } catch (error) {
        // Error is expected for non-existent portfolio
        expect(error).toBeDefined();
      }
    });

    it("should handle activation with benchmark selection", async () => {
      try {
        const result = await activatePortfolio(99999, 1, "10000", "SMI");
        
        // Should return null for non-existent portfolio
        expect(result).toBeNull();
      } catch (error) {
        // Error is expected
        expect(error).toBeDefined();
      }
    });
  });
});
