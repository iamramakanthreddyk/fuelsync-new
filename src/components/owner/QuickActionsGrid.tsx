import { Button } from '@/components/ui/button';
import { Building2, Users, Fuel, BarChart3 } from 'lucide-react';
import { NavigateFunction } from 'react-router-dom';

interface QuickActionsGridProps {
  navigate: NavigateFunction;
}

export function QuickActionsGrid({ navigate }: QuickActionsGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Button
        onClick={() => navigate('/owner/stations')}
        variant="outline"
        size="sm"
        className="w-full justify-start border-blue-200 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 group"
      >
        <Building2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-500 group-hover:text-blue-600 transition-colors flex-shrink-0" />
        <span className="font-medium">Stations</span>
      </Button>
      <Button
        onClick={() => navigate('/owner/employees')}
        variant="outline"
        size="sm"
        className="w-full justify-start border-purple-200 hover:bg-purple-50 hover:border-purple-300 transition-all duration-200 group"
      >
        <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-purple-500 group-hover:text-purple-600 transition-colors flex-shrink-0" />
        <span className="font-medium">Employees</span>
      </Button>
      <Button
        onClick={() => navigate('/owner/reports')}
        variant="outline"
        size="sm"
        className="w-full justify-start border-green-200 hover:bg-green-50 hover:border-green-300 transition-all duration-200 group"
      >
        <Fuel className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-500 group-hover:text-green-600 transition-colors flex-shrink-0" />
        <span className="font-medium">Reports</span>
      </Button>
      <Button
        onClick={() => navigate('/owner/analytics')}
        variant="default"
        size="sm"
        className="w-full justify-start bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-300 group"
      >
        <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-white group-hover:scale-110 transition-transform flex-shrink-0" />
        <span className="hidden sm:inline font-medium">Analytics</span>
        <span className="sm:hidden font-medium">Charts</span>
      </Button>
    </div>
  );
}
