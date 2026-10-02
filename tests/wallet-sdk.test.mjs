import test from 'node:test'
import assert from 'node:assert/strict'
import { loadUI } from './load-ui.mjs'

const loader = loadUI({ '@openfort/openfort-js': `
  export const RecoveryMethod = {AUTOMATIC:'automatic'}, ThirdPartyOAuthProvider = {CUSTOM:'custom'}
  export class Openfort {
    constructor(config) {
      globalThis.sdkFixture.constructed.push(config)
      this.auth = {logout: () => globalThis.sdkFixture.logout(config.overrides.storage)}
      this.embeddedWallet = {getEthereumProvider: async options => options}
    }
    async waitForInitialization() {}
  }
` })
const tabA = await import('../src/wallet-sdk.ts?tab-a')
const tabB = await import('../src/wallet-sdk.ts?tab-b')
const tick = () => new Promise(resolve => setImmediate(resolve))
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const access = { publishable_key: 'fixture', shield_publishable_key: 'fixture-shield', wallet: { chain_id: 1 } }

test('send/export share an origin lock through SDK logout and dispose each isolated store afterward', async () => {
  const oldDocument = globalThis.document, oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const signing = defer(), teardown = defer()
  const frame = { isConnected: true }
  let held = false, competingAction = false, cleanupEntered = false
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { async request(_name, _options, action) {
    if (held) return action(null)
    held = true
    try { return await action({}) } finally { held = false }
  } } } })
  globalThis.document = { getElementById: () => frame }
  globalThis.sdkFixture = { constructed: [], async logout(storage) {
    cleanupEntered = true
    assert.equal(await storage.get('auth'), 'fixture-auth', 'auth must still exist when logout begins')
    await teardown.promise
    frame.isConnected = false
  } }
  let first, retainedFactory, retainedHandle
  try {
    first = tabA.withWalletSDK(async createSDK => {
      retainedFactory = createSDK
      const sdk = createSDK(access, async () => 'fixture-token')
      assert.equal('provider' in sdk, false, 'raw provider handles stay inside the Adapter')
      await sdk.waitForInitialization()
      retainedHandle = sdk
      const storage = globalThis.sdkFixture.constructed.at(-1).overrides.storage
      storage.save('auth', 'fixture-auth')
      try { await signing.promise; return 'sent' } finally { await sdk.logout(true) }
    })
    await tick()
    await assert.rejects(tabB.withWalletSDK(async () => { competingAction = true }), /Another wallet operation/)
    assert.equal(competingAction, false)
    assert.equal(globalThis.sdkFixture.constructed.length, 1)
    signing.resolve(); await tick()
    assert.equal(cleanupEntered, true)
    await assert.rejects(tabB.withWalletSDK(async () => { competingAction = true }), /Another wallet operation/)
    teardown.resolve(); assert.equal(await first, 'sent')
    assert.throws(() => retainedFactory(access, async () => 'fixture-token'), /operation has ended/)
    assert.throws(() => retainedHandle.waitForInitialization(), /operation has ended/)
    const prior = globalThis.sdkFixture.constructed[0].overrides.storage
    assert.equal(await prior.get('auth'), null)
    prior.save('auth', 'late SDK callback'); assert.equal(await prior.get('auth'), null)

    // The other tab can now proceed with an empty, independent store.
    frame.isConnected = true
    globalThis.sdkFixture.logout = async () => { frame.isConnected = false }
    await tabB.withWalletSDK(async createSDK => {
      const sdk = createSDK({ ...access, wallet: { chain_id: 11155111 } }, async () => 'fixture-token')
      assert.equal('provider' in sdk, false)
      await sdk.waitForInitialization()
      const storage = globalThis.sdkFixture.constructed.at(-1).overrides.storage
      assert.notEqual(storage, prior); assert.equal(await storage.get('auth'), null)
      // Failed actions release the origin lock but retain the local reload guard.
      await sdk.logout(false)
    })
    await assert.rejects(tabB.withWalletSDK(async () => assert.fail('failed tab must reload')), /Reload/)
    assert.equal(held, false)
    assert.equal(await tabA.withWalletSDK(async () => 'ready'), 'ready')
    frame.isConnected = true
    await tabA.withWalletSDK(async createSDK => { createSDK(access, async () => 'fixture-token') })
    assert.equal(frame.isConnected, false, 'Capability disposes an abandoned handle before releasing the operation lock')
    await assert.rejects(tabA.withWalletSDK(async () => 'unsafe'), /Reload/)
  } finally {
    signing.resolve(); teardown.resolve(); await first?.catch(() => {})
    globalThis.document = oldDocument
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator)
    else delete globalThis.navigator
    delete globalThis.sdkFixture; loader.deregister()
  }
})
