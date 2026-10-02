import type { Session, Wallet } from '../contracts/species.ts'
import { workflow_resolve_treasury_backup } from '../workflow/workflow_resolve_treasury_backup.ts'
import { workflow_create_member_backup } from '../workflow/workflow_create_member_backup.ts'
import { backupClient } from '../backup-client.ts'
import { tool_capability_deliver_file } from '../capability/tool_capability_deliver_file.ts'
type ExportContext =
  | { scope: 'member'; session: Session; wallet: Wallet; isCurrent: () => boolean }
  | {
      scope: 'treasury'
      session: Session
      account: { id: string; address: string; chainId: number }
      signal: AbortSignal
    }
/** One outcome, context-selected key acquisition, shared encrypted-file delivery. */
export async function journey_export_wallet_backup(context: ExportContext) {
  if (context.scope === 'member') {
    const file = await workflow_create_member_backup(context.session, context.wallet, context.isCurrent)
    if (!context.isCurrent()) throw new Error('Session changed')
    return tool_capability_deliver_file(file, `species-wallet-${context.wallet.address}.encrypted.json`)
  }
  const { config, backupPath } = await workflow_resolve_treasury_backup(
    context.session,
    context.account,
    context.signal,
  )
  const file = await backupClient.createTreasuryWalletBackup(context.session, config, backupPath, context.signal)
  if (context.signal.aborted) throw new DOMException('Cancelled', 'AbortError')
  return tool_capability_deliver_file(
    file,
    `species-${config.wallet.account_id.replace('species:', '')}-${config.wallet.address}.encrypted.json`,
  )
}
