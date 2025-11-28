
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Fuel } from 'lucide-react';

export default function PumpsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pump Management</h1>
        <p className="text-muted-foreground">Manage pumps across all stations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="w-5 h-5" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Pump management functionality will be available soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
