import test from 'node:test'
import assert from 'node:assert/strict'
import { WalletCleanupGuard } from '../src/export-cleanup.ts'

test('logout without a live iframe blocks another export even when the SDK creates its teardown iframe later', async () => {
  const guard = new WalletCleanupGuard()
  let frame = null, finishTeardown
  const delayedTeardown = new Promise(resolve => { finishTeardown = resolve })
  let asyncCleanup
  await guard.logout(frame, async () => {
    // Model Openfort firing an async logout listener without awaiting it.
    asyncCleanup = delayedTeardown.then(() => { frame = { isConnected: true } })
  }, async () => assert.fail('There was no frame to observe'), true)
  assert.throws(() => guard.assertReady(), /Reload/)
  finishTeardown(); await asyncCleanup
  assert.equal(frame.isConnected, true)
  assert.throws(() => guard.assertReady(), /Reload/)
})

test('a live iframe must finish teardown before cleanup completes', async () => {
  const guard = new WalletCleanupGuard(), frame = { isConnected: true }
  let finish, complete = false
  const removed = new Promise(resolve => { finish = resolve })
  const cleanup = guard.logout(frame, async () => {}, async observed => {
    assert.equal(observed, frame); await removed
  }, true).then(() => { complete = true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(complete, false)
  frame.isConnected = false; finish(); await cleanup
  assert.doesNotThrow(() => guard.assertReady())
})

test('unconfirmed teardown requires a reload', async () => {
  const guard = new WalletCleanupGuard()
  await guard.logout({ isConnected: true }, async () => {}, async () => { throw new Error('timeout') }, true)
  assert.throws(() => guard.assertReady(), /Reload/)
})

test('failed recovery that replaces its iframe cannot start another export', async () => {
  const guard = new WalletCleanupGuard(), original = { isConnected: true }
  let current = original
  await guard.logout(original, async () => {
    original.isConnected = false
    current = { isConnected: true }
  }, async frame => assert.equal(frame.isConnected, false), false)
  assert.equal(current.isConnected, true)
  assert.throws(() => guard.assertReady(), /Reload/)
})
