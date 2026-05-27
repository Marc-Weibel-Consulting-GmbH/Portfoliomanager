// Dashboard header — DASHBOARD label, greeting, date, scope selector.
// Per IA-Optimierung spec: small label, title, subtitle, tabs top-right.

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/_core/hooks/useAuth";
import type { ScopeId } from "./types";

interface DashboardHeaderProps {
  scope: ScopeId;
  onScopeChange: (scope: ScopeId) => void;
  portfolios: { id: number; name: string; isLive: boolean }[];
}

export function DashboardHeader({ scope, onScopeChange, portfolios }: DashboardHeaderProps) {
  const { user } = useAuth();
  const scopeStr = scope === "aggregate" ? "aggregate" : String(scope);
  const now = new Date();
  const timeStr = now.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-[#00CFC1]/70 font-semibold mb-1">
          Dashboard
        </div>
        <h1 className="text-2xl font-semibold text-white">
          Willkommen zurück, {user?.name?.split(" ")[0] ?? "Marc"}
        </h1>
        <p className="text-[12px] text-gray-400 mt-0.5">
          Aggregiert über alle Live-Portfolios · Daten von heute, {timeStr}
        </p>
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
