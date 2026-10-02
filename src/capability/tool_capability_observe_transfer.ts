import type { Wallet } from '../contracts/species.ts'
import type { Submission } from '../resource/transfer-operation.ts'
import { adapter_evm_transfer_observation } from '../adapter/adapter_evm_transfer_observation.ts'
import { adapter_evm_rpc, verifyChain } from '../adapter/adapter_evm_rpc.ts'
import { tool_verify_transfer_evidence } from '../tool/tool_verify_transfer_evidence.ts'
import { walletNetwork } from '../tool/tool_validate_transfer.ts'
import { walletNetworkRecipeVersion } from '../recipe/wallet-networks.ts'

export async function tool_capability_observe_transfer(wallet: Wallet, operation: Submission) {
  if (!operation.hash || !operation.intent) return null
  const network = walletNetwork(wallet.chain_id)
  if (
    operation.binding?.recipe !== walletNetworkRecipeVersion ||
    operation.binding.capability !== 'transfer-inclusion/v1' ||
    operation.binding.adapter !== 'evm-rpc/v1' ||
    operation.network?.rpc !== network.rpc ||
    operation.network.usdc !== network.usdc ||
    operation.intent.chainId !== wallet.chain_id ||
    operation.intent.sender.toLowerCase() !== wallet.address.toLowerCase()
  )
    throw new Error('Original transfer binding is unavailable')
  const call = adapter_evm_rpc(operation.intent.chainId)
  await verifyChain(call, operation.intent.chainId)
  return tool_verify_transfer_evidence(operation, await adapter_evm_transfer_observation(operation.hash, call))
}
