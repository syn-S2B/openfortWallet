import type { TransferConfirmation } from '../contracts/transfer-confirmation.ts'
import { tool_verify_transfer_confirmation } from '../tool/tool_verify_transfer_confirmation.ts'
import type { Quote } from '../contracts/wallet.ts'
import type { Session, Wallet } from '../contracts/species.ts'
import { completed, type OperationResult } from '../contracts/operation.ts'
import { parseSubmission, type Submission } from '../resource/transfer-operation.ts'
import { createTransferOperation } from '../tool/tool_create_transfer_operation.ts'
import { withTransferLock, requireNoPendingSubmission } from '../submission-lock.ts'

type Send = (
  session: Session,
  wallet: Wallet,
  quote: Quote,
  isCurrent: () => boolean,
  broadcast: () => void,
  confirmation: TransferConfirmation,
) => Promise<string>
/** Explicit confirmation continues the reviewed intent. Never retries a broadcast. */
export async function journey_send_transfer(options: {
  confirmation: TransferConfirmation
  session: Session
  wallet: Wallet
  quote: Quote
  key: string
  storage: Pick<Storage, 'getItem' | 'setItem'>
  isCurrent: () => boolean
  send: Send
  changed: (record: Submission) => void
}): Promise<OperationResult<Submission>> {
  const { session, wallet, quote, key, storage, isCurrent, send, changed } = options
  tool_verify_transfer_confirmation(wallet, quote, options.confirmation)
  const operation = createTransferOperation(wallet, quote, options.confirmation.operationId)
  let started = false
  return withTransferLock(key, async () => {
    const previous = parseSubmission(storage.getItem(key))
    if (previous && previous.operationId && previous.operationId === operation.operationId) {
      if (JSON.stringify(previous.intent) !== JSON.stringify(operation.intent))
        throw new Error('Operation identity cannot be reused for a different intent')
      changed(previous)
      if (previous.state === 'completed') return completed(previous, previous.evidence ?? [])
      if (previous.state === 'failed')
        return { state: 'failed', code: 'transfer_reverted', message: 'This operation failed on chain.' }
      return {
        state: previous.state === 'pending' ? 'pending' : 'indeterminate',
        operationId: previous.operationId!,
        duty: previous.duty ?? operation.duty!,
        evidence: previous.evidence ?? [],
      }
    }
    requireNoPendingSubmission(storage, key)
    if (!isCurrent()) throw new Error('Session changed')
    try {
      const hash = await send(
        session,
        wallet,
        quote,
        isCurrent,
        () => {
          // Durability is required before the effect boundary; failure stops signing.
          storage.setItem(key, JSON.stringify(operation))
          started = true
          changed(operation)
        },
        options.confirmation,
      )
      if (!/^0x[\da-fA-F]{64}$/.test(hash)) throw new Error('Invalid submission evidence')
      operation.hash = hash
      operation.evidence = [{ kind: 'broadcast-reference', reference: hash, observedAt: Date.now() }]
      const pending: Submission = {
        ...operation,
        hash,
        status: 'pending',
        state: 'pending',
        evidence: [{ kind: 'broadcast-reference', reference: hash, observedAt: Date.now() }],
      }
      storage.setItem(key, JSON.stringify(pending))
      changed(pending)
      return {
        state: 'pending',
        operationId: operation.operationId!,
        duty: operation.duty!,
        evidence: pending.evidence!,
      }
    } catch (error) {
      if (!started) throw error
      // The pre-broadcast record survives a crash or failed post-broadcast write.
      changed(operation)
      return {
        state: 'indeterminate',
        operationId: operation.operationId!,
        duty: operation.duty!,
        evidence: operation.evidence!,
      }
    }
  })
}
