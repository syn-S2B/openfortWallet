import type { RPC } from '../contracts/wallet.ts'
export async function adapter_evm_fee(transaction: Record<string, string>, call: RPC) {
  const [estimate, block, priority] = await Promise.all([
    call('eth_estimateGas', [transaction]),
    call('eth_getBlockByNumber', ['latest', false]),
    call('eth_maxPriorityFeePerGas', []),
  ])
  return { estimate, block, priority }
}
