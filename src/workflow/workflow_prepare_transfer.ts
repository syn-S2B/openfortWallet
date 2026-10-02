import type { Wallet } from '../contracts/species.ts'
import type { Asset, Quote } from '../contracts/wallet.ts'
import { assertNetwork, address, parseAmount, fail, hex, quantity } from '../tool/tool_validate_transfer.ts'
import { createChainCapability } from '../capability/tool_capability_chain.ts'
export async function workflow_prepare_transfer(
  wallet: Wallet,
  asset: Asset,
  recipient: string,
  amount: string,
  reads: ReturnType<typeof createChainCapability> = createChainCapability(wallet.chain_id),
): Promise<Quote> {
  const network = assertNetwork(wallet)
  if (asset !== 'USDC' && asset !== 'ETH') return fail('Choose USDC or ETH.')
  const to = address(recipient),
    units = parseAmount(amount, asset)
  if (to.toLowerCase() === wallet.address.toLowerCase() || to.toLowerCase() === network.usdc.toLowerCase())
    return fail('Choose a recipient other than this wallet or the token contract.')
  const balances = await reads.balances(wallet)
  if (units > (asset === 'USDC' ? balances.usdc : balances.eth)) return fail(`Insufficient ${asset} balance.`)
  if (balances.eth === 0n) return fail(`Add ${network.gasAsset} to this address to pay the network fee.`)
  const transaction = {
    from: wallet.address,
    to: asset === 'USDC' ? network.usdc : to,
    chainId: hex(BigInt(wallet.chain_id)),
    value: asset === 'ETH' ? hex(units) : '0x0',
    data:
      asset === 'USDC'
        ? `0xa9059cbb${to.slice(2).toLowerCase().padStart(64, '0')}${units.toString(16).padStart(64, '0')}`
        : '0x',
  }
  const { estimate, block, priority } = await reads.estimate(transaction)
  const baseFee = quantity(
    block && typeof block === 'object' && 'baseFeePerGas' in block ? block.baseFeePerGas : undefined,
  )
  const gas = (quantity(estimate) * 120n + 99n) / 100n,
    maxPriorityFeePerGas = quantity(priority)
  const maxFeePerGas = baseFee * 2n + maxPriorityFeePerGas
  if (gas <= 0n || maxFeePerGas <= 0n || maxFeePerGas >= 2n ** 256n) return fail('Could not estimate the network fee.')
  const fee = gas * maxFeePerGas
  if (balances.eth < fee + (asset === 'ETH' ? units : 0n))
    return fail(`Not enough ${network.gasAsset} for the amount and network fee. Reduce the amount or add ETH.`)
  return Object.freeze({
    walletAddress: wallet.address,
    chainId: wallet.chain_id,
    recipient: to,
    asset,
    units,
    fee,
    createdAt: Date.now(),
    // Both supported chains use EIP-1559. Openfort 2.6's legacy serialization includes
    // unsupported optional keys; explicit type-2 fees also preserve this cap.
    transaction: Object.freeze({
      ...transaction,
      gas: hex(gas),
      maxFeePerGas: hex(maxFeePerGas),
      maxPriorityFeePerGas: hex(maxPriorityFeePerGas),
      type: '0x2',
    }),
  })
}
export const prepareTransfer = workflow_prepare_transfer
