/**
 * Station Detail Page (Refactored)
 * Comprehensive view of a single station with pumps, nozzles, fuel prices
 * Now uses sub-components for better maintainability
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api-client';
import { Station } from '@/types';
import { StationSettingsForm } from '@/components/owner/StationSettingsForm';
import {
  ArrowLeft,
  Fuel,
  Settings,
  IndianRupee,
  CreditCard
} from 'lucide-react';
import PumpsTab from './components/StationDetail/PumpsTab';
import PricesTab from './components/StationDetail/PricesTab';
import CreditorsTab from './components/StationDetail/CreditorsTab';

export default function StationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('pumps');

  // Fetch station details
  const { data: station, isLoading: stationLoading } = useQuery({
    queryKey: ['station', id],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Station }>(`/stations/${id}`);
      return response.data;
    },
    enabled: !!id
  });

  if (stationLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">Loading station details...</div>
      </div>
    );
  }

  if (!station) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">Station not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-4 page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/owner/stations')}
            className="flex-shrink-0 hover:bg-primary hover:text-primary-foreground transition-colors duration-200 px-3 py-2 h-auto"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-3xl font-bold truncate">{station.name}</h1>
            <p className="text-muted-foreground text-sm md:text-base">
              {station.code && `Code: ${station.code} • `}
              {station.city && `${station.city}, ${station.state}`}
            </p>
          </div>
        </div>
        <Badge variant={station.isActive ? 'default' : 'secondary'} className="self-start sm:self-center flex-shrink-0">
          {station.isActive ? '● Active' : '○ Inactive'} ({station.isActive ? 'true' : 'false'})
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col gap-4">
          {/* Quick Actions Bar */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-amber-600" />
              <span className="font-medium text-amber-900 dark:text-amber-100">Fuel Pricing</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab('prices')}
              className="text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            >
              Manage Prices →
            </Button>
          </div>

          <TabsList className="flex h-14 items-center justify-center rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 p-1 text-muted-foreground shadow-lg border border-slate-200 dark:border-slate-700 w-full overflow-x-auto overflow-y-hidden flex-nowrap min-w-max backdrop-blur-sm">
            <TabsTrigger value="pumps" className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 sm:px-4 py-3 text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-blue-200 dark:data-[state=active]:border-blue-800 hover:bg-white/80 dark:hover:bg-slate-700/50 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-md flex-shrink-0 group">
              <Fuel className="w-5 h-5 sm:w-6 sm:h-6 sm:mr-2 text-blue-500 group-data-[state=active]:text-blue-600 group-hover:text-blue-600 transition-colors flex-shrink-0" />
              <span className="hidden sm:inline">Pumps</span>
            </TabsTrigger>
            <TabsTrigger value="prices" className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 sm:px-4 py-3 text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-green-600 dark:data-[state=active]:text-green-400 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-green-200 dark:data-[state=active]:border-green-800 hover:bg-white/80 dark:hover:bg-slate-700/50 hover:text-green-600 dark:hover:text-green-400 hover:shadow-md flex-shrink-0 group">
              <IndianRupee className="w-5 h-5 sm:w-6 sm:h-6 sm:mr-2 text-green-500 group-data-[state=active]:text-green-600 group-hover:text-green-600 transition-colors flex-shrink-0" />
              <span className="hidden sm:inline">Prices</span>
            </TabsTrigger>
            <TabsTrigger value="creditors" className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 sm:px-4 py-3 text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-purple-200 dark:data-[state=active]:border-purple-800 hover:bg-white/80 dark:hover:bg-slate-700/50 hover:text-purple-600 dark:hover:text-purple-400 hover:shadow-md flex-shrink-0 group">
              <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 sm:mr-2 text-purple-500 group-data-[state=active]:text-purple-600 group-hover:text-purple-600 transition-colors flex-shrink-0" />
              <span className="hidden sm:inline">Creditors</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 sm:px-4 py-3 text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-orange-600 dark:data-[state=active]:text-orange-400 data-[state=active]:shadow-md data-[state=active]:border data-[state=active]:border-orange-200 dark:data-[state=active]:border-orange-800 hover:bg-white/80 dark:hover:bg-slate-700/50 hover:text-orange-600 dark:hover:text-orange-400 hover:shadow-md flex-shrink-0 group">
              <Settings className="w-5 h-5 sm:w-6 sm:h-6 sm:mr-2 text-orange-500 group-data-[state=active]:text-orange-600 group-hover:text-orange-600 transition-colors flex-shrink-0" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Pumps Tab */}
        <TabsContent value="pumps" className="space-y-4 sm:space-y-6">
          {id && <PumpsTab id={id} />}
        </TabsContent>

        {/* Prices Tab */}
        <TabsContent value="prices" className="space-y-6">
          {id && <PricesTab id={id} />}
        </TabsContent>

        {/* Creditors Tab */}
        <TabsContent value="creditors" className="space-y-4">
          {id && <CreditorsTab id={id} />}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <h2 className="text-xl font-semibold">Station Settings</h2>
          {id && <StationSettingsForm stationId={id} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
