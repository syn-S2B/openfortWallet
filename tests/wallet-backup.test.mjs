import test from 'node:test'
import assert from 'node:assert/strict'
import { encryptWalletBackup, decryptWalletBackup, createUnlockRecipient, backupBinding, backupDigest, backupAuthorizationBody, parseWalletBackup, assertBackupOwner } from '../src/wallet-backup-crypto.ts'
const enc = new TextEncoder(), b64 = value => Buffer.from(value).toString('base64')
const owner = 'usr-11111111-1111-4111-8111-111111111111'
const privateKey = '0x' + '0'.repeat(63) + '1' // public test vector only
const wallet = { account_ref:'acc_test', address:'0x7e5f4552091a69125d5dfcb7b8c2659029395bdf', chain_id:11155111 }
const server = await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:3072,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'}, true, ['unwrapKey'])
const spki = await crypto.subtle.exportKey('spki', server.publicKey)
const config = { key_id:Buffer.from(await crypto.subtle.digest('SHA-256',spki)).toString('hex'),public_key_spki:b64(spki),instance_id:'test',authorization_behavior:'open-wallet-backup' }
async function wrapForBrowser(file, recipient, id = 'auth-test') {
  const key = await crypto.subtle.unwrapKey('raw',Buffer.from(file.wrapped_key,'base64'),server.privateKey,{name:'RSA-OAEP',label:enc.encode(backupBinding(file))},{name:'AES-GCM'},true,['decrypt'])
  const publicKey = await crypto.subtle.importKey('spki',Buffer.from(recipient.public_key_spki,'base64'),{name:'RSA-OAEP',hash:'SHA-256'},false,['wrapKey'])
  return b64(await crypto.subtle.wrapKey('raw',key,publicKey,{name:'RSA-OAEP',label:enc.encode(['species-wallet-unlock:v1',id,await backupDigest(file)].join('\n'))}))
}
test('download contains ciphertext only and opens with the matching ephemeral browser key', async () => {
  const file = await encryptWalletBackup(privateKey,wallet,owner,config)
  assert.equal(JSON.stringify(file).includes(privateKey.slice(2)),false)
  const recipient = await createUnlockRecipient()
  assert.equal(recipient.privateKey.extractable,false)
  const wrapped = await wrapForBrowser(file,recipient)
  assert.equal(await decryptWalletBackup(file,'auth-test',wrapped,recipient.privateKey),privateKey)
  await assert.rejects(decryptWalletBackup(file,'different-approval',wrapped,recipient.privateKey))
  await assert.rejects(decryptWalletBackup(file,'auth-test',wrapped,(await createUnlockRecipient()).privateKey))
  const altered = {...file,ciphertext:b64(new Uint8Array(48))}
  await assert.rejects(decryptWalletBackup(altered,'auth-test',await wrapForBrowser(altered,recipient),recipient.privateKey))
})
test('new downloads use independent keys and nonce; metadata and key substitution fail closed', async () => {
  const a = await encryptWalletBackup(privateKey,wallet,owner,config), b = await encryptWalletBackup(privateKey,wallet,owner,config)
  for (const field of ['iv','wrapped_key','ciphertext','export_id']) assert.notEqual(a[field],b[field])
  const recipient = await createUnlockRecipient()
  await assert.rejects(wrapForBrowser({...a,account_ref:'acc_other'},recipient))
  await assert.rejects(encryptWalletBackup(privateKey,wallet,owner,{...config,key_id:'0'.repeat(64)}))
  assert.notEqual(await backupAuthorizationBody(a,recipient.public_key_spki),await backupAuthorizationBody(b,recipient.public_key_spki))
})
test('invalid scalars and a valid private key for another wallet never produce a backup', async () => {
  for (const key of ['0'.repeat(64),'f'.repeat(64),'1'.repeat(64),'bad']) await assert.rejects(encryptWalletBackup(key,wallet,owner,config))
})
test('strict parsing and owner binding reject malformed or cross-owner files before authorization', async () => {
  const file = await encryptWalletBackup(privateKey,wallet,owner,config)
  assert.doesNotThrow(()=>assertBackupOwner(file,owner,wallet,'test'))
  for (const patch of [{extra:true},{chain_id:0},{chain_id:1.1},{iv:'AAAA'},{created_at:'2026-02-30T00:00:00.000Z'},{address:'0x'+'0'.repeat(40)},{wrapped_key:file.wrapped_key+'\n'}]) assert.throws(()=>parseWalletBackup(JSON.stringify({...file,...patch})))
  for (const patch of [{owner:'usr-other'},{instance_id:'other'},{account_ref:'acc_other'},{chain_id:1},{address:'0x'+'2'.repeat(40)}]) assert.throws(()=>assertBackupOwner({...file,...patch},owner,wallet,'test'))
})
