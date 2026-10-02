import type { Asset } from '../contracts/wallet.ts'
import type { Binding, Evidence, OperationState } from '../contracts/operation.ts'

export type Submission = {
  hash?: string
  status: 'pending' | 'confirmed' | 'failed' | 'unknown'
  asset: Asset
  amount: string
  createdAt?: number
  version?: 1
  operationId?: string
  state?: OperationState
  binding?: Binding
  signerBinding?: { recipe: string; adapter: string; capability: string }
  intent?: { chainId: number; sender: string; recipient: string; units: string; transaction: Record<string, string> }
  evidence?: Evidence[]
  duty?: string
  network?: { rpc: string; usdc: string }
}
export function parseSubmission(raw: string | null): Submission | null {
  if (!raw) return null
  const value = JSON.parse(raw) as Submission
  if (
    !value ||
    !['pending', 'confirmed', 'failed', 'unknown'].includes(value.status) ||
    !['USDC', 'ETH'].includes(value.asset) ||
    typeof value.amount !== 'string' ||
    !/^(0|[1-9]\d*)(\.\d+)?$/.test(value.amount) ||
    (['pending', 'confirmed', 'failed'].includes(value.status) && !value.hash) ||
    (value.hash !== undefined && !/^0x[\da-fA-F]{64}$/.test(value.hash))
  )
    throw new Error('Invalid transfer continuity record')
  if (
    value.version !== undefined &&
    (value.version !== 1 ||
      !value.operationId ||
      !value.binding ||
      !value.intent ||
      !value.network ||
      !Number.isSafeInteger(value.intent.chainId) ||
      !/^\d+$/.test(value.intent.units) ||
      !Array.isArray(value.evidence) ||
      value.state !==
        ({ unknown: 'indeterminate', pending: 'pending', confirmed: 'completed', failed: 'failed' } as const)[
          value.status
        ] ||
      !/^0x[\da-fA-F]{40}$/.test(value.intent.sender) ||
      !/^0x[\da-fA-F]{40}$/.test(value.intent.recipient) ||
      !value.intent.transaction ||
      value.evidence.some((item) => !item.kind || !item.reference || !Number.isFinite(item.observedAt)) ||
      (['confirmed', 'failed'].includes(value.status) &&
        !value.evidence.some((item) => item.kind === 'transaction-inclusion')))
  )
    throw new Error('Invalid transfer binding')
  return value
}
