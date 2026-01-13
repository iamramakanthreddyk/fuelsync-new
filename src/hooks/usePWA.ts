import { useEffect, useState, useCallback } from 'react';

// @ts-ignore - virtual module from vite-plugin-pwa
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Hook to detect if the app is online/offline
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Hook to handle PWA updates
 * Shows a notification when an update is available
 */
export function usePWAUpdate() {
  const [hasUpdate, setHasUpdate] = useState(false);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegistered(swr: ServiceWorkerRegistration) {
      console.log('Service Worker registered:', swr);
      // Check for updates every hour
      setInterval(() => {
        swr?.update();
      }, 60 * 60 * 1000);
    },
    onRegisterError(error: Error) {
      console.error('Service Worker registration error:', error);
    },
    immediate: true
  });

  useEffect(() => {
    setHasUpdate(needRefresh);
  }, [needRefresh]);

  const handleUpdate = useCallback(() => {
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  return {
    hasUpdate,
    needRefresh,
    offlineReady,
    updateServiceWorker: handleUpdate,
    setOfflineReady,
    setNeedRefresh
  };
}

/**
 * Check if app is running as PWA (installed)
 */
export function useIsPWAInstalled() {
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    // Check if running as PWA on mobile
    const isStandalone = 
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;

    setIsPWA(isStandalone);
  }, []);

  return isPWA;
}

/**
 * Trigger cache refresh manually
 */
export async function refreshCache() {
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    return true;
  } catch (error) {
    console.error('Cache refresh failed:', error);
    return false;
  }
}

/**
 * Clear all caches (useful for debugging)
 */
export async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );
    console.log('All caches cleared');
    return true;
  } catch (error) {
    console.error('Failed to clear caches:', error);
    return false;
  }
}

/**
 * Get cache size (for debugging)
 */
export async function getCacheSize() {
  try {
    const cacheNames = await caches.keys();
    let totalSize = 0;

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();

      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }

    return {
      bytes: totalSize,
      mb: (totalSize / 1024 / 1024).toFixed(2)
    };
  } catch (error) {
    console.error('Failed to get cache size:', error);
    return null;
  }
}
