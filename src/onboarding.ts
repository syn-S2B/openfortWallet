import { waitForObservation } from './workflow/workflow_wait_for_authorization.ts'
export type OnboardingAction = {
  tool: string
  reason?: string
  arguments?: Record<string, string>
}

export type OnboardingJourney = {
  state?: string
  next_tool?: string
  actions?: OnboardingAction[]
}

export type RegistrationArguments = {
  idempotency_key: string
  correlation_id: string
}

export type RegistrationOperation = {
  operation_id?: string
  state?: string
  last_error?: string
  error?: string
  [key: string]: unknown
}

export type RegistrationPollOptions = {
  signal?: AbortSignal
  maxAttempts?: number
  intervalMs?: number
}

export class RegistrationOperationError extends Error {
  public code: string
  public state: string

  constructor(code: string, message: string, state = '') {
    super(message)
    this.code = code
    this.state = state
    this.name = 'RegistrationOperationError'
  }
}

export function registrationArguments(journey: OnboardingJourney | null | undefined): RegistrationArguments | null {
  const action = journey?.actions?.find(item => item.tool === 'journey_member_registration')
  const args = action?.arguments
  if (!args?.idempotency_key || !args.correlation_id) return null
  return { idempotency_key: args.idempotency_key, correlation_id: args.correlation_id }
}

export function onboardingReason(journey: OnboardingJourney | null | undefined): string {
  return journey?.actions?.find(item => item.tool === journey.next_tool)?.reason
    || journey?.actions?.[0]?.reason
    || ''
}

export function walletEnsureSelected(journey: OnboardingJourney | null | undefined): boolean {
  return journey?.next_tool === 'journey_member_wallet_ensure'
}

function operationState(operation: RegistrationOperation): string {
  return typeof operation.state === 'string' ? operation.state.toUpperCase() : ''
}

function abortError(): DOMException {
  return new DOMException('Registration polling was cancelled.', 'AbortError')
}

const successfulStates = new Set(['COMPLETED', 'SUCCEEDED', 'SUCCESS'])
const failedStates = new Set(['FAILED', 'REJECTED', 'TIMED_OUT', 'EXPIRED', 'CANCELLED'])

export async function pollRegistration(
  read: (operationID: string) => Promise<RegistrationOperation>,
  operationID: string,
  options: RegistrationPollOptions = {},
): Promise<RegistrationOperation> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 60))
  const intervalMs = Math.max(0, Math.floor(options.intervalMs ?? 2000))
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (options.signal?.aborted) throw abortError()
    const operation = await read(operationID)
    if (options.signal?.aborted) throw abortError()
    const state = operationState(operation)
    if (successfulStates.has(state)) return operation
    if (failedStates.has(state)) {
      const detail = typeof operation.last_error === 'string' ? operation.last_error
        : typeof operation.error === 'string' ? operation.error : `Registration ${state.toLowerCase()}.`
      throw new RegistrationOperationError('registration_operation_failed', detail, state)
    }
    if (attempt + 1 >= maxAttempts) {
      throw new RegistrationOperationError('registration_pending_timeout', 'Species is still setting up this member.', state)
    }
    await waitForObservation(intervalMs, options.signal)
  }
  throw new RegistrationOperationError('registration_pending_timeout', 'Species is still setting up this member.')
}
