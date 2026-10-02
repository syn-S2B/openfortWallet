import { readMemberReadiness, readMemberWallet, ensureMemberWallet } from '../capability/tool_capability_member.ts'
import type { Session } from '../contracts/species.ts'
import { walletEnsureSelected, onboardingReason } from '../onboarding.ts'
export async function workflow_resolve_member_readiness(session: Session, isCurrent: () => boolean) {
  const readiness = await readMemberReadiness(session)
  if (!isCurrent()) return null
  if (!readiness.member_wallet && !walletEnsureSelected(readiness))
    return {
      wallet: null,
      readiness,
      reason: onboardingReason(readiness) || 'Species needs another onboarding step before it can issue your wallet.',
    }
  const wallet = await (readiness.member_wallet ? readMemberWallet(session) : ensureMemberWallet(session))
  return isCurrent() ? { wallet, readiness, reason: '' } : null
}
