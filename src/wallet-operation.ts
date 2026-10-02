import type { LockProvider } from './submission-lock'

export class WalletOperationUnavailable extends Error {
  constructor(message = 'Another wallet operation is in progress. Wait for it to finish in the other wallet window, then try again.') {
    super(message)
  }
}

// All SDK users on this origin share the provider's browser state. Keep this
// lock through logout/iframe cleanup, in addition to each wallet's send lock.
export async function withWalletOperation<T>(action: () => Promise<T>, locks: LockProvider | undefined = navigator.locks) {
  if (!locks) throw new WalletOperationUnavailable('This browser cannot safely coordinate wallet operations. Use a current browser.')
  return locks.request('species:openfort-sdk', { ifAvailable: true }, async lock => {
    if (!lock) throw new WalletOperationUnavailable()
    return action()
  })
}

// The SDK's auth/account cache belongs to one operation, never localStorage.
// Disposal also rejects writes from late SDK work after that operation ends.
export class WalletSessionStorage {
  private values = new Map<string, string>()
  private disposed = false
  async get(key: string): Promise<string | null> { return this.values.get(key) ?? null }
  save(key: string, value: string) { if (!this.disposed) this.values.set(key, value) }
  remove(key: string) { this.values.delete(key) }
  flush() { this.values.clear() }
  dispose() { this.disposed = true; this.flush() }
}
