import { startAuthentication, observeAuthentication } from '../capability/tool_capability_authentication.ts'
import type { AuthenticationChallenge } from '../contracts/authentication.ts'
import { walletPollingRecipe } from '../recipe/wallet-networks.ts'
import { workflow_wait_for_authorization } from '../workflow/workflow_wait_for_authorization.ts'
export async function journey_sign_in(
  identity: string,
  signal: AbortSignal,
  challengeChanged: (challenge: AuthenticationChallenge) => void,
) {
  const challenge = await startAuthentication(identity)
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
  challengeChanged(challenge)
  return workflow_wait_for_authorization(
    () => observeAuthentication(challenge),
    signal,
    walletPollingRecipe.authenticationMs,
  )
}
