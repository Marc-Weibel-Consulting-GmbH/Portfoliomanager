import { Shield, Database, Grid3x3, PieChart, Key, BarChart3, Calculator, Camera } from "lucide-react";
import { useLocation } from "wouter";

type AdminTab = "overview" | "stocks" | "categories" | "sectors" | "secrets" | "kpis" | "berechnungen" | "screenshots";

export function AdminTopbar() {
  const [location, setLocation] = useLocation();
  
  // Determine active tab from URL
  const getActiveTab = (): AdminTab => {
    if (location.startsWith("/admin/stocks")) return "stocks";
    if (location.startsWith("/admin/categories")) return "categories";
    if (location.startsWith("/admin/sectors")) return "sectors";
    if (location.startsWith("/admin/secrets")) return "secrets";
    if (location.startsWith("/admin/kpis")) return "kpis";
    if (location.startsWith("/admin/berechnungen")) return "berechnungen";
    if (location.startsWith("/admin/screenshots")) return "screenshots";
    return "overview";
  };
  
  const activeTab = getActiveTab();

  const tabs = [
    { id: "overview" as const, label: "Übersicht", icon: Shield, path: "/admin" },
    { id: "stocks" as const, label: "Aktien-Verwaltung", icon: Database, path: "/admin/stocks" },
    { id: "categories" as const, label: "Kategorien-Verwaltung", icon: Grid3x3, path: "/admin/categories" },
    { id: "sectors" as const, label: "Sektoren-Verwaltung", icon: PieChart, path: "/admin/sectors" },
    { id: "kpis" as const, label: "KPI-Verwaltung", icon: BarChart3, path: "/admin/kpis" },
    { id: "secrets" as const, label: "Secrets-Verwaltung", icon: Key, path: "/admin/secrets" },
    { id: "berechnungen" as const, label: "Berechnungen", icon: Calculator, path: "/admin/berechnungen" },
    { id: "screenshots" as const, label: "Screenshots", icon: Camera, path: "/admin/screenshots" },
  ];

  return (
    <div className="bg-zinc-900/50 border-b border-zinc-800 mb-6 -mx-6 px-6">
      <nav className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setLocation(tab.path)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap rounded-t-lg
                ${isActive 
                  ? "bg-teal-500/10 text-teal-400" 
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }
              `}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
