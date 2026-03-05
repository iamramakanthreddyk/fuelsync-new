/**
 * QuickEntryCardsGrid - Quick action cards for navigation
 * Displays attractive cards for Quick Entry, Shifts, Stations, Employees, Cash, Reports
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Zap, ArrowRight, Clock, CreditCard, TrendingUp, Scale3d } from 'lucide-react';
import { NavigateFunction } from 'react-router-dom';

interface QuickEntryCardsGridProps {
  navigate: NavigateFunction;
}

export function QuickEntryCardsGrid({ navigate }: QuickEntryCardsGridProps) {
  return (
    <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      {/* Quick Entry */}
      <Card 
        className="group cursor-pointer hover:shadow-lg transition-all duration-200 border hover:border-yellow-500/50 bg-gradient-to-br from-yellow-50/30 to-transparent"
        onClick={() => navigate('/owner/quick-entry')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/owner/quick-entry')}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-yellow-100 rounded-md group-hover:scale-110 transition-transform">
              <Zap className="w-4 h-4 text-yellow-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-900 group-hover:text-yellow-700">Quick Entry</div>
              <div className="text-xs text-gray-500 truncate">Fast readings</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Settlement */}
      <Card 
        className="group cursor-pointer hover:shadow-lg transition-all duration-200 border hover:border-green-500/50 bg-gradient-to-br from-green-50/30 to-transparent"
        onClick={() => navigate('/owner/stations')} // Navigate to stations to select one
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/owner/stations')}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-green-100 rounded-md group-hover:scale-110 transition-transform">
              <Scale3d className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-900 group-hover:text-green-700">Settlement</div>
              <div className="text-xs text-gray-500 truncate">Daily close</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Reports */}
      <Card 
        className="group cursor-pointer hover:shadow-lg transition-all duration-200 border hover:border-indigo-500/50 bg-gradient-to-br from-indigo-50/30 to-transparent"
        onClick={() => navigate('/owner/daily-reports')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/owner/daily-reports')}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-100 rounded-md group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-900 group-hover:text-indigo-700">Reports</div>
              <div className="text-xs text-gray-500 truncate">Analytics</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shift Management */}
      <Card 
        className="group cursor-pointer hover:shadow-lg transition-all duration-200 border hover:border-orange-500/50 bg-gradient-to-br from-orange-50/30 to-transparent"
        onClick={() => navigate('/owner/shifts')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/owner/shifts')}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-orange-100 rounded-md group-hover:scale-110 transition-transform">
              <Clock className="w-4 h-4 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-900 group-hover:text-orange-700">Shifts</div>
              <div className="text-xs text-gray-500 truncate">Management</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manage Stations */}
      <Card 
        className="group cursor-pointer hover:shadow-lg transition-all duration-200 border hover:border-blue-500/50 bg-gradient-to-br from-blue-50/30 to-transparent"
        onClick={() => navigate('/owner/stations')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/owner/stations')}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 rounded-md group-hover:scale-110 transition-transform">
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-900 group-hover:text-blue-700">Stations</div>
              <div className="text-xs text-gray-500 truncate">Management</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manage Employees */}
      <Card 
        className="group cursor-pointer hover:shadow-lg transition-all duration-200 border hover:border-purple-500/50 bg-gradient-to-br from-purple-50/30 to-transparent"
        onClick={() => navigate('/owner/employees')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/owner/employees')}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-100 rounded-md group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-900 group-hover:text-purple-700">Employees</div>
              <div className="text-xs text-gray-500 truncate">Management</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Ledger */}
      <Card 
        className="group cursor-pointer hover:shadow-lg transition-all duration-200 border hover:border-orange-500/50 bg-gradient-to-br from-orange-50/30 to-transparent"
        onClick={() => navigate('/owner/credit-ledger')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/owner/credit-ledger')}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-orange-100 rounded-md group-hover:scale-110 transition-transform">
              <CreditCard className="w-4 h-4 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-900 group-hover:text-orange-700">Credit Ledger</div>
              <div className="text-xs text-gray-500 truncate">Outstanding</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
