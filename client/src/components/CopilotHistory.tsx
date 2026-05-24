/**
 * CopilotHistory Component
 * =========================
 * Shows past Copilot recommendations and their hit rate over time.
 */

import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  History,
  TrendingUp,
  TrendingDown,
  Target,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';

interface CopilotHistoryProps {
  portfolioId: number;
}

export default function CopilotHistory({ portfolioId }: CopilotHistoryProps) {
  const { data: history, isLoading } = trpc.copilot.getHistory.useQuery(
    { portfolioId, limit: 50 },
    { staleTime: 60 * 1000 }
  );
  const { data: stats } = trpc.copilot.getHistoryStats.useQuery(
    { portfolioId },
    { staleTime: 60 * 1000 }
  );
  const evaluateMutation = trpc.copilot.evaluateHistory.useMutation();
  const utils = trpc.useUtils();

  const handleEvaluate = async () => {
    await evaluateMutation.mutateAsync();
    utils.copilot.getHistory.invalidate();
    utils.copilot.getHistoryStats.invalidate();
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Copilot-Historie & Trefferquote
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEvaluate}
              disabled={evaluateMutation.isPending}
            >
              {evaluateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Auswerten</span>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Vergangene Empfehlungen und deren tatsächliche Performance.
          </p>
        </CardHeader>
        {stats && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label="Empfehlungen" value={String(stats.totalRecommendations || 0)} />
              <StatCard label="Ausgewertet" value={String(stats.evaluatedRecommendations || 0)} />
              <StatCard
                label="Hit Rate (30T)"
                value={stats.evaluatedRecommendations ? `${((stats.hitRate30d || 0) * 100).toFixed(0)}%` : '–'}
                positive={(stats.hitRate30d || 0) > 0.5}
              />
              <StatCard
                label="Ø Rendite (30T)"
                value={stats.avgReturn30d ? `${stats.avgReturn30d > 0 ? '+' : ''}${(stats.avgReturn30d * 100).toFixed(1)}%` : '–'}
                positive={(stats.avgReturn30d || 0) > 0}
              />
              <StatCard
                label="Ø Rendite (90T)"
                value={stats.avgReturn90d ? `${stats.avgReturn90d > 0 ? '+' : ''}${(stats.avgReturn90d * 100).toFixed(1)}%` : '–'}
                positive={(stats.avgReturn90d || 0) > 0}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* History List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : history && history.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Letzte Empfehlungen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((rec: any) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-muted hover:bg-muted/20"
                >
                  <div className="flex items-center gap-3">
                    {rec.signal === 'buy' || rec.signal === 'strong_buy' ? (
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                    ) : rec.signal === 'sell' || rec.signal === 'strong_sell' ? (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    ) : (
                      <Target className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{rec.ticker}</span>
                        <span className="text-xs text-muted-foreground">{rec.companyName}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">
                          {rec.signal}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Score: {rec.rankScore}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(rec.createdAt).toLocaleDateString('de-CH')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    {rec.evaluatedAt ? (
                      <div>
                        <div className="flex items-center gap-1 justify-end">
                          {rec.wasCorrect ? (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          )}
                          <span className={`text-xs font-mono ${
                            Number(rec.returnSinceSignal) > 0 ? 'text-emerald-500' : 'text-red-500'
                          }`}>
                            {Number(rec.returnSinceSignal) > 0 ? '+' : ''}
                            {(Number(rec.returnSinceSignal) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {rec.wasCorrect ? 'Treffer' : 'Fehlschlag'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Offen</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Noch keine Copilot-Empfehlungen gespeichert. Empfehlungen werden automatisch 
              bei jeder Analyse gespeichert.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="text-center p-3 rounded-lg border border-muted/50">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-lg font-bold ${
        positive === true ? 'text-emerald-500' : positive === false ? 'text-red-500' : ''
      }`}>
        {value}
      </p>
    </div>
  );
}
