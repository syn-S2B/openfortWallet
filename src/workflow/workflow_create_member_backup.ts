import { runExport } from '../export-core'
import { withWalletSDK } from '../wallet-sdk'
import type { Session, Wallet } from '../contracts/species.ts'
import { readWalletAccess, readWalletBackupConfig } from '../capability/tool_capability_member.ts'
import { encryptWalletBackup, type BackupConfig, type WalletBackup } from '../wallet-backup-crypto'

export async function workflow_create_member_backup(session: Session, wallet: Wallet, isCurrent: () => boolean) {
  const config = await readWalletBackupConfig<BackupConfig>(session)
  if (!isCurrent() || config.authorization_behavior !== 'open-wallet-backup')
    throw new Error('Wallet backup is unavailable')
  let file: WalletBackup | undefined
  await withWalletSDK((createSDK) =>
    runExport({
      wallet,
      isCurrent,
      createSDK,
      getAccess: () => readWalletAccess(session),
      async save(key) {
        file = await encryptWalletBackup(key, wallet, session.onli_id, config)
        if (!isCurrent()) throw new Error('Session changed')
      },
    }),
  )
  if (!file) throw new Error('No verified encrypted artifact was produced')
  return file
}
