import type { Asset, Quote } from '../contracts/wallet.ts'
import type { Wallet } from '../contracts/species.ts'
import { WalletError } from '../tool/tool_validate_transfer.ts'
import { workflow_prepare_transfer } from './workflow_prepare_transfer.ts'
import { requireNoPendingSubmission } from '../submission-lock.ts'
export async function workflow_review_transfer(options: {
  wallet: Wallet
  asset: Asset
  recipient: string
  amount: string
  destination: 'incoming' | 'custom'
  storage: Pick<Storage, 'getItem'>
  key: string
  loadIncoming: () => Promise<string>
  isCurrent: () => boolean
}): Promise<Quote | null> {
  requireNoPendingSubmission(options.storage, options.key)
  if (options.destination === 'incoming') {
    const latest = await options.loadIncoming()
    if (!options.isCurrent()) return null
    if (!latest || latest.toLowerCase() !== options.recipient.toLowerCase())
      throw new WalletError(
        'The Incoming address changed or could not be checked. Check the destination and review again.',
      )
    if (options.asset !== 'USDC') throw new WalletError('The Appliance Incoming account receives USDC.')
  }
  const quote = await workflow_prepare_transfer(options.wallet, options.asset, options.recipient, options.amount)
  return options.isCurrent() ? quote : null
}
