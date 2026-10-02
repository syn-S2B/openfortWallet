import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDemoServer } from '../server/demo-site.mjs'

test('public demo serves only built assets and denies all real wallet effects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wallet-demo-'))
  await mkdir(join(root, 'Docs')); await mkdir(join(root, 'assets'))
  await writeFile(join(root, 'index.html'), '<h1>Demo</h1>')
  await writeFile(join(root, 'Docs/index.html'), '<h1>Docs</h1>')
  await writeFile(join(root, 'assets/demo.js'), '/* demo */')
  const server = createDemoServer(root)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    assert.match(await (await fetch(base)).text(), /Demo/)
    assert.match(await (await fetch(`${base}/Docs/`)).text(), /Docs/)
    const connection = await fetch(`${base}/api/species/connection`)
    assert.deepEqual(await connection.json(), { configured: false, gateway_url: '', message: 'Public wallet demo. Real wallet operations are unavailable.' })
    assert.equal(connection.headers.get('cache-control'), 'no-store')
    assert.match(connection.headers.get('content-security-policy'), /frame-ancestors 'none'/)
    assert.equal((await fetch(`${base}/api/species/members`)).status, 403)
    assert.equal((await fetch(`${base}/api/species/auth/start`, { method: 'POST', body: '{}' })).status, 405)
    assert.equal((await fetch(`${base}/.env`)).status, 404)
    assert.equal((await fetch(`${base}/%2e%2e%2fpackage.json`)).status, 404)
    assert.equal((await fetch(`${base}/missing.js`)).status, 404)
    assert.equal(await (await fetch(base, { method: 'HEAD' })).text(), '')
    assert.equal((await fetch(`${base}/assets/demo.js`)).headers.get('cache-control'), 'public, max-age=31536000, immutable')
    assert.equal(await (await fetch(`${base}/healthz`)).text(), 'ok')
  } finally { await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true }) }
})
