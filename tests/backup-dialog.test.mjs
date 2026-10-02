import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { act, create } from 'react-test-renderer'
import { loadUI } from './load-ui.mjs'

const loader = loadUI({ './open-wallet-backup': 'export const openWalletBackup = (...args) => globalThis.backupFixture(...args)' })
const { default: WalletBackupDialog } = await import('../src/WalletBackupDialog.tsx')
loader.deregister()
const wallet = { account_ref: 'acc_fixture', address: `0x${'1'.repeat(40)}`, chain_id: 11155111 }
const session = { token: 'fixture-session', onli_id: 'usr-11111111-1111-4111-8111-111111111111' }
const file = { format: 'species-wallet-backup', version: 1, key_id: 'a'.repeat(64), instance_id: 'test', export_id: '11111111-1111-4111-8111-111111111111', owner: session.onli_id, ...wallet, created_at: '2026-09-26T01:00:00.000Z', iv: Buffer.alloc(12).toString('base64'), ciphertext: Buffer.alloc(48).toString('base64'), wrapped_key: Buffer.alloc(384).toString('base64') }

for (const [label, changed] of Object.entries({ account: { wallet: { ...wallet, account_ref: 'acc_other' } }, address: { wallet: { ...wallet, address: `0x${'2'.repeat(40)}` } }, network: { wallet: { ...wallet, chain_id: 1 } }, session: { session: { ...session, token: 'fixture-session-b' } }, owner: { session: { ...session, onli_id: 'usr_other' } }, scope: { backupPath: '/treasury/master/backup' } })) {
  for (const pending of [false, true]) test(`${label} change clears ${pending ? 'pending unlock and ignores its late result' : 'revealed key and selected file'}`, async () => {
    const events = new EventTarget()
    globalThis.document = { visibilityState: 'visible', addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) }
    let signal, release, root
    globalThis.backupFixture = async (_file, _session, _wallet, active) => {
      signal = active
      const result = { privateKey: 'SYNTHETIC_FIXTURE_KEY', expiresAt: Date.now() + 60000 }
      return pending ? new Promise(resolve => { release = () => resolve(result) }) : result
    }
    const props = { wallet, session, onClose() {} }
    const button = label => root.root.findAllByType('button').find(b => b.children.join('') === label)
    try {
      await act(async () => { root = create(React.createElement(WalletBackupDialog, props), { createNodeMock: e => e.type === 'dialog' ? { showModal() {}, close() {} } : null }) })
      await act(async () => { root.root.findByType('input').props.onChange({ target: { files: [{ size: 1000, text: async () => JSON.stringify(file) }] } }) })
      await act(async () => { button('Verify with OnliYou & open').props.onClick() })
      assert.equal(pending ? !!button('Waiting for OnliYou…') : root.root.findAllByType('textarea').length === 1, true)
      await act(async () => { root.update(React.createElement(WalletBackupDialog, { ...props, ...changed })) })
      assert.equal(signal.aborted, true)
      if (release) await act(async () => { release() })
      assert.equal(root.root.findAllByType('textarea').length, 0)
      assert.equal(button('Copy for Phantom'), undefined)
      assert.equal(button('Verify with OnliYou & open').props.disabled, true)
      assert.equal(root.root.findByType('input').props.disabled, false)
      assert.equal(JSON.stringify(root.toJSON()).includes(file.address), false)
    } finally { await act(async () => { root?.unmount() }); delete globalThis.backupFixture }
  })
}
