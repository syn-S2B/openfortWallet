import type { RPC } from '../contracts/wallet.ts'
/** Provider translation only; the Capability verifies canonical effect evidence. */
export async function adapter_evm_transfer_observation(hash: string, call: RPC) {
  const [transaction, receipt] = await Promise.all([
    call('eth_getTransactionByHash', [hash]),
    call('eth_getTransactionReceipt', [hash]),
  ])
  return { transaction, receipt }
}
