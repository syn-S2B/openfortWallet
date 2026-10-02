import type { Wallet, WalletAccess } from './species.ts'
import type { Quote } from './wallet.ts'
import type { TransferConfirmation } from './transfer-confirmation.ts'
export type WalletSDK = {
  waitForInitialization(): Promise<unknown>
  recover(
    account: string,
    encryptionSession: string,
  ): Promise<{ id: string; address: string; chainId?: number; accountType?: string }>
  logout(exportCompleted: boolean): Promise<unknown>
}
export type ExportSDK = WalletSDK & { exportPrivateKey(): Promise<string> }
/** Canonical scoped operations; provider handles remain private. */
export type RecoveredWalletSession = ExportSDK & {
  sendTransfer(
    wallet: Wallet,
    quote: Quote,
    check: () => void,
    broadcastStarted: () => void,
    confirmation: TransferConfirmation,
  ): Promise<string>
}
export type WalletSessionFactory = (
  access: WalletAccess,
  getAccessToken: () => Promise<string>,
) => RecoveredWalletSession
export class WalletActionError extends Error {
  readonly diagnostic: { stage: string; kind: string }
  constructor(stage: 'access' | 'initialization' | 'recovery' | 'identity', failure?: unknown) {
    // Keep only allowlisted classifications. Provider messages, responses and
    // causes may contain credentials and must never reach the UI or logs.
    const kind =
      failure &&
      typeof failure === 'object' &&
      'name' in failure &&
      [
        'IframeHandshakeTimeoutError',
        'IframeRpcTimeoutError',
        'IframeConnectionDestroyedError',
        'SessionEndedBeforeSetupError',
        'SessionError',
        'AuthenticationError',
        'RecoveryError',
        'RequestError',
      ].includes(String(failure.name))
        ? String(failure.name)
        : 'unclassified'
    const messages = {
      access: 'Wallet access could not be renewed. Sign in again before retrying.',
      initialization: 'Your wallet could not start. Reload the app and sign in again.',
      recovery: 'Your wallet could not reconnect. Nothing was sent. Reload the app and sign in again.',
      identity: 'The recovered wallet does not match your platform wallet. Nothing was sent.',
    }
    super(messages[stage])
    this.diagnostic = { stage, kind }
  }
}
