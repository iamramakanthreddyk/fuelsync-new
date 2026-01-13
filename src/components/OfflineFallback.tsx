import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function OfflineFallback() {
  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="p-4 bg-yellow-100 rounded-full">
            <WifiOff className="w-12 h-12 text-yellow-600" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          You're Offline
        </h1>

        <p className="text-gray-600 mb-6">
          It looks like you've lost your internet connection. Don't worry! You can still view previously loaded pages and your cached data.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">What you can do:</h3>
          <ul className="text-sm text-blue-800 space-y-1 text-left">
            <li>✓ View previously accessed pages</li>
            <li>✓ Check cached transaction data</li>
            <li>✓ Use offline-enabled features</li>
            <li>✗ Cannot fetch new data from server</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleReload}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Reconnecting
          </Button>

          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Go Back
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          This page works offline. Once you reconnect to the internet, you'll have full access to all features.
        </p>
      </div>
    </div>
  );
}
