import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { morkahjaLocalAdminPlugin } from './vite/localAdminPlugin'
import {
  morkahjaLocalContentPlugin,
  resolveMorkahjaPublicRoot,
} from './vite/localContentPlugin'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = env.VITE_API_BASE_URL?.trim() ?? ''
  const proxyTarget = env.API_PROXY_TARGET?.trim()
  const adminApiKey = env.ADMIN_API_KEY?.trim()
  const morkahjaPublic = resolveMorkahjaPublicRoot(env)
  const databaseUrl = env.VITE_DATABASE_URL?.trim() ?? ''
  const devPort = Number(env.DEV_PORT) || 5180
  const previewPort = Number(env.PREVIEW_PORT) || 4180

  const useApiProxy = apiBase.startsWith('/') && proxyTarget.length > 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proxy: Record<string, any> = {}

  if (useApiProxy) {
    proxy[apiBase] = {
      target: proxyTarget,
      changeOrigin: true,
      secure: env.API_PROXY_INSECURE !== 'true',
      configure: (proxyServer: {
        on: (
          event: string,
          fn: (proxyReq: { setHeader: (key: string, value: string) => void }) => void,
        ) => void
      }) => {
        proxyServer.on('proxyReq', (proxyReq) => {
          if (adminApiKey) {
            proxyReq.setHeader('Authorization', `Bearer ${adminApiKey}`)
          }
        })
      },
    }
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      morkahjaLocalContentPlugin(morkahjaPublic),
      ...(databaseUrl ? [morkahjaLocalAdminPlugin(databaseUrl)] : []),
    ],
    server: {
      host: '127.0.0.1',
      port: devPort,
      strictPort: true,
      fs: {
        // Project root (index.html, src/) + Morkahja public assets outside the repo
        allow: [projectRoot, resolve(morkahjaPublic)],
      },
      proxy: Object.keys(proxy).length > 0 ? proxy : undefined,
    },
    preview: {
      host: '127.0.0.1',
      port: previewPort,
      strictPort: true,
    },
  }
})
