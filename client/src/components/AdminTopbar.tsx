import { Shield, Database, Grid3x3, PieChart, Key } from "lucide-react";
import { useLocation } from "wouter";

type AdminTab = "overview" | "stocks" | "categories" | "sectors" | "secrets";

export function AdminTopbar() {
  const [location, setLocation] = useLocation();
  
  // Determine active tab from URL
  const getActiveTab = (): AdminTab => {
    if (location.startsWith("/admin/stocks")) return "stocks";
    if (location.startsWith("/admin/categories")) return "categories";
    if (location.startsWith("/admin/sectors")) return "sectors";
    if (location.startsWith("/admin/secrets")) return "secrets";
    return "overview";
  };
  
  const activeTab = getActiveTab();

  const tabs = [
    { id: "overview" as const, label: "Übersicht", icon: Shield, path: "/admin" },
    { id: "stocks" as const, label: "Aktien-Verwaltung", icon: Database, path: "/admin/stocks" },
    { id: "categories" as const, label: "Kategorien-Verwaltung", icon: Grid3x3, path: "/admin/categories" },
    { id: "sectors" as const, label: "Sektoren-Verwaltung", icon: PieChart, path: "/admin/sectors" },
    { id: "secrets" as const, label: "Secrets-Verwaltung", icon: Key, path: "/admin/secrets" },
  ];

  return (
    <div className="border-b border-border mb-6">
      <nav className="flex gap-1 -mb-px overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setLocation(tab.path)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${isActive 
                  ? "border-teal-500 text-teal-500" 
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
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
