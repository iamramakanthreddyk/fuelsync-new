import React from 'react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PieChart,
  BarChart3,
  Droplet,
  Activity,
  Users,
} from 'lucide-react';

export const ReportTabTriggers: React.FC = () => {
  return (
    <TabsList className="grid w-full grid-cols-5 gap-1 bg-slate-100 p-1 rounded-lg h-auto md:h-auto overflow-x-auto">
      <TabsTrigger
        value="overview"
        className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-xs py-2 px-1 md:px-3 transition-all duration-200 flex flex-col md:flex-row items-center gap-0 md:gap-2 whitespace-nowrap"
      >
        <PieChart className="w-4 h-4 text-purple-600 data-[state=active]:text-purple-700" />
        <span className="text-[10px] md:text-sm leading-tight">Overview</span>
      </TabsTrigger>
      <TabsTrigger
        value="sales"
        className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-xs py-2 px-1 md:px-3 transition-all duration-200 flex flex-col md:flex-row items-center gap-0 md:gap-2 whitespace-nowrap"
      >
        <BarChart3 className="w-4 h-4 text-blue-600 data-[state=active]:text-blue-700" />
        <span className="text-[10px] md:text-sm leading-tight">Sales</span>
      </TabsTrigger>
      <TabsTrigger
        value="nozzles"
        className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-xs py-2 px-1 md:px-3 transition-all duration-200 flex flex-col md:flex-row items-center gap-0 md:gap-2 whitespace-nowrap"
      >
        <Droplet className="w-4 h-4 text-cyan-600 data-[state=active]:text-cyan-700" />
        <span className="text-[10px] md:text-sm leading-tight">Nozzles</span>
      </TabsTrigger>
      <TabsTrigger
        value="pumps"
        className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-xs py-2 px-1 md:px-3 transition-all duration-200 flex flex-col md:flex-row items-center gap-0 md:gap-2 whitespace-nowrap"
      >
        <Activity className="w-4 h-4 text-orange-600 data-[state=active]:text-orange-700" />
        <span className="text-[10px] md:text-sm leading-tight">Pumps</span>
      </TabsTrigger>
      <TabsTrigger
        value="employees"
        className="rounded-md data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm text-xs py-2 px-1 md:px-3 transition-all duration-200 flex flex-col md:flex-row items-center gap-0 md:gap-2 whitespace-nowrap"
      >
        <Users className="w-4 h-4 text-red-600 data-[state=active]:text-red-700" />
        <span className="text-[10px] md:text-sm leading-tight">Shortfall</span>
      </TabsTrigger>
    </TabsList>
  );
};
