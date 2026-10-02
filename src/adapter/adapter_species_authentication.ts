import { request } from '../capability/tool_capability_species_request.ts'
import type { AuthenticationChallenge, AuthenticationObservation } from '../contracts/authentication.ts'
import type { Session, OnboardingJourney } from '../contracts/species.ts'
export async function adapter_species_start_authentication(identity: string): Promise<AuthenticationChallenge> {
  const value = await request<AuthenticationChallenge>(
    '/auth/start',
    null,
    identity.includes('@') ? { email: identity.trim() } : { onli_id: identity.trim() },
  )
  if (!value.challenge_id || !value.claim_secret || !value.status) throw new Error('Invalid authentication challenge')
  return value
}
export async function adapter_species_observe_authentication(
  challenge: AuthenticationChallenge,
): Promise<AuthenticationObservation> {
  const value = await request<AuthenticationChallenge & { session?: Session; journey?: OnboardingJourney }>(
    '/auth/collect',
    null,
    challenge,
  )
  if (value.status === 'ACCEPTED' && value.session?.token && value.session.onli_id)
    return { state: 'completed', session: value.session, onboarding: value.journey }
  if (value.status === 'ASKED' || value.status === 'PENDING') return { state: 'pending', challenge }
  if (typeof value.status !== 'string') throw new Error('Invalid authentication observation')
  return { state: 'failed', message: `Sign-in ${value.status.toLowerCase()}. Start again to retry.` }
}
