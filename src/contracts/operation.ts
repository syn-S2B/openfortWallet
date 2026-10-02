/** Effect outcomes. A transport acknowledgment cannot establish completion. */
export type OperationState = 'unmet_requirements' | 'pending' | 'completed' | 'failed' | 'indeterminate'
export type Evidence = { kind: string; reference: string; observedAt: number }
export type Binding = { capability: string; adapter: string; recipe: string }
export type OperationResult<T> =
  | { state: 'completed'; value: T; evidence: Evidence[] }
  | { state: 'pending' | 'indeterminate'; operationId: string; duty: string; evidence: Evidence[] }
  | { state: 'unmet_requirements' | 'failed'; code: string; message: string }
export function completed<T>(value: T, evidence: Evidence[]): OperationResult<T> {
  if (!evidence.length || evidence.some((item) => !item.reference || !Number.isFinite(item.observedAt)))
    throw new Error('Completion evidence is required')
  return { state: 'completed', value, evidence }
}

export class OperationIndeterminate extends Error {
  readonly state = 'indeterminate' as const
  readonly operationId: string
  readonly duty: string
  constructor(operationId: string, duty: string) {
    super('The provider response was not confirmed. The original operation remains unresolved.')
    this.name = 'OperationIndeterminate'
    this.operationId = operationId
    this.duty = duty
  }
}
