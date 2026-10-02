import type { Wallet } from '../contracts/species.ts'
import { readBalances, readActivity } from '../capability/tool_capability_chain.ts'
/** Independent observations retain unavailable states rather than becoming zero. */
export async function workflow_read_wallet_observations(
  wallet: Wallet,
  selection = { balances: true, activity: true },
) {
  const [balances, activity] = await Promise.allSettled([
    selection.balances ? readBalances(wallet) : Promise.resolve(undefined),
    selection.activity ? readActivity(wallet) : Promise.resolve(undefined),
  ])
  return { balances, activity }
}
