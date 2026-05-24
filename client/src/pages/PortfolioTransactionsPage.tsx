import { useState } from "react";
import { useRoute, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { TransactionHistory } from "@/components/TransactionHistory";
import { TransactionModal } from "@/components/TransactionModal";

export default function PortfolioTransactionsPage() {
  const [, params] = useRoute<{ id: string }>("/portfolio/:id/transactions");
  const portfolioId = params?.id ? parseInt(params.id) : null;
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  // Fetch portfolio details
  const { data: portfolios = [] } = trpc.portfolios.list.useQuery();
  const portfolio = portfolios.find((p: any) => p.id === portfolioId);

  // Fetch transactions
  const { data: transactions = [] } = trpc.portfolioTransactions.list.useQuery(
    { portfolioId: portfolioId! },
    { enabled: !!portfolioId }
  );

  if (!portfolio) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto">
          <div className="text-white">Portfolio nicht gefunden</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <button className="p-2 rounded-lg bg-[#1a1f2e] border border-white/10 hover:border-[#00CFC1]/50 transition-colors">
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white">{portfolio.name}</h1>
              <p className="text-gray-400">{portfolio.description || "Portfolio Details"}</p>
            </div>
          </div>
          <Button
            onClick={() => setIsTransactionModalOpen(true)}
            className="bg-[#00CFC1] hover:bg-[#00b8ad] text-black font-semibold"
          >
            <Plus className="h-4 w-4 mr-2" />
            Neue Transaktion
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-4 border-b border-white/10">
          <Link href={`/portfolio/${portfolioId}/positions`}>
            <button className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
              Positionen
            </button>
          </Link>
          {!!portfolio.isLive && (
            <Link href={`/portfolio/${portfolioId}/transactions`}>
              <button className="px-4 py-2 text-[#00CFC1] border-b-2 border-[#00CFC1] font-semibold">
                Transaktionen
              </button>
            </Link>
          )}
        </div>

        {/* Transaction History */}
        <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
          <CardHeader>
            <CardTitle className="text-white">Transaktionshistorie</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionHistory portfolioId={portfolioId!} portfolioName={portfolio.name} />
          </CardContent>
        </Card>

        {/* Transaction Modal */}
        {isTransactionModalOpen && (
          <TransactionModal
            portfolioId={portfolioId!}
            portfolioStocks={[]}
            open={isTransactionModalOpen}
            onClose={() => setIsTransactionModalOpen(false)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
