import { getAddress } from '@ethersproject/address'
import type { MemberReadiness, Wallet } from './species'

// Read the current adapter's target together with this owner's issued wallet.
// Never reuse an admin treasury snapshot or a saved address from another rail.
export function incomingAddress(readiness: MemberReadiness, wallet: Wallet, owner: string): string {
  const target = readiness.funding_target, current = readiness.member_wallet
  if (readiness.onli_id !== owner || !target?.available || target.settlement_account !== 'species:incoming' ||
      target.adapter !== 'openfort-usdc-evm' || target.adapter !== wallet.adapter || !current ||
      current.adapter !== target.adapter || current.chain_id !== wallet.chain_id || current.account_ref !== wallet.account_ref ||
      current.user_ref !== wallet.user_ref || current.wallet_ref !== wallet.wallet_ref || current.address.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error('The Appliance Incoming account is unavailable for this wallet. Refresh or paste another address.')
  }
  try {
    const address = getAddress(target.settlement_address || '')
    if (BigInt(address) === 0n) throw new Error()
    return address
  } catch { throw new Error('Species did not return a valid Incoming address. Refresh or paste another address.') }
}
