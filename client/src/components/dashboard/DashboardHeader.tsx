// Dashboard header — title, date, scope (aggregate vs single portfolio).
// Shows all portfolios (live and demo) in the selector.

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/_core/hooks/useAuth";
import { formatDate } from "./format";
import type { ScopeId } from "./types";

interface DashboardHeaderProps {
  scope: ScopeId;
  onScopeChange: (scope: ScopeId) => void;
  portfolios: { id: number; name: string; isLive: boolean }[];
}

export function DashboardHeader({ scope, onScopeChange, portfolios }: DashboardHeaderProps) {
  const { user } = useAuth();
  const scopeStr = scope === "aggregate" ? "aggregate" : String(scope);

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-2 mb-1 text-[11px] uppercase tracking-wider text-gray-400">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Live · {formatDate()}</span>
        </div>
        <h1 className="text-2xl font-semibold text-white">
          Willkommen zurück, {user?.name?.split(" ")[0] ?? "Marc"}
        </h1>
      </div>

      {portfolios.length > 0 && (
        <Tabs
          value={scopeStr}
          onValueChange={v => onScopeChange(v === "aggregate" ? "aggregate" : Number(v))}
        >
          <TabsList className="bg-[#0f1420] border border-white/10 flex-wrap h-auto gap-0.5 p-1">
            <TabsTrigger
              value="aggregate"
              className="data-[state=active]:bg-[#00CFC1]/20 data-[state=active]:text-[#00CFC1] text-xs"
            >
              Aggregiert
            </TabsTrigger>
            {portfolios.map(p => (
              <TabsTrigger
                key={p.id}
                value={String(p.id)}
                className="data-[state=active]:bg-[#00CFC1]/20 data-[state=active]:text-[#00CFC1] text-xs"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${p.isLive ? "bg-emerald-400" : "bg-gray-500"}`}
                  />
                  {p.name}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
    </div>
  );
}
