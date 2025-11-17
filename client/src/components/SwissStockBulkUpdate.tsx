import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export function SwissStockBulkUpdate() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);

  const bulkUpdate = trpc.admin.bulkUpdateSwissStocks.useMutation({
    onSuccess: (data) => {
      setResults(data);
      setIsRunning(false);
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
      setIsRunning(false);
    },
  });

  const handleBulkUpdate = () => {
    if (confirm("Bulk-Update für alle Schweizer Aktien starten? (ca. 15-20 Sekunden)")) {
      setIsRunning(true);
      setResults(null);
      bulkUpdate.mutate();
    }
  };

  return (
    <div className="space-y-4">
      <Button
        onClick={handleBulkUpdate}
        disabled={isRunning}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {isRunning ? "⏳ Läuft..." : "▶️ Bulk Update starten"}
      </Button>

      {results && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-700 p-3 rounded text-center">
              <div className="text-slate-400 text-xs">Total</div>
              <div className="text-xl font-bold text-white">{results.total}</div>
            </div>
            <div className="bg-green-900/30 p-3 rounded text-center">
              <div className="text-slate-400 text-xs">Aktualisiert</div>
              <div className="text-xl font-bold text-green-400">{results.updated}</div>
            </div>
            <div className="bg-red-900/30 p-3 rounded text-center">
              <div className="text-slate-400 text-xs">Fehlgeschlagen</div>
              <div className="text-xl font-bold text-red-400">{results.failed}</div>
            </div>
          </div>

          {results.updated > 0 && (
            <Alert className="bg-green-900/20 border-green-700">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-200">
                {results.updated} Schweizer Aktien erfolgreich aktualisiert!
              </AlertDescription>
            </Alert>
          )}

          {results.failed > 0 && (
            <Alert className="bg-red-900/20 border-red-700">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-red-200">
                {results.failed} Aktien konnten nicht aktualisiert werden.
              </AlertDescription>
            </Alert>
          )}

          <details className="bg-slate-700 rounded p-3">
            <summary className="cursor-pointer text-white font-semibold">Details anzeigen</summary>
            <div className="space-y-2 mt-3 max-h-60 overflow-y-auto">
              {results.results.map((r: any, i: number) => (
                <div
                  key={i}
                  className={`p-2 rounded text-sm ${
                    r.status === 'success' ? 'bg-green-900/20' : 'bg-red-900/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-mono text-xs">{r.ticker}</span>
                    <span className={r.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                      {r.status === 'success' ? '✅' : '❌'}
                    </span>
                  </div>
                  {r.status === 'success' && r.updates && (
                    <div className="text-xs text-slate-400 mt-1">
                      {r.updates.currency && `Currency: ${r.updates.currency} | `}
                      {r.updates.currentPrice && `Price: ${parseFloat(r.updates.currentPrice).toFixed(2)} | `}
                      {r.updates.sharpeRatio && `Sharpe: ${parseFloat(r.updates.sharpeRatio).toFixed(2)}`}
                    </div>
                  )}
                  {r.status === 'failed' && (
                    <div className="text-xs text-red-400 mt-1">{r.error}</div>
                  )}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
