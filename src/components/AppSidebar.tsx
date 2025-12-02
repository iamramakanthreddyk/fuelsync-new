// React import not required with new JSX transform
import { Link, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { 
  Home,
  Upload,
  TrendingUp,
  Calendar,
  Fuel,
  FileText,
  Users, 
  Building2, 
  Settings,
  LogOut,
  BarChart3,
  Zap
} from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import FuelSyncLogo from './FuelSyncLogo';
import { useSidebar } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { isMobile: sidebarIsMobile, setOpenMobile, toggleSidebar, state } = useSidebar();
  // local hook to decide collapsible mode for Sidebar (ensures mobile uses Sheet)
  const isMobile = useIsMobile();

  // This sidebar is ONLY for owners and employees
  // Superadmins should never see this - they have their own layout
  if (user?.role === 'super_admin') {
    return null;
  }

  // Owner-specific menu items
  const ownerMenuItems = [
    {
      title: "Dashboard",
      url: "/owner/dashboard",
      icon: Home,
    },
    {
      title: "Quick Entry",
      url: "/owner/quick-entry",
      icon: Zap,
    },
    {
      title: "Stations",
      url: "/owner/stations",
      icon: Building2,
    },
    {
      title: "Employees",
      url: "/owner/employees",
      icon: Users,
    },
    {
      title: "Reports",
      url: "/owner/reports",
      icon: FileText,
    },
    {
      title: "Analytics",
      url: "/owner/analytics",
      icon: BarChart3,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
    },
  ];

  // Manager/Employee menu items
  const staffMenuItems = [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: Home,
    },
    {
      title: "Data Entry",
      url: "/data-entry",
      icon: Upload,
    },
    {
      title: "Sales",
      url: "/sales", 
      icon: TrendingUp,
    },
    {
      title: "Daily Closure",
      url: "/daily-closure",
      icon: Calendar,
    },
    {
      title: "Pumps",
      url: "/pumps",
      icon: Fuel,
    },
    {
      title: "Reports",
      url: "/reports",
      icon: FileText,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
    },
  ];

  const menuItems = user?.role === 'owner' ? ownerMenuItems : staffMenuItems;

  const iconColorMap: Record<string, string> = {
    Dashboard: 'text-[#2B6EF6]',
    'Quick Entry': 'text-[#0EA5E9]',
    Stations: 'text-[#7C3AED]',
    Employees: 'text-[#F97316]',
    Reports: 'text-[#10B981]',
    Analytics: 'text-[#EF4444]',
    Settings: 'text-[#64748B]',
    'Data Entry': 'text-[#0EA5E9]',
    Sales: 'text-[#F59E0B]',
    'Daily Closure': 'text-[#06B6D4]',
    Pumps: 'text-[#3B82F6]',
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Helper to close sidebar on mobile when a menu item is clicked
  const handleItemClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  // Determine dashboard URL based on user role
  const dashboardUrl = user?.role === 'owner' ? '/owner/dashboard' : '/dashboard';

  return (
    <Sidebar
      collapsible={isMobile ? 'offcanvas' : 'none'}
      className={cn(
        state === 'collapsed' ? 'w-20' : 'w-56',
        'flex flex-col bg-white border-r border-border shadow-sm overflow-auto'
      )}
      style={
        ( {
          // For fixed header: mobile header is h-14 (3.5rem), desktop h-16 (4rem)
          marginTop: isMobile ? '3.5rem' : '4rem',
          height: isMobile ? 'calc(100vh - 3.5rem)' : 'calc(100vh - 4rem)'
        } as React.CSSProperties )
      }
    >
      <SidebarHeader className="flex items-center justify-between py-2 px-2">
        <Link to={dashboardUrl} className="flex items-center gap-3">
          <span className={state === 'collapsed' ? 'hidden' : 'font-semibold text-xl tracking-tight text-slate-800'}>FuelSync</span>
        </Link>
      </SidebarHeader>
      {/* Compact profile block to utilize header/space */}
      <div className="px-3 mb-2">
        <div className="flex items-center gap-3 px-2 py-3 rounded">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-base font-semibold">{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</div>
          <div className={state === 'collapsed' ? 'hidden' : 'flex-1 truncate'}>
            <div className="text-sm font-medium text-slate-800 truncate">{user?.name || 'User'}</div>
            <div className="text-sm text-slate-500 truncate">{user?.role}</div>
          </div>
        </div>
      </div>
      <SidebarContent className="flex-1 flex flex-col">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1"></SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                // Highlight if current path starts with item.url (for subpages)
                const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      isActive={isActive}
                      className={isActive ? "bg-gray-100 text-slate-900 font-semibold" : ""}
                    >
                      <Link
                        to={item.url}
                        onClick={handleItemClick}
                        className={cn(
                          "flex items-center transition-colors rounded-md",
                          // on desktop collapsed, center icons; otherwise use roomy, touch-friendly padding
                          state === 'collapsed' && !isMobile ? 'justify-center p-3' : 'gap-3 px-4 py-3'
                        )}
                      >
                        <span
                          className={cn(
                            'inline-flex items-center justify-center rounded-full w-10 h-10',
                            isActive ? 'bg-primary/10 text-primary' : 'bg-white'
                          )}
                        >
                          <item.icon className={cn(isActive ? 'w-6 h-6' : 'w-6 h-6', iconColorMap[item.title] || 'text-slate-500')} />
                        </span>
                        <span
                          className={cn(
                            isActive ? 'text-sm text-slate-900' : 'text-sm text-slate-600',
                            // show labels on mobile (sheet) even if collapsed; hide only when desktop collapsed
                            state === 'collapsed' && !isMobile ? 'hidden' : 'block'
                          )}
                        >
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {/* Floating edge toggle (arrow) - hover-visible on the sidebar wrapper */}
      {!isMobile && (
        <>
          <button
        aria-label={state === 'collapsed' ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={state !== 'collapsed'}
        onClick={toggleSidebar}
        // Hidden on very small screens, but always visible when collapsed
        className={cn(
          "absolute top-12 -left-3 flex items-center justify-center w-6 h-10 rounded-r-md border shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1",
          // default look (when expanded): subtle white button that appears on hover
          state === 'collapsed'
            ? "opacity-100 translate-x-0 bg-indigo-600 border-indigo-600 hover:bg-indigo-500"
            : "opacity-0 -translate-x-1 group-hover/sidebar-wrapper:opacity-100 group-hover/sidebar-wrapper:-translate-x-0 bg-white border-gray-200 hover:opacity-100",
          // ensure it's not shown on very small screens where off-canvas sheet is used
          "sm:flex"
        )}
        title={state === 'collapsed' ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {state === 'collapsed' ? (
          <ChevronRight className="w-4 h-4 text-white" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        )}
          </button>
        </>
      )}
      <SidebarFooter className="mt-auto p-2">
        <div className="p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-slate-700"
          >
            <LogOut className="w-4 h-4 text-slate-700" />
            <span className={state === 'collapsed' ? 'hidden' : 'text-sm'}>Logout</span>
          </Button>
        </div>
        <p className={cn("text-[11px] text-muted-foreground px-3 pb-3 text-center", state === 'collapsed' ? 'hidden' : '')}>
          FuelSync © {new Date().getFullYear()}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
