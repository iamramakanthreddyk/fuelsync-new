import { Button } from '@/components/ui/button';
import { Building2, Users, Fuel, BarChart3, Settings } from 'lucide-react';
import { NavigateFunction } from 'react-router-dom';

interface QuickActionsGridProps {
  navigate: NavigateFunction;
}

export function QuickActionsGrid({ navigate }: QuickActionsGridProps) {
  const actions = [
    {
      title: "Stations",
      icon: Building2,
      href: "/owner/stations",
      color: "border-blue-200 hover:bg-blue-50 hover:border-blue-300 text-blue-600 hover:text-blue-700"
    },
    {
      title: "Employees",
      icon: Users,
      href: "/owner/employees",
      color: "border-purple-200 hover:bg-purple-50 hover:border-purple-300 text-purple-600 hover:text-purple-700"
    },
    {
      title: "Reports",
      icon: Fuel,
      href: "/owner/reports",
      color: "border-green-200 hover:bg-green-50 hover:border-green-300 text-green-600 hover:text-green-700"
    },
    {
      title: "Analytics",
      icon: BarChart3,
      href: "/owner/analytics",
      color: "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      {actions.map((action, index) => {
        const IconComponent = action.icon;
        const isPrimary = action.title === "Analytics";

        return (
          <Button
            key={index}
            onClick={() => navigate(action.href)}
            variant={isPrimary ? "default" : "outline"}
            size="sm"
            className={`w-full h-16 sm:h-20 flex flex-col items-center justify-center gap-1 sm:gap-2 transition-all duration-200 hover:scale-105 active:scale-95 ${action.color} ${isPrimary ? 'shadow-lg hover:shadow-xl' : ''}`}
          >
            <IconComponent className={`w-4 h-4 sm:w-5 sm:h-5 ${isPrimary ? 'text-white' : ''} flex-shrink-0`} />
            <span className="text-xs font-medium leading-tight">{action.title}</span>
          </Button>
        );
      })}
    </div>
  );
}
