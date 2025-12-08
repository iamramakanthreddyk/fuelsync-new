
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { Fuel } from "lucide-react";

export function QuickActions() {
  const { isOwner, isAdmin, isManager, isEmployee } = useRoleAccess();

  const actions = [
    {
      title: "Add Reading",
      description: "Upload or manual entry",
      href: "/upload",
      color: "hover:bg-blue-50 hover:border-blue-200"
    },
    {
      title: "Daily Closure",
      description: "End of day summary",
      href: "/daily-closure",
      color: "hover:bg-green-50 hover:border-green-200"
    },
    // 'View Reports' should be visible to managers and above; hide for employees
    ...(isEmployee ? [] : [{
      title: "View Reports",
      description: "Sales & analytics",
      href: "/reports",
      color: "hover:bg-purple-50 hover:border-purple-200"
    }])
  ];

  return (
    <Card className="card-mobile">
      <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
        <CardTitle className="text-sm sm:text-base">Quick Actions</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Common daily tasks</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6 space-y-2 sm:space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:gap-3">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={() => window.location.href = action.href}
              className={`touch-target p-3 sm:p-4 text-left border-2 rounded-lg transition-all duration-200 group active:scale-95 ${action.color}`}
            >
              <div className="font-medium text-sm sm:text-base group-hover:text-primary transition-colors">
                {action.title}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                {action.description}
              </div>
            </button>
          ))}
          
          {(isOwner || isAdmin) && (
            <button
              onClick={() => window.location.href = '/prices'}
              className="touch-target p-3 sm:p-4 text-left border-2 rounded-lg hover:bg-amber-50 hover:border-amber-200 transition-all duration-200 group flex items-start gap-3 active:scale-95"
            >
              <Fuel className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-sm sm:text-base group-hover:text-amber-700 transition-colors">
                  Update Fuel Prices
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Manage & update per litre rates
                </div>
              </div>
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
