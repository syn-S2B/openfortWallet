import { assertTreasuryBinding } from '../tool/tool_verify_treasury_binding.ts'
import { tool_complete_backup_release } from '../tool/tool_record_backup_release.ts'
import { waitForVisiblePage } from '../wallet-backup/visibility.ts'
import type { createWalletBackupCrypto, BackupConfig, BackupWallet, WalletBackup } from '../wallet-backup/crypto.ts'
import type {
  BackupOwner,
  BackupRequest,
  TreasuryBackupWallet,
  TreasuryBackupConfig,
} from '../contracts/backup-client.ts'
import { createBackupCapability } from '../capability/tool_capability_backup.ts'
import { walletPollingRecipe } from '../recipe/wallet-networks.ts'
import { waitForObservation } from './workflow_wait_for_authorization.ts'
export function createWalletBackupWorkflows<S extends BackupOwner>(
  request: BackupRequest<S>,
  walletCrypto: ReturnType<typeof createWalletBackupCrypto>,
) {
  const capability = createBackupCapability(request)
  const {
    assertBackupOwner,
    backupAuthorizationBody,
    backupDigest,
    createUnlockRecipient,
    decryptWalletBackup,
    encryptWalletBackup,
  } = walletCrypto
  type Unlock = { unlock_id: string; file_sha256: string; wrapped_key: string; expires_at: number }
  async function openWalletBackup(
    file: WalletBackup,
    session: S,
    wallet: BackupWallet,
    signal: AbortSignal,
    backupPath = `/members/${encodeURIComponent(session.onli_id)}/wallet/backup`,
  ) {
    const check = () => {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    }
    const config = await capability.configuration<BackupConfig>(backupPath, session)
    check()
    assertBackupOwner(file, session.onli_id, wallet, config.instance_id)
    if (config.authorization_behavior !== 'open-wallet-backup') throw new Error('Wallet backup is unavailable')
    const recipient = await createUnlockRecipient()
    check()
    const note = {
      behavior: 'open-wallet-backup',
      body: await backupAuthorizationBody(file, recipient.public_key_spki),
    }
    check()
    const authorization = await authorizeWalletBackup(note, session, signal)
    check()
    // OnliYou may be on this same device. Keep consent pending while the user
    // switches apps, and only request the one-use key release on their return.
    await waitForVisiblePage(signal)
    check()
    const result = await capability.release<Unlock>(
      backupPath,
      session,
      { backup: file, recipient_public_key_spki: recipient.public_key_spki },
      authorization.auth_log_id,
    )
    check()
    if (
      result.unlock_id !== authorization.auth_log_id ||
      result.file_sha256 !== (await backupDigest(file)) ||
      !Number.isSafeInteger(result.expires_at) ||
      result.expires_at * 1000 <= Date.now() ||
      result.expires_at * 1000 > Date.now() + 65_000
    )
      throw new Error('Wallet unlock expired or invalid')
    const privateKey = await decryptWalletBackup(file, result.unlock_id, result.wrapped_key, recipient.privateKey)
    check()
    if (result.expires_at * 1000 <= Date.now()) throw new Error('Wallet unlock expired')
    tool_complete_backup_release(session.onli_id, authorization.auth_log_id, await backupDigest(file))
    check()
    return { privateKey, expiresAt: result.expires_at * 1000 }
  }

  async function authorizeWalletBackup(note: { behavior: string; body: string }, session: S, signal: AbortSignal) {
    const check = () => {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    }
    let authorization = await capability.authorize(note, session)
    check()
    const deadline = Date.now() + walletPollingRecipe.backupApprovalLifetimeMs
    while (authorization.state === 'pending') {
      if (Date.now() >= deadline) throw new Error('OnliYou approval expired. Try again.')
      await waitForObservation(walletPollingRecipe.backupApprovalMs, signal)
      check()
      if (!/^[a-zA-Z0-9_-]{1,200}$/.test(authorization.challenge_id)) throw new Error('Invalid authorization challenge')
      authorization = await capability.observe(authorization.challenge_id, session)
      check()
    }
    if (authorization.state !== 'completed' || !authorization.auth_log_id) {
      throw new Error('OnliYou did not authorize opening this file. Try again when you are ready.')
    }
    return authorization
  }
  const base64 = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
  async function treasuryExportNote(wallet: TreasuryBackupWallet, exportID: string, spki: ArrayBuffer) {
    const hash = hex(await crypto.subtle.digest('SHA-256', spki))
    return {
      hash,
      body: `Export encrypted treasury wallet ${wallet.account_id} (${wallet.address}) on chain ${wallet.chain_id}.\nAccount: ${wallet.account_ref}\nExport: ${exportID}\nThis browser: ${hash}\nOnly approve if you requested this wallet backup.`,
    }
  }
  async function createTreasuryWalletBackup(
    session: S,
    config: TreasuryBackupConfig,
    backupPath: string,
    signal: AbortSignal,
  ) {
    const check = () => {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    }
    if (
      config.export_behavior !== 'export-treasury-wallet-backup' ||
      config.authorization_behavior !== 'open-wallet-backup'
    )
      throw new Error('Treasury wallet export is unavailable')
    const recipient = await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      false,
      ['decrypt'],
    )
    check()
    const spki = await crypto.subtle.exportKey('spki', recipient.publicKey),
      exportID = crypto.randomUUID()
    const note = await treasuryExportNote(config.wallet, exportID, spki)
    check()
    const auth = await authorizeWalletBackup({ behavior: config.export_behavior, body: note.body }, session, signal)
    check()
    await waitForVisiblePage(signal)
    check()
    const result = await capability.export<{
      export_id: string
      recipient_sha256: string
      encrypted_private_key: string
      expires_at: number
      wallet: TreasuryBackupWallet
    }>(backupPath, session, { export_id: exportID, recipient_public_key_spki: base64(spki) }, auth.auth_log_id)
    check()
    assertTreasuryBinding(result.wallet, config.wallet.account_id, config.wallet.address, config.wallet.chain_id)
    if (
      result.wallet.account_ref !== config.wallet.account_ref ||
      result.export_id !== exportID ||
      result.recipient_sha256 !== note.hash ||
      !Number.isSafeInteger(result.expires_at) ||
      result.expires_at * 1000 <= Date.now() ||
      result.expires_at * 1000 > Date.now() + 65_000 ||
      !/^[A-Za-z0-9+/]{683}=$/.test(result.encrypted_private_key)
    )
      throw new Error('Treasury export response is invalid or expired')
    const ciphertext = Uint8Array.from(atob(result.encrypted_private_key), (c) => c.charCodeAt(0))
    const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, recipient.privateKey, ciphertext)
    try {
      check()
      if (raw.byteLength !== 32 || result.expires_at * 1000 <= Date.now())
        throw new Error('Treasury wallet export expired')
      const file = await encryptWalletBackup(hex(raw), config.wallet, session.onli_id, config)
      check()
      tool_complete_backup_release(session.onli_id, auth.auth_log_id, await backupDigest(file))
      check()
      return file
    } finally {
      new Uint8Array(raw).fill(0)
    }
  }

  return {
    openWalletBackup,
    authorizeWalletBackup,
    treasuryExportNote,
    assertTreasuryBinding,
    createTreasuryWalletBackup,
  }
}
