import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DebugTest() {
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testMutation = trpc.debugTest.testPortfolioCreate.useMutation();

  const handleTest = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const testData = {
        userId: 1, // Test user ID
        name: "Debug Test Portfolio",
        description: "Test portfolio created via debug endpoint",
        portfolioData: JSON.stringify({
          stocks: [
            {
              ticker: "NVDA",
              companyName: "NVIDIA Corp",
              weight: 50,
              currentPrice: 187.54,
              ytdPerformance: 180.5,
              dividendYield: 0.03,
              sector: "Technology",
            },
            {
              ticker: "TSLA",
              companyName: "Tesla Inc",
              weight: 50,
              currentPrice: 454.43,
              ytdPerformance: 45.2,
              dividendYield: 0,
              sector: "Automotive",
            },
          ],
        }),
        investmentAmount: "100000",
        portfolioType: "demo" as const,
      };

      console.log("[DebugTest] Sending test data:", testData);

      const res = await testMutation.mutateAsync(testData);

      console.log("[DebugTest] Result:", res);
      setResult(res);
    } catch (error: any) {
      console.error("[DebugTest] Error:", error);
      setResult({
        success: false,
        error: error.message || String(error),
        logs: [`Error: ${error.message || String(error)}`],
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="bg-[#0f1420]/50 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Debug Portfolio Creation Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-300">
              This page tests the portfolio creation logic and shows all server logs.
            </p>

            <Button
              onClick={handleTest}
              disabled={isLoading}
              className="bg-[#00CFC1] hover:bg-[#00CFC1]/90 text-white"
            >
              {isLoading ? "Testing..." : "Run Test"}
            </Button>

            {result && (
              <div className="mt-6 space-y-4">
                <div>
                  <h3 className="text-white font-bold mb-2">
                    Result: {result.success ? "✅ SUCCESS" : "❌ FAILED"}
                  </h3>
                  {result.error && (
                    <p className="text-red-400 mb-2">Error: {result.error}</p>
                  )}
                  {result.portfolio && (
                    <div className="bg-green-900/20 border border-green-500/30 p-4 rounded">
                      <p className="text-green-400 font-bold">Portfolio Created!</p>
                      <p className="text-white">ID: {result.portfolio.id}</p>
                      <p className="text-white">Name: {result.portfolio.name}</p>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-white font-bold mb-2">Server Logs:</h3>
                  <div className="bg-[#0a0f1a] border border-white/10 p-4 rounded max-h-96 overflow-y-auto">
                    {result.logs && result.logs.length > 0 ? (
                      result.logs.map((log: string, idx: number) => (
                        <div key={idx} className="text-sm text-gray-300 font-mono mb-1">
                          {log}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500">No logs available</p>
                    )}
                  </div>
                </div>

                {result.stack && (
                  <div>
                    <h3 className="text-white font-bold mb-2">Stack Trace:</h3>
                    <div className="bg-[#0a0f1a] border border-red-500/30 p-4 rounded max-h-96 overflow-y-auto">
                      <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap">
                        {result.stack}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
