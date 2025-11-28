
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { Fuel } from "lucide-react";

export function QuickActions() {
  const { isOwner, isAdmin } = useRoleAccess();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common daily tasks</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3">
          <button 
            onClick={() => window.location.href = '/upload'}
            className="p-3 text-left border rounded-lg hover:bg-gray-50 hover:shadow-md transition-all duration-200 group"
          >
            <div className="font-medium group-hover:text-primary">Add Reading</div>
            <div className="text-sm text-muted-foreground">Upload or manual entry</div>
          </button>
          <button 
            onClick={() => window.location.href = '/daily-closure'}
            className="p-3 text-left border rounded-lg hover:bg-gray-50 hover:shadow-md transition-all duration-200 group"
          >
            <div className="font-medium group-hover:text-primary">Daily Closure</div>
            <div className="text-sm text-muted-foreground">End of day summary</div>
          </button>
          <button 
            onClick={() => window.location.href = '/reports'}
            className="p-3 text-left border rounded-lg hover:bg-gray-50 hover:shadow-md transition-all duration-200 group"
          >
            <div className="font-medium group-hover:text-primary">View Reports</div>
            <div className="text-sm text-muted-foreground">Sales & analytics</div>
          </button>
          {(isOwner || isAdmin) && (
            <button
              onClick={() => window.location.href = '/prices'}
              className="p-3 text-left border rounded-lg hover:bg-blue-50 hover:shadow-md transition-all duration-200 group flex items-center gap-2"
            >
              <Fuel className="w-4 h-4 text-blue-600 mr-2" />
              <div>
                <div className="font-medium group-hover:text-blue-700">Update Fuel Prices</div>
                <div className="text-sm text-muted-foreground">Manage & update per litre rates</div>
              </div>
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
