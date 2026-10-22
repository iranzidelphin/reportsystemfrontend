import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,svg,ico,png,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        runtimeCaching: [{
          urlPattern: /\/api\//,
          handler: 'NetworkOnly',
        }],
      },
    }),
  ],
})
