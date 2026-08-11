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

  /**
   * Las pruebas no hablan con producción. Nunca.
   *
   * Vite carga el `.env` también en modo test, así que `VITE_SUPABASE_URL`
   * llegaba puesta y cualquier módulo que importe `lib/supabase` construía el
   * cliente **real**: una prueba de `busqueda.js` alcanzó a hacerle consultas
   * a la base del hotel antes de que se notara. Fueron lecturas y volvieron
   * vacías por la RLS, pero el camino estaba abierto.
   *
   * Vaciarla aquí cierra la clase entera de error: `isMock` da true siempre en
   * pruebas, sin depender de que cada archivo se acuerde de simularlo.
   */
  test: {
    env: {
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
  },
})
