import test from 'node:test'
import assert from 'node:assert/strict'
import { loadUI } from '../load-ui.mjs'
const loader = loadUI()
const { createBackupCapability } = await import('../../src/capability/tool_capability_backup.ts')
const { OperationIndeterminate } = await import('../../src/contracts/operation.ts')
const { SpeciesError } = await import('../../src/contracts/species.ts')
loader.deregister()
const session = { onli_id: 'member' }
test('protected release requires an explicit approval before provider invocation', () => {
  let calls = 0
  const capability = createBackupCapability(async () => { calls++; return {} })
  assert.throws(() => capability.release('scope', session, {}, ''), /approval/)
  assert.throws(() => capability.export('scope', session, {}, ''), /approval/)
  assert.equal(calls, 0)
})
test('authorization acknowledgment without accepted authentication cannot complete', async () => {
  const incomplete = createBackupCapability(async () => ({ status: 'ACCEPTED', auth_log_id: 'proof' }))
  assert.equal((await incomplete.authorize({ behavior: 'open-wallet-backup', body: 'bound note' }, session)).state, 'failed')
  const pending = createBackupCapability(async () => ({ status: 'PENDING', challenge_id: 'same-challenge' }))
  assert.equal((await pending.observe('same-challenge', session)).state, 'pending')
  const accepted = createBackupCapability(async () => ({ status: 'ACCEPTED', authentication_status: 'AuthenticationStatusACCEPTED', auth_log_id: 'proof' }))
  assert.equal((await accepted.authorize({ behavior: 'open-wallet-backup', body: 'bound note' }, session)).state, 'completed')
})
test('lost one-use release response is indeterminate while explicit backend denial remains failure', async () => {
  const lost = createBackupCapability(async () => { throw new Error('private transport material') })
  await assert.rejects(lost.release('scope', session, {}, 'original-proof'), error => error instanceof OperationIndeterminate && error.operationId === 'original-proof' && !error.message.includes('private'))
  const denied = createBackupCapability(async () => { throw new SpeciesError('denied', 'Denied', 403) })
  await assert.rejects(denied.export('scope', session, {}, 'proof'), error => error instanceof SpeciesError && error.status === 403)
})
