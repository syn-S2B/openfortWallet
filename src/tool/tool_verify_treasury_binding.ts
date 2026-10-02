import type { TreasuryBackupWallet } from '../contracts/backup-client.ts'
export function assertTreasuryBinding(
  wallet: TreasuryBackupWallet,
  accountID: string,
  address: string,
  chainID: number,
) {
  if (
    wallet.account_id !== accountID ||
    wallet.adapter !== 'openfort-usdc-evm' ||
    wallet.address?.toLowerCase() !== address.toLowerCase() ||
    wallet.chain_id !== chainID ||
    !/^acc_[A-Za-z0-9_-]+$/.test(wallet.account_ref)
  )
    throw new Error('Treasury wallet configuration changed. Refresh the account.')
}
