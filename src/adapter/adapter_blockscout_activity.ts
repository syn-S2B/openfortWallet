import type { Wallet } from '../contracts/species.ts'
import type { Activity } from '../contracts/wallet.ts'
import { assertNetwork, fail, formatUnits } from '../tool/tool_validate_transfer.ts'
import { adapter_network_json } from './adapter_network_json.ts'
export async function adapter_blockscout_activity(wallet: Wallet): Promise<Activity[]> {
  const network = assertNetwork(wallet)
  const base = `${network.explorer}/api/v2/addresses/${wallet.address}`
  const [tokens, transactions] = await Promise.all([
    adapter_network_json(`${base}/token-transfers?type=ERC-20`),
    adapter_network_json(`${base}/transactions`),
  ])
  if (!Array.isArray(tokens.items) || !Array.isArray(transactions.items))
    return fail('Activity is temporarily unavailable.')
  const owner = wallet.address.toLowerCase()
  const rows: Activity[] = []
  for (const [items, asset] of [
    [tokens.items, 'USDC'],
    [transactions.items, 'ETH'],
  ] as const) {
    for (const item of items.slice(0, 50)) {
      if (asset === 'USDC' && item.token?.address_hash?.toLowerCase() !== network.usdc.toLowerCase()) continue
      const hash = asset === 'USDC' ? item.transaction_hash : item.hash
      const raw = asset === 'USDC' ? item.total?.value : item.value
      const from = item.from?.hash?.toLowerCase(),
        to = item.to?.hash?.toLowerCase()
      if (
        (from !== owner && to !== owner) ||
        !/^0x[\da-fA-F]{64}$/.test(hash) ||
        typeof raw !== 'string' ||
        !/^\d{1,78}$/.test(raw) ||
        (asset === 'ETH' && BigInt(raw) === 0n)
      )
        continue
      rows.push({
        hash,
        asset,
        amount: formatUnits(BigInt(raw), asset),
        direction: from === owner ? 'sent' : 'received',
        peer: from === owner ? to : from,
        status:
          item.status === 'error' ? 'failed' : item.block_number == null && asset === 'ETH' ? 'pending' : 'confirmed',
        timestamp: typeof item.timestamp === 'string' ? item.timestamp : '',
      })
    }
  }
  return rows.sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0)).slice(0, 20)
}
