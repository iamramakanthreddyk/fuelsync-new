import React from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, AlertTriangle, Info, Zap } from "lucide-react";

interface PlanStatus {
  level: 'unlimited' | 'warning' | 'limited' | 'restricted' | 'blocked';
  upgradePrompt?: string;
  limits?: {
    exports?: {
      allowed: boolean;
      quota: { usage: number; limit: number; remaining: number };
    };
    reports?: {
      allowed: boolean;
      quota: { usage: number; limit: number; remaining: number };
    };
    manualEntries?: {
      allowed: boolean;
      quota: { usage: number; limit: number; remaining: number };
    };
  };
}

interface PlanStatusAlertProps {
  planStatus: PlanStatus;
  onUpgrade?: () => void;
  className?: string;
}

export const PlanStatusAlert: React.FC<PlanStatusAlertProps> = ({
  planStatus,
  onUpgrade,
  className = ""
}) => {
  if (planStatus.level === 'unlimited') {
    return null; // No alert for unlimited plans
  }

  const getAlertConfig = () => {
    switch (planStatus.level) {
      case 'warning':
        return {
          variant: 'default' as const,
          icon: <Info className="h-4 w-4" />,
          title: "Premium Features Available",
          description: planStatus.upgradePrompt || "Upgrade to unlock all features",
          badge: <Badge variant="secondary">Premium</Badge>
        };
      case 'limited':
        return {
          variant: 'default' as const,
          icon: <AlertTriangle className="h-4 w-4" />,
          title: "Feature Limits Active",
          description: planStatus.upgradePrompt || "Some features are limited. Upgrade for full access.",
          badge: <Badge variant="outline">Limited</Badge>
        };
      case 'restricted':
        return {
          variant: 'destructive' as const,
          icon: <AlertTriangle className="h-4 w-4" />,
          title: "Many Features Restricted",
          description: planStatus.upgradePrompt || "Most features are limited. Upgrade to remove restrictions.",
          badge: <Badge variant="destructive">Restricted</Badge>
        };
      case 'blocked':
        return {
          variant: 'destructive' as const,
          icon: <Zap className="h-4 w-4" />,
          title: "Plan Upgrade Required",
          description: planStatus.upgradePrompt || "This feature requires a paid plan.",
          badge: <Badge variant="destructive">Blocked</Badge>
        };
      default:
        return null;
    }
  };

  const config = getAlertConfig();
  if (!config) return null;

  return (
    <Alert variant={config.variant} className={`border-l-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          {config.icon}
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <AlertTitle className="text-sm font-medium">
                {config.title}
              </AlertTitle>
              {config.badge}
            </div>
            <AlertDescription className="text-sm">
              {config.description}
            </AlertDescription>

            {/* Show usage limits if available */}
            {planStatus.limits && (
              <div className="mt-3 space-y-2">
                {planStatus.limits.exports && (
                  <div className="text-xs text-muted-foreground">
                    Exports: {planStatus.limits.exports.quota.usage}/{planStatus.limits.exports.quota.limit} used
                    {!planStatus.limits.exports.allowed && (
                      <span className="text-destructive ml-1">(Limit reached)</span>
                    )}
                  </div>
                )}
                {planStatus.limits.reports && (
                  <div className="text-xs text-muted-foreground">
                    Reports: {planStatus.limits.reports.quota.usage}/{planStatus.limits.reports.quota.limit} used
                    {!planStatus.limits.reports.allowed && (
                      <span className="text-destructive ml-1">(Limit reached)</span>
                    )}
                  </div>
                )}
                {planStatus.limits.manualEntries && (
                  <div className="text-xs text-muted-foreground">
                    Manual Entries: {planStatus.limits.manualEntries.quota.usage}/{planStatus.limits.manualEntries.quota.limit} used
                    {!planStatus.limits.manualEntries.allowed && (
                      <span className="text-destructive ml-1">(Limit reached)</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {onUpgrade && (
          <Button
            size="sm"
            variant={config.variant === 'destructive' ? 'default' : 'outline'}
            onClick={onUpgrade}
            className="ml-4 flex items-center space-x-1"
          >
            <Crown className="h-3 w-3" />
            <span>Upgrade</span>
          </Button>
        )}
      </div>
    </Alert>
  );
};

export default PlanStatusAlert;