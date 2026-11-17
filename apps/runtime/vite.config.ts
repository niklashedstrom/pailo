import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// /a/<slug>/manifest.webmanifest comes from the app-manifest server function.
// On Vercel a rewrite in vercel.json does this; in development this proxy
// does the same against the Supabase in .env.local.
const MANIFEST = /^\/a\/([a-z0-9-]+)\/manifest\.webmanifest$/

export default defineConfig(({ mode }) => {
  const supabaseUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL
  return {
    plugins: [react()],
    server: supabaseUrl
      ? {
          proxy: {
            '^/a/[a-z0-9-]+/manifest\\.webmanifest$': {
              target: supabaseUrl,
              changeOrigin: true,
              rewrite: (path) => path.replace(MANIFEST, '/functions/v1/app-manifest?slug=$1'),
            },
          },
        }
      : undefined,
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
    },
  }
})
