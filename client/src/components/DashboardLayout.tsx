import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_LOGO, APP_TITLE } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, TrendingUp, Calendar, LineChart, Signal, Database, Calculator, Settings, Mail, Briefcase, Activity, Grid3x3, PieChart, Bell, Zap, FolderKanban, BarChart3, Sparkles, FileText, Shield, Key, ChevronDown, ChevronRight, Receipt, ShieldAlert, Search, Eye, Brain, Globe, Wallet, Target, Gauge, Wrench, Droplets } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import TrustpilotMini from "./trustpilot/TrustpilotMini";
import { FloatingChatButton } from "./FloatingChatButton";

// Grouped navigation: 3 main categories + Tools
type NavItem = { icon: any; label: string; path: string };
type NavGroup = { icon: any; label: string; items: NavItem[] };

const topLevelItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
];

const menuGroups: NavGroup[] = [
  {
    icon: Globe,
    label: "Markt-Regime",
    items: [
      { icon: Gauge, label: "Regime-Dashboard", path: "/market-regime" },
      { icon: BarChart3, label: "Makro-Indikatoren", path: "/analysis" },
      { icon: Grid3x3, label: "Sektor-Heatmap", path: "/sector-heatmap" },
    ],
  },
  {
    icon: Wallet,
    label: "Portfolio",
    items: [
      { icon: FolderKanban, label: "Übersicht", path: "/portfolios" },
      { icon: PieChart, label: "Optimierung", path: "/portfolio-optimizer" },
      { icon: Receipt, label: "Transaktionen", path: "/transactions" },
      { icon: FileText, label: "Performance & Reports", path: "/reports" },
      { icon: TrendingUp, label: "Dividenden-Kalender", path: "/dividends" },
    ],
  },
  {
    icon: Target,
    label: "Einzeltitel-Analyse",
    items: [
      { icon: Search, label: "Aktien suchen", path: "/invest" },
      { icon: Zap, label: "Signale & Scores", path: "/signals" },
      { icon: Activity, label: "Technische Analyse", path: "/technical-analysis" },
      { icon: Calculator, label: "DCF-Bewertung", path: "/dcf-valuation" },
      { icon: Brain, label: "KI-Prognose", path: "/prediction" },
      { icon: LineChart, label: "Backtesting", path: "/backtesting" },
    ],
  },
  {
    icon: Wrench,
    label: "Tools",
    items: [
      { icon: Bell, label: "Preisalarme", path: "/price-alerts" },
      { icon: ShieldAlert, label: "Risiko-Analyse", path: "/risk-dashboard" },
      { icon: Calculator, label: "Rechner", path: "/rechner" },
      { icon: Settings, label: "Einstellungen", path: "/einstellungen" },
    ],
  },
];

// Flat list for backwards compat (mobile header, active detection)
const menuItems: NavItem[] = [
  ...topLevelItems,
  ...menuGroups.flatMap(g => g.items),
];

const adminMenuItems = [
  { icon: Shield, label: "Admin", path: "/admin" },
  { icon: Eye, label: "Watchlist", path: "/admin/watchlist" },
  { icon: Zap, label: "Signal-Optimizer", path: "/admin/optimizer" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const [location, setLocation] = useLocation();
  const { data: onboardingStatus } = trpc.onboarding.hasCompletedOnboarding.useQuery(undefined, {
    enabled: !!user,
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  // Redirect to onboarding only if user hasn't completed registration
  // Users who have completed registration but not onboarding can skip onboarding
  useEffect(() => {
    if (user && onboardingStatus !== undefined && !onboardingStatus.hasCompletedOnboarding && location !== "/onboarding") {
      // Only redirect to onboarding if user hasn't completed registration
      // This means they are truly new users who need to go through the onboarding flow
      if (!user.hasCompletedRegistration) {
        setLocation("/onboarding");
      }
    }
  }, [user, onboardingStatus, location, setLocation]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <div className="relative group">
              <div className="relative">
                <img
                  src={APP_LOGO}
                  alt={APP_TITLE}
                  className="h-20 w-20 rounded-xl object-cover shadow"
                />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">{APP_TITLE}</h1>
              <p className="text-sm text-muted-foreground">
                Please sign in to continue
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              window.location.href = "/login";
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();
  
  // Fetch portfolios for sidebar submenu
  const { data: portfolios = [] } = trpc.portfolios.list.useQuery();
  
  // State for collapsible group menus
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuGroups.forEach(g => {
      initial[g.label] = g.items.some(i => location.startsWith(i.path));
    });
    return initial;
  });
  const toggleGroup = (label: string) => setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  
  // State for portfolio submenu
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(true);

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 pl-2 group-data-[collapsible=icon]:px-0 transition-all w-full">
              {isCollapsed ? (
                <div className="relative h-8 w-8 shrink-0 group">
                  <img
                    src={APP_LOGO}
                    className="h-8 w-8 rounded-md object-cover ring-1 ring-border"
                    alt="Logo"
                  />
                  <button
                    onClick={toggleSidebar}
                    className="absolute inset-0 flex items-center justify-center bg-accent rounded-md ring-1 ring-border opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <PanelLeft className="h-4 w-4 text-foreground" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={APP_LOGO}
                      className="h-8 w-8 rounded-md object-cover ring-1 ring-border shrink-0"
                      alt="Logo"
                    />
                    <span className="font-semibold tracking-tight truncate">
                      {APP_TITLE}
                    </span>
                  </div>
                  <button
                    onClick={toggleSidebar}
                    className="ml-auto h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  >
                    <PanelLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                </>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {/* Top-level: Dashboard */}
              {topLevelItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal"
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Grouped navigation sections */}
              {menuGroups.map(group => {
                const isGroupOpen = openGroups[group.label] ?? false;
                const hasActiveChild = group.items.some(i => location === i.path || location.startsWith(i.path + '/'));
                const GroupIcon = group.icon;
                return (
                  <SidebarMenuItem key={group.label}>
                    <SidebarMenuButton
                      onClick={() => toggleGroup(group.label)}
                      tooltip={group.label}
                      className={`h-10 transition-all font-medium ${hasActiveChild ? 'text-primary' : ''}`}
                    >
                      <GroupIcon className={`h-4 w-4 ${hasActiveChild ? "text-primary" : "text-muted-foreground"}`} />
                      <span>{group.label}</span>
                      {!isCollapsed && (
                        <ChevronRight className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isGroupOpen ? 'rotate-90' : ''}`} />
                      )}
                    </SidebarMenuButton>
                    {isGroupOpen && !isCollapsed && (
                      <SidebarMenuSub>
                        {group.items.map(item => {
                          const isActive = location === item.path;
                          const isPortfolioPage = location.startsWith('/portfolios/') && item.path === '/portfolios';
                          const showPortfolios = item.path === '/portfolios' && portfolios.length > 0;
                          const ItemIcon = item.icon;
                          return (
                            <SidebarMenuSubItem key={item.path}>
                              <div className="flex items-center">
                                <SidebarMenuSubButton
                                  isActive={isActive || isPortfolioPage}
                                  onClick={() => setLocation(item.path)}
                                  className="text-sm flex-1"
                                >
                                  <ItemIcon className={`h-3.5 w-3.5 ${isActive || isPortfolioPage ? "text-primary" : ""}`} />
                                  <span>{item.label}</span>
                                </SidebarMenuSubButton>
                                {showPortfolios && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setIsSubmenuOpen(!isSubmenuOpen); }}
                                    className="h-8 w-6 flex items-center justify-center hover:bg-accent rounded transition-colors"
                                  >
                                    <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isSubmenuOpen ? '' : '-rotate-90'}`} />
                                  </button>
                                )}
                              </div>
                              {showPortfolios && isSubmenuOpen && (
                                <SidebarMenuSub>
                                  {portfolios.slice(0, 6).map((portfolio: any) => (
                                    <SidebarMenuSubItem key={portfolio.id}>
                                      <SidebarMenuSubButton
                                        isActive={location === `/portfolios/${portfolio.id}`}
                                        onClick={() => setLocation(`/portfolios/${portfolio.id}`)}
                                        className="text-xs"
                                      >
                                        <span className="truncate flex items-center gap-1.5">
                                          {portfolio.name}
                                          {portfolio.isLive && <span className="text-[9px] font-medium text-[#00CFC1] bg-[#00CFC1]/10 px-1 py-0.5 rounded">Live</span>}
                                        </span>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  ))}
                                </SidebarMenuSub>
                              )}
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}

              {/* Admin section */}
              {user?.role === 'admin' && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => toggleGroup('Admin')}
                    tooltip="Admin"
                    className={`h-10 transition-all font-medium ${location.startsWith('/admin') ? 'text-primary' : ''}`}
                  >
                    <Shield className={`h-4 w-4 ${location.startsWith('/admin') ? "text-primary" : "text-muted-foreground"}`} />
                    <span>Admin</span>
                    {!isCollapsed && (
                      <ChevronRight className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${openGroups['Admin'] ? 'rotate-90' : ''}`} />
                    )}
                  </SidebarMenuButton>
                  {openGroups['Admin'] && !isCollapsed && (
                    <SidebarMenuSub>
                      {adminMenuItems.map(item => {
                        const isActive = location === item.path;
                        const ItemIcon = item.icon;
                        return (
                          <SidebarMenuSubItem key={item.path}>
                            <SidebarMenuSubButton
                              isActive={isActive}
                              onClick={() => setLocation(item.path)}
                              className="text-sm"
                            >
                              <ItemIcon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : ""}`} />
                              <span>{item.label}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-xs text-muted-foreground truncate leading-none mb-1">
                      Eingeloggt als:
                    </p>
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.username || user?.name || user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? APP_TITLE}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
        
        {/* Trustpilot Footer */}
        <footer className="border-t border-slate-700 bg-slate-900 p-4">
          <div className="max-w-7xl mx-auto">
            <TrustpilotMini />
          </div>
        </footer>
      </SidebarInset>
      
      {/* Floating Chat Button */}
      <FloatingChatButton />
    </>
  );
}
