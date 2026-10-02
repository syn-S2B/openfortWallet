import type { PhantomProvider, PhantomAccount } from '../contracts/external-wallet.ts'
import { phantomAccount } from '../tool/tool_validate_external_account.ts'
export function detectPhantom(target: { phantom?: { ethereum?: unknown } }): PhantomProvider | null {
  const provider = target.phantom?.ethereum as PhantomProvider | undefined
  return provider?.isPhantom === true && typeof provider.request === 'function' ? provider : null
}
export async function readPhantom(
  provider: PhantomProvider,
  requestPermission = false,
): Promise<PhantomAccount | null> {
  // Never request signatures, exports, token approvals or transactions to connect.
  const accounts = await provider.request({ method: requestPermission ? 'eth_requestAccounts' : 'eth_accounts' })
  const chain = await provider.request({ method: 'eth_chainId' })
  return phantomAccount(accounts, chain)
}
export function phantomError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  if (code === 4001) return 'Connection declined. You can try again whenever you’re ready.'
  if (code === -32002) return 'A connection request is already open. Check Phantom.'
  return 'Phantom could not connect. Unlock your wallet and try again.'
}
export function observePhantom(provider: PhantomProvider, changed: () => void, disconnected: () => void) {
  provider.on?.('accountsChanged', changed)
  provider.on?.('chainChanged', changed)
  provider.on?.('disconnect', disconnected)
  return () => {
    provider.removeListener?.('accountsChanged', changed)
    provider.removeListener?.('chainChanged', changed)
    provider.removeListener?.('disconnect', disconnected)
  }
}
