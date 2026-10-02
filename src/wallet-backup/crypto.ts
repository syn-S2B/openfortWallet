
export type BackupConfig = { key_id: string; public_key_spki: string; instance_id: string; authorization_behavior: string }
export type WalletBackup = {
  format: 'species-wallet-backup'; version: 1; key_id: string; instance_id: string
  export_id: string; owner: string; account_ref: string; address: string; chain_id: number; created_at: string
  iv: string; ciphertext: string; wrapped_key: string
}
export type BackupWallet = { account_ref: string; address: string; chain_id: number }
export function createWalletBackupCrypto(computeAddress: (privateKey: string) => string) {
const encoder = new TextEncoder()
const invalid = () => new Error('This is not a valid encrypted Species wallet file.')
const base64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
function decode(value: unknown, sizes: number[]) {
  if (typeof value !== 'string' || value.length > 4096 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw invalid()
  let bytes = Uint8Array.from([])
  try { bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0)) } catch { throw invalid() }
  if (!sizes.includes(bytes.length) || base64(bytes) !== value) throw invalid()
  return bytes
}
const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('')
function backupBinding(file: WalletBackup) {
  return ['species-wallet-backup:v1', file.key_id, file.instance_id, file.export_id, file.owner,
    file.account_ref, file.address, String(file.chain_id), file.created_at].join('\n')
}
async function backupDigest(file: WalletBackup) {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(['species-wallet-file:v1', backupBinding(file), file.iv, file.ciphertext, file.wrapped_key].join('\n'))))
}
async function backupAuthorizationBody(file: WalletBackup, recipientSPKI: string) {
  const recipientHash = hex(await crypto.subtle.digest('SHA-256', decode(recipientSPKI, [422])))
  return `Open encrypted wallet ${file.address} on chain ${file.chain_id}.\nFile: ${await backupDigest(file)}\nThis browser: ${recipientHash}\nReveal the private key for import. Only approve if you requested this.`
}
function assertKeyAddress(privateKey: string, address: string) {
  try {
    if (!/^(0x)?[a-fA-F0-9]{64}$/.test(privateKey) || computeAddress('0x' + privateKey.replace(/^0x/, '')).toLowerCase() !== address.toLowerCase()) throw invalid()
  } catch { throw new Error('The private key does not match this wallet.') }
}
function parseWalletBackup(text: string): WalletBackup {
  if (text.length > 16_384) throw invalid()
  let value: WalletBackup
  try { value = JSON.parse(text) } catch { throw invalid() }
  const names = ['format','version','key_id','instance_id','export_id','owner','account_ref','address','chain_id','created_at','iv','ciphertext','wrapped_key']
  if (!value || typeof value !== 'object' || Object.keys(value).length !== names.length || names.some(name => !Object.hasOwn(value, name)) ||
    value.format !== 'species-wallet-backup' || value.version !== 1 ||
    typeof value.key_id !== 'string' || !/^[a-f0-9]{64}$/.test(value.key_id) ||
    typeof value.instance_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value.instance_id) ||
    typeof value.export_id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value.export_id) ||
    typeof value.owner !== 'string' || !/^usr-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.owner) ||
    typeof value.account_ref !== 'string' || !/^acc_[A-Za-z0-9_-]{1,100}$/.test(value.account_ref) ||
    typeof value.address !== 'string' || !/^0x[a-f0-9]{40}$/.test(value.address) || /^0x0{40}$/.test(value.address) ||
    !Number.isSafeInteger(value.chain_id) || value.chain_id <= 0 ||
    typeof value.created_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.created_at) ||
    !Number.isFinite(Date.parse(value.created_at)) || new Date(value.created_at).toISOString() !== value.created_at) throw invalid()
  decode(value.iv, [12]); decode(value.ciphertext, [48]); decode(value.wrapped_key, [384,512])
  return Object.freeze(value)
}
function assertBackupOwner(file: WalletBackup, owner: string, wallet: BackupWallet, instance: string) {
  if (file.owner !== owner || file.instance_id !== instance || file.account_ref !== wallet.account_ref ||
      file.address !== wallet.address.toLowerCase() || file.chain_id !== wallet.chain_id) {
    throw new Error('This encrypted file belongs to a different owner, wallet or Species instance.')
  }
}
async function wrappingKey(config: BackupConfig) {
  if (!/^[a-f0-9]{64}$/.test(config.key_id) || typeof config.public_key_spki !== 'string') throw invalid()
  const spki = decode(config.public_key_spki, [422,550]) // RSA 3072/4096 SPKI with exponent 65537.
  if (hex(await crypto.subtle.digest('SHA-256', spki)) !== config.key_id) throw new Error('Wallet encryption key does not match its identifier.')
  const key = await crypto.subtle.importKey('spki', spki, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['wrapKey'])
  const algorithm = key.algorithm as RsaHashedKeyAlgorithm
  if (![3072,4096].includes(algorithm.modulusLength) || hex(algorithm.publicExponent) !== '010001') throw invalid()
  return key
}
async function encryptWalletBackup(privateKey: string, wallet: BackupWallet, owner: string, config: BackupConfig): Promise<WalletBackup> {
  assertKeyAddress(privateKey, wallet.address)
  const raw = Uint8Array.from(privateKey.replace(/^0x/, '').match(/../g)!, pair => parseInt(pair, 16))
  try {
    const recipient = await wrappingKey(config)
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const file: WalletBackup = { format:'species-wallet-backup', version:1, key_id:config.key_id, instance_id:config.instance_id,
      export_id:crypto.randomUUID(), owner, account_ref:wallet.account_ref, address:wallet.address.toLowerCase(), chain_id:wallet.chain_id,
      created_at:new Date().toISOString(), iv:base64(iv), ciphertext:'', wrapped_key:'' }
    const binding = encoder.encode(backupBinding(file))
    file.ciphertext = base64(await crypto.subtle.encrypt({name:'AES-GCM', iv, additionalData:binding, tagLength:128}, key, raw))
    file.wrapped_key = base64(await crypto.subtle.wrapKey('raw', key, recipient, {name:'RSA-OAEP', label:binding}))
    return parseWalletBackup(JSON.stringify(file))
  } finally { raw.fill(0) }
}
async function createUnlockRecipient() {
  const pair = await crypto.subtle.generateKey({name:'RSA-OAEP', modulusLength:3072, publicExponent:new Uint8Array([1,0,1]), hash:'SHA-256'}, false, ['unwrapKey'])
  return { privateKey:pair.privateKey, public_key_spki:base64(await crypto.subtle.exportKey('spki', pair.publicKey)) }
}
async function decryptWalletBackup(file: WalletBackup, unlockID: string, wrappedKey: string, recipient: CryptoKey) {
  const label = encoder.encode(['species-wallet-unlock:v1', unlockID, await backupDigest(file)].join('\n'))
  const key = await crypto.subtle.unwrapKey('raw', decode(wrappedKey, [384]), recipient, {name:'RSA-OAEP', label}, {name:'AES-GCM', length:256}, false, ['decrypt'])
  const raw = new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM', iv:decode(file.iv,[12]), additionalData:encoder.encode(backupBinding(file)), tagLength:128}, key, decode(file.ciphertext,[48])))
  try {
    if (raw.length !== 32) throw invalid()
    const privateKey = '0x' + hex(raw)
    assertKeyAddress(privateKey, file.address)
    return privateKey
  } finally { raw.fill(0) }
}

return { backupBinding, backupDigest, backupAuthorizationBody, parseWalletBackup, assertBackupOwner, encryptWalletBackup, createUnlockRecipient, decryptWalletBackup }
}
