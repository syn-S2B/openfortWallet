import type { Session } from '../contracts/species.ts'
import type { BackupWallet, WalletBackup } from '../wallet-backup/crypto.ts'
import { backupClient } from '../backup-client.ts'
/** The reusable Workflow proves key binding; the Journey admits a bounded reveal. */
export async function journey_open_wallet_backup(
  file: WalletBackup,
  session: Session,
  wallet: BackupWallet,
  signal: AbortSignal,
  path?: string,
) {
  const result = await backupClient.openWalletBackup(file, session, wallet, signal, path)
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
  if (result.expiresAt <= Date.now() || document.visibilityState !== 'visible')
    throw new Error('The reveal is unavailable in the current page context')
  return result
}
