import type { Submission } from '../resource/transfer-operation.ts'
import type { Evidence } from '../contracts/operation.ts'
import { walletNetwork } from './tool_validate_transfer.ts'

const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const equalHex = (a: unknown, b: unknown) =>
  typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase()
const equalQuantity = (a: unknown, b: string) =>
  typeof a === 'string' && /^0x[\da-fA-F]{1,64}$/.test(a) && BigInt(a) === BigInt(b)
export function tool_verify_transfer_evidence(
  operation: Submission,
  observation: { transaction: unknown; receipt: unknown },
): { status: 'confirmed' | 'failed'; evidence: Evidence[] } | null {
  if (!observation.transaction || !observation.receipt) return null
  const intent = operation.intent
  if (!intent || !operation.hash) throw new Error('Legacy transfer lacks verifiable intent; reconciliation is required')
  const tx = observation.transaction as Record<string, unknown>
  const receipt = observation.receipt as Record<string, unknown>
  const expected = intent.transaction
  if (
    !equalHex(tx.hash, operation.hash) ||
    !equalHex(receipt.transactionHash, operation.hash) ||
    !equalHex(tx.from, intent.sender) ||
    !equalHex(tx.to, expected.to) ||
    !equalHex(tx.input, expected.data) ||
    !equalQuantity(tx.value, expected.value) ||
    !equalQuantity(tx.chainId, `0x${intent.chainId.toString(16)}`) ||
    !equalHex(tx.blockHash, receipt.blockHash) ||
    !/^0x[\da-fA-F]{64}$/.test(String(receipt.blockHash)) ||
    !equalQuantity(tx.blockNumber, String(receipt.blockNumber)) ||
    !['0x0', '0x1'].includes(String(receipt.status))
  ) {
    throw new Error('Transaction evidence does not match the recorded intent')
  }
  if (receipt.status === '0x1' && operation.asset === 'USDC') {
    const token = walletNetwork(intent.chainId).usdc
    const logs = receipt.logs as
      | { address?: unknown; topics?: unknown[]; data?: unknown; removed?: boolean }[]
      | undefined
    const topicAddress = (address: string) => `0x${address.slice(2).toLowerCase().padStart(64, '0')}`
    if (
      !Array.isArray(logs) ||
      !logs.some(
        (log) =>
          !log.removed &&
          equalHex(log.address, token) &&
          Array.isArray(log.topics) &&
          log.topics.length === 3 &&
          equalHex(log.topics[0], transferTopic) &&
          equalHex(log.topics[1], topicAddress(intent.sender)) &&
          equalHex(log.topics[2], topicAddress(intent.recipient)) &&
          equalQuantity(log.data, `0x${BigInt(intent.units).toString(16)}`),
      )
    )
      throw new Error('The receipt does not prove the token transfer')
  }
  return {
    status: receipt.status === '0x1' ? 'confirmed' : 'failed',
    evidence: [
      { kind: 'transaction-inclusion', reference: `${operation.hash}:${receipt.blockHash}`, observedAt: Date.now() },
    ],
  }
}
