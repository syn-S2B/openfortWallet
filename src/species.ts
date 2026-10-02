export * from './contracts/species.ts'
import type { Session } from './contracts/species.ts'
export { request } from './capability/tool_capability_species_request.ts'
export function formatBalance(minor: number | null, scale: number): string {
  if (minor === null || !Number.isSafeInteger(minor) || !Number.isInteger(scale) || scale < 0 || scale > 12) return 'Unavailable'
  return (minor / 10 ** scale).toLocaleString('en-US', { minimumFractionDigits: scale, maximumFractionDigits: scale })
}
export function walletPath(session: Session) { return `/members/${encodeURIComponent(session.onli_id)}/wallet` }
export function readinessPath(session: Session) { return `/members/${encodeURIComponent(session.onli_id)}/readiness` }
export function operationPath(operationID: string) { return `/operations/${encodeURIComponent(operationID)}` }
