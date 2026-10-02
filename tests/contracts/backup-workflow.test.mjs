import test from 'node:test'
import assert from 'node:assert/strict'
import { loadUI } from '../load-ui.mjs'
const loader = loadUI()
const { createWalletBackupWorkflows } = await import('../../src/workflow/workflow_wallet_backup.ts')
loader.deregister()
const file = { address: `0x${'1'.repeat(40)}`, export_id: 'file-reference' }
const wallet = { account_ref: 'account', address: file.address, chain_id: 1 }, session = { onli_id: 'owner' }
function fixture(patch = {}) {
  const calls = []
  const config = { instance_id: 'instance', authorization_behavior: 'open-wallet-backup' }
  const cryptoTools = { assertBackupOwner() { calls.push('binding') }, backupAuthorizationBody: async () => 'bound-note', backupDigest: async () => 'bound-digest', createUnlockRecipient: async () => ({ public_key_spki: 'public-recipient', privateKey: 'ephemeral-fixture' }), decryptWalletBackup: async () => { calls.push('decrypt'); return 'public-fixture-key' }, ...patch.crypto }
  const request = async (path, _session, body, headers) => {
    calls.push(path)
    if (path.endsWith('/config')) return config
    if (path === '/auth/backup-authorization') return { status: 'ACCEPTED', authentication_status: 'AuthenticationStatusACCEPTED', auth_log_id: 'original-proof' }
    if (path.endsWith('/unlock')) {
      assert.equal(headers['X-Onli-Auth-Log-Id'], 'original-proof'); assert.equal(body.recipient_public_key_spki, 'public-recipient')
      return { unlock_id: 'original-proof', file_sha256: 'bound-digest', wrapped_key: 'fixture-wrapped', expires_at: Math.floor(Date.now() / 1000) + 60, ...patch.release }
    }
    throw new Error('Unexpected request')
  }
  return { calls, workflows: createWalletBackupWorkflows(request, cryptoTools) }
}
function page() { const target = new EventTarget(); target.visibilityState = 'visible'; return target }
test('backup Workflow selects bound approval and verifies release before invoking decryption', async () => {
  const originalDocument = globalThis.document; globalThis.document = page()
  try {
    const f = fixture()
    const result = await f.workflows.openWalletBackup(file, session, wallet, new AbortController().signal)
    assert.equal(result.privateKey, 'public-fixture-key')
    assert.deepEqual(f.calls, ['/members/owner/wallet/backup/config', 'binding', '/auth/backup-authorization', '/members/owner/wallet/backup/unlock', 'decrypt'])
    const wrong = fixture({ release: { file_sha256: 'different-file' } })
    await assert.rejects(wrong.workflows.openWalletBackup(file, session, wallet, new AbortController().signal), /invalid/)
    assert.equal(wrong.calls.includes('decrypt'), false)
  } finally { globalThis.document = originalDocument }
})
test('context binding failure omits authorization and protected release', async () => {
  const f = fixture({ crypto: { assertBackupOwner() { throw new Error('Owner mismatch') } } })
  await assert.rejects(f.workflows.openWalletBackup(file, session, wallet, new AbortController().signal), /Owner mismatch/)
  assert.deepEqual(f.calls, ['/members/owner/wallet/backup/config'])
})
