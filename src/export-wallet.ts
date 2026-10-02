import type { Session, Wallet } from './contracts/species.ts'
import { journey_export_wallet_backup } from './journey/journey_export_wallet_backup.ts'
export function exportWallet(session: Session, wallet: Wallet, isCurrent: () => boolean) {
  return journey_export_wallet_backup({ scope: 'member', session, wallet, isCurrent })
}
