import test from 'node:test'
import assert from 'node:assert/strict'
import { loadUI } from '../load-ui.mjs'
const loader = loadUI()
const { workflow_read_wallet_observations } = await import('../../src/workflow/workflow_read_wallet_observations.ts')
const { createExternalWalletJourney } = await import('../../src/journey/journey_connect_external_wallet.ts')
const { tool_verify_transfer_confirmation } = await import('../../src/tool/tool_verify_transfer_confirmation.ts')
const { createTransferConfirmation } = await import('../../src/contracts/transfer-confirmation.ts')
loader.deregister()
const wallet = { address: `0x${'1'.repeat(40)}`, chain_id: 1, custody: 'User', account_type: 'Externally Owned Account' }
test('observation Workflow invokes only selected children and preserves independent unavailable reads', async () => {
  const originalFetch = globalThis.fetch, calls = []
  globalThis.fetch = async (url, init) => {
    calls.push(String(url))
    if (init.method !== 'POST') throw new Error('explorer unavailable')
    const { method } = JSON.parse(init.body)
    return { ok: true, json: async () => ({ result: { eth_chainId: '0x1', eth_getBalance: '0x1', eth_call: '0x2' }[method] }) }
  }
  try {
    const balanceOnly = await workflow_read_wallet_observations(wallet, { balances: true, activity: false })
    assert.equal(balanceOnly.balances.status, 'fulfilled'); assert.equal(balanceOnly.activity.value, undefined)
    assert.ok(calls.every(url => !url.includes('blockscout')))
    const before = calls.length
    await workflow_read_wallet_observations(wallet, { balances: false, activity: false })
    assert.equal(calls.length, before)
    const both = await workflow_read_wallet_observations(wallet)
    assert.equal(both.balances.status, 'fulfilled'); assert.equal(both.activity.status, 'rejected')
  } finally { globalThis.fetch = originalFetch }
})
test('external-wallet Journey compares context, reads public permission only, and disposes subscriptions', async () => {
  const listeners = new Map(), methods = [], views = []
  const provider = { isPhantom: true, request: async ({ method }) => { methods.push(method); return method === 'eth_chainId' ? '0x1' : [wallet.address] }, on: (event, handler) => listeners.set(event, handler), removeListener: event => listeners.delete(event) }
  const journey = createExternalWalletJourney({ phantom: { ethereum: provider } }, view => views.push(view))
  journey.compare(wallet)
  await journey.connect()
  assert.equal(views.at(-1).addressMatches, true); assert.equal(views.at(-1).chainMatches, true)
  journey.compare({ ...wallet, chain_id: 11155111 })
  assert.equal(views.at(-1).addressMatches, true); assert.equal(views.at(-1).chainMatches, false)
  assert.deepEqual(methods, ['eth_requestAccounts', 'eth_chainId'])
  journey.dispose(); assert.equal(listeners.size, 0)
  const before = views.length
  await journey.connect(); assert.equal(views.length, before)
})
test('the protected transfer boundary rejects missing or different confirmation before signing', () => {
  const quote = { walletAddress: wallet.address, chainId: 1, recipient: `0x${'2'.repeat(40)}`, asset: 'ETH', units: 1n, fee: 2n, createdAt: Date.now(), transaction: { from: wallet.address, to: `0x${'2'.repeat(40)}`, data: '0x', chainId: '0x1', value: '0x1', gas: '0x1', maxFeePerGas: '0x2', maxPriorityFeePerGas: '0x1', type: '0x2' } }
  assert.throws(() => tool_verify_transfer_confirmation(wallet, quote, undefined), /confirmation/)
  const confirmation = createTransferConfirmation(quote)
  assert.doesNotThrow(() => tool_verify_transfer_confirmation(wallet, quote, confirmation))
  assert.throws(() => tool_verify_transfer_confirmation(wallet, quote, { ...confirmation, transaction: { ...confirmation.transaction, value: '0x2' } }), /confirmation/)
})
