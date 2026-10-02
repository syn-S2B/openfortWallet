import { readConnection } from '../capability/tool_capability_wallet_projection.ts'
import { OperationIndeterminate } from '../contracts/operation.ts'
import { startMemberRegistration } from '../capability/tool_capability_member.ts'
import { readRegistrationContinuity, writeRegistrationContinuity } from '../resource/registration-operation.ts'
import type { Session } from '../contracts/species.ts'
import { RegistrationOperationError, type RegistrationArguments } from '../onboarding.ts'
import { workflow_observe_registration } from '../workflow/workflow_observe_registration.ts'
import { workflow_resolve_member_readiness } from '../workflow/workflow_resolve_member_readiness.ts'
export async function journey_open_member_wallet(options: {
  session: Session
  registration?: RegistrationArguments
  signal?: AbortSignal
  isCurrent: () => boolean
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}) {
  const current = () => options.isCurrent() && !options.signal?.aborted
  if (options.registration) {
    const store = options.storage ?? (typeof window === 'undefined' ? undefined : localStorage)
    const connection = store ? await readConnection() : null
    if (store && (!connection?.configured || !connection.binding_id))
      throw new Error('A verifiable Species connection binding is required')
    if (!current()) return null
    let operation = store ? readRegistrationContinuity(store, options.session.onli_id) : null
    operation ??= {
      version: 1,
      owner: options.session.onli_id,
      arguments: options.registration,
      bindingId: connection?.binding_id,
    }
    if (store && operation.bindingId !== connection?.binding_id)
      throw new OperationIndeterminate(
        operation.operationId ?? operation.arguments.idempotency_key,
        'Restore the original Species connection before resuming this registration.',
      )
    if (store) writeRegistrationContinuity(store, operation)
    if (!operation.operationId) {
      const started = await startMemberRegistration(options.session, operation.arguments)
      if (!started.operation?.operation_id)
        throw new RegistrationOperationError(
          'registration_response_invalid',
          'Species did not return a registration operation.',
        )
      operation = { ...operation, operationId: started.operation.operation_id }
      if (store) writeRegistrationContinuity(store, operation)
    }
    if (!current()) return null
    const result = await workflow_observe_registration(options.session, operation.operationId!, options.signal)
    if (!current()) return null
    if (result.state === 'pending' || result.state === 'indeterminate') return result
    if (result.state === 'failed' || result.state === 'unmet_requirements')
      throw new RegistrationOperationError(result.code, result.message)
    if (!current()) return null
  }
  return workflow_resolve_member_readiness(options.session, current)
}
