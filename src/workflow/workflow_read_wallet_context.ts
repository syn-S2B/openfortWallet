import type { Session } from '../contracts/species.ts'
import { readMemberWallet, readMemberReadiness } from '../capability/tool_capability_member.ts'
import { readTreasury, readConnection } from '../capability/tool_capability_wallet_projection.ts'
import type { Wallet } from '../contracts/species.ts'
import { incomingAddress } from '../send-destination.ts'
export const workflow_read_connection = readConnection
export const workflow_read_treasury = readTreasury
export const workflow_read_member_wallet = readMemberWallet
export async function workflow_resolve_incoming_target(session: Session, wallet: Wallet) {
  return incomingAddress(await readMemberReadiness(session), wallet, session.onli_id)
}
