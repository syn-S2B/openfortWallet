import test from 'node:test'
import assert from 'node:assert/strict'
import { detectPhantom, readPhantom, phantomAccount, phantomError } from '../src/phantom.ts'

const address = `0x${'1'.repeat(40)}`
test('connect selects only the Phantom EVM provider, never another installed wallet', () => {
  const provider = { isPhantom:true, request:async()=>{} }
  assert.equal(detectPhantom({phantom:{ethereum:provider}}),provider)
  assert.equal(detectPhantom({ethereum:provider}),null)
  assert.equal(detectPhantom({phantom:{ethereum:{...provider,isPhantom:false}}}),null)
  assert.equal(detectPhantom({phantom:{solana:provider}}),null)
})
test('one-click connection requests only public accounts and chain; never signs or exports', async () => {
  const methods=[]
  const account=await readPhantom({isPhantom:true,request:async({method})=>{methods.push(method);return method==='eth_requestAccounts'?[address]:'0xaa36a7'}},true)
  assert.deepEqual(account,{address,chainId:11155111})
  assert.deepEqual(methods,['eth_requestAccounts','eth_chainId'])
})
test('account/network refresh reads existing permission without prompting again', async () => {
  const methods=[]
  assert.deepEqual(await readPhantom({isPhantom:true,request:async({method})=>{methods.push(method);return method==='eth_accounts'?[address]:'0x1'}}),{address,chainId:1})
  assert.deepEqual(methods,['eth_accounts','eth_chainId'])
  assert.equal(phantomAccount([],'0x1'),null)
})
test('invalid provider data cannot appear as a connected wallet', () => {
  for(const [accounts,chain] of [[null,'0x1'],[['0x123'],'0x1'],[[address],'bad'],[[address],'0x0'],[[address],'0xffffffffffffffffffffffff'],[['0x'+'0'.repeat(40)],'0x1']]) assert.throws(()=>phantomAccount(accounts,chain))
})
test('declined/pending connections are recoverable and provider errors stay private', async () => {
  const error={code:4001,message:'potentially sensitive provider error'}
  await assert.rejects(readPhantom({isPhantom:true,request:async()=>{throw error}},true),value=>value===error)
  assert.match(phantomError(error),/declined/)
  assert.match(phantomError({code:-32002}),/already open/)
  assert.ok(!phantomError(new Error('secret')).includes('secret'))
})
