import test from 'node:test'
import assert from 'node:assert/strict'
import { WalletOperationUnavailable, WalletSessionStorage, withWalletOperation } from '../src/wallet-operation.ts'

test('origin lock rejects concurrent operations and releases after failure', async () => {
  let held = false, release, calls = 0
  const locks = { async request(name, options, action) {
    assert.equal(name, 'species:openfort-sdk')
    assert.deepEqual(options, { ifAvailable: true })
    if (held) return action(null)
    held = true
    try { return await action({}) } finally { held = false }
  } }
  const first = withWalletOperation(async () => {
    calls++
    await new Promise(resolve => { release = resolve })
    throw new Error('fixture failure')
  }, locks)
  await assert.rejects(withWalletOperation(async () => { calls++ }, locks), WalletOperationUnavailable)
  assert.equal(calls, 1)
  release()
  await assert.rejects(first, /fixture failure/)
  await withWalletOperation(async () => { calls++ }, locks)
  assert.equal(calls, 2)
})

test('unavailable browser coordination fails before touching the SDK', async () => {
  // null deliberately models a browser without Web Locks, bypassing the default.
  await assert.rejects(withWalletOperation(async () => assert.fail('must not execute'), null), WalletOperationUnavailable)
})

test('operation storage isolates auth and account state and refuses late writes after disposal', async () => {
  const first = new WalletSessionStorage(), second = new WalletSessionStorage()
  for (const key of ['auth', 'account']) { first.save(key, 'first'); second.save(key, 'second') }
  first.dispose()
  for (const key of ['auth', 'account']) {
    first.save(key, 'late write')
    assert.equal(await first.get(key), null)
    assert.equal(await second.get(key), 'second')
  }
  second.remove('auth'); assert.equal(await second.get('auth'), null)
  second.flush(); assert.equal(await second.get('account'), null)
})

test('installed public Openfort SDK initializes and logs out with memory storage only', async () => {
  const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), originalFetch = globalThis.fetch
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { assert.fail('SDK must not use persistent browser storage') } })
  globalThis.fetch = async () => assert.fail('fixture initialization/logout must not make network requests')
  const storage = new WalletSessionStorage(), removed = []
  const remove = storage.remove.bind(storage)
  storage.remove = key => { removed.push(key); remove(key) }
  try {
    const { Openfort, ThirdPartyOAuthProvider } = await import('@openfort/openfort-js')
    const sdk = new Openfort({
      baseConfiguration: { publishableKey: 'pk_test_fixture1' },
      shieldConfiguration: { shieldPublishableKey: 'pk_test_fixture_shield' },
      thirdPartyAuth: { provider: ThirdPartyOAuthProvider.CUSTOM, getAccessToken: async () => 'fixture-token' },
      overrides: { storage },
    })
    await sdk.waitForInitialization()
    storage.save('fixture1.openfort.authentication', JSON.stringify({ type: 'third_party', userId: 'fixture-user', thirdPartyProvider: 'custom' }))
    storage.save('fixture1.openfort.account', 'fixture-account')
    await sdk.auth.logout()
    await new Promise(resolve => setImmediate(resolve))
    assert.ok(removed.includes('fixture1.openfort.authentication'))
    assert.ok(removed.includes('fixture1.openfort.account'), 'logout must reach the account cleanup listener before disposal')
    assert.equal(await storage.get('fixture1.openfort.authentication'), null)
    assert.equal(await storage.get('fixture1.openfort.account'), null)
  } finally {
    storage.dispose(); globalThis.fetch = originalFetch
    if (priorStorage) Object.defineProperty(globalThis, 'localStorage', priorStorage)
    else delete globalThis.localStorage
  }
})
