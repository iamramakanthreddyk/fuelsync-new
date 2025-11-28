
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock, Info, AlertCircle } from "lucide-react";

interface Alert {
  id: string;
  type: 'warning' | 'info' | 'error';
  message: string;
  severity: 'low' | 'medium' | 'high';
  tags: string[];
}

interface AlertBadgesProps {
  alerts: Alert[];
}

export const AlertBadges: React.FC<AlertBadgesProps> = ({ alerts }) => {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return AlertTriangle;
      case 'error':
        return AlertCircle;
      case 'info':
        return Info;
      default:
        return Clock;
    }
  };

  const getAlertColor = (type: string, severity: string) => {
    if (type === 'error' || severity === 'high') {
      return 'bg-red-100 text-red-800 border-red-300';
    }
    if (type === 'warning' || severity === 'medium') {
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
    if (type === 'info' || severity === 'low') {
      return 'bg-blue-100 text-blue-800 border-blue-300';
    }
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  // Show success badge if no alerts
  const displayAlerts = alerts.length === 0 ? [{
    id: 'all_good',
    type: 'info' as const,
    message: 'All systems operational',
    severity: 'low' as const,
    tags: ['system']
  }] : alerts;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">System Status</h3>
      <div className="flex flex-wrap gap-2">
        {displayAlerts.map((alert) => {
          const Icon = alert.id === 'all_good' ? CheckCircle : getAlertIcon(alert.type);
          const colorClass = alert.id === 'all_good' 
            ? 'bg-green-100 text-green-800 border-green-300'
            : getAlertColor(alert.type, alert.severity);
          
          return (
            <Badge 
              key={alert.id} 
              variant="outline" 
              className={`${colorClass} flex items-center gap-1`}
            >
              <Icon className="h-3 w-3" />
              {alert.message}
            </Badge>
          );
        })}
      </div>
    </div>
  );
};
