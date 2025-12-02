import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { apiService } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
// charts are not used in this page yet

export default function Reports() {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportType, setReportType] = useState('daily');
  const { user } = useAuth();
  const { toast } = useToast();

  const currentStation = user?.stations?.[0];

  // Query for report generation data and capture results for preview
  const { data: reportData, isLoading } = useQuery({
    queryKey: ['report', currentStation?.id, startDate, endDate, reportType],
    queryFn: async () => {
      if (!currentStation) return { data: [] };
      return await apiService.generateReport(currentStation.id, startDate, endDate);
    },
    enabled: !!currentStation
  });

  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "Your report is being generated...",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Generate detailed reports and view analytics for your fuel station.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
          <CardDescription>
            Select date range and report type to generate custom reports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily Sales</SelectItem>
                  <SelectItem value="monthly">Monthly Summary</SelectItem>
                  <SelectItem value="pump">Pump Performance</SelectItem>
                  <SelectItem value="fuel">Fuel Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleExport} className="w-full">
                Export Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center py-8">
        <span className="text-4xl">📊</span>
        <p className="text-muted-foreground mt-2">Reports preview</p>
        <p className="text-sm text-muted-foreground">Preview of generated report rows</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Quick view of the generated report</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading report...</div>
          ) : !reportData || (Array.isArray(reportData.data) && reportData.data.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground">No data for selected range</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-auto">
                <thead>
                  <tr className="text-left">
                    {Object.keys(reportData.data[0] || {}).slice(0, 6).map((h) => (
                      <th key={h} className="p-2 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.data.slice(0, 10).map((row: any, idx: number) => (
                    <tr key={idx} className="border-t">
                      {Object.values(row).slice(0, 6).map((val, i) => (
                        <td key={i} className="p-2">{typeof val === 'number' ? val.toLocaleString('en-IN') : String(val)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
