// Copilot insights — vertical stack of 3-5 priority items. Each insight
// has a severity (positive / watch / info) and optionally an action link.

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Info, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import type { CopilotInsight } from "./types";

interface CopilotInsightsProps {
  insights: CopilotInsight[];
}

const ICON_BY_SEVERITY = {
  positive: CheckCircle2,
  watch: AlertTriangle,
  info: Info,
};

const COLOR_BY_SEVERITY = {
  positive: { bg: "bg-emerald-500/15", border: "border-emerald-500", text: "text-emerald-400" },
  watch: { bg: "bg-amber-500/15", border: "border-amber-500", text: "text-amber-400" },
  info: { bg: "bg-[#00CFC1]/15", border: "border-[#00CFC1]", text: "text-[#00CFC1]" },
};

export function CopilotInsights({ insights }: CopilotInsightsProps) {
  return (
    <Card className="bg-gradient-to-br from-[#1a1f2e] to-[#0f1420] border-[#00CFC1]/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <div className="text-sm font-semibold text-white">KI-Insights</div>
          <div className="text-[11px] text-gray-400">
            Copilot · {insights.length} neue
          </div>
        </div>
        <Badge className="bg-[#00CFC1]/20 text-[#00CFC1] border-[#00CFC1]/40">Live</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        {insights.map(insight => {
          const Icon = ICON_BY_SEVERITY[insight.severity];
          const colors = COLOR_BY_SEVERITY[insight.severity];

          const body = (
            <div
              className={`flex gap-3 px-3 py-2.5 bg-[#0a0f1a]/60 rounded-lg border-l-2 ${colors.border}`}
            >
              <div className={`shrink-0 w-7 h-7 rounded-md ${colors.bg} ${colors.text} flex items-center justify-center`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white mb-0.5">
                  {insight.title}
                </div>
                <div className="text-[11px] text-gray-400 leading-relaxed mb-1.5">
                  {insight.body}
                </div>
                {insight.action && (
                  <div className="text-[11px] text-[#00CFC1] font-medium flex items-center gap-1">
                    {insight.action}
                    <ArrowRight className="h-3 w-3" />
                  </div>
                )}
              </div>
            </div>
          );

          return insight.actionHref ? (
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
