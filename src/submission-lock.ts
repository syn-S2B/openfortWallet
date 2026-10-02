import { parseSubmission } from './resource/transfer-operation.ts'
export type LockProvider = { request<T>(name: string, options: { ifAvailable: true }, action: (lock: unknown) => Promise<T>): Promise<T> }
export async function withTransferLock<T>(key: string, action: () => Promise<T>, locks: LockProvider | undefined = navigator.locks) {
  if (!locks) throw new Error('This browser cannot safely coordinate wallet sends. Use a current browser.')
  return locks.request(key, { ifAvailable: true }, async lock => {
    if (!lock) throw new Error('A transfer is already in progress in another tab.')
    return action()
  })
}
export function requireNoPendingSubmission(storage: Pick<Storage, 'getItem'>, key: string) {
  const raw = storage.getItem(key)
  if (!raw) return
  const saved = parseSubmission(raw)
  if (!saved || !['confirmed', 'failed'].includes(saved.status)) throw new Error('Check the existing transfer before sending again.')
}
