import type { Session } from '../contracts/species.ts'
import type { TreasuryBackupConfig } from '../contracts/backup-client.ts'
import { request } from '../capability/tool_capability_species_request.ts'
import { assertTreasuryBinding } from '../tool/tool_verify_treasury_binding.ts'
export async function workflow_resolve_treasury_backup(
  session: Session,
  account: { id: string; address: string; chainId: number },
  signal: AbortSignal,
) {
  const backupPath = `/treasury/${account.id.replace('species:', '')}/wallet/backup`
  const config = await request<TreasuryBackupConfig>(`${backupPath}/config`, session)
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
  assertTreasuryBinding(config.wallet, account.id, account.address, account.chainId)
  return { config, backupPath }
}
