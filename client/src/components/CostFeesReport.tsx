import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Receipt } from "lucide-react";

interface Transaction {
  id: number;
  transactionDate: Date | string;
  transactionType: "buy" | "sell" | "dividend" | "deposit" | "withdrawal";
  ticker: string | null;
  shares: string | null;
  pricePerShare: string | null;
  currency: string;
  totalAmount: string;
  totalAmountCHF: string | null;
  fees: string;
  notes: string | null;
}

interface CostFeesReportProps {
  transactions: Transaction[];
  portfolioId: number;
}

export function CostFeesReport({ transactions, portfolioId }: CostFeesReportProps) {
  // Calculate fee breakdown by transaction type
  const feeBreakdown = useMemo(() => {
    const breakdown = {
      buy: 0,
      sell: 0,
      dividend: 0,
      deposit: 0,
      withdrawal: 0,
      total: 0,
    };

    transactions.forEach((tx) => {
      const fee = parseFloat(tx.fees || "0");
      breakdown[tx.transactionType] += fee;
      breakdown.total += fee;
    });

    return breakdown;
  }, [transactions]);

  // Group fees by year for tax reporting
  const feesByYear = useMemo(() => {
    const yearMap = new Map<number, { total: number; buy: number; sell: number; count: number }>();

    transactions.forEach((tx) => {
      const year = new Date(tx.transactionDate).getFullYear();
      const fee = parseFloat(tx.fees || "0");

      if (!yearMap.has(year)) {
        yearMap.set(year, { total: 0, buy: 0, sell: 0, count: 0 });
      }

      const yearData = yearMap.get(year)!;
      yearData.total += fee;
      yearData.count++;

      if (tx.transactionType === "buy") {
        yearData.buy += fee;
      } else if (tx.transactionType === "sell") {
        yearData.sell += fee;
      }
    });

    return Array.from(yearMap.entries())
      .map(([year, data]) => ({ year, ...data }))
      .sort((a, b) => b.year - a.year);
  }, [transactions]);

  // Export fees report as CSV
  const exportFeesReport = () => {
    const header = "Jahr,Typ,Anzahl Transaktionen,Gebühren (CHF)";
    const rows: string[] = [];

    feesByYear.forEach((yearData) => {
      rows.push(`${yearData.year},Gesamt,${yearData.count},${yearData.total.toFixed(2)}`);
      rows.push(`${yearData.year},Kauf,,-,${yearData.buy.toFixed(2)}`);
      rows.push(`${yearData.year},Verkauf,,-,${yearData.sell.toFixed(2)}`);
    });

    rows.push("");
    rows.push("Gesamt nach Typ");
    rows.push(`Kauf,-,${feeBreakdown.buy.toFixed(2)}`);
    rows.push(`Verkauf,-,${feeBreakdown.sell.toFixed(2)}`);
    rows.push(`Dividende,-,${feeBreakdown.dividend.toFixed(2)}`);
    rows.push(`Einzahlung,-,${feeBreakdown.deposit.toFixed(2)}`);
    rows.push(`Auszahlung,-,${feeBreakdown.withdrawal.toFixed(2)}`);
    rows.push(`Gesamt,-,${feeBreakdown.total.toFixed(2)}`);

    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `gebuehren_portfolio_${portfolioId}_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Kosten & Gebühren (Steuer-Reporting)</CardTitle>
          <Button variant="outline" size="sm" onClick={exportFeesReport}>
            <Download className="w-4 h-4 mr-2" />
            CSV Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Gesamt Gebühren</p>
            </div>
            <p className="text-2xl font-bold text-red-500">
              CHF {feeBreakdown.total.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{transactions.length} Transaktionen</p>
          </div>

          <div className="bg-muted/30 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-2">Kauf-Gebühren</p>
            <p className="text-xl font-bold text-foreground">
              CHF {feeBreakdown.buy.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-muted/30 rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-2">Verkauf-Gebühren</p>
            <p className="text-xl font-bold text-foreground">
              CHF {feeBreakdown.sell.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Breakdown by Transaction Type */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3">Gebühren nach Transaktionstyp</h3>
          <div className="space-y-2">
            {[
              { type: "buy", label: "Kauf", value: feeBreakdown.buy, color: "bg-green-500" },
              { type: "sell", label: "Verkauf", value: feeBreakdown.sell, color: "bg-red-500" },
              { type: "dividend", label: "Dividende", value: feeBreakdown.dividend, color: "bg-blue-500" },
              { type: "deposit", label: "Einzahlung", value: feeBreakdown.deposit, color: "bg-cyan-500" },
              { type: "withdrawal", label: "Auszahlung", value: feeBreakdown.withdrawal, color: "bg-orange-500" },
            ].map((item) => (
              <div key={item.type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                  <span className="text-sm text-foreground">{item.label}</span>
                </div>
                <span className="text-sm font-medium text-foreground">
                  CHF {item.value.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Breakdown by Year */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Gebühren nach Jahr (für Steuererklärung)</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-4 text-sm font-medium text-muted-foreground">Jahr</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-muted-foreground">Transaktionen</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-muted-foreground">Kauf-Gebühren</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-muted-foreground">Verkauf-Gebühren</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-muted-foreground">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {feesByYear.map((yearData) => (
                  <tr key={yearData.year} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-2 px-4 text-sm font-medium text-foreground">{yearData.year}</td>
                    <td className="text-right py-2 px-4 text-sm text-foreground">{yearData.count}</td>
                    <td className="text-right py-2 px-4 text-sm text-foreground">
                      CHF {yearData.buy.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right py-2 px-4 text-sm text-foreground">
                      CHF {yearData.sell.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="text-right py-2 px-4 text-sm font-bold text-red-500">
                      CHF {yearData.total.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
