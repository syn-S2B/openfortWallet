import type { Quote } from './wallet.ts'
export type TransferConfirmation = {
  kind: 'explicit_transfer_confirmation'
  operationId: string
  walletAddress: string
  chainId: number
  quoteCreatedAt: number
  confirmedAt: number
  transaction: Record<string, string>
}
/** Surface calls this only when the user selects Confirm and send. */
export function createTransferConfirmation(quote: Quote): TransferConfirmation {
  return Object.freeze({
    kind: 'explicit_transfer_confirmation',
    operationId: crypto.randomUUID(),
    walletAddress: quote.walletAddress,
    chainId: quote.chainId,
    quoteCreatedAt: quote.createdAt,
    confirmedAt: Date.now(),
    transaction: Object.freeze({ ...quote.transaction }),
  })
}
