// Openfort logout can start an unawaited iframe teardown. A failed recovery
// may have persisted account state without a live iframe to observe; in that
// case only a page reload guarantees that its asynchronous work has stopped.
export class WalletReloadRequired extends Error {
  constructor() { super('Reload the app and sign in again to reset your wallet session. Nothing was sent.') }
}
export class WalletCleanupGuard {
  private reloadRequired = false
  get requiresReload() { return this.reloadRequired }

  assertReady() {
    if (this.reloadRequired) throw new WalletReloadRequired()
  }

  async logout<Frame extends { readonly isConnected: boolean }>(
    frame: Frame | null,
    logout: () => Promise<void>,
    waitForRemoval: (frame: Frame) => Promise<void>,
    exportCompleted: boolean,
  ) {
    // Failed managers can replace an existing iframe during logout, so its
    // removal alone cannot prove that a failed session finished teardown.
    if (!exportCompleted || !frame?.isConnected) this.reloadRequired = true
    try {
      await logout()
      if (frame) await waitForRemoval(frame)
    } catch {
      this.reloadRequired = true
    }
  }
}
