import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { loadUI } from './load-ui.mjs'

globalThis.appTestReact = React
const loader = loadUI({
  './usePersonalWallet': 'export const usePersonalWallet = () => ({busy:false})',
  './WalletPopup': 'export default props => globalThis.appTestReact.createElement("wallet-fixture", props)',
  './WalletBackupDialog': 'export default () => null', './TreasuryWalletBackup': 'export default () => null',
  './export-wallet': 'export const exportWallet = () => globalThis.appExportFixture()',
})
const { default: App } = await import('../src/App.tsx')
loader.deregister()
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const session = { token: 'fixture-session', onli_id: 'fixture-owner' }

for (const leave of ['sign out', 'switch experience']) for (const mode of ['register', 'ensure', 'export']) test(`${mode}: ${leave} clears busy and stale completion cannot unlock a new setup`, async () => {
  let root, loginCount = 0, setupCalls = 0
  const old = defer(), next = defer(), originalFetch = globalThis.fetch
  globalThis.appExportFixture = () => old.promise
  globalThis.fetch = async (url, init) => {
    const path = String(url).replace('/api/species', '')
    let body
    if (path === '/connection') body = { configured: true, appliance_symbol: 'SYNTH' }
    else if (path === '/auth/start') body = { challenge_id: 'fixture', claim_secret: 'fixture', status: 'PENDING' }
    else if (path === '/auth/collect') {
      loginCount++
      body = { status: 'ACCEPTED', session: { ...session, token: `${session.token}-${loginCount}` }, journey: { next_tool: mode === 'ensure' ? 'journey_member_wallet_ensure' : 'journey_member_registration', actions: [{ tool: 'journey_member_registration', arguments: { idempotency_key: 'fixture-key', correlation_id: 'fixture-trace' } }] } }
    } else if (path.endsWith('/wallet') && init.method === 'GET') {
      body = mode === 'export' && loginCount === 1 ? { account_ref: 'fixture-account', network: 'fixture' } : { error: { code: mode === 'ensure' ? 'member_wallet_pending' : 'member_not_found', message: 'Fixture requires setup' } }
    } else if (path === '/members' || path.endsWith('/readiness')) {
      setupCalls++
      body = await ((mode === 'export' || setupCalls > 1) ? next.promise : old.promise)
    } else throw new Error(`Unexpected fixture request ${path}`)
    return { ok: !body.error, status: body.error ? 409 : 200, json: async () => body }
  }
  const button = label => root.root.findAllByType('button').find(b => b.children.filter(v => typeof v === 'string').join('') === label)
  const signIn = async () => {
    await act(async () => { root.root.findByType('input').props.onChange({ target: { value: 'fixture@example.test' } }) })
    await act(async () => { await root.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
  }
  try {
    await act(async () => { root = create(React.createElement(App)) })
    await signIn()
    await act(async () => { if (mode === 'export') root.root.findByType('wallet-fixture').props.onDownload(); else button(mode === 'ensure' ? 'Reconcile wallet' : 'Set up my wallet').props.onClick() })
    await act(async () => { button(leave === 'sign out' ? 'Sign out' : 'Admin experience').props.onClick() })
    if (leave === 'switch experience') await act(async () => { button('User experience').props.onClick() })
    await signIn()
    const label = mode === 'ensure' ? 'Reconcile wallet' : 'Set up my wallet'
    assert.equal(button(label).props.disabled, false, 'new session must not inherit busy')
    await act(async () => { button(label).props.onClick() })
    const working = mode === 'ensure' ? 'Checking Species…' : 'Setting up…'
    assert.equal(button(working).props.disabled, true)
    await act(async () => { old.resolve({ error: { code: 'fixture_old_failure', message: 'Old request finished' } }) })
    assert.equal(button(working).props.disabled, true, 'old finalizer must not clear new busy state')
    await act(async () => { next.resolve({ error: { code: mode === 'ensure' ? 'member_wallet_pending' : 'fixture_new_failure', message: 'New request finished' } }) })
    assert.equal(button(mode === 'ensure' ? 'Reconcile wallet' : 'Retry setup').props.disabled, false)
  } finally {
    old.resolve({}); next.resolve({})
    await act(async () => { root?.unmount() })
    globalThis.fetch = originalFetch; delete globalThis.appExportFixture
  }
})
