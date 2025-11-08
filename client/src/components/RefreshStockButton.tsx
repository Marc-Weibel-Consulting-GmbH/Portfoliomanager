import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface RefreshStockButtonProps {
  ticker: string;
}

export function RefreshStockButton({ ticker }: RefreshStockButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const utils = trpc.useUtils();

  const refreshMutation = trpc.stocks.refreshStock.useMutation({
    onSuccess: () => {
      // Invalidate queries to refetch updated data
      utils.stocks.list.invalidate();
      toast.success(`${ticker} erfolgreich aktualisiert!`);
      setIsRefreshing(false);
    },
    onError: (error) => {
      toast.error(`Fehler beim Aktualisieren: ${error.message}`);
      setIsRefreshing(false);
    },
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshMutation.mutate(ticker);
  };

  return (
    <Button
      onClick={handleRefresh}
      disabled={isRefreshing}
      variant="outline"
      size="sm"
      className="bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
    >
      <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
      {isRefreshing ? "Lädt..." : "Aktualisieren"}
    </Button>
  );
}
