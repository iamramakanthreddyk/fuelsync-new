import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PendingActionsAlert({ stats, navigate }) {
  if (!stats || stats.pendingActions <= 0) return null;
  return (
    <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
      <Bell className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="text-sm">
        <div className="flex items-center justify-between gap-2">
          <span>
            You have <strong>{stats.pendingActions}</strong> pending action{stats.pendingActions > 1 ? 's' : ''} that need attention
          </span>
          <Button size="sm" variant="outline" onClick={() => navigate('/owner/stations')}>
            Review
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
