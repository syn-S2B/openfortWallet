import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { loadWalletConfiguration } from './server/configuration.mjs'
import { createMiddleware } from './server/gateway.mjs'

export default defineConfig(({ mode }) => {
  const config = loadWalletConfiguration(mode)
  return {
    define: { __WALLET_DEMO__: JSON.stringify(mode === 'demo') },
    plugins: [react(), {
      name: 'species-wallet-gateway',
      configureServer(server) { server.middlewares.use(createMiddleware(config, 5175)) },
      configurePreviewServer(server) { server.middlewares.use(createMiddleware(config, 5175)) },
    }],
    server: { host: '127.0.0.1', port: 5175, strictPort: true, cors: false },
    preview: { host: '127.0.0.1', port: 5175, strictPort: true, cors: false },
  }
})
