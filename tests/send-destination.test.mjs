import test from 'node:test'
import assert from 'node:assert/strict'
import { incomingAddress } from '../src/send-destination.ts'
const wallet={adapter:'openfort-usdc-evm',chain_id:11155111,account_ref:'acc_owner',user_ref:'usr_provider',wallet_ref:'pla_owner',address:'0x'+'8'.repeat(40)}
const target={adapter:wallet.adapter,settlement_account:'species:incoming',settlement_address:'0x'+'1'.repeat(40),denomination:'USD',available:true}
const readiness=()=>({onli_id:'usr-owner',member_wallet:wallet,funding_target:target,ready_to_transact:false})
test('prefills the current Incoming address without treating ledger USD or other onboarding steps as token identity',()=>{
 assert.equal(incomingAddress(readiness(),wallet,'usr-owner'),target.settlement_address)
 assert.equal(incomingAddress({...readiness(),funding_target:{...target,settlement_address:'0x'+'2'.repeat(40)}},wallet,'usr-owner'),'0x'+'2'.repeat(40))
})
test('missing, malformed, zero, unavailable, and non-Incoming destinations never become a preset',()=>{
 for(const patch of [{settlement_address:undefined},{settlement_address:'bad'},{settlement_address:'0x'+'0'.repeat(40)},{available:false},{settlement_account:'species:master'},{adapter:'usdc-solana'}]) {
  assert.throws(()=>incomingAddress({...readiness(),funding_target:{...target,...patch}},wallet,'usr-owner'))
 }
 assert.throws(()=>incomingAddress({...readiness(),funding_target:undefined},wallet,'usr-owner'))
})
test('a different owner, issued wallet or current rail cannot supply the address',()=>{
 assert.throws(()=>incomingAddress(readiness(),wallet,'usr-another-owner'))
 assert.throws(()=>incomingAddress({...readiness(),member_wallet:null},wallet,'usr-owner'))
 for(const patch of [{chain_id:1},{account_ref:'acc_other'},{user_ref:'usr_other'},{wallet_ref:'pla_other'},{address:'0x'+'3'.repeat(40)},{adapter:'other'}]){
  assert.throws(()=>incomingAddress({...readiness(),member_wallet:{...wallet,...patch}},wallet,'usr-owner'))
 }
})
