import test from 'node:test'
import assert from 'node:assert/strict'
import { loadUI } from '../load-ui.mjs'
const loader = loadUI()
const { journey_open_member_wallet } = await import('../../src/journey/journey_open_member_wallet.ts')
const { workflow_observe_registration } = await import('../../src/workflow/workflow_observe_registration.ts')
const { readRegistrationContinuity } = await import('../../src/resource/registration-operation.ts')
loader.deregister()
const session = { onli_id: 'member', token: 'do-not-store' }
const args = { idempotency_key: 'original-key', correlation_id: 'original-trace' }
const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } }
test('reload resumes the same registration operation despite newly offered request keys', async () => {
  const storage = memory(), originalFetch = globalThis.fetch
  let starts = 0, observed = 0
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/connection')) return { ok: true, json: async () => ({ configured: true, binding_id: 'original-connection' }) }
    if (String(url).endsWith('/members')) {
      starts++; assert.equal(options.headers['Idempotency-Key'], args.idempotency_key)
      return { ok: true, json: async () => ({ operation: { operation_id: 'op-original' } }) }
    }
    assert.ok(String(url).endsWith('/operations/op-original'))
    observed++; return { ok: true, json: async () => ({ state: 'INDETERMINATE' }) }
  }
  try {
    const first = await journey_open_member_wallet({ session, registration: args, storage, isCurrent: () => true })
    assert.equal(first.state, 'indeterminate')
    const saved = readRegistrationContinuity(storage, session.onli_id)
    assert.equal(saved.operationId, 'op-original'); assert.equal(JSON.stringify(saved).includes('do-not-store'), false)
    const resumed = await journey_open_member_wallet({ session: { ...session, token: 'new-session' }, registration: { idempotency_key: 'new-key', correlation_id: 'new-trace' }, storage, isCurrent: () => true })
    assert.equal(resumed.state, 'indeterminate'); assert.equal(starts, 1); assert.equal(observed, 2)
  } finally { globalThis.fetch = originalFetch }
})
test('lost registration acknowledgment retries only the persisted original idempotent request', async () => {
  const storage = memory(), originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, options) => { if (String(_url).endsWith('/connection')) return { ok: true, json: async () => ({ configured: true, binding_id: 'original-connection' }) }; calls++; assert.equal(options.headers['Idempotency-Key'], args.idempotency_key); throw new Error('lost acknowledgment') }
  try {
    await assert.rejects(journey_open_member_wallet({ session, registration: args, storage, isCurrent: () => true }))
    assert.equal(readRegistrationContinuity(storage, session.onli_id).arguments.idempotency_key, args.idempotency_key)
    await assert.rejects(journey_open_member_wallet({ session, registration: { idempotency_key: 'replacement', correlation_id: 'replacement' }, storage, isCurrent: () => true }))
    assert.equal(calls, 2)
  } finally { globalThis.fetch = originalFetch }
})
test('backend timeout preserves indeterminate state and registration status alone does not claim wallet readiness', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ state: 'TIMED_OUT' }) })
  try { assert.equal((await workflow_observe_registration(session, 'op-original')).state, 'indeterminate') }
  finally { globalThis.fetch = originalFetch }
})
test('a changed Species binding cannot rebind an outstanding registration', async () => {
  const storage = memory(), originalFetch = globalThis.fetch
  storage.setItem('species-wallet-registration:member', JSON.stringify({ version: 1, owner: 'member', arguments: args, bindingId: 'original-connection', operationId: 'op-original' }))
  let effectCalls = 0
  globalThis.fetch = async url => {
    if (!String(url).endsWith('/connection')) effectCalls++
    return { ok: true, json: async () => ({ configured: true, binding_id: 'different-connection' }) }
  }
  try {
    await assert.rejects(journey_open_member_wallet({ session, registration: args, storage, isCurrent: () => true }), error => error.state === 'indeterminate' && error.operationId === 'op-original')
    assert.equal(effectCalls, 0)
  } finally { globalThis.fetch = originalFetch }
})
