// Called by the opt-in Go interoperability test; all material is a public test vector.
import { createInterface } from 'node:readline'
import { encryptWalletBackup, decryptWalletBackup, createUnlockRecipient, backupDigest, backupAuthorizationBody } from '../src/wallet-backup-crypto.ts'
const lines = createInterface({input:process.stdin})[Symbol.asyncIterator]()
const config = JSON.parse((await lines.next()).value)
const privateKey = '0x' + '0'.repeat(63) + '1'
const wallet = {account_ref:'acc_test',address:'0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',chain_id:11155111}
const file = await encryptWalletBackup(privateKey,wallet,'usr-11111111-1111-4111-8111-111111111111',config)
const recipient = await createUnlockRecipient()
console.log(JSON.stringify({file,recipient:recipient.public_key_spki,digest:await backupDigest(file),note:await backupAuthorizationBody(file,recipient.public_key_spki)}))
const response = JSON.parse((await lines.next()).value)
const recovered = await decryptWalletBackup(file,response.id,response.wrapped,recipient.privateKey)
if (recovered !== privateKey) throw new Error('round trip mismatch')
console.log('PASS')
process.exit(0)
