import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import ts from 'typescript'
import React from 'react'
import { create, act } from 'react-test-renderer'

// Mount the real hook and component. Only the network/signing boundary is fake;
// rendering, receipt polling, persistence and cross-tab locks are production code.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './send-wallet') return { url: 'test:send-wallet', shortCircuit: true }
    if (specifier.startsWith('.') && context.parentURL?.includes('/src/')) {
      const url = new URL(specifier, context.parentURL)
      for (const extension of ['.ts', '.tsx']) {
        if (existsSync(new URL(url.href + extension))) return { url: url.href + extension, shortCircuit: true }
      }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (url === 'test:send-wallet') return { format: 'module', source: 'export const sendWallet = (...args) => globalThis.walletUIHarness.send(...args)', shortCircuit: true }
    if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true }
    if (/\/src\/.*\.tsx?$/.test(url)) return { format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8').replaceAll('import.meta.env.DEV', 'false'), { fileName: new URL(url).pathname, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText, shortCircuit: true }
    return next(url, context)
  },
})
const { usePersonalWallet } = await import('../src/usePersonalWallet.ts')
const { default: WalletTools } = await import('../src/WalletTools.tsx')
const { WalletActionError } = await import('../src/export-core.ts')
hooks.deregister()

for (const [chainID, chainHex, explorer] of [[1, '0x1', 'https://eth.blockscout.com'], [11155111, '0xaa36a7', 'https://eth-sepolia.blockscout.com']]) {
  const wallet = { address: `0x${'1'.repeat(40)}`, account_ref: 'acc_test', user_ref: 'usr_test', wallet_ref: 'pla_test', chain_id: chainID, adapter: 'openfort-usdc-evm', custody: 'User', account_type: 'Externally Owned Account' }
  const recipient = `0x${'2'.repeat(40)}`, session = { token: 'fixture', onli_id: 'fixture' }
  const hashA = `0x${'a'.repeat(64)}`, hashB = `0x${'b'.repeat(64)}`
  const key = `species-wallet-submission:${wallet.chain_id}:${wallet.address}`

  test('Send form → review → confirmation retains receipts and duplicate guard on chain ' + chainID, async () => {
    const values = new Map([[key, JSON.stringify({ hash: hashA, status: 'confirmed', asset: 'USDC', amount: '1' })]])
    const events = new EventTarget()
    globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) }
    globalThis.window = { setInterval, clearInterval, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) }
    globalThis.document = { hidden: false }
    let held = false
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { async request(_key, _options, action) { if (held) return action(null); held = true; try { return await action({}) } finally { held = false } } } } })
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (url, options) => {
      let body
      if (String(url).includes('/readiness')) body = { onli_id: session.onli_id, member_wallet: wallet, funding_target: { available: true, settlement_account: 'species:incoming', adapter: wallet.adapter, settlement_address: recipient } }
      else if (options?.method === 'POST') {
        const { method } = JSON.parse(options.body)
        const transaction = personal?.submission?.intent?.transaction
        const blockHash = `0x${'c'.repeat(64)}`
        const topics = ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', `0x${wallet.address.slice(2).padStart(64, '0')}`, `0x${recipient.slice(2).padStart(64, '0')}`]
        const result = { eth_chainId: chainHex, eth_getBalance: '0xde0b6b3a7640000', eth_call: '0x1312d00', eth_estimateGas: '0x10000', eth_getBlockByNumber: { baseFeePerGas: '0x1' }, eth_maxPriorityFeePerGas: '0x1', eth_getTransactionByHash: { hash: hashB, from: wallet.address, to: transaction?.to, input: transaction?.data, value: transaction?.value, chainId: chainHex, blockHash, blockNumber: '0x1' }, eth_getTransactionReceipt: { status: '0x1', transactionHash: hashB, blockHash, blockNumber: '0x1', logs: [{ address: transaction?.to, topics, data: '0x0f4240' }] } }[method]
        assert.notEqual(result, undefined, method); body = { result }
      } else body = { items: [] }
      return { ok: true, json: async () => body }
    }
    let personal, root, release, sendCalls = 0
    globalThis.walletUIHarness = { send: () => { sendCalls++; return new Promise((_resolve, reject) => { release = () => reject(new WalletActionError('recovery')) }) } }
    const button = label => root.root.findAllByType('button').find(b => b.children.filter(c => typeof c === 'string').join('') === label)
    const rendered = () => JSON.stringify(root.toJSON())
    function Harness() { personal = usePersonalWallet(wallet, session); return React.createElement(WalletTools, { wallet, personal, hidden: false, busy: false }) }
    try {
      await act(async () => { root = create(React.createElement(Harness)) })
      await act(async () => { button('Send').props.onClick() })
      assert.equal(rendered().includes('Transfer confirmed'), false)
      assert.equal(JSON.parse(values.get(key)).hash, hashA, 'new form retains historical receipt')
      assert.equal(root.root.findByProps({ 'aria-label': 'Recipient address' }).props.value, recipient)
      await act(async () => { root.root.findByProps({ 'aria-label': 'Amount to send' }).props.onChange({ target: { value: '1' } }) })
      await act(async () => { root.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
      assert.equal(personal.quote.units, 1_000_000n)
      assert.equal(personal.quote.recipient.toLowerCase(), recipient)
      assert.equal(sendCalls, 0, 'Review never signs or submits')
      await act(async () => { button('Confirm and send').props.onClick() })
      assert.match(rendered(), /Signing and submitting/)
      assert.doesNotMatch(rendered(), /Transfer confirmed/)
      await act(async () => { release() })
      assert.match(rendered(), /could not reconnect/)
      assert.doesNotMatch(rendered(), /Transfer confirmed/)

      globalThis.walletUIHarness.send = async (_s, _w, _q, check, broadcast) => { sendCalls++; assert.equal(check(), true); broadcast(); return hashB }
      await act(async () => { root.root.findByProps({ 'aria-label': 'Send destination' }).props.onChange({ target: { value: 'custom' } }) })
      await act(async () => { root.root.findByProps({ 'aria-label': 'Recipient address' }).props.onChange({ target: { value: recipient } }) })
      await act(async () => { root.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
      assert.equal(sendCalls, 1, 'A second review still does not submit')
      await act(async () => { button('Confirm and send').props.onClick() })
      assert.equal(sendCalls, 2)
      assert.match(rendered(), /Transfer confirmed/)
      assert.doesNotMatch(rendered(), /Review transfer|Signing and submitting/)
      const transactionLink = root.root.findByProps({ className: 'wallet-transaction-link' })
      assert.equal(transactionLink.props.href, `${explorer}/tx/${hashB}`, 'result links to the submitted transaction, not the wallet or an earlier transfer')
      assert.equal(transactionLink.props.target, '_blank')
      assert.ok(button('Done')); assert.ok(button('New transfer'))
      await act(async () => { button('New transfer').props.onClick() })
      assert.doesNotMatch(rendered(), /Transfer confirmed/)
      assert.equal(root.root.findByProps({ 'aria-label': 'Amount to send' }).props.value, '')
      assert.equal(JSON.parse(values.get(key)).hash, hashB)

      // Another tab submits after this form opens. No local reset may erase it.
      values.set(key, JSON.stringify({ status: 'pending', hash: hashA, asset: 'USDC', amount: '1' }))
      await act(async () => { await personal.review('USDC', recipient, '1') })
      assert.equal(personal.quote, null)
      assert.equal(JSON.parse(values.get(key)).status, 'pending')
      await act(async () => {
        const event = new Event('storage')
        Object.assign(event, { key, newValue: values.get(key) })
        events.dispatchEvent(event)
      })
      assert.match(rendered(), /Transfer pending/)
      assert.doesNotMatch(rendered(), /Transfer confirmed|Review transfer/)
    } finally {
      await act(async () => { root?.unmount() })
      globalThis.fetch = originalFetch
      delete globalThis.walletUIHarness
    }
  })

}
