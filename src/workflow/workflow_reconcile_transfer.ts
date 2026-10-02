import type { Wallet } from '../contracts/species.ts'
import { parseSubmission, type Submission } from '../resource/transfer-operation.ts'
import { tool_capability_observe_transfer } from '../capability/tool_capability_observe_transfer.ts'
import { withTransferLock } from '../submission-lock.ts'
export async function workflow_reconcile_transfer(options: {
  wallet: Wallet
  operation: Submission
  key: string
  storage: Pick<Storage, 'getItem' | 'setItem'>
  isCurrent: () => boolean
}): Promise<Submission | null> {
  const result = await tool_capability_observe_transfer(options.wallet, options.operation)
  if (!result || !options.isCurrent()) return null
  return withTransferLock(options.key, async () => {
    if (!options.isCurrent()) return null
    const saved = parseSubmission(options.storage.getItem(options.key))
    if (
      !saved ||
      (saved.hash !== undefined && saved.hash !== options.operation.hash) ||
      saved.operationId !== options.operation.operationId ||
      JSON.stringify(saved.intent) !== JSON.stringify(options.operation.intent)
    )
      return null
    if (!['pending', 'unknown'].includes(saved.status)) return null
    const next: Submission = {
      ...saved,
      hash: options.operation.hash,
      status: result.status,
      state: result.status === 'confirmed' ? 'completed' : 'failed',
      duty: undefined,
      evidence: [...(saved.evidence ?? []), ...result.evidence],
    }
    options.storage.setItem(options.key, JSON.stringify(next))
    return next
  })
}
