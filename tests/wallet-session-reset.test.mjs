import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { create, act } from 'react-test-renderer'
import { loadUI } from './load-ui.mjs'

const loader = loadUI({
  './send-wallet': 'export const sendWallet = (...args) => globalThis.walletResetHarness.send(...args)',
  '@openfort/openfort-js': `
    export const RecoveryMethod = {AUTOMATIC:'automatic'}, ThirdPartyOAuthProvider = {CUSTOM:'custom'}
    export class Openfort {
      auth = {logout: async () => {}}
      embeddedWallet = {recover: async () => { throw Object.assign(new Error('private provider response'), {name:'RecoveryError'}) }}
      async waitForInitialization() {}
    }
  `,
})
const { usePersonalWallet } = await import('../src/usePersonalWallet.ts')
const { default: WalletTools } = await import('../src/WalletTools.tsx')
const { withWalletSDK } = await import('../src/wallet-sdk.ts')
const { runWalletAction } = await import('../src/export-core.ts')

test('failed SDK recovery offers a page reset, blocks repeat signing and preserves submission records', async () => {
  const wallet = { address: `0x${'1'.repeat(40)}`, account_ref: 'acc_test', user_ref: 'usr_test', wallet_ref: 'pla_test', chain_id: 11155111, custody: 'User', account_type: 'Externally Owned Account' }
  const session = { token: 'fixture', onli_id: 'fixture' }, recipient = `0x${'2'.repeat(40)}`
  const key = `species-wallet-submission:${wallet.chain_id}:${wallet.address}`
  const record = JSON.stringify({ status: 'confirmed', hash: `0x${'a'.repeat(64)}`, asset: 'USDC', amount: '1' })
  const values = new Map([[key, record]]), events = new EventTarget()
  const originalFetch = globalThis.fetch
  let reloads = 0, attempts = 0, personal, root
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }
  globalThis.window = { setInterval, clearInterval, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), location: { reload: () => { reloads++ } } }
  globalThis.document = { hidden: false, getElementById: () => null }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request: async (_key, _options, action) => action({}) } } })
  globalThis.fetch = async (_url, options) => {
    if (options?.method !== 'POST') return { ok: true, json: async () => ({ items: [] }) }
    const { method } = JSON.parse(options.body)
    const result = { eth_chainId: '0xaa36a7', eth_getBalance: '0xde0b6b3a7640000', eth_call: '0x1312d00', eth_estimateGas: '0x10000', eth_getBlockByNumber: { baseFeePerGas: '0x1' }, eth_maxPriorityFeePerGas: '0x1' }[method]
    assert.notEqual(result, undefined, method)
    return { ok: true, json: async () => ({ result }) }
  }
  globalThis.walletResetHarness = { send: (_session, _wallet, _quote, isCurrent) => {
    attempts++
    return withWalletSDK(createSDK => runWalletAction({
      wallet, createSDK, isCurrent,
      getAccess: async () => ({ wallet, publishable_key: 'pk_fixture', shield_publishable_key: 'shield_fixture', auth_provider: 'custom', auth_token: 'fixture-token', encryption_session: 'fixture-session', expires_at: Date.now() / 1000 + 300 }),
      action: async () => assert.fail('failed recovery must never reach signing'),
    }))
  } }
  const button = label => root.root.findAllByType('button').find(b => b.children.filter(c => typeof c === 'string').join('') === label)
  const rendered = () => JSON.stringify(root.toJSON())
  function Harness() { personal = usePersonalWallet(wallet, session); return React.createElement(WalletTools, { wallet, personal, hidden: false, busy: false }) }
  try {
    await act(async () => { root = create(React.createElement(Harness)) })
    await act(async () => { button('Send').props.onClick() })
    await act(async () => { await personal.review('USDC', recipient, '1') })
    await act(async () => { await personal.confirm() })
    assert.equal(attempts, 1)
    assert.equal(personal.reloadRequired, true)
    assert.match(rendered(), /could not reconnect/)
    assert.doesNotMatch(rendered(), /private provider response/)
    assert.equal(button('Review transfer'), undefined)
    assert.equal(button('Confirm and send'), undefined)
    assert.ok(button('Reload and sign in'))
    await act(async () => { personal.edit(); await personal.review('USDC', recipient, '1'); await personal.confirm() })
    assert.equal(attempts, 1, 'no automatic or repeated submission from a failed SDK session')
    assert.match(rendered(), /could not reconnect/, 'retain the original safe failure message')
    await act(async () => { button('Reload and sign in').props.onClick() })
    assert.equal(reloads, 1)
    assert.equal(values.get(key), record, 'reset keeps transaction history and duplicate guards')

    // Remounting/signing in on the same page cannot bypass SDK teardown failure.
    await act(async () => { root.unmount() })
    await act(async () => { root = create(React.createElement(Harness)) })
    assert.equal(personal.reloadRequired, true)
    await act(async () => { button('Send').props.onClick() })
    assert.ok(button('Reload and sign in'))
    assert.equal(button('Review transfer'), undefined)
  } finally {
    await act(async () => { root?.unmount() })
    globalThis.fetch = originalFetch
    delete globalThis.walletResetHarness
    loader.deregister()
  }
})
