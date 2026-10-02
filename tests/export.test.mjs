import test from 'node:test'
import assert from 'node:assert/strict'
import { runExport, WalletActionError } from '../src/export-core.ts'

const wallet = { address: `0x${'1'.repeat(40)}`, account_ref: 'acc_fixture', user_ref: 'usr_fixture', wallet_ref: 'pla_fixture', chain_id: 84532, custody: 'User', account_type: 'Externally Owned Account' }
const access = () => ({ wallet, publishable_key: 'pk_test_fixture', shield_publishable_key: 'shield_fixture', auth_provider: 'custom', auth_token: 'temporary-auth', encryption_session: 'temporary-recovery', expires_at: 2000 })
function setup(overrides = {}) {
  const calls = [], saved = []
  const sdk = {
    async waitForInitialization() {},
    async recover(account, encryption) { calls.push(['recover', account, encryption]); return { id: wallet.account_ref, address: wallet.address, chainId: wallet.chain_id, accountType: wallet.account_type } },
    async exportPrivateKey() { calls.push(['export']); return 'a'.repeat(64) },
    async logout() { calls.push(['logout']) },
    ...overrides,
  }
  return { calls, saved, sdk, options: { wallet, getAccess: async () => access(), now: () => 1000, isCurrent: () => true, createSDK: () => sdk, save: (...args) => saved.push(args) } }
}
test('recovers the exact issued wallet and downloads only after verification, then logs out', async () => {
  const s = setup(); await runExport(s.options)
  assert.deepEqual(s.calls, [['recover', 'acc_fixture', 'temporary-recovery'], ['export'], ['logout']])
  assert.deepEqual(s.saved, [['a'.repeat(64), wallet.address]])
})
test('chain-independent Openfort EOAs recover without a chain ID', async () => {
  const s = setup({ async recover() { return { id: wallet.account_ref, address: wallet.address, accountType: wallet.account_type } } })
  await runExport(s.options)
  assert.equal(s.saved.length, 1)
  assert.deepEqual(s.calls, [['export'], ['logout']])
})
for (const [field, value] of Object.entries({ account_ref: 'acc_other', user_ref: 'usr_other', wallet_ref: 'pla_other', address: `0x${'2'.repeat(40)}`, chain_id: 1, custody: 'Developer' })) {
  test(`refuses mismatched handoff ${field} before SDK initialization`, async () => {
    const s = setup(); s.options.getAccess = async () => ({ ...access(), wallet: { ...wallet, [field]: value } })
    await assert.rejects(runExport(s.options)); assert.equal(s.calls.length, 0); assert.equal(s.saved.length, 0)
  })
}
for (const change of [{ id: 'acc_other' }, { address: `0x${'2'.repeat(40)}` }, { chainId: 1 }, { accountType: 'Smart Account' }]) {
  test(`refuses recovered account mismatch ${JSON.stringify(change)} and logs out`, async () => {
    const s = setup({ async recover() { return { id: wallet.account_ref, address: wallet.address, chainId: wallet.chain_id, accountType: wallet.account_type, ...change } } })
    await assert.rejects(runExport(s.options)); assert.deepEqual(s.calls, [['logout']]); assert.equal(s.saved.length, 0)
  })
}
test('expired handoff never opens an SDK session', async () => {
  const s = setup(); s.options.getAccess = async () => ({ ...access(), expires_at: 999 })
  await assert.rejects(runExport(s.options)); assert.equal(s.calls.length, 0)
})
test('disconnect while key export is pending cancels download and clears SDK session', async () => {
  let current = true
  const s = setup({ async exportPrivateKey() { current = false; return 'a'.repeat(64) } }); s.options.isCurrent = () => current
  await assert.rejects(runExport(s.options)); assert.equal(s.saved.length, 0); assert.deepEqual(s.calls.at(-1), ['logout'])
})
test('recovery failure does not export and still logs out', async () => {
  let completed
  const s = setup({ async recover() { throw new Error('provider refused') }, async logout(value) { completed = value } })
  await assert.rejects(runExport(s.options)); assert.equal(s.saved.length, 0); assert.equal(completed, false)
})
test('recovery errors explain the failed step without exposing provider credentials', async () => {
  const s = setup({ async recover() { throw new Error('provider credential must remain private') } })
  await assert.rejects(runExport(s.options), error => error instanceof WalletActionError && /could not reconnect/.test(error.message) && !error.message.includes('credential') && error.diagnostic.kind === 'unclassified' && !('cause' in error))
  assert.equal(s.saved.length, 0)
  assert.deepEqual(s.calls, [['logout']])
})
test('recovery diagnostics allowlist SDK classifications without retaining provider material', () => {
  const failure = Object.assign(new Error('secret response'), { name: 'IframeHandshakeTimeoutError', token: 'secret' })
  const error = new WalletActionError('recovery', failure)
  assert.deepEqual(error.diagnostic, { stage: 'recovery', kind: 'IframeHandshakeTimeoutError' })
  assert.equal(JSON.stringify(error).includes('secret'), false)
  assert.equal(new WalletActionError('recovery', { name: 'secret-name' }).diagnostic.kind, 'unclassified')
})
test('token refresh must stay bound to the same wallet', async () => {
  const s = setup(); let time = 1000, count = 0
  s.options.now = () => time
  s.options.getAccess = async () => ++count === 1 ? access() : { ...access(), wallet: { ...wallet, account_ref: 'acc_other' }, expires_at: 3000 }
  s.options.createSDK = (_, getToken) => ({ ...s.sdk, async waitForInitialization() { time = 1999; await getToken() } })
  await assert.rejects(runExport(s.options)); assert.equal(s.saved.length, 0); assert.deepEqual(s.calls, [['logout']])
})
test('expired tokens refresh in memory while preserving account binding', async () => {
  const s = setup(); let time = 1000, count = 0
  s.options.now = () => time
  s.options.getAccess = async () => ({ ...access(), auth_token: `token-${++count}`, expires_at: count === 1 ? 2000 : 3000 })
  s.options.createSDK = (_, getToken) => ({ ...s.sdk, async waitForInitialization() { time = 1999; assert.equal(await getToken(), 'token-2') } })
  await runExport(s.options); assert.equal(count, 2); assert.equal(s.saved.length, 1)
})
test('export remains pending until asynchronous SDK teardown completes', async () => {
  let release, finished = false
  const pending = new Promise(resolve => { release = resolve })
  const s = setup({ logout: () => pending })
  const exporting = runExport(s.options).then(() => { finished = true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(s.saved.length, 1); assert.equal(finished, false)
  release(); await exporting; assert.equal(finished, true)
})
test('asynchronous encryption failure does not mark export complete and still clears the SDK', async () => {
  const s = setup(); let completed
  s.options.save = async () => { await Promise.resolve(); throw new Error('encryption failed') }
  s.sdk.logout = async value => { completed = value }
  await assert.rejects(runExport(s.options)); assert.equal(completed,false)
})
