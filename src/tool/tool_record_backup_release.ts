import type { BackupReleaseOperation } from '../resource/backup-release-operation.ts'
import { backupReleaseKey } from '../resource/backup-release-operation.ts'
import { OperationIndeterminate } from '../contracts/operation.ts'
const storage = () => (typeof window === 'undefined' ? undefined : localStorage)
export function tool_record_backup_release(owner: string, proof: string, scope: string, effect: 'unlock' | 'export') {
  const store = storage()
  if (!store) return // Non-browser contract harness; production requires durable storage.
  const key = backupReleaseKey(owner, proof)
  if (store.getItem(key))
    throw new OperationIndeterminate(
      proof,
      'This one-use approval was already submitted. Reconcile it or request fresh approval with a new recipient.',
    )
  const operation: BackupReleaseOperation = {
    version: 1,
    operationId: proof,
    owner,
    scope,
    effect,
    binding: { capability: 'backup-release/v1', adapter: 'species-gateway/v1' },
    state: 'indeterminate',
    createdAt: Date.now(),
    duty: 'Verify the original bound release; do not replay this approval.',
  }
  store.setItem(key, JSON.stringify(operation))
}
export function tool_complete_backup_release(
  owner: string,
  proof: string,
  evidenceReference: string,
  state: 'completed' | 'failed' = 'completed',
) {
  const store = storage()
  if (!store) return
  const key = backupReleaseKey(owner, proof),
    raw = store.getItem(key)
  if (!raw || !evidenceReference) throw new Error('Backup release continuity is unavailable')
  const operation = JSON.parse(raw) as BackupReleaseOperation
  if (operation.operationId !== proof || operation.owner !== owner) throw new Error('Backup release binding changed')
  store.setItem(key, JSON.stringify({ ...operation, state, duty: undefined, evidenceReference }))
}
