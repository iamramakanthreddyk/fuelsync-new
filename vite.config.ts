import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "localhost",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.jpeg'],
      manifest: {
        name: 'FuelSync - Fuel Station Management',
        short_name: 'FuelSync',
        description: 'Manage your fuel station with ease. Track sales, monitor pumps, and manage your team.',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'logo.jpeg',
            sizes: '192x192',
            type: 'image/jpeg'
          }
        ],
        screenshots: [
          {
            src: 'logo.jpeg',
            sizes: '540x720',
            type: 'image/jpeg',
            form_factor: 'narrow'
          },
          {
            src: 'logo.jpeg',
            sizes: '1280x720',
            type: 'image/jpeg',
            form_factor: 'wide'
          }
        ],
        categories: ['business', 'productivity'],
        shortcuts: [
          {
            name: 'Quick Entry',
            short_name: 'Entry',
            description: 'Quick data entry for readings',
            url: '/quick-entry',
            icons: [{ src: 'logo.jpeg', sizes: '192x192' }]
          },
          {
            name: 'Daily Settlement',
            short_name: 'Settlement',
            description: 'Daily settlement management',
            url: '/settlement',
            icons: [{ src: 'logo.jpeg', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,jpeg}'],
        globIgnores: ['**/node_modules/**/*', '.git/**/*'],
        maximumFileSizeToCacheInBytes: 5000000,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60 // 5 minutes
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|svg|gif)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.(woff|woff2|ttf|otf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: mode === 'development'
      }
    }),
    // mode === 'development' &&
    // componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
