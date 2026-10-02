import test from 'node:test'
import assert from 'node:assert/strict'
import { loadUI } from '../load-ui.mjs'
const loader = loadUI()
const { createTransferConfirmation } = await import('../../src/contracts/transfer-confirmation.ts')
const { journey_send_transfer } = await import('../../src/journey/journey_send_transfer.ts')
const { createTransferOperation } = await import('../../src/tool/tool_create_transfer_operation.ts')
const { tool_verify_transfer_evidence } = await import('../../src/tool/tool_verify_transfer_evidence.ts')
const { parseSubmission } = await import('../../src/resource/transfer-operation.ts')
const { assertQuote } = await import('../../src/tool/tool_validate_transfer.ts')
const { completed } = await import('../../src/contracts/operation.ts')
loader.deregister()
const wallet = { address: `0x${'1'.repeat(40)}`, chain_id: 1, custody: 'User', account_type: 'Externally Owned Account' }
const recipient = `0x${'2'.repeat(40)}`, hash = `0x${'a'.repeat(64)}`, blockHash = `0x${'b'.repeat(64)}`
const quote = () => ({ walletAddress: wallet.address, chainId: 1, recipient, asset: 'ETH', units: 1n, fee: 2n, createdAt: Date.now(), transaction: { from: wallet.address, to: recipient, data: '0x', chainId: '0x1', value: '0x1', gas: '0x1', maxFeePerGas: '0x2', maxPriorityFeePerGas: '0x1', type: '0x2' } })
const installLocks = () => Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request: async (_key, _options, action) => action({}) } } })
function fixture() {
  installLocks()
  let raw = null
  const storage = { getItem: () => raw, setItem: (_key, value) => { raw = value } }
  const reviewed = quote()
  return { storage, options: { confirmation: createTransferConfirmation(reviewed), session: { token: 'do-not-store', onli_id: 'owner' }, wallet, quote: reviewed, key: 'wallet', storage, isCurrent: () => true, changed() {} } }
}
test('broadcast durability precedes effect and lost acknowledgment remains indeterminate across reload', async () => {
  const f = fixture(); let effects = 0
  const result = await journey_send_transfer({ ...f.options, send: async (_s, _w, _q, _current, broadcast) => {
    broadcast(); const stored = parseSubmission(f.storage.getItem())
    assert.equal(stored.state, 'indeterminate'); assert.ok(stored.operationId)
    assert.deepEqual(stored.intent.transaction, f.options.quote.transaction)
    assert.equal(JSON.stringify(stored).includes('do-not-store'), false)
    effects++; throw new Error('acknowledgment lost')
  } })
  assert.equal(result.state, 'indeterminate'); assert.equal(effects, 1)
  const resumed = parseSubmission(f.storage.getItem())
  assert.equal(resumed.operationId, result.operationId)
  assert.equal((await journey_send_transfer({ ...f.options, send: async () => { effects++; return hash } })).state, 'indeterminate')
  await assert.rejects(journey_send_transfer({ ...f.options, confirmation: createTransferConfirmation(f.options.quote), send: async () => { effects++; return hash } }), /existing transfer/)
  assert.equal(effects, 1)
})
test('failed pre-effect persistence prevents submission', async () => {
  const f = fixture(); let effects = 0
  await assert.rejects(journey_send_transfer({ ...f.options, storage: { getItem: () => null, setItem() { throw new Error('disk unavailable') } }, send: async (_s, _w, _q, _c, broadcast) => { broadcast(); effects++; return hash } }), /disk unavailable/)
  assert.equal(effects, 0)
})
test('a hash is pending evidence, and a failed later write retains it in memory', async () => {
  const f = fixture(); let writes = 0, latest
  const result = await journey_send_transfer({ ...f.options, changed: value => { latest = value }, storage: { getItem: () => null, setItem() { if (++writes === 2) throw new Error('disk unavailable') } }, send: async (_s, _w, _q, _c, broadcast) => { broadcast(); return hash } })
  assert.equal(result.state, 'indeterminate'); assert.equal(latest.hash, hash)
  assert.equal(latest.state, 'indeterminate'); assert.equal(result.evidence[0].reference, hash)
})
test('one successful broadcast remains pending until matching on-chain evidence', async () => {
  const f = fixture()
  const result = await journey_send_transfer({ ...f.options, send: async (_s, _w, _q, _c, broadcast) => { broadcast(); return hash } })
  assert.equal(result.state, 'pending'); assert.equal(parseSubmission(f.storage.getItem()).hash, hash)
})
function observation(operation) {
  const t = operation.intent.transaction
  return { transaction: { hash, from: wallet.address, to: t.to, input: t.data, value: t.value, chainId: '0x1', blockHash, blockNumber: '0x1' }, receipt: { status: '0x1', transactionHash: hash, blockHash, blockNumber: '0x1', logs: [] } }
}
test('receipt evidence proves the recorded native transfer and rejects unrelated or malformed effects', () => {
  const operation = { ...createTransferOperation(wallet, quote()), hash }
  assert.equal(tool_verify_transfer_evidence(operation, observation(operation)).status, 'confirmed')
  assert.equal(tool_verify_transfer_evidence(operation, { transaction: null, receipt: null }), null)
  for (const patch of [{ hash: blockHash }, { from: recipient }, { to: wallet.address }, { value: '0x2' }, { input: '0x1234' }, { chainId: '0x2' }, { blockHash: hash }]) {
    const proof = observation(operation); proof.transaction = { ...proof.transaction, ...patch }
    assert.throws(() => tool_verify_transfer_evidence(operation, proof), /evidence/)
  }
  const proof = observation(operation); proof.receipt.transactionHash = blockHash
  assert.throws(() => tool_verify_transfer_evidence(operation, proof), /evidence/)
})
test('USDC completion requires the exact token transfer event, and reverted execution is failure', () => {
  const operation = { ...createTransferOperation(wallet, quote()), hash, asset: 'USDC' }
  const token = operation.network.usdc
  operation.intent.transaction = { ...operation.intent.transaction, to: token, value: '0x0', data: '0xa9059cbb' }
  const proof = observation(operation)
  assert.throws(() => tool_verify_transfer_evidence(operation, proof), /token transfer/)
  proof.receipt.logs = [{ address: token, topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', `0x${wallet.address.slice(2).padStart(64, '0')}`, `0x${recipient.slice(2).padStart(64, '0')}`], data: '0x1' }]
  assert.equal(tool_verify_transfer_evidence(operation, proof).status, 'confirmed')
  proof.receipt.logs[0].data = '0x2'
  assert.throws(() => tool_verify_transfer_evidence(operation, proof), /token transfer/)
  proof.receipt.status = '0x0'
  assert.equal(tool_verify_transfer_evidence(operation, proof).status, 'failed')
})
test('quote validation rejects edited transaction data and amount before broadcast', () => {
  assert.doesNotThrow(() => assertQuote(wallet, quote()))
  const changed = quote(); changed.transaction.value = '0x2'
  assert.throws(() => assertQuote(wallet, changed), /transaction changed/)
  const amount = quote(); amount.units = 2n
  assert.throws(() => assertQuote(wallet, amount), /transaction changed/)
})
test('completion requires declared evidence and malformed continuity never authorizes replacement', () => {
  assert.throws(() => completed('ok', []), /evidence/)
  assert.throws(() => parseSubmission('{broken'))
  assert.throws(() => parseSubmission(JSON.stringify({ status: 'pending', asset: 'ETH', amount: '1', version: 1 })), /Invalid transfer/)
})

test('same-operation replay returns existing pending evidence without another provider invocation', async () => {
  const f = fixture(); let effects = 0
  const options = { ...f.options, send: async (_s, _w, _q, _c, broadcast) => { broadcast(); effects++; return hash } }
  const first = await journey_send_transfer(options), replay = await journey_send_transfer(options)
  assert.equal(first.operationId, replay.operationId); assert.equal(replay.state, 'pending'); assert.equal(effects, 1)
})
