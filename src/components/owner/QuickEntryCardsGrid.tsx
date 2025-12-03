/**
 * QuickEntryCardsGrid - Quick action cards for navigation
 * Displays attractive cards for Quick Entry, Shifts, Stations, Employees, Cash, Reports
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, BarChart3, Zap, ArrowRight, Clock, Banknote } from 'lucide-react';
import { NavigateFunction } from 'react-router-dom';

interface QuickEntryCardsGridProps {
  navigate: NavigateFunction;
}

export function QuickEntryCardsGrid({ navigate }: QuickEntryCardsGridProps) {
  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
      {/* Quick Entry */}
      <Card 
        className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-yellow-500/50 bg-gradient-to-br from-yellow-50/50 to-transparent dark:from-yellow-950/20"
        onClick={() => navigate('/owner/quick-entry')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/owner/quick-entry')}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-base sm:text-lg group-hover:text-yellow-600 transition-colors">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <span>Quick Entry</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Fast nozzle reading entry for today
          </p>
          <div className="mt-3 flex items-center text-xs text-yellow-600 font-medium">
            <span>Enter now</span>
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>

      {/* Shift Management */}
      <Card 
        className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-orange-500/50 bg-gradient-to-br from-orange-50/50 to-transparent dark:from-orange-950/20"
        onClick={() => navigate('/owner/shifts')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/owner/shifts')}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-base sm:text-lg group-hover:text-orange-600 transition-colors">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <span>Shift Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Start/end shifts with cash reconciliation
          </p>
          <div className="mt-3 flex items-center text-xs text-orange-600 font-medium">
            <span>Manage shifts</span>
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>

      {/* Cash Handovers */}
      <Card 
        className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-green-500/50 bg-gradient-to-br from-green-50/50 to-transparent dark:from-green-950/20"
        onClick={() => navigate('/owner/cash-handovers')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/owner/cash-handovers')}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-base sm:text-lg group-hover:text-green-600 transition-colors">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <Banknote className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <span>Cash Handovers</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Confirm cash received from employees
          </p>
          <div className="mt-3 flex items-center text-xs text-green-600 font-medium">
            <span>View handovers</span>
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>

      {/* Manage Stations */}
      <Card 
        className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20"
        onClick={() => navigate('/owner/stations')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/owner/stations')}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-base sm:text-lg group-hover:text-primary transition-colors">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span>Manage Stations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Add, edit, and configure your fuel stations
          </p>
          <div className="mt-3 flex items-center text-xs text-primary font-medium">
            <span>Get started</span>
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>

      {/* Manage Employees */}
      <Card 
        className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20"
        onClick={() => navigate('/owner/employees')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/owner/employees')}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-base sm:text-lg group-hover:text-primary transition-colors">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span>Manage Employees</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Add and manage staff across all stations
          </p>
          <div className="mt-3 flex items-center text-xs text-primary font-medium">
            <span>View team</span>
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>

      {/* Reports */}
      <Card 
        className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50 bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-950/20"
        onClick={() => navigate('/owner/reports')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/owner/reports')}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-base sm:text-lg group-hover:text-primary transition-colors">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg group-hover:scale-110 transition-transform">
              <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span>View Reports</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Sales, profit/loss, and analytics reports
          </p>
          <div className="mt-3 flex items-center text-xs text-primary font-medium">
            <span>See insights</span>
            <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
