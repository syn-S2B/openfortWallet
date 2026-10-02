import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RegistrationOperationError,
  onboardingReason,
  pollRegistration,
  registrationArguments,
  walletEnsureSelected,
} from '../src/onboarding.ts'

test('registration keeps the server-selected idempotency and correlation values', () => {
  const journey = {
    next_tool: 'journey_member_registration',
    actions: [{ tool: 'journey_member_registration', reason: 'create member', arguments: { idempotency_key: 'stable-id', correlation_id: 'stable-correlation' } }],
  }
  assert.deepEqual(registrationArguments(journey), { idempotency_key: 'stable-id', correlation_id: 'stable-correlation' })
  assert.equal(walletEnsureSelected({ next_tool: 'journey_member_wallet_ensure' }), true)
  assert.equal(onboardingReason(journey), 'create member')
})

test('registration polling can be cancelled while an operation is pending', async () => {
  const controller = new AbortController()
  let reads = 0
  const pending = pollRegistration(async () => {
    reads += 1
    return { state: 'PENDING' }
  }, 'operation-fixture', { signal: controller.signal, maxAttempts: 10, intervalMs: 50 })
  await new Promise(resolve => setTimeout(resolve, 0))
  controller.abort()
  await assert.rejects(pending, error => error.name === 'AbortError')
  assert.equal(reads, 1)
})

test('registration polling checks cancellation after an operation read', async () => {
  const controller = new AbortController()
  await assert.rejects(
    pollRegistration(async () => {
      controller.abort()
      return { state: 'COMPLETED' }
    }, 'operation-fixture', { signal: controller.signal }),
    error => error.name === 'AbortError',
  )
})

test('registration polling reports a bounded pending timeout and terminal failure', async () => {
  await assert.rejects(
    pollRegistration(async () => ({ state: 'IN_PROGRESS' }), 'operation-fixture', { maxAttempts: 2, intervalMs: 0 }),
    error => error instanceof RegistrationOperationError && error.code === 'registration_pending_timeout',
  )
  await assert.rejects(
    pollRegistration(async () => ({ state: 'FAILED', last_error: 'provider refused setup' }), 'operation-fixture', { maxAttempts: 2, intervalMs: 0 }),
    error => error instanceof RegistrationOperationError && error.code === 'registration_operation_failed' && error.message === 'provider refused setup',
  )
})
