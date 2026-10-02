import test from 'node:test'
import assert from 'node:assert/strict'
import { withTransferLock, requireNoPendingSubmission } from '../src/submission-lock.ts'

test('two open tabs cannot confirm concurrently, and an unknown result blocks the next tab', async () => {
  let held = false, stored = null, release
  const storage = { getItem: () => stored }
  const locks = { async request(name, options, callback) {
    assert.equal(name, 'wallet:1'); assert.deepEqual(options,{ifAvailable:true})
    if(held) return callback(null)
    held = true
    try { return await callback({}) } finally { held = false }
  } }
  const first = withTransferLock('wallet:1', async () => {
    requireNoPendingSubmission(storage,'wallet:1')
    stored = JSON.stringify({ status:'unknown', asset:'ETH', amount:'1' })
    await new Promise(resolve=>{release=resolve})
  }, locks)
  await assert.rejects(withTransferLock('wallet:1',async()=>{},locks),/another tab/)
  release(); await first
  await assert.rejects(withTransferLock('wallet:1',async()=>requireNoPendingSubmission(storage,'wallet:1'),locks),/existing transfer/)
  stored=JSON.stringify({status:'confirmed', asset:'ETH', amount:'1', hash:'0x'+'a'.repeat(64)})
  await withTransferLock('wallet:1',async()=>requireNoPendingSubmission(storage,'wallet:1'),locks)
})
test('malformed or inaccessible pending storage never authorizes a send', () => {
  assert.throws(()=>requireNoPendingSubmission({getItem:()=>'{broken'},'key'))
  assert.throws(()=>requireNoPendingSubmission({getItem:()=>JSON.stringify({})},'key'))
  assert.throws(()=>requireNoPendingSubmission({getItem:()=>{throw new Error('unavailable')}},'key'))
})
