import type { OperationState } from '../contracts/operation.ts'
export type BackupReleaseOperation = {
  version: 1
  operationId: string
  owner: string
  scope: string
  effect: 'unlock' | 'export'
  binding: { capability: 'backup-release/v1'; adapter: 'species-gateway/v1' }
  state: OperationState
  createdAt: number
  duty?: string
  evidenceReference?: string
}
export function backupReleaseKey(owner: string, proof: string) {
  return `species-wallet-backup-release:${owner}:${proof}`
}
