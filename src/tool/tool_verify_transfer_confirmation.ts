import type { Quote } from '../contracts/wallet.ts'
import type { Wallet } from '../contracts/species.ts'
import type { TransferConfirmation } from '../contracts/transfer-confirmation.ts'
import { assertQuote, WalletError } from './tool_validate_transfer.ts'
export function tool_verify_transfer_confirmation(
  wallet: Wallet,
  quote: Quote,
  confirmation: TransferConfirmation | undefined,
  now = Date.now(),
) {
  assertQuote(wallet, quote, now)
  if (
    !confirmation ||
    confirmation.kind !== 'explicit_transfer_confirmation' ||
    !confirmation.operationId ||
    confirmation.walletAddress.toLowerCase() !== wallet.address.toLowerCase() ||
    confirmation.chainId !== wallet.chain_id ||
    confirmation.quoteCreatedAt !== quote.createdAt ||
    !Number.isFinite(confirmation.confirmedAt) ||
    confirmation.confirmedAt < quote.createdAt ||
    confirmation.confirmedAt > now ||
    JSON.stringify(confirmation.transaction) !== JSON.stringify(quote.transaction)
  )
    throw new WalletError('Explicit confirmation of this exact transfer is required.')
}
