import type { BackupOwner, BackupRequest } from '../contracts/backup-client.ts'
export function adapter_species_backup<S extends BackupOwner>(request: BackupRequest<S>) {
  type Approval = { challenge_id: string; auth_log_id: string; status: string; authentication_status: string }
  const canonical = (value: Approval) => ({
    challenge_id: value.challenge_id,
    auth_log_id: value.auth_log_id,
    state: ['ASKED', 'PENDING'].includes(value.status)
      ? ('pending' as const)
      : value.status === 'ACCEPTED' &&
          value.authentication_status === 'AuthenticationStatusACCEPTED' &&
          value.auth_log_id
        ? ('completed' as const)
        : ('failed' as const),
  })
  return {
    configuration: <T>(path: string, session: S) => request<T>(`${path}/config`, session),
    authorize: async (note: { behavior: string; body: string }, session: S) =>
      canonical(await request<Approval>('/auth/backup-authorization', session, { note })),
    observe: async (id: string, session: S) =>
      canonical(await request<Approval>(`/auth/backup-authorization/${id}`, session)),
    release: <T>(path: string, session: S, body: unknown, proof: string) =>
      request<T>(`${path}/unlock`, session, body, { 'X-Onli-Auth-Log-Id': proof }),
    export: <T>(path: string, session: S, body: unknown, proof: string) =>
      request<T>(`${path}/download`, session, body, { 'X-Onli-Auth-Log-Id': proof }),
  }
}
