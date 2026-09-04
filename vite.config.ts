import path from 'node:path'
import { loadEnv, type PluginOption } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Local-dev bridge for the `/api/assistant` serverless function.
 *
 * `vite dev` does NOT run files in `api/` (that only happens on Vercel), so
 * without this the AI Copilot could never reach the LLM in local development
 * and every free-form question fell back to the dumb rule-based engine.
 *
 * This middleware runs the exact same `api/assistant.js` handler in the dev
 * server's Node process, so `npm run dev` behaves like production. The key is
 * read from `.env` here (Node side) and never exposed to the browser bundle.
 */
function devAssistantApi(mode: string): PluginOption {
  return {
    name: 'netforge-dev-assistant-api',
    apply: 'serve',
    configureServer(server) {
      // Load every var from .env (not just VITE_*) into process.env so the
      // serverless handler can read KIMI_API_KEY / MOONSHOT_API_KEY / etc.
      const env = loadEnv(mode, process.cwd(), '')
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }

      server.middlewares.use('/api/assistant', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let raw = ''
        for await (const chunk of req) raw += chunk

        let body: unknown
        try {
          body = raw ? JSON.parse(raw) : {}
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Invalid JSON body' }))
          return
        }

        // Shim the Vercel (req, res) contract onto Node's http res.
        const shimRes = {
          statusCode: 200,
          setHeader: (k: string, v: string) => res.setHeader(k, v),
          status(code: number) {
            this.statusCode = code
            return this
          },
          json(payload: unknown) {
            res.statusCode = this.statusCode
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(payload))
          },
        }

        try {
          // Fresh import each call so edits to api/assistant.js hot-reload.
          const mod = await server.ssrLoadModule('/api/assistant.js')
          await mod.default({ method: 'POST', body }, shimRes)
        } catch (error) {
          // Never 500 the copilot - tell the client to use its local engine.
          console.error('[dev-assistant-api]', error)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ fallback: true, reason: 'dev_bridge_error' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), devAssistantApi(mode)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
}))
