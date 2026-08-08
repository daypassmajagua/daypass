import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // El muelle de La Bodeguita no tiene señal confiable en hora de embarque,
    // y la isla tampoco. La app se instala en el iPad y arranca sin red.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'DayPASS · Hotel San Pedro de Majagua',
        short_name: 'DayPASS',
        description: 'Pasadías del Hotel San Pedro de Majagua, Islas del Rosario',
        lang: 'es-CO',
        theme_color: '#1e2045',
        background_color: '#f8f8f6',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // El shell se cachea completo: la app abre sin red.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Los datos NO se cachean aquí: de eso se encarga Dexie, que es la
        // fuente de verdad local. Un caché de red daría respuestas viejas
        // sin que nadie se entere.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//],
        runtimeCaching: [],
      },
      devOptions: {
        // En desarrollo el service worker estorba más de lo que ayuda.
        enabled: false,
      },
    }),
  ],
})
