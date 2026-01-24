import { useState, useEffect } from 'react';
import { X, Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * PWA Installation guide banner for mobile and desktop
 * Shows instructions to install the app
 * Complements PWAInstallPrompt for users whose browsers don't support beforeinstallprompt
 * 
 * TEMPORARILY DISABLED - Remove the return statement below to re-enable
 */
export function PWAInstallGuide() {
  // Temporarily disabled - comment out the line below to re-enable
  return null;

  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed this
    const isDismissed = localStorage.getItem('pwa-install-guide-dismissed');
    if (isDismissed) {
      setDismissed(true);
      return;
    }

    // Check if already installed
    const isInstalled = 
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;

    if (isInstalled) {
      setDismissed(true);
      return;
    }

    // Check if mobile
    const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    setIsMobile(mobile);

    // Show on mobile or desktop after a short delay
    const timer = setTimeout(() => {
      setShow(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-install-guide-dismissed', 'true');
  };

  if (!show || dismissed) {
    return null;
  }

  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-2xl p-4 z-50 animate-in slide-in-from-top-4 text-white">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500 rounded-lg">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Install FuelSync App</h3>
            <p className="text-xs opacity-90">Works offline • Fast access • One tap away</p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-blue-500 rounded-md transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-blue-500 bg-opacity-50 rounded p-3 mb-3 text-xs">
        {isAndroid ? (
          <div className="space-y-2">
            <p className="font-semibold">📱 Android Installation:</p>
            <ol className="list-decimal list-inside space-y-1 opacity-95">
              <li>Tap the menu button (⋮) top-right</li>
              <li>Select "Install app"</li>
              <li>Confirm</li>
            </ol>
          </div>
        ) : isIOS ? (
          <div className="space-y-2">
            <p className="font-semibold">📱 iOS Installation:</p>
            <ol className="list-decimal list-inside space-y-1 opacity-95">
              <li>Tap the share button (↗️)</li>
              <li>Select "Add to Home Screen"</li>
              <li>Name it "FuelSync" and confirm</li>
            </ol>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="font-semibold">💻 Desktop Installation:</p>
            <ol className="list-decimal list-inside space-y-1 opacity-95">
              <li>Look for install icon in address bar</li>
              <li>Click to install FuelSync</li>
              <li>Or use the Install button below</li>
            </ol>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleDismiss}
          variant="outline"
          className="flex-1 h-9 bg-blue-500 border-blue-400 text-white hover:bg-blue-600 hover:text-white"
          size="sm"
        >
          Maybe Later
        </Button>
        <Button
          onClick={handleDismiss}
          className="flex-1 bg-white text-blue-600 hover:bg-gray-100 h-9 font-semibold"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Install Now
        </Button>
      </div>

      <div className="text-xs opacity-75 mt-2 text-center">
        You'll be able to use FuelSync without internet
      </div>
    </div>
  );
}
