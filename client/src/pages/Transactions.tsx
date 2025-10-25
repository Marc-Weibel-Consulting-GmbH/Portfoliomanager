import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

interface TransactionsProps {
  onBackClick: () => void;
}

export default function Transactions({ onBackClick }: TransactionsProps) {
  const { isAuthenticated } = useAuth();
  const { data: transactions = [], refetch } = trpc.transactions.list.useQuery();
  const deleteAllMutation = trpc.transactions.deleteAll.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleDeleteAll = () => {
    if (confirm("Möchtest du wirklich die gesamte Transaktionshistorie löschen?")) {
      deleteAllMutation.mutate();
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "add":
        return "Hinzugefügt";
      case "delete":
        return "Gelöscht";
      case "update_weight":
        return "Gewichtung geändert";
      case "update_data":
        return "Daten aktualisiert";
      default:
        return action;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "add":
        return "text-green-400";
      case "delete":
        return "text-red-400";
      case "update_weight":
        return "text-blue-400";
      case "update_data":
        return "text-yellow-400";
      default:
        return "text-slate-400";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Button
              onClick={onBackClick}
              variant="ghost"
              className="text-white hover:bg-purple-700"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Zurück
            </Button>
          </div>
          <h1 className="text-4xl font-bold mb-2">Transaktionshistorie</h1>
          <p className="text-purple-100">Alle Portfolio-Änderungen im Überblick</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="text-slate-300">
            {transactions.length} {transactions.length === 1 ? "Transaktion" : "Transaktionen"}
          </div>
          {isAuthenticated && transactions.length > 0 && (
            <Button
              onClick={handleDeleteAll}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Historie löschen
            </Button>
          )}
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Transaktionen</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                Noch keine Transaktionen vorhanden
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`font-semibold ${getActionColor(tx.action)}`}>
                            {getActionLabel(tx.action)}
                          </span>
                          <span className="text-slate-300 font-medium">{tx.companyName}</span>
                          <span className="text-slate-500 text-sm">({tx.ticker})</span>
                        </div>
                        
                        {tx.action === "update_weight" && (
                          <div className="text-sm text-slate-400">
                            Gewichtung: {parseFloat(tx.oldValue || "0").toFixed(1)}% → {parseFloat(tx.newValue || "0").toFixed(1)}%
                          </div>
                        )}
                        
                        {tx.action === "add" && (
                          <div className="text-sm text-slate-400">
                            Portfolio-Gewichtung: {parseFloat(tx.newValue || "0").toFixed(1)}%
                          </div>
                        )}
                        
                        {tx.action === "delete" && (
                          <div className="text-sm text-slate-400">
                            Vorherige Gewichtung: {parseFloat(tx.oldValue || "0").toFixed(1)}%
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right text-sm text-slate-500">
                        {new Date(tx.createdAt).toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}{" "}
                        {new Date(tx.createdAt).toLocaleTimeString("de-DE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
