import { adapter_browser_download } from '../adapter/adapter_browser_download.ts'
import { completed } from '../contracts/operation.ts'
import { backupDigest, parseWalletBackup, type WalletBackup } from '../wallet-backup-crypto.ts'
/** Completion proves initiation with a bound encrypted artifact, never filesystem save. */
export async function tool_capability_deliver_file(file: WalletBackup, name: string) {
  const verifiedFile = parseWalletBackup(JSON.stringify(file))
  const digest = await backupDigest(verifiedFile)
  adapter_browser_download(verifiedFile, name)
  return completed({ digest, name }, [
    { kind: 'browser-download-initiated', reference: digest, observedAt: Date.now() },
  ])
}
