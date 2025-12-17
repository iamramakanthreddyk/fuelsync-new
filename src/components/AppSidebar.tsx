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
import { isOwner, getDashboardUrl } from '@/lib/roleUtils';
import {
  Home,
  TrendingUp,
  Calendar,
  Fuel,
  FileText,
  Users,
  Building2,
  Banknote,
  Settings,
  LogOut,
  BarChart3,
  Zap,
  Scale3d,
  LineChart,
  IndianRupee,
  ChevronLeft,
  ChevronRight,
  User,
  Crown,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { setOpenMobile, toggleSidebar, state, isMobile } = useSidebar();

  // This sidebar is ONLY for owners and employees
  // Superadmins should never see this - they have their own layout
  if (user?.role === 'super_admin') {
    return null;
  }

  const isOwnerRole = isOwner(user?.role);
  const dashboardURL = getDashboardUrl(user?.role);

  // Define isManager here for use in menu groups
  const isManager = user?.role === 'manager';

  // Owner-specific menu items organized by function
  const ownerMenuGroups = [
    {
      label: "Operations",
      items: [
        {
          title: "Dashboard",
          url: "/owner/dashboard",
          icon: Home,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
        },
        {
          title: "Quick Entry",
          url: "/owner/quick-entry",
          icon: Zap,
          color: "text-amber-600",
          bgColor: "bg-amber-50",
        },
        {
          title: "Daily Settlement",
          url: "/owner/stations",
          icon: Scale3d,
          color: "text-emerald-600",
          bgColor: "bg-emerald-50",
        },
      ]
    },
    {
      label: "Management",
      items: [
        {
          title: "Stations",
          url: "/owner/stations",
          icon: Building2,
          color: "text-indigo-600",
          bgColor: "bg-indigo-50",
        },
        {
          title: "Employees",
          url: "/owner/employees",
          icon: Users,
          color: "text-orange-600",
          bgColor: "bg-orange-50",
        },
      ]
    },
    {
      label: "Reports & Analytics",
      items: [
        {
          title: "Daily Reports",
          url: "/owner/daily-reports",
          icon: LineChart,
          color: "text-purple-600",
          bgColor: "bg-purple-50",
        },
        {
          title: "Reports",
          url: "/owner/reports",
          icon: FileText,
          color: "text-green-600",
          bgColor: "bg-green-50",
        },
        {
          title: "Analytics",
          url: "/owner/analytics",
          icon: BarChart3,
          color: "text-red-600",
          bgColor: "bg-red-50",
        },
        {
          title: "Income & Receivables",
          url: "/owner/income-report",
          icon: IndianRupee,
          color: "text-teal-600",
          bgColor: "bg-teal-50",
        },
      ]
    },
    {
      label: "Account",
      items: [
        {
          title: "Settings",
          url: "/settings",
          icon: Settings,
          color: "text-slate-600",
          bgColor: "bg-slate-50",
        },
      ]
    }
  ];

  // Manager/Employee menu items organized by function
  const staffMenuGroups = [
    {
      label: "Operations",
      items: [
        {
          title: "Dashboard",
          url: "/dashboard",
          icon: Home,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
        },
        {
          title: "Quick Entry",
          url: "/quick-entry",
          icon: Zap,
          color: "text-amber-600",
          bgColor: "bg-amber-50",
        },
        {
          title: "Sales",
          url: "/sales",
          icon: TrendingUp,
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
        },
        {
          title: "Pumps",
          url: "/pumps",
          icon: Fuel,
          color: "text-blue-600",
          bgColor: "bg-blue-50",
        },
      ]
    },
    ...(isManager ? [{
      label: "Management",
      items: [
        {
          title: "Settlements",
          url: "/settlements",
          icon: Calendar,
          color: "text-cyan-600",
          bgColor: "bg-cyan-50",
        },
        {
          title: "Reports",
          url: "/reports",
          icon: FileText,
          color: "text-green-600",
          bgColor: "bg-green-50",
        },
      ]
    }] : []),
    {
      label: "Account",
      items: [
        {
          title: "Settings",
          url: "/settings",
          icon: Settings,
          color: "text-slate-600",
          bgColor: "bg-slate-50",
        },
      ]
    }
  ];

  const menuGroups = isOwnerRole ? ownerMenuGroups : staffMenuGroups;

  // Get role icon
  const getRoleIcon = (role?: string) => {
    switch (role) {
      case 'owner':
        return Crown;
      case 'manager':
        return Shield;
      case 'employee':
        return User;
      default:
        return User;
    }
  };

  const RoleIcon = getRoleIcon(user?.role);

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
  const dashboardUrl = dashboardURL;

  return (
    <Sidebar
      collapsible={isMobile ? 'offcanvas' : 'icon'}
      className={cn(
        state === 'collapsed' ? 'w-20' : 'w-64',
        'flex flex-col bg-gradient-to-b from-white via-slate-50/30 to-slate-100/50 border-r border-slate-200/60 shadow-lg backdrop-blur-sm overflow-hidden'
      )}
      style={
        ( {
          marginTop: isMobile ? '3rem' : '3rem', // Brand bar is 3rem
          height: isMobile ? 'calc(100vh - 3rem)' : 'calc(100vh - 3rem)'
        } as React.CSSProperties )
      }
    >
      <SidebarHeader className="flex flex-col items-center pt-2 pb-3 px-3 border-b border-slate-200/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
        <div className="w-full h-8" /> {/* Spacer to maintain header height */}
      </SidebarHeader>

      {/* Enhanced Profile Section */}
      <div className="px-4 py-3 border-b border-slate-200/50 bg-gradient-to-r from-slate-50/80 to-white">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white border-2 border-white flex items-center justify-center shadow-sm">
              <RoleIcon className="w-3 h-3 text-slate-600" />
            </div>
          </div>
          <div className={cn("flex-1 min-w-0", state === 'collapsed' && 'hidden')}>
            <div className="text-sm font-semibold text-slate-800 truncate leading-tight">
              {user?.name || 'User'}
            </div>
            <div className="text-xs text-slate-500 capitalize flex items-center gap-1">
              <span>{user?.role || 'User'}</span>
            </div>
          </div>
        </div>
      </div>
      <SidebarContent className="flex-1 overflow-y-auto">
        <div className="space-y-1 p-2">
          {menuGroups.map((group, groupIndex) => (
            <SidebarGroup key={group.label} className="mb-4">
              <SidebarGroupLabel className={cn(
                "text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 px-3",
                state === 'collapsed' && 'hidden'
              )}>
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + "/");
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          className={cn(
                            "group relative rounded-lg transition-all duration-200 hover:shadow-md",
                            isActive
                              ? "bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 shadow-sm"
                              : "hover:bg-slate-50/80 border border-transparent hover:border-slate-200/50"
                          )}
                        >
                          <Link
                            to={item.url}
                            onClick={handleItemClick}
                            className={cn(
                              "flex items-center w-full",
                              state === 'collapsed' && !isMobile ? 'justify-center px-3 py-3' : 'gap-3 px-4 py-3'
                            )}
                          >
                            <div className={cn(
                              "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200",
                              isActive
                                ? `${item.bgColor} ${item.color} shadow-sm`
                                : `bg-slate-100 ${item.color} group-hover:bg-slate-200 group-hover:shadow-sm`
                            )}>
                              <item.icon className="w-4 h-4" />
                            </div>
                            <div className={cn(
                              "flex-1 min-w-0",
                              state === 'collapsed' && !isMobile ? 'hidden' : 'block'
                            )}>
                              <div className={cn(
                                "text-sm font-medium leading-tight",
                                isActive ? "text-slate-900" : "text-slate-700 group-hover:text-slate-900"
                              )}>
                                {item.title}
                              </div>
                            </div>
                            {isActive && (
                              <div className="w-1.5 h-6 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full ml-auto"></div>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </div>
      </SidebarContent>
      {/* Enhanced Toggle Button - Moved to right edge */}
      {!isMobile && (
        <button
          aria-label={state === 'collapsed' ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={state !== 'collapsed'}
          onClick={toggleSidebar}
          className={cn(
            "absolute top-16 -right-4 flex items-center justify-center w-10 h-10 rounded-full border-2 shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 z-10",
            state === 'collapsed'
              ? "bg-gradient-to-r from-blue-500 to-indigo-600 border-blue-400 hover:from-blue-600 hover:to-indigo-700"
              : "bg-white border-slate-300 hover:bg-slate-50 hover:border-slate-400"
          )}
          title={state === 'collapsed' ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {state === 'collapsed' ? (
            <ChevronLeft className="w-5 h-5 text-white" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-600" />
          )}
        </button>
      )}

      {/* Enhanced Footer */}
      <SidebarFooter className="mt-auto border-t border-slate-200/50 bg-gradient-to-r from-slate-50/80 to-white p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className={cn(
            "w-full rounded-lg transition-all duration-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 border border-transparent",
            state === 'collapsed' && !isMobile ? 'px-3' : 'justify-start gap-3 px-4'
          )}
        >
          <LogOut className="w-4 h-4" />
          <span className={cn(
            "text-sm font-medium",
            state === 'collapsed' && !isMobile && 'hidden'
          )}>
            Logout
          </span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
