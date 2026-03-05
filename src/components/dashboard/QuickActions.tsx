
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { Fuel, Upload, Calculator, BarChart3, Settings } from "lucide-react";

export function QuickActions() {
  const { isOwner, isAdmin, isManager, isEmployee } = useRoleAccess();

  const actions = [
    {
      title: "Add Reading",
      description: "Upload or manual entry",
      href: "/upload",
      icon: Upload,
      color: "bg-blue-500 hover:bg-blue-600",
      textColor: "text-blue-50"
    },
    {
      title: "Daily Settlement",
      description: "End of day summary",
      href: "/settlements",
      icon: Calculator,
      color: "bg-green-500 hover:bg-green-600",
      textColor: "text-green-50"
    },
    // 'View Reports' should be visible to managers and above; hide for employees
    ...(isEmployee ? [] : [{
      title: "Reports",
      description: "Sales & analytics",
      href: "/reports",
      icon: BarChart3,
      color: "bg-purple-500 hover:bg-purple-600",
      textColor: "text-purple-50"
    }])
  ];

  return (
    <Card className="card-mobile">
      <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
        <CardTitle className="text-sm sm:text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6">
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {actions.map((action, index) => {
            const IconComponent = action.icon;
            return (
              <button
                key={index}
                onClick={() => window.location.href = action.href}
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

          {(isOwner || isAdmin) && (
            <button
              onClick={() => window.location.href = '/prices'}
              className="bg-amber-500 hover:bg-amber-600 text-amber-50 p-3 sm:p-4 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md flex flex-col items-center justify-center text-center min-h-[80px] sm:min-h-[100px] group"
            >
              <Fuel className="w-5 h-5 sm:w-6 sm:h-6 mb-1 sm:mb-2 group-hover:scale-110 transition-transform" />
              <div className="font-medium text-xs sm:text-sm leading-tight">
                Fuel Prices
              </div>
              <div className="text-xs opacity-90 mt-0.5 leading-tight hidden sm:block">
                Update rates
              </div>
            </button>
          )}
        </div>

        {/* Settings link for all users */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={() => window.location.href = '/settings'}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors group text-sm text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            <span>Settings</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
