
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getNavigationBySection } from "@/utils/navigationConfig";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function QuickActions() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Get primary and admin navigation items based on role
  // Map role to navigation role ('super_admin' becomes 'admin' for navigation)
  const navRole = user?.role === 'super_admin' ? 'admin' : user?.role;
  
  const primaryItems = getNavigationBySection(navRole, 'primary');
  const adminItems = getNavigationBySection(navRole, 'admin');
  const secondaryItems = getNavigationBySection(navRole, 'secondary');

  // Combine primary + admin for grid display
  const mainItems = [...primaryItems, ...adminItems];
  
  // Find Settings item from secondary
  const settingsItem = secondaryItems.find(item => item.id === 'settings');

  return (
    <Card className="card-mobile">
      <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
        <CardTitle className="text-sm sm:text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6">
        {/* Main action grid */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {mainItems.map((action) => {
            const IconComponent = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => navigate(action.href)}
                className={`${action.color} ${action.textColor} p-3 sm:p-4 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md flex flex-col items-center justify-center text-center min-h-[80px] sm:min-h-[100px] group`}
              >
                <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 mb-1 sm:mb-2 group-hover:scale-110 transition-transform" />
                <div className="font-medium text-xs sm:text-sm leading-tight">
                  {action.title}
                </div>
                <div className="text-xs opacity-90 mt-0.5 leading-tight hidden sm:block">
                  {action.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* Settings link for all users */}
        {settingsItem && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={() => navigate(settingsItem.href)}
              className="w-full flex items-center justify-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors group text-sm text-muted-foreground hover:text-foreground"
            >
              <settingsItem.icon className="w-4 h-4 group-hover:rotate-90 transition-transform" />
              <span>{settingsItem.title}</span>
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
