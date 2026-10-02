import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' }
/** Public hosting is demo-only; no environment credentials or upstream proxy. */
export function createDemoServer(directory = fileURLToPath(new URL('../dist/', import.meta.url))) {
  const root = resolve(directory)
  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'")
    res.setHeader('Cache-Control', 'no-store')
    const reply = (status, body, type = 'text/plain; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type })
      res.end(req.method === 'HEAD' ? undefined : body)
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD')
      return reply(405, 'This public site is a read-only wallet demo.')
    }
    let path
    try { path = decodeURIComponent(new URL(req.url, 'http://demo.invalid').pathname) } catch { return reply(400, 'Invalid path') }
    if (path === '/healthz') return reply(200, 'ok')
    if (path === '/api/species/connection') return reply(200, JSON.stringify({ configured: false, gateway_url: '', message: 'Public wallet demo. Real wallet operations are unavailable.' }), 'application/json')
    if (path.startsWith('/api/')) return reply(403, JSON.stringify({ error: { code: 'demo_only', message: 'Real wallet operations are unavailable on this public demo.' } }), 'application/json')
    if (path.includes('\\') || path.includes('\0') || path.split('/').some(part => part.startsWith('.'))) return reply(404, 'Not found')
    if (path.endsWith('/')) path += 'index.html'
    const file = resolve(root, `.${path}`)
    if (!file.startsWith(root + sep) || !types[extname(file)]) return reply(404, 'Not found')
    try {
      const body = await readFile(file)
      if (path.startsWith('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      return reply(200, body, types[extname(file)])
    } catch { return reply(404, 'Not found') }
  })
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createDemoServer()
  server.listen(Number(process.env.PORT ?? 8080), '0.0.0.0')
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)))
}
