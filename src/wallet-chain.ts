// Compatibility facade; implementation owners live in explicit architecture layers.
export * from './contracts/wallet.ts'
export { ETHEREUM, SEPOLIA } from './recipe/wallet-networks.ts'
export { WalletError, decimals, findWalletNetwork, walletNetwork, assertNetwork, address, parseAmount, formatUnits, assertQuote } from './tool/tool_validate_transfer.ts'
export { rpcFor, readBalances, readActivity, receiptStatus, submitTransfer } from './capability/tool_capability_chain.ts'
import type { Wallet } from './contracts/species.ts'
import type { Asset, RPC } from './contracts/wallet.ts'
import { createChainCapability } from './capability/tool_capability_chain.ts'
import { workflow_prepare_transfer } from './workflow/workflow_prepare_transfer.ts'
export function prepareTransfer(wallet: Wallet, asset: Asset, recipient: string, amount: string, call?: RPC) {
  return workflow_prepare_transfer(wallet, asset, recipient, amount, createChainCapability(wallet.chain_id, call))
}
