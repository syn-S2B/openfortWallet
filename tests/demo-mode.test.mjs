import test from 'node:test'
import assert from 'node:assert/strict'
import { loadWalletConfiguration } from '../server/configuration.mjs'

const env = {
  SPECIES_WALLET_ENV_FILE: '/example/external-wallet.env',
  SPECIES_GATEWAY_URL: 'https://gateway.example.test',
  SPECIES_APP_SYMBOL: 'FIXTURE', SPECIES_API_KEY: 'appk_fixture',
  SPECIES_ENCRYPTION_KEY: Buffer.alloc(32, 42).toString('base64'),
}
test('demo ignores inherited gateway credentials and never loads an external env file', () => {
  const config = loadWalletConfiguration('demo', env, () => { throw new Error('must not load') })
  assert.equal(config.configured, false)
  assert.equal(config.url, '')
  assert.equal(config.apiKey, '')
  assert.equal(config.key.length, 0)
})
test('configured mode loads only the explicitly named file and retains gateway settings', () => {
  const loaded = []
  const config = loadWalletConfiguration('development', env, path => loaded.push(path))
  assert.deepEqual(loaded, [env.SPECIES_WALLET_ENV_FILE])
  assert.equal(config.configured, true)
  assert.equal(config.url, env.SPECIES_GATEWAY_URL)
})
