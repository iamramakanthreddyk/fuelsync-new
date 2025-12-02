import React from 'react';
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
  DollarSign, 
  FileText, 
  Users, 
  Building2, 
  Settings,
  LogOut,
  BarChart3,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import FuelSyncLogo from './FuelSyncLogo';
import { useSidebar } from '@/components/ui/sidebar';

export function AppSidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

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
    <Sidebar className="w-64 min-h-screen flex flex-col bg-gradient-to-b from-white to-gray-50 border-r border-border shadow-sm">
      <SidebarHeader className="flex items-center justify-center py-6">
        <Link to={dashboardUrl} className="flex items-center gap-2">
          <FuelSyncLogo className="h-8" />
          <span className="font-bold text-xl tracking-tight text-primary">FuelSync</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="flex-1 flex flex-col justify-center">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Navigation</SidebarGroupLabel>
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
                      className={isActive ? "bg-primary/10 text-primary font-semibold" : ""}
                    >
                      <Link to={item.url} onClick={handleItemClick} className="flex items-center gap-2 px-3 py-2 rounded transition-colors">
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="mt-auto">
        <div className="p-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="w-full justify-start"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
        <p className="text-xs text-muted-foreground px-2 pb-2 text-center">
          FuelSync &copy; {new Date().getFullYear()}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
