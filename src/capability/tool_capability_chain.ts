import type { Wallet } from '../contracts/species.ts'
import type { RPC } from '../contracts/wallet.ts'
import { adapter_evm_rpc, adapter_evm_balances, adapter_evm_receipt } from '../adapter/adapter_evm_rpc.ts'
import { adapter_blockscout_activity } from '../adapter/adapter_blockscout_activity.ts'
import { adapter_evm_fee } from '../adapter/adapter_evm_fee.ts'
import { adapter_evm_submit } from '../adapter/adapter_evm_submit.ts'
// The compatibility exports retain the existing injectable test boundary.
export const rpcFor = adapter_evm_rpc
export const readBalances = adapter_evm_balances
export const readActivity = adapter_blockscout_activity
export const receiptStatus = adapter_evm_receipt
export const estimateTransfer = adapter_evm_fee
export const submitTransfer = adapter_evm_submit

export function createChainCapability(chainId: number, call: RPC = adapter_evm_rpc(chainId)) {
  return {
    balances: (wallet: Wallet) => adapter_evm_balances(wallet, call),
    estimate: (transaction: Record<string, string>) => adapter_evm_fee(transaction, call),
  }
}
