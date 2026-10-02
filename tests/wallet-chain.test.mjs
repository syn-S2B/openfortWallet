import { createTransferConfirmation } from '../src/contracts/transfer-confirmation.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import { serialize, parse } from '@ethersproject/transactions'
import { SEPOLIA, ETHEREUM, walletNetwork, parseAmount, formatUnits, address, prepareTransfer, readBalances, readActivity, receiptStatus, assertQuote, submitTransfer } from '../src/wallet-chain.ts'

const wallet = { address: `0x${'1'.repeat(40)}`, chain_id: SEPOLIA.id, custody: 'User', account_type: 'Externally Owned Account' }
const recipient = `0x${'2'.repeat(40)}`
const eth = 10n ** 18n
test('mainnet reviews use native USDC and reject Sepolia evidence and quotes', async () => {
  const mainnet = { ...wallet, chain_id: 1 }, n = node({ eth_chainId: '0x1' })
  const quote = await prepareTransfer(mainnet, 'USDC', recipient, '1', n.call)
  assert.equal(quote.transaction.to, ETHEREUM.usdc)
  assert.equal(quote.transaction.chainId, '0x1')
  assert.equal(quote.units, 1_000_000n)
  assert.equal(n.calls.find(([method]) => method === 'eth_call')[1][0].to, ETHEREUM.usdc)
  await assert.rejects(readBalances(mainnet, node().call), /Network mismatch/)
  assert.throws(() => assertQuote(wallet, quote), /wallet changed/)
  assert.throws(() => walletNetwork(8453), /not supported/)
  const receiptNode = node({ eth_chainId: '0xaa36a7', eth_getTransactionReceipt: { status: '0x1' } })
  await assert.rejects(receiptStatus(mainnet, `0x${'a'.repeat(64)}`, receiptNode.call), /Network mismatch/)
  assert.ok(!receiptNode.calls.some(([method]) => method === 'eth_getTransactionReceipt'))
})

test('default balance, activity and receipt paths stay on the wallet chain without credentials', async () => {
  const savedFetch = globalThis.fetch, calls = []
  const hash = `0x${'a'.repeat(64)}`
  let network = ETHEREUM
  globalThis.fetch = async (url, options) => {
    calls.push(String(url))
    assert.equal(options.credentials, 'omit')
    assert.equal(options.headers?.Authorization, undefined)
    assert.equal(options.headers?.['X-Onli-Session'], undefined)
    if (options.method === 'POST') {
      assert.equal(url, network.rpc)
      const { method } = JSON.parse(options.body)
      const result = { eth_chainId: `0x${network.id.toString(16)}`, eth_getBalance: '0x0', eth_call: '0x989680', eth_getTransactionReceipt: { status: '0x1' } }[method]
      assert.notEqual(result, undefined)
      return { ok: true, json: async () => ({ result }) }
    }
    assert.ok(String(url).startsWith(network.explorer))
    const transfer = contract => ({ transaction_hash: hash, token: { address_hash: contract }, total: { value: '1000000' }, from: { hash: wallet.address }, to: { hash: recipient }, timestamp: '2026-09-28T00:00:00Z' })
    return { ok: true, json: async () => ({ items: String(url).includes('token-transfers') ? [transfer(ETHEREUM.usdc), transfer(SEPOLIA.usdc)] : [] }) }
  }
  try {
    for (network of [ETHEREUM, SEPOLIA]) {
      const connected = { ...wallet, chain_id: network.id }
      assert.equal((await readBalances(connected)).usdc, 10_000_000n)
      assert.equal((await readActivity(connected)).length, 1, 'only the selected chain token is displayed')
      assert.equal(await receiptStatus(connected, hash), 'confirmed')
    }
    const before = calls.length
    await assert.rejects(readBalances({ ...wallet, chain_id: 8453 }), /not supported/)
    assert.equal(calls.length, before, 'unknown chains never default to a network')
  } finally { globalThis.fetch = savedFetch }
})

function node(overrides = {}) {
  const calls = []
  const call = async (method, params) => {
    calls.push([method, params])
    const values = { eth_chainId: '0xaa36a7', eth_getBalance: `0x${eth.toString(16)}`, eth_call: '0x989680', eth_estimateGas: '0xea60', eth_getBlockByNumber: { baseFeePerGas: '0x3b9aca00' }, eth_maxPriorityFeePerGas: '0x3b9aca00', ...overrides }
    if (values[method] instanceof Error) throw values[method]
    assert.ok(method in values, method)
    return values[method]
  }
  return { call, calls }
}
test('amounts retain exact base units without floating-point rounding', () => {
  assert.equal(parseAmount('9007199254.740993', 'USDC'), 9007199254740993n)
  assert.equal(parseAmount('0.000000000000000001', 'ETH'), 1n)
  assert.equal(formatUnits(9007199254740993n, 'USDC'), '9007199254.740993')
  assert.equal(formatUnits(1n, 'ETH', 8), '<0.00000001')
  for (const value of ['0', '-1', '1e3', '1,000', '0.0000001', 'NaN', '1.']) assert.throws(() => parseAmount(value, 'USDC'))
})
test('recipient validates checksum and refuses zero', () => {
  assert.equal(address(recipient), recipient)
  for (const invalid of ['0x' + '0'.repeat(40), 'bob.eth', '0x123', '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7239']) assert.throws(() => address(invalid))
})
test('live reads enforce chain and distinguish unavailable from a zero balance', async () => {
  const n = node({ eth_getBalance: '0x0', eth_call: '0x0' })
  const result = await readBalances(wallet, n.call)
  assert.equal(result.usdc, 0n); assert.equal(result.eth, 0n)
  assert.equal(n.calls.find(([m]) => m === 'eth_call')[1][0].to, SEPOLIA.usdc)
  await assert.rejects(readBalances(wallet, node({ eth_chainId: '0x1' }).call), /Network mismatch/)
  await assert.rejects(readBalances(wallet, node({ eth_call: null }).call), /invalid balance/)
})
test('USDC review encodes the precise recipient, amount, chain and bounded fee', async () => {
  const n = node(); const q = await prepareTransfer(wallet, 'USDC', recipient, '1.234567', n.call)
  assert.equal(q.units, 1234567n)
  assert.equal(q.transaction.to, SEPOLIA.usdc)
  assert.equal(q.transaction.data, `0xa9059cbb${recipient.slice(2).padStart(64,'0')}${(1234567n).toString(16).padStart(64,'0')}`)
  assert.equal(q.transaction.value, '0x0')
  assert.equal(q.fee, BigInt(q.transaction.gas) * BigInt(q.transaction.maxFeePerGas))
  assert.equal(BigInt(q.transaction.maxFeePerGas), 3_000_000_000n)
  assert.equal(BigInt(q.transaction.maxPriorityFeePerGas), 1_000_000_000n)
  assert.ok(!('gasPrice' in q.transaction))
  assert.equal(q.transaction.chainId, '0xaa36a7')
  assert.equal(q.transaction.type, '0x2')
  assert.ok(Object.isFrozen(q.transaction))
})
test('the installed Openfort EOA parser produces a serializable reviewed transaction', async () => {
  const helpers = await import(new URL('./wallets/evm/walletHelpers.js', import.meta.resolve('@openfort/openfort-js')))
  for (const asset of ['USDC', 'ETH']) {
    const q = await prepareTransfer(wallet, asset, recipient, '0.01', node().call)
    const complete = await helpers.prepareEOATransaction(q.transaction, { getTransactionCount: async () => 0 }, wallet.address)
    const { gas, ...parsed } = helpers.parseTransactionRequest(complete)
    // This is the serialization boundary used by Openfort's EOA provider.
    const encoded = serialize({ ...parsed, gasLimit: gas, type: { legacy: 0, eip2930: 1, eip1559: 2 }[parsed.type] })
    const decoded = parse(encoded)
    assert.equal(decoded.chainId, SEPOLIA.id)
    assert.equal(decoded.to.toLowerCase(), q.transaction.to.toLowerCase())
    assert.equal(decoded.data, q.transaction.data)
    assert.equal(decoded.value.toBigInt(), BigInt(q.transaction.value))
    assert.equal(decoded.gasLimit.toBigInt() * decoded.maxFeePerGas.toBigInt(), q.fee)
  }
})
test('native sends reserve gas, while insufficient token funds never estimate or sign', async () => {
  const n = node(); await assert.rejects(prepareTransfer(wallet, 'USDC', recipient, '11', n.call), /Insufficient/)
  assert.ok(!n.calls.some(([m]) => m === 'eth_estimateGas'))
  await assert.rejects(prepareTransfer(wallet, 'USDC', recipient, '1', node({ eth_getBalance:'0x0' }).call), /Add Sepolia ETH/)
  await assert.rejects(prepareTransfer(wallet, 'ETH', recipient, '1', node().call), /Not enough Sepolia ETH/)
  const q = await prepareTransfer(wallet, 'ETH', recipient, '0.01', node().call)
  assert.equal(q.transaction.to, recipient); assert.equal(q.transaction.data, '0x'); assert.equal(BigInt(q.transaction.value), 10n ** 16n)
  await assert.rejects(prepareTransfer(wallet, 'ETH', wallet.address, '0.01', node().call), /Choose a recipient/)
})
test('failed fee estimates fail closed with no fallback gas', async () => {
  await assert.rejects(prepareTransfer(wallet, 'USDC', recipient, '1', node({ eth_estimateGas:new Error('RPC failed') }).call), /RPC failed/)
  await assert.rejects(prepareTransfer(wallet, 'USDC', recipient, '1', node({ eth_estimateGas:'0x0' }).call), /estimate/)
})
test('EIP-1559 fee data fails closed when malformed and permits a zero tip', async () => {
  for (const block of [null, {}, { baseFeePerGas: null }, { baseFeePerGas: '1' }]) {
    await assert.rejects(prepareTransfer(wallet, 'USDC', recipient, '1', node({ eth_getBlockByNumber: block }).call), /invalid balance or fee/)
  }
  for (const priority of [null, '-1', '0xzz', new Error('RPC failed')]) {
    await assert.rejects(prepareTransfer(wallet, 'USDC', recipient, '1', node({ eth_maxPriorityFeePerGas: priority }).call))
  }
  const q = await prepareTransfer(wallet, 'USDC', recipient, '1', node({ eth_maxPriorityFeePerGas: '0x0' }).call)
  assert.equal(q.transaction.maxPriorityFeePerGas, '0x0')
  assert.equal(BigInt(q.transaction.maxFeePerGas), 2_000_000_000n)
})
test('stale review, wrong wallet or changed provider account prevents broadcast', async () => {
  const q = await prepareTransfer(wallet, 'USDC', recipient, '1', node().call)
  assert.throws(() => assertQuote(wallet, q, q.createdAt + 60001), /expired/)
  assert.throws(() => assertQuote({ ...wallet, address:recipient }, q), /wallet changed/)
  for (const [chain, accounts] of [['0x1',[wallet.address]],['0xaa36a7',[recipient]],['0xaa36a7',[]]]) {
    const calls = []; let started = false
    await assert.rejects(submitTransfer(wallet, q, { request: async ({method}) => { calls.push(method); return method === 'eth_chainId' ? chain : accounts } }, () => {}, () => {started = true}, createTransferConfirmation(q)), /changed/)
    assert.equal(started, false); assert.ok(!calls.includes('eth_sendTransaction'))
  }
})
test('submission sends only the reviewed transaction once and marks an ambiguous broadcast', async () => {
  const q = await prepareTransfer(wallet, 'USDC', recipient, '1', node().call)
  const calls = []; let started = 0
  const provider = { request:async ({method,params}) => {
    if (method === 'eth_chainId') return '0xaa36a7'
    if (method === 'eth_accounts') return [wallet.address]
    calls.push(params); throw new Error('Connection lost after broadcast')
  } }
  await assert.rejects(submitTransfer(wallet,q,provider,()=>{},()=>{started++}, createTransferConfirmation(q)), /Connection lost/)
  assert.equal(started,1); assert.deepEqual(calls,[[q.transaction]])
})
test('session changes during provider checks never broadcast', async () => {
  const q = await prepareTransfer(wallet, 'USDC', recipient, '1', node().call)
  let checks=0, started=false
  await assert.rejects(submitTransfer(wallet,q,{request:async ({method})=>method==='eth_chainId'?'0xaa36a7':[wallet.address]},()=>{if(++checks>1)throw new Error('Session changed')},()=>{started=true}, createTransferConfirmation(q)),/Session changed/)
  assert.equal(started,false)
})
test('a confirmed user action returns the provider transaction hash without exporting a key', async () => {
  const q = await prepareTransfer(wallet, 'ETH', recipient, '0.01', node().call)
  const hash = `0x${'a'.repeat(64)}`, methods=[]
  let started=false
  const result = await submitTransfer(wallet,q,{request:async({method,params})=>{
    methods.push(method)
    if(method==='eth_chainId')return '0xaa36a7'
    if(method==='eth_accounts')return [wallet.address]
    assert.equal(started,true); assert.deepEqual(params,[q.transaction]); return hash
  }},()=>{},()=>{started=true}, createTransferConfirmation(q))
  assert.equal(result,hash)
  assert.deepEqual(methods,['eth_chainId','eth_accounts','eth_sendTransaction'])
})
