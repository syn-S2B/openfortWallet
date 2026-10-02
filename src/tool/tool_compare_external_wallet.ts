import type { PhantomAccount } from '../contracts/external-wallet.ts'
import type { Wallet } from '../contracts/species.ts'
export function tool_compare_external_wallet(
  expected: Pick<Wallet, 'address' | 'chain_id'> | null,
  observed: PhantomAccount | null,
) {
  return {
    addressMatches: !!expected && !!observed && expected.address.toLowerCase() === observed.address.toLowerCase(),
    chainMatches: !!expected && !!observed && expected.chain_id === observed.chainId,
  }
}
