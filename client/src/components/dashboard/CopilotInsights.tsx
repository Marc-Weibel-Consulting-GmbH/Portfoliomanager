// Copilot insights card for dashboard.
// Per IA-Optimierung spec: "Copilot Insights" title with LIVE badge,
// subtitle "3 neue · AI · vor 12 Min.", warning/check icons, CTA links.

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Info, ArrowRight, RefreshCw, Sparkles } from "lucide-react";
import { Link } from "wouter";
import type { CopilotInsight } from "./types";

interface CopilotInsightsProps {
  insights: CopilotInsight[];
  loading?: boolean;
  onRefresh?: () => void;
  onAction?: (insight: CopilotInsight) => void;
}

const ICON_BY_SEVERITY = {
  positive: CheckCircle2,
  watch: AlertTriangle,
  info: Info,
};

const COLOR_BY_SEVERITY = {
  positive: { bg: "bg-emerald-500/15", border: "border-emerald-500", text: "text-emerald-400", icon: "text-emerald-400" },
  watch: { bg: "bg-amber-500/15", border: "border-amber-500", text: "text-amber-400", icon: "text-amber-400" },
  info: { bg: "bg-[#00CFC1]/15", border: "border-[#00CFC1]", text: "text-[#00CFC1]", icon: "text-[#00CFC1]" },
};

export function CopilotInsights({ insights, loading, onRefresh, onAction }: CopilotInsightsProps) {
  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            Copilot Insights
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-emerald-500/50 text-emerald-400 bg-emerald-500/10 font-medium">
              LIVE
            </Badge>
          </div>
          <div className="text-[11px] text-gray-400">
            {insights.length > 0 ? `${insights.length} neue` : "Keine"} · AI · vor 12 Min.
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="h-7 px-2 text-[10px] text-gray-400 hover:text-[#00CFC1] hover:bg-[#00CFC1]/10"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
          Aktualisieren
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {loading && insights.length === 0 && (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Insights werden generiert...
          </div>
        )}

        {!loading && insights.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Sparkles className="h-8 w-8 text-gray-600 mb-2" />
            <div className="text-sm text-gray-400">Keine Insights verfügbar</div>
            <div className="text-[11px] text-gray-500 mt-1 mb-3">
              Aktiviere ein Live-Portfolio oder klicke "Aktualisieren"
            </div>
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                className="text-[11px] border-[#00CFC1]/40 text-[#00CFC1] hover:bg-[#00CFC1]/10"
              >
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Jetzt generieren
              </Button>
            )}
          </div>
        )}

        {insights.slice(0, 4).map(insight => {
          const Icon = ICON_BY_SEVERITY[insight.severity];
          const colors = COLOR_BY_SEVERITY[insight.severity];

          const body = (
            <div
              className={`flex gap-3 px-3 py-2.5 bg-[#0a0f1a]/60 rounded-lg border-l-2 ${colors.border}`}
            >
              <div className={`shrink-0 w-7 h-7 rounded-md ${colors.bg} ${colors.icon} flex items-center justify-center`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white mb-0.5">
                  {insight.title}
                </div>
                <div className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">
                  {insight.body}
                </div>
                {insight.action && (
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#00CFC1] bg-[#00CFC1]/10 border border-[#00CFC1]/30 px-2.5 py-1 rounded-md hover:bg-[#00CFC1]/20 transition-colors">
                      <ArrowRight className="h-3 w-3" />
                      {insight.action}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );

          return onAction ? (
            <div key={insight.id} className="block hover:opacity-90 transition-opacity cursor-pointer" onClick={() => onAction(insight)}>
              {body}
            </div>
          ) : insight.actionHref ? (
            <Link key={insight.id} href={insight.actionHref} className="block hover:opacity-90 transition-opacity">
              {body}
            </Link>
          ) : (
            <div key={insight.id}>{body}</div>
          );
        })}
      </CardContent>
    </Card>
  );
}
