import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  // In development the Django server is proxied, so the browser only ever
  // talks to the Vite origin (no CORS issues, WebSockets included).
  const backend = env.VITE_DEV_BACKEND || 'http://127.0.0.1:8000'
  // With church subdomains (e.g. kaimosi.localhost:5173) the backend must see the browser's own Host header.
  const keepHost = Boolean(env.VITE_TENANT_BASE_DOMAIN)

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: backend, changeOrigin: !keepHost },
        '/health': { target: backend, changeOrigin: !keepHost },
        '/media': { target: backend, changeOrigin: !keepHost },
        '/ws': { target: backend.replace(/^http/, 'ws'), ws: true, changeOrigin: !keepHost },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react')) return 'react'
          },
        },
      },
    },
  }
})
