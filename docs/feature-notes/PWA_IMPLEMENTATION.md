# PWA Implementation Guide

## Overview

FuelSync is now a **Progressive Web App (PWA)**! This means users can:
- ✅ Install the app on their home screen
- ✅ Use the app offline
- ✅ Get automatic updates
- ✅ Enjoy app-like experience

---

## Features Implemented

### 1. **Service Worker & Caching**
- Automatic service worker registration via `vite-plugin-pwa`
- Smart caching strategies:
  - **Network-First** for API calls (5-minute cache)
  - **Cache-First** for images (1-year cache)
  - **Cache-First** for fonts (1-year cache)
  - **Cache-First** for static assets

### 2. **Install Prompt**
- Custom install banner shown to eligible users
- Shows on desktop and mobile browsers
- Can be dismissed or installed with one click
- Stored in component: `src/components/PWAInstallPrompt.tsx`

### 3. **Update Notifications**
- Automatically detects new app versions
- Shows notification when update available
- One-click update with page reload
- Component: `src/components/PWAUpdateNotification.tsx`

### 4. **Offline Support**
- Offline fallback page at `/public/offline.html`
- Service worker serves cached content when offline
- Graceful error handling for API failures

### 5. **App Manifest**
- Complete PWA manifest at `/public/manifest.json`
- Includes:
  - App name, description, icons
  - Shortcuts for quick access
  - Screenshot for install prompts
  - Theme colors

### 6. **PWA Utilities**
- Hook-based utilities in `src/hooks/usePWA.ts`:
  - `useOnlineStatus()` - Detect online/offline
  - `usePWAUpdate()` - Handle app updates
  - `useIsPWAInstalled()` - Check if running as PWA
  - `refreshCache()` - Manual cache refresh
  - `clearAllCaches()` - Clear all caches (dev/debug)
  - `getCacheSize()` - Get cache size info

---

## File Structure

```
src/
├── components/
│   ├── PWAInstallPrompt.tsx      ← Install banner
│   ├── PWAUpdateNotification.tsx ← Update notification
│   └── OfflineFallback.tsx       ← Offline UI (unused, for reference)
├── hooks/
│   └── usePWA.ts                  ← PWA utilities & hooks
└── main.tsx                       ← Entry point (updated)

public/
├── manifest.json                 ← PWA manifest
├── offline.html                  ← Offline fallback page
├── favicon.svg
└── logo.jpeg

vite.config.ts                    ← PWA plugin configuration
index.html                        ← HTML with PWA meta tags
```

---

## Configuration

### `vite.config.ts`
The `VitePWA` plugin is configured with:
- Auto-update service workers
- Workbox for advanced caching
- Runtime caching strategies
- Development mode detection

**Key configuration:**
```typescript
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    // Network-first for API
    runtimeCaching: [{
      urlPattern: /^https:\/\/api\./,
      handler: 'NetworkFirst'
    }]
  }
})
```

### `manifest.json`
Defines:
- App metadata (name, description, theme)
- Icons for different devices
- Shortcuts for quick access
- Screenshots for install prompt

---

## How It Works

### Installation Flow
1. User visits app on supported browser
2. `beforeinstallprompt` event triggers
3. Install banner shown (`PWAInstallPrompt`)
4. User clicks "Install"
5. App added to home screen / app drawer

### Offline Flow
1. User opens app while offline
2. Service worker serves cached content
3. API calls fail gracefully
4. Cached data displayed
5. User sees offline indicator

### Update Flow
1. New app version deployed
2. Service worker detects update
3. Update notification shown
4. User clicks "Update Now"
5. Page reloads with new version

---

## Testing

### Test Installation
```bash
# Build the app
npm run build

# Preview build locally
npm run preview

# On desktop:
# - Look for install icon in address bar
# - Chrome: Click install button
# - Edge: Click app icon menu

# On mobile:
# - Tap menu → "Install app" / "Add to Home Screen"
```

### Test Offline
```bash
# In DevTools (F12):
# 1. Go to Application → Service Workers
# 2. Check "Offline" checkbox
# 3. Try navigating to different pages
# 4. Open DevTools → Network tab to see cached requests
```

### Test Updates
```bash
# Make a small change to the app
# Rebuild: npm run build
# Reload page
# Should see update notification
# Click "Update Now" to refresh
```

### Lighthouse PWA Audit
```bash
# In Chrome DevTools:
# 1. F12 → Lighthouse tab
# 2. Select "PWA" category
# 3. Click "Analyze page load"
```

---

## Usage in Components

### Detect Online Status
```tsx
import { useOnlineStatus } from '@/hooks/usePWA';

function MyComponent() {
  const isOnline = useOnlineStatus();
  
  return <div>{isOnline ? '🟢 Online' : '🔴 Offline'}</div>;
}
```

### Handle Updates
```tsx
import { usePWAUpdate } from '@/hooks/usePWA';

function UpdateHandler() {
  const { hasUpdate, updateServiceWorker } = usePWAUpdate();
  
  if (hasUpdate) {
    return (
      <button onClick={updateServiceWorker}>
        Update Available
      </button>
    );
  }
  return null;
}
```

### Check if PWA Installed
```tsx
import { useIsPWAInstalled } from '@/hooks/usePWA';

function AppShell() {
  const isPWA = useIsPWAInstalled();
  
  // Customize UI for PWA mode
  return <div>{isPWA && '✨ Running as PWA'}</div>;
}
```

---

## Debugging

### Clear Cache (Development)
```tsx
import { clearAllCaches } from '@/hooks/usePWA';

// In browser console:
// clearAllCaches().then(() => window.location.reload())
```

### Check Cache Size
```tsx
import { getCacheSize } from '@/hooks/usePWA';

getCacheSize().then(size => {
  console.log(`Cache: ${size.mb} MB`);
});
```

### Service Worker Logs
```tsx
// In DevTools → Application → Service Workers
// Check the status and logs
```

---

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Installation | ✅ | ✅ | ✅ | ✅ |
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Offline | ✅ | ✅ | ✅ | ✅ |
| Push Notifications | ✅ | ✅ | ⚠️ | ✅ |
| Background Sync | ✅ | ✅ | ❌ | ✅ |

---

## Next Steps (Optional)

For **Tier 2 (Recommended)** features, implement:
1. **Background Sync** - Sync offline transactions when online
2. **Push Notifications** - Server-side push updates
3. **Advanced Caching** - Per-route caching strategies
4. **Analytics** - Track PWA usage metrics

---

## Troubleshooting

### App not installing
- Check `manifest.json` is served correctly
- Ensure HTTPS or localhost
- Verify service worker registered (DevTools → Application)

### Offline not working
- Check service worker status
- Verify caching strategy in `vite.config.ts`
- Check Network tab for cached requests

### Updates not appearing
- Clear browser cache
- Hard refresh (Ctrl+Shift+R)
- Check service worker update frequency

---

## References

- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web.dev PWA Checklist](https://web.dev/pwa-checklist/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [vite-plugin-pwa](https://vite-plugin-pwa.netlify.app/)
