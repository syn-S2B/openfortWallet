import type { TransferConfirmation } from '../contracts/transfer-confirmation.ts'
import { tool_verify_transfer_confirmation } from '../tool/tool_verify_transfer_confirmation.ts'
import type { Wallet } from '../contracts/species.ts'
import type { Quote } from '../contracts/wallet.ts'
import { assertQuote, WalletError } from '../tool/tool_validate_transfer.ts'
export type Provider = { request(input: { method: string; params?: unknown[] }): Promise<unknown> }
export async function adapter_evm_submit(
  wallet: Wallet,
  quote: Quote,
  provider: Provider,
  check: () => void,
  broadcastStarted: () => void,
  confirmation: TransferConfirmation,
) {
  check()
  tool_verify_transfer_confirmation(wallet, quote, confirmation)
  assertQuote(wallet, quote)
  const [chain, accounts] = await Promise.all([
    provider.request({ method: 'eth_chainId' }),
    provider.request({ method: 'eth_accounts' }),
  ])
  check()
  tool_verify_transfer_confirmation(wallet, quote, confirmation)
  assertQuote(wallet, quote)
  if (
    typeof chain !== 'string' ||
    BigInt(chain) !== BigInt(wallet.chain_id) ||
    !Array.isArray(accounts) ||
    accounts.length !== 1 ||
    String(accounts[0]).toLowerCase() !== wallet.address.toLowerCase()
  )
    throw new WalletError('Signing wallet or network changed. Review the transfer again.')
  // After this point an error may mean broadcast succeeded. Never automatically retry.
  broadcastStarted()
  const hash = await provider.request({ method: 'eth_sendTransaction', params: [quote.transaction] })
  if (typeof hash !== 'string' || !/^0x[\da-fA-F]{64}$/.test(hash)) throw new Error('Unknown transaction outcome')
  return hash
}
