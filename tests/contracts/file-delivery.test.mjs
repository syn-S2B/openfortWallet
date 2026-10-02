import test from 'node:test'
import assert from 'node:assert/strict'
import { loadUI } from '../load-ui.mjs'
const loader = loadUI()
const { tool_capability_deliver_file } = await import('../../src/capability/tool_capability_deliver_file.ts')
const { encryptWalletBackup } = await import('../../src/wallet-backup-crypto.ts')
loader.deregister()
test('file delivery verifies encrypted schema and reports initiation rather than filesystem save', async () => {
  const server = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' }, true, ['unwrapKey'])
  const spki = await crypto.subtle.exportKey('spki', server.publicKey)
  const file = await encryptWalletBackup('0'.repeat(63)+'1', { account_ref: 'acc_fixture', address: '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf', chain_id: 1 }, 'usr-11111111-1111-4111-8111-111111111111', { key_id: Buffer.from(await crypto.subtle.digest('SHA-256', spki)).toString('hex'), public_key_spki: Buffer.from(spki).toString('base64'), instance_id: 'fixture', authorization_behavior: 'open-wallet-backup' })
  const oldDocument = globalThis.document, oldWindow = globalThis.window, oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL
  let clicked = 0, removed = 0, revoked = 0, filename
  globalThis.document = { body: { append() {} }, createElement: () => ({ set download(value) { filename = value }, click() { clicked++ }, remove() { removed++ } }) }
  globalThis.window = { setTimeout: callback => { callback() } }
  URL.createObjectURL = () => 'blob:fixture'; URL.revokeObjectURL = () => { revoked++ }
  try {
    const result = await tool_capability_deliver_file(file, 'wallet.encrypted.json')
    assert.equal(result.state, 'completed'); assert.equal(result.evidence[0].kind, 'browser-download-initiated')
    assert.equal(filename, 'wallet.encrypted.json'); assert.equal(clicked, 1); assert.equal(removed, 1); assert.equal(revoked, 1)
    await assert.rejects(tool_capability_deliver_file({ ...file, privateKey: 'never-download-plaintext' }, 'bad.json'))
    assert.equal(clicked, 1)
  } finally { globalThis.document = oldDocument; globalThis.window = oldWindow; URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke }
})
