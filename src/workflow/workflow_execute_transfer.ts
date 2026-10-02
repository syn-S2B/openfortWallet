import type { TransferConfirmation } from '../contracts/transfer-confirmation.ts'
import { tool_verify_transfer_confirmation } from '../tool/tool_verify_transfer_confirmation.ts'
import { runWalletAction } from '../export-core'
import { withWalletSDK } from '../wallet-sdk'
import { assertQuote, readBalances, WalletError, type Quote } from '../wallet-chain'
import type { Session, Wallet } from '../contracts/species.ts'
import { readWalletAccess } from '../capability/tool_capability_member.ts'

export async function workflow_execute_transfer(
  session: Session,
  wallet: Wallet,
  quote: Quote,
  isCurrent: () => boolean,
  broadcastStarted: () => void,
  confirmation: TransferConfirmation,
) {
  tool_verify_transfer_confirmation(wallet, quote, confirmation)
  return withWalletSDK((createSDK) =>
    runWalletAction({
      wallet,
      isCurrent,
      createSDK,
      getAccess: () => readWalletAccess(session),
      async action(sdk, check) {
        const balance = await readBalances(wallet)
        check()
        assertQuote(wallet, quote)
        if (
          balance.eth < quote.fee + (quote.asset === 'ETH' ? quote.units : 0n) ||
          (quote.asset === 'USDC' && balance.usdc < quote.units)
        )
          throw new WalletError('Your balance changed. Review the transfer again.')
        return sdk.sendTransfer(wallet, quote, check, broadcastStarted, confirmation)
      },
    }),
  )
}
