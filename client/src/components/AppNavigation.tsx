/**
 * @deprecated Ersetzt durch die konsolidierte Sidebar in `DashboardLayout.tsx`
 * (flache 6 Top-Level-Einträge, IA-Konsolidierung — siehe design/handoff/02-IA-Routes.md).
 * Diese Komponente wird nirgends mehr importiert und in PR 03 gelöscht. Nicht weiterverwenden.
 */
import { Button } from "@/components/ui/button";
import { APP_LOGO, APP_TITLE } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { 
  LayoutDashboard, 
  TrendingUp, 
  PieChart, 
  Newspaper, 
  Settings, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";

export function AppNavigation() {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Portfolio", path: "/dashboard", icon: PieChart },
    { label: "Märkte", path: "/newsroom", icon: TrendingUp },
    { label: "News", path: "/newsroom", icon: Newspaper },
  ];

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <nav className="sticky top-0 z-50 glassmorphism border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button 
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {APP_LOGO && <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-8" />}
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {APP_TITLE}
            </span>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "default" : "ghost"}
                  onClick={() => setLocation(item.path)}
                  className="gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLocation("/settings/notifications")}
                  title="Einstellungen"
                >
                  <Settings className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  title="Abmelden"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-border/50">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <Button
                    key={item.path}
                    variant={isActive ? "default" : "ghost"}
                    onClick={() => {
                      setLocation(item.path);
                      setMobileMenuOpen(false);
                    }}
                    className="justify-start gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
              <div className="border-t border-border/50 my-2" />
              <Button
                variant="ghost"
                onClick={() => {
                  setLocation("/settings/notifications");
                  setMobileMenuOpen(false);
                }}
                className="justify-start gap-2"
              >
                <Settings className="h-4 w-4" />
                Einstellungen
              </Button>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="justify-start gap-2"
              >
                <LogOut className="h-4 w-4" />
                Abmelden
              </Button>
              {user && (
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
