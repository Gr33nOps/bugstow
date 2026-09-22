import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Offline support for Personal mode: precache the app shell so Bugstow keeps
    // working with no network. It never caches /api (team data must be live).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Never serve stale team API data from the cache.
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'Bugstow',
        short_name: 'Bugstow',
        description: 'A privacy-first issue tracker. Spot it. Stow it. Fix it.',
        theme_color: '#5B50F6',
        background_color: '#0b0f19',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '8443'),
    // In development, proxy API + auth calls to a locally running team server
    // so the team UI can be exercised end-to-end. Set BUGSTOW_SERVER to override.
    proxy: {
      '/api': {
        target: process.env.BUGSTOW_SERVER || 'http://localhost:8080',
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '8443'),
  },
})
