import { request } from '../capability/tool_capability_species_request.ts'
import type { Session, Wallet, MemberReadiness, WalletAccess } from '../contracts/species.ts'
import type { RegistrationArguments, RegistrationOperation } from '../onboarding.ts'
const memberPath = (session: Session) => `/members/${encodeURIComponent(session.onli_id)}`
export const readMemberReadiness = (session: Session) =>
  request<MemberReadiness>(`${memberPath(session)}/readiness`, session)
export const readMemberWallet = (session: Session) => request<Wallet>(`${memberPath(session)}/wallet`, session)
export const ensureMemberWallet = (session: Session) => request<Wallet>(`${memberPath(session)}/wallet`, session, {})
export const startMemberRegistration = (session: Session, args: RegistrationArguments) =>
  request<{ operation?: RegistrationOperation }>(
    '/members',
    session,
    {},
    { 'Idempotency-Key': args.idempotency_key, 'X-Correlation-Id': args.correlation_id },
  )
export const readMemberRegistration = (session: Session, id: string) =>
  request<RegistrationOperation>(`/operations/${encodeURIComponent(id)}`, session)

export async function observeMemberRegistration(session: Session, id: string) {
  const value = await readMemberRegistration(session, id)
  const state = typeof value.state === 'string' ? value.state.toUpperCase() : ''
  if (['COMPLETED', 'SUCCEEDED', 'SUCCESS'].includes(state)) return { state: 'completed' as const, value }
  if (['FAILED', 'REJECTED', 'CANCELLED'].includes(state)) return { state: 'failed' as const, value }
  if (['TIMED_OUT', 'EXPIRED', 'INDETERMINATE', 'UNKNOWN', ''].includes(state))
    return { state: 'indeterminate' as const, value }
  return { state: 'pending' as const, value }
}

export const readWalletAccess = (session: Session) =>
  request<WalletAccess>(`${memberPath(session)}/wallet/access`, session, {})
export const readWalletBackupConfig = <T>(session: Session) =>
  request<T>(`${memberPath(session)}/wallet/backup/config`, session)
