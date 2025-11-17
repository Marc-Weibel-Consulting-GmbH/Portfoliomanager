import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, TrendingUp, TrendingDown, AlertCircle, FileText, DollarSign } from "lucide-react";

interface WeeklyOverviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WeeklyOverviewDialog({ open, onOpenChange }: WeeklyOverviewDialogProps) {
  const { data, isLoading, error } = trpc.weeklyOverview.generate.useQuery(undefined, {
    enabled: open, // Only fetch when dialog is open
  });

  const getEventIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'earnings':
      case 'gewinn':
        return <FileText className="h-4 w-4 text-blue-400" />;
      case 'price_move':
      case 'kursbewegung':
        return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'm&a':
      case 'übernahme':
        return <DollarSign className="h-4 w-4 text-yellow-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-400" />
            KI-Wochenüberblick
          </DialogTitle>
          <p className="text-sm text-slate-400 mt-2">
            Wichtige Ereignisse der letzten 7 Tage für dein Portfolio
          </p>
        </DialogHeader>

        <div className="mt-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              <span className="ml-3 text-slate-300">Analysiere Portfolio-News...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
              <p className="text-red-400">Fehler beim Laden der Übersicht: {error.message}</p>
            </div>
          )}

          {data && data.overview && data.overview.length === 0 && (
            <div className="bg-slate-700/50 rounded-lg p-8 text-center">
              <AlertCircle className="h-12 w-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-300 text-lg">Keine wichtigen Ereignisse diese Woche</p>
              <p className="text-slate-400 text-sm mt-2">
                Deine Portfolio-Aktien hatten keine signifikanten News oder Kursbewegungen.
              </p>
            </div>
          )}

          {data && data.overview && data.overview.length > 0 && (
            <div className="space-y-4">
              {data.overview.map((stock: any, index: number) => (
                <div
                  key={index}
                  className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-slate-500 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{stock.companyName}</h3>
                      <p className="text-sm text-slate-400">{stock.ticker}</p>
                    </div>
                  </div>

                  <p className="text-slate-200 mb-3">{stock.summary}</p>

                  <div className="space-y-2">
                    {stock.events.map((event: any, eventIndex: number) => (
                      <div
                        key={eventIndex}
                        className="flex items-start gap-3 bg-slate-800/50 rounded p-3"
                      >
                        <div className="mt-0.5">{getEventIcon(event.type)}</div>
                        <div className="flex-1">
                          <p className="text-sm text-slate-300">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
          >
            Schliessen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
