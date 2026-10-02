import { backupClient } from './backup-client'
import type { Session } from './contracts/species.ts'
import type { TreasuryBackupConfig } from './contracts/backup-client.ts'
import { journey_export_wallet_backup } from './journey/journey_export_wallet_backup.ts'
export type { TreasuryBackupConfig, TreasuryBackupWallet } from './contracts/backup-client.ts'
export const { treasuryExportNote, assertTreasuryBinding } = backupClient
export function downloadTreasuryWallet(session: Session, config: TreasuryBackupConfig, _backupPath: string, signal: AbortSignal) {
  return journey_export_wallet_backup({ scope: 'treasury', session, account: { id: config.wallet.account_id, address: config.wallet.address, chainId: config.wallet.chain_id }, signal })
}
