import type { RegistrationArguments } from '../onboarding.ts'
export type RegistrationContinuity = {
  bindingId?: string
  version: 1
  owner: string
  arguments: RegistrationArguments
  operationId?: string
}
export function readRegistrationContinuity(
  storage: Pick<Storage, 'getItem'>,
  owner: string,
): RegistrationContinuity | null {
  const raw = storage.getItem(`species-wallet-registration:${owner}`)
  if (!raw) return null
  const value = JSON.parse(raw) as RegistrationContinuity
  if (
    value.version !== 1 ||
    value.owner !== owner ||
    !value.arguments?.idempotency_key ||
    !value.arguments.correlation_id ||
    (value.operationId !== undefined && !/^[a-zA-Z0-9_-]{1,200}$/.test(value.operationId))
  )
    throw new Error('Invalid registration continuity')
  return value
}
export function writeRegistrationContinuity(storage: Pick<Storage, 'setItem'>, operation: RegistrationContinuity) {
  storage.setItem(`species-wallet-registration:${operation.owner}`, JSON.stringify(operation))
}
