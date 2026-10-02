import { tool_record_backup_release, tool_complete_backup_release } from '../tool/tool_record_backup_release.ts'
import { OperationIndeterminate } from '../contracts/operation.ts'
import { SpeciesError } from '../contracts/species.ts'
import type { BackupOwner, BackupRequest } from '../contracts/backup-client.ts'
import { adapter_species_backup } from '../adapter/adapter_species_backup.ts'
export function createBackupCapability<S extends BackupOwner>(request: BackupRequest<S>) {
  const adapter = adapter_species_backup(request)
  return {
    ...adapter,
    authorize: async (note: { behavior: string; body: string }, session: S) => adapter.authorize(note, session),
    observe: async (id: string, session: S) => adapter.observe(id, session),
    release: <T>(path: string, session: S, body: unknown, proof: string) => {
      if (!proof) throw new Error('Explicit backup approval is required')
      tool_record_backup_release(session.onli_id, proof, path, 'unlock')
      return adapter.release<T>(path, session, body, proof).catch((error) => {
        if (error instanceof SpeciesError && error.status >= 400 && error.status < 500) {
          tool_complete_backup_release(
            session.onli_id,
            proof,
            `provider-denial:${error.status}:${error.code}`,
            'failed',
          )
          throw error
        }
        throw new OperationIndeterminate(
          proof,
          'Reconcile the original backup release; any new attempt requires fresh approval and a new ephemeral recipient.',
        )
      })
    },
    export: <T>(path: string, session: S, body: unknown, proof: string) => {
      if (!proof) throw new Error('Explicit treasury export approval is required')
      tool_record_backup_release(session.onli_id, proof, path, 'export')
      return adapter.export<T>(path, session, body, proof).catch((error) => {
        if (error instanceof SpeciesError && error.status >= 400 && error.status < 500) {
          tool_complete_backup_release(
            session.onli_id,
            proof,
            `provider-denial:${error.status}:${error.code}`,
            'failed',
          )
          throw error
        }
        throw new OperationIndeterminate(
          proof,
          'Reconcile the original treasury export; any new attempt requires fresh approval, export identity and ephemeral recipient.',
        )
      })
    },
  }
}
