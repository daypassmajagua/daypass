import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],

      /**
       * ── Las tres del compilador de React, como avisos ──────────────────────
       *
       * Un despliegue se detiene por **defectos**, no por consejo de
       * optimización. Estas tres no dicen que algo esté mal: dicen que el
       * compilador no pudo optimizar algo, o que un patrón podría causar
       * renders en cascada. Con ellas en `error`, `npm run lint` salía con
       * código 1 y **Vercel se negaba a desplegar** — un hotel operando en un
       * Excel de 88 columnas se quedaba sin sistema por un consejo de
       * rendimiento.
       *
       * Siguen apareciendo en cada corrida, que es lo que importa: la deuda
       * queda a la vista y no se puede alegar que nadie la vio.
       *
       *   `set-state-in-effect` (30) — casi todas son el mismo patrón:
       *     `useEffect(() => { cargar() }, [cargar])`, donde `cargar` es una
       *     función async que pone estado **después de un await**. La regla es
       *     conservadora y no distingue eso de un setState síncrono. Las que sí
       *     son síncronas están contadas y valen la pena; arreglarlas todas es
       *     rehacer las veinticinco pantallas que traen datos, y eso se decide
       *     aparte, no de contrabando en un arreglo de despliegue.
       *
       *   `preserve-manual-memoization` (4) — todas en `useEmbarque`, el hook
       *     del muelle. Quiere decir que el compilador se saltó la
       *     optimización porque las dependencias escritas a mano
       *     (`zarpe?.id`, `zarpe?.fecha`) son más específicas que las que él
       *     infiere (`zarpe`). Se arregla sacando esos valores a variables
       *     antes del `useCallback`. **Vale la pena hacerlo** —es la pantalla
       *     donde el rendimiento importa— pero es cirugía en el archivo más
       *     delicado del sistema y no se hace junto a otra cosa.
       *
       *   `incompatible-library` (1) — el `watch()` de React Hook Form no se
       *     puede memoizar sin arriesgar interfaz vieja. Es de la librería, no
       *     nuestro.
       *
       * **Qué las devolvería a `error`:** que alguna deje de ser consejo. Si
       * aparece un `set-state-in-effect` que sí causa un bucle de renders, esa
       * línea se arregla; la regla no se sube entera para que el arreglo
       * quepa.
       */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/incompatible-library': 'warn',
    },
  },
])
