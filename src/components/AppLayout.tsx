
import React from 'react';
import { Navigate } from 'react-router-dom';
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import FuelSyncLogo from './FuelSyncLogo';
import { useAuth } from '@/hooks/useAuth';
import { Bell } from 'lucide-react';
import { notificationService } from '@/services/notificationService';
import { MobileMenuTrigger } from './MobileMenuTrigger';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();
  const unreadCount = notificationService.getUnread().length;
  const [showDropdown, setShowDropdown] = React.useState(false);

  return (
    <SidebarProvider>
      {/* Superadmins should never see this layout - redirect them */}
      {user?.role === 'super_admin' && <Navigate to="/superadmin/users" replace />}

      {user?.role !== 'super_admin' && (
        <>
          {/* Top Brand Bar */}
          <div className="fixed top-0 left-0 right-0 z-50 h-12 bg-white border-b border-slate-200/60 shadow-sm">
            <div className="flex items-center h-full px-4 gap-4">
              {/* Mobile menu trigger - hidden on mobile since we have bottom nav */}
              <div className="hidden md:block">
                <MobileMenuTrigger />
              </div>
              <FuelSyncLogo size={32} variant="brand" showText={true} />
              <div className="flex-1"></div>
              <div className="hidden md:flex items-center gap-4">
                {user?.name && (
                  <span className="text-sm text-slate-600">
                    Welcome back, <strong className="text-slate-800 ml-1">{user.name}</strong> 👋
                  </span>
                )}
                {/* Notification Bell */}
                <div className="relative">
                  <button
                    className="relative p-2 rounded-full hover:bg-muted transition"
                    onClick={() => setShowDropdown((v) => !v)}
                    aria-label="Notifications"
                  >
                    <Bell className="w-5 h-5 text-foreground" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  {showDropdown && (
                    <div className="absolute right-0 mt-2 w-80 bg-white border rounded-lg shadow-lg z-50">
                      <div className="p-3 border-b font-semibold">Notifications</div>
                      <div className="max-h-80 overflow-y-auto">
                        {notificationService.getAll().length === 0 ? (
                          <div className="p-4 text-muted-foreground text-center">No notifications</div>
                        ) : (
                          notificationService.getAll().map((n) => (
                            <div key={n.id} className={`p-3 border-b last:border-b-0 flex gap-2 items-start ${n.read ? 'bg-muted/30' : ''}`}>
                              <span className={`w-2 h-2 rounded-full mt-2 ${n.type === 'error' ? 'bg-red-500' : n.type === 'warning' ? 'bg-yellow-500' : n.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                              <div className="flex-1">
                                <div className="font-medium text-sm">{n.message}</div>
                                <div className="text-xs text-muted-foreground">{n.createdAt.toLocaleString()}</div>
                                {n.link && (
                                  <a href={n.link} className="text-xs text-blue-600 underline">View</a>
                                )}
                              </div>
                              {!n.read && (
                                <button
                                  className="ml-2 text-xs text-primary underline"
                                  onClick={() => { notificationService.markRead(n.id); setShowDropdown(false); }}
                                >Mark read</button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                      <div className="p-2 text-right">
                        <button className="text-xs text-muted-foreground underline" onClick={() => { notificationService.clearAll(); setShowDropdown(false); }}>Clear all</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-screen flex w-full bg-background pt-12">
            <div className="sticky top-12 h-[calc(100vh-3rem)]">
              <AppSidebar />
            </div>
            <div className="flex-1 flex flex-col">
              <AppHeader />
              <main className="flex-1 overflow-auto pt-5 pb-20 md:pb-5">
                <div className="w-full px-4 md:px-6 lg:px-8 xl:px-12 pt-6 md:pt-8">
                  {children}
                </div>
              </main>
            </div>
          </div>

          {/* Mobile Bottom Navigation */}
          <MobileBottomNav />
        </>
      )}
    </SidebarProvider>
  );
}
