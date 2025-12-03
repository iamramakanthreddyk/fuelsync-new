import { Button } from '@/components/ui/button';
import { Building2, Users, Fuel, BarChart3 } from 'lucide-react';
import { NavigateFunction } from 'react-router-dom';

interface QuickActionsGridProps {
  navigate: NavigateFunction;
}

export function QuickActionsGrid({ navigate }: QuickActionsGridProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button 
        onClick={() => navigate('/owner/stations')} 
        variant="outline" 
        size="sm"
        className="border-primary/20 hover:bg-primary/5"
      >
        <Building2 className="w-4 h-4 mr-2" />
        Stations
      </Button>
      <Button 
        onClick={() => navigate('/owner/employees')} 
        variant="outline" 
        size="sm"
        className="border-primary/20 hover:bg-primary/5"
      >
        <Users className="w-4 h-4 mr-2" />
        Employees
      </Button>
      <Button 
        onClick={() => navigate('/owner/reports')} 
        variant="outline" 
        size="sm"
        className="border-primary/20 hover:bg-primary/5"
      >
        <Fuel className="w-4 h-4 mr-2" />
        Reports
      </Button>
      <Button 
        onClick={() => navigate('/owner/analytics')} 
        variant="default"
        size="sm" 
        className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
      >
        <BarChart3 className="w-4 h-4 mr-2" />
        <span className="hidden sm:inline">Analytics</span>
        <span className="sm:hidden">Charts</span>
      </Button>
    </div>
  );
}
