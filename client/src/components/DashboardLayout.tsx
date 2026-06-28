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
import { LayoutDashboard, LogOut, PanelLeft, TrendingUp, Settings, Bell, Calculator, FileText, Shield, ChevronDown, ChevronRight, Brain, Globe, Wallet, Wrench, Eye, Zap, FlaskConical } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import TrustpilotMini from "./trustpilot/TrustpilotMini";
import { FloatingChatButton } from "./FloatingChatButton";

// New flat sidebar structure from design handoff (6 top-level items)
type NavItem = { icon: any; label: string; path: string };
type NavGroup = { icon: any; label: string; items: NavItem[] };

type NavItemWithBadge = NavItem & { badge?: string };

const topLevelItems: NavItemWithBadge[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Wallet, label: "Portfolios", path: "/portfolios" },
  { icon: TrendingUp, label: "Aktien", path: "/aktien", badge: "9 Pages" },
  { icon: Globe, label: "Markt", path: "/markt", badge: "5 Pages" },
  { icon: Brain, label: "Copilot", path: "/copilot", badge: "3 Pages" },
];

const toolsGroup: NavGroup = {
  icon: Wrench,
  label: "Tools",
  items: [
    { icon: Bell, label: "Preisalarme", path: "/price-alerts" },
    { icon: Calculator, label: "Rechner", path: "/rechner" },
    { icon: FlaskConical, label: "Backtest", path: "/backtesting" },
    { icon: FileText, label: "Import", path: "/import" },
  ],
};

const settingsItem: NavItem = { icon: Settings, label: "Einstellungen", path: "/einstellungen" };

// Flat list for backwards compat (mobile header, active detection)
const menuItems: NavItem[] = [
  ...topLevelItems,
  ...toolsGroup.items,
  settingsItem,
];

const adminMenuItems = [
  { icon: Shield, label: "Admin", path: "/admin" },
  { icon: Eye, label: "Watchlist", path: "/admin/watchlist" },
  { icon: Zap, label: "Signal-Optimizer", path: "/admin/optimizer" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
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
  useEffect(() => {
    if (user && onboardingStatus !== undefined && !onboardingStatus.hasCompletedOnboarding && location !== "/onboarding") {
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
  const isMobile = useIsMobile();

  // Active detection: match top-level items or their sub-paths
  const activeMenuItem = menuItems.find(item =>
    location === item.path || location.startsWith(item.path + '/')
  ) ?? topLevelItems[0];

  // Fetch portfolios for sidebar submenu
  const { data: portfolios = [] } = trpc.portfolios.list.useQuery();

  // State for tools group
  const [toolsOpen, setToolsOpen] = useState(
    toolsGroup.items.some(i => location === i.path || location.startsWith(i.path + '/'))
  );

  // State for portfolio submenu
  const [portfolioSubmenuOpen, setPortfolioSubmenuOpen] = useState(
    location.startsWith('/portfolios')
  );

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
          <SidebarHeader className="h-16 justify-center border-b border-border/30">
            <div className="flex items-center gap-3 pl-3 pr-2 group-data-[collapsible=icon]:px-0 transition-all w-full">
              {isCollapsed ? (
                <div className="relative h-8 w-8 shrink-0 flex items-center justify-center bg-[#00CFC1]/20 rounded-md">
                  <span className="text-[#00CFC1] font-bold text-sm">P</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="h-8 w-8 shrink-0 flex items-center justify-center bg-[#00CFC1]/20 rounded-md">
                      <span className="text-[#00CFC1] font-bold text-sm">P</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-sm tracking-tight truncate text-foreground leading-tight">Portfoliomanager</span>
                      <span className="text-[10px] text-muted-foreground truncate leading-tight">Marc Weibel Consulting</span>
                    </div>
                  </div>
                  <button
                    onClick={toggleSidebar}
                    className="h-7 w-7 flex items-center justify-center hover:bg-accent rounded transition-colors focus:outline-none shrink-0"
                  >
                    <PanelLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {/* Top-level navigation items */}
              {topLevelItems.map(item => {
                const isActive = location === item.path || location.startsWith(item.path + '/');
                const isPortfolios = item.path === '/portfolios';
                const showPortfolioSubmenu = isPortfolios && portfolios.length > 0 && !isCollapsed;
                const portfolioBadge = isPortfolios && portfolios.length > 0 ? `${portfolios.length} Pages` : item.badge;

                return (
                  <SidebarMenuItem key={item.path}>
                    <div className="flex items-center">
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setLocation(item.path)}
                        tooltip={item.label}
                        className={`h-9 transition-all font-normal flex-1 rounded-md ${
                          isActive
                            ? 'bg-[#00CFC1]/15 text-[#00CFC1] font-medium hover:bg-[#00CFC1]/20'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                        }`}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#00CFC1]' : ''}`} />
                        <span className="flex-1">{item.label}</span>
                        {portfolioBadge && !isCollapsed && (
                          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-sm ${
                            isActive ? 'bg-[#00CFC1]/20 text-[#00CFC1]' : 'bg-white/10 text-muted-foreground'
                          }`}>{portfolioBadge}</span>
                        )}
                      </SidebarMenuButton>
                      {isPortfolios && portfolios.length > 0 && !isCollapsed && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setPortfolioSubmenuOpen(!portfolioSubmenuOpen); }}
                          className="h-7 w-5 flex items-center justify-center hover:bg-accent rounded transition-colors"
                        >
                          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${portfolioSubmenuOpen ? '' : '-rotate-90'}`} />
                        </button>
                      )}
                    </div>
                    {/* Portfolio submenu — matches design: portfolio names + Neues Portfolio */}
                    {showPortfolioSubmenu && portfolioSubmenuOpen && (
                      <SidebarMenuSub>
                        {portfolios.slice(0, 6).map((portfolio: any) => (
                          <SidebarMenuSubItem key={portfolio.id}>
                            <SidebarMenuSubButton
                              isActive={location === `/portfolios/${portfolio.id}` || location.startsWith(`/portfolios/${portfolio.id}`)}
                              onClick={() => setLocation(`/portfolios/${portfolio.id}`)}
                              className="text-xs"
                            >
                              <span className="truncate">{portfolio.name}</span>
                              {portfolio.isLive === 1 && (
                                <span className="ml-auto text-[9px] text-emerald-400 font-medium">Live</span>
                              )}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            onClick={() => setLocation('/portfolio-builder')}
                            className="text-xs text-muted-foreground"
                          >
                            <span>Neues Portfolio</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}

              {/* Divider */}
              <div className="my-2 border-t border-border/50" />

              {/* Tools group */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setToolsOpen(!toolsOpen)}
                  tooltip="Tools"
                  className={`h-10 transition-all font-normal ${toolsGroup.items.some(i => location === i.path) ? 'text-primary' : ''}`}
                >
                  <Wrench className={`h-4 w-4 ${toolsGroup.items.some(i => location === i.path) ? "text-primary" : "text-muted-foreground"}`} />
                  <span>Tools</span>
                  {!isCollapsed && (
                    <ChevronRight className={`ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${toolsOpen ? 'rotate-90' : ''}`} />
                  )}
                </SidebarMenuButton>
                {toolsOpen && !isCollapsed && (
                  <SidebarMenuSub>
                    {toolsGroup.items.map(item => {
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

              {/* Settings */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location === settingsItem.path || location.startsWith(settingsItem.path + '/')}
                  onClick={() => setLocation(settingsItem.path)}
                  tooltip={settingsItem.label}
                  className={`h-9 transition-all font-normal rounded-md ${
                    (location === settingsItem.path || location.startsWith(settingsItem.path + '/'))
                      ? 'bg-[#00CFC1]/15 text-[#00CFC1] font-medium hover:bg-[#00CFC1]/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
                >
                  <Settings className={`h-4 w-4 ${(location === settingsItem.path || location.startsWith(settingsItem.path + '/')) ? 'text-[#00CFC1]' : ''}`} />
                  <span>{settingsItem.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Admin section */}
              {user?.role === 'admin' && (
                <>
                  <div className="my-2 border-t border-border/50" />
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setLocation('/admin')}
                      tooltip="Admin"
                      isActive={location.startsWith('/admin')}
                      className={`h-9 transition-all font-normal rounded-md ${
                        location.startsWith('/admin')
                          ? 'bg-[#00CFC1]/15 text-[#00CFC1] font-medium hover:bg-[#00CFC1]/20'
                          : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                      }`}
                    >
                      <Shield className={`h-4 w-4 ${location.startsWith('/admin') ? 'text-[#00CFC1]' : 'text-muted-foreground'}`} />
                      <span>Admin</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent/60 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 shrink-0 bg-[#00CFC1]/20 border-[#00CFC1]/40 border">
                    <AvatarFallback className="text-xs font-semibold text-[#00CFC1] bg-transparent">
                      {(user?.name || user?.username || 'U').substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-foreground">
                      {user?.username || user?.name || user?.email || "-"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] font-semibold text-[#00CFC1] bg-[#00CFC1]/15 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">Premium</span>
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Abmelden</span>
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
