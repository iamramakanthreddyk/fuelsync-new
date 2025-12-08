
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Fuel } from "lucide-react";
import React from "react";

export function ReadingSummary({
  totalReadings,
  lastReading,
}: {
  totalReadings: number;
  lastReading: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fuel className="h-5 w-5" />
          Reading Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center p-4 border rounded-lg">
          <div className="text-2xl font-bold">{totalReadings}</div>
          <div className="text-sm text-muted-foreground">Total Readings</div>
        </div>

        {/* Only show last reading/time if available; hide otherwise to avoid showing useless placeholders */}
        {lastReading ? (
          <>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{new Date(lastReading).toLocaleTimeString()}</div>
              <div className="text-sm text-muted-foreground">Last Reading</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{new Date(lastReading).toLocaleDateString()}</div>
              <div className="text-sm text-muted-foreground">Last Reading Date</div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
