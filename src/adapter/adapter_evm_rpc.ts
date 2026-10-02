import type { Wallet } from '../contracts/species.ts'
import type { RPC, Balances } from '../contracts/wallet.ts'
import { walletNetwork, assertNetwork, quantity, fail } from '../tool/tool_validate_transfer.ts'
import { adapter_network_json } from './adapter_network_json.ts'
export function adapter_evm_rpc(chainID: number): RPC {
  const network = walletNetwork(chainID)
  return async (method, params) => {
    const result = await adapter_network_json(network.rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    if (result.error || !('result' in result))
      return fail('The network could not complete this request. Check your balance and try again.')
    return result.result
  }
}
async function verifyChain(call: RPC, chainID: number) {
  if (quantity(await call('eth_chainId', [])) !== BigInt(chainID)) fail('Network mismatch. Sending is disabled.')
}
export async function adapter_evm_balances(
  wallet: Wallet,
  call: RPC = adapter_evm_rpc(wallet.chain_id),
): Promise<Balances> {
  const network = assertNetwork(wallet)
  await verifyChain(call, network.id)
  const [eth, usdc] = await Promise.all([
    call('eth_getBalance', [wallet.address, 'latest']),
    call('eth_call', [
      { to: network.usdc, data: `0x70a08231${wallet.address.slice(2).toLowerCase().padStart(64, '0')}` },
      'latest',
    ]),
  ])
  return { eth: quantity(eth), usdc: quantity(usdc), checkedAt: Date.now() }
}
export { verifyChain }
export async function adapter_evm_receipt(
  wallet: Wallet,
  hash: string,
  call: RPC = adapter_evm_rpc(wallet.chain_id),
): Promise<'pending' | 'confirmed' | 'failed'> {
  assertNetwork(wallet)
  if (!/^0x[\da-fA-F]{64}$/.test(hash)) return fail('Invalid transaction reference.')
  await verifyChain(call, wallet.chain_id)
  const receipt = (await call('eth_getTransactionReceipt', [hash])) as { status?: string } | null
  if (!receipt) return 'pending'
  if (receipt.status === '0x1') return 'confirmed'
  if (receipt.status === '0x0') return 'failed'
  return fail('Transaction status is unavailable.')
}
