import type { Session } from '../contracts/species.ts'
import type { RegistrationOperation } from '../onboarding.ts'
import type { OperationResult } from '../contracts/operation.ts'
import { completed } from '../contracts/operation.ts'
import { observeMemberRegistration } from '../capability/tool_capability_member.ts'
import { waitForObservation } from './workflow_wait_for_authorization.ts'
import { walletPollingRecipe } from '../recipe/wallet-networks.ts'
export async function workflow_observe_registration(
  session: Session,
  id: string,
  signal?: AbortSignal,
): Promise<OperationResult<RegistrationOperation>> {
  for (let attempt = 0; attempt < walletPollingRecipe.registrationAttempts; attempt++) {
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
    const result = await observeMemberRegistration(session, id)
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
    if (result.state === 'completed')
      return completed(result.value, [{ kind: 'registration-operation-status', reference: id, observedAt: Date.now() }])
    if (result.state === 'failed')
      return {
        state: 'failed',
        code: 'registration_operation_failed',
        message: 'Species rejected or could not complete this registration operation.',
      }
    if (result.state === 'indeterminate')
      return {
        state: 'indeterminate',
        operationId: id,
        duty: 'Reconcile this registration operation with Species.',
        evidence: [],
      }
    if (attempt + 1 < walletPollingRecipe.registrationAttempts)
      await waitForObservation(walletPollingRecipe.registrationMs, signal)
  }
  return {
    state: 'pending',
    operationId: id,
    duty: 'Continue observing the same registration operation.',
    evidence: [],
  }
}
