import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAUpdate } from '@/hooks/usePWA';

export function PWAUpdateNotification() {
  const [showNotification, setShowNotification] = useState(false);
  const { hasUpdate, updateServiceWorker } = usePWAUpdate();

  useEffect(() => {
    if (hasUpdate) {
      setShowNotification(true);
    }
  }, [hasUpdate]);

  const handleUpdate = () => {
    updateServiceWorker();
    setShowNotification(false);
    // Reload page after update
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowNotification(false);
  };

  if (!showNotification) {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 bg-white rounded-lg shadow-2xl border-l-4 border-l-green-500 p-4 z-50 animate-in slide-in-from-top-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 bg-green-100 rounded-lg mt-0.5">
            <RefreshCw className="w-5 h-5 text-green-600 animate-spin" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Update Available</h3>
            <p className="text-sm text-gray-600 mt-1">
              A new version of FuelSync is available. Update now to get the latest features and bug fixes.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-gray-100 rounded-md transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="flex gap-2 mt-4">
        <Button
          onClick={handleUpdate}
          className="flex-1 bg-green-600 hover:bg-green-700 h-9"
          size="sm"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Update Now
        </Button>
        <Button
          onClick={handleDismiss}
          variant="outline"
          className="flex-1 h-9"
          size="sm"
        >
          Later
        </Button>
      </div>
    </div>
  );
}
