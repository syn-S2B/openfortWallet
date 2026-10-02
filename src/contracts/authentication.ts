import type { Session, OnboardingJourney } from './species.ts'
export type AuthenticationChallenge = { challenge_id: string; claim_secret: string; status: string }
export type AuthenticationObservation =
  | { state: 'pending'; challenge: AuthenticationChallenge }
  | { state: 'completed'; session: Session; onboarding?: OnboardingJourney }
  | { state: 'failed'; message: string }
