import { walletProviderRecipe } from '../recipe/wallet-provider.ts'
import type { Submission } from '../resource/transfer-operation.ts'
import type { Wallet } from '../contracts/species.ts'
import type { Quote } from '../contracts/wallet.ts'
import { walletNetwork, formatUnits } from './tool_validate_transfer.ts'
import { walletNetworkRecipeVersion } from '../recipe/wallet-networks.ts'
export function createTransferOperation(
  wallet: Wallet,
  quote: Quote,
  operationId: string = crypto.randomUUID(),
): Submission {
  const network = walletNetwork(wallet.chain_id)
  return {
    version: 1,
    operationId,
    state: 'indeterminate',
    status: 'unknown',
    asset: quote.asset,
    amount: formatUnits(quote.units, quote.asset),
    createdAt: Date.now(),
    binding: { capability: 'transfer-inclusion/v1', adapter: 'evm-rpc/v1', recipe: walletNetworkRecipeVersion },
    signerBinding: {
      recipe: walletProviderRecipe.version,
      adapter: walletProviderRecipe.adapter,
      capability: walletProviderRecipe.capability,
    },
    network: { rpc: network.rpc, usdc: network.usdc },
    intent: {
      chainId: wallet.chain_id,
      sender: wallet.address,
      recipient: quote.recipient,
      units: quote.units.toString(),
      transaction: { ...quote.transaction },
    },
    evidence: [],
    duty: 'Reconcile the original broadcast before any replacement transfer.',
  }
}
