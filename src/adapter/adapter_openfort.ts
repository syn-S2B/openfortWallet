import type { WalletSessionFactory } from '../contracts/wallet-session.ts'
import type { TransferConfirmation } from '../contracts/transfer-confirmation.ts'
import { tool_verify_transfer_confirmation } from '../tool/tool_verify_transfer_confirmation.ts'
import { adapter_evm_submit } from './adapter_evm_submit.ts'
import type { Wallet } from '../contracts/species.ts'
import type { Quote } from '../contracts/wallet.ts'
import type { WalletCleanupGuard } from '../export-cleanup.ts'
import type { WalletAccess } from '../contracts/species.ts'
import { walletNetwork } from '../tool/tool_validate_transfer.ts'
import { WalletSessionStorage } from '../wallet-operation.ts'
async function waitForRemoval(element: HTMLElement | null) {
  if (!element?.isConnected) return
  await new Promise<void>((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (!element.isConnected) {
        observer.disconnect()
        clearTimeout(timeout)
        resolve()
      }
    })
    const timeout = window.setTimeout(() => {
      observer.disconnect()
      reject(new Error('Wallet cleanup incomplete; reload before trying again'))
    }, 15_000)
    observer.observe(document.documentElement, { childList: true, subtree: true })
  })
}
export async function adapter_openfort_factory(cleanup: WalletCleanupGuard): Promise<WalletSessionFactory> {
  const { Openfort, RecoveryMethod, ThirdPartyOAuthProvider } = await import('@openfort/openfort-js')
  return (access: WalletAccess, getAccessToken: () => Promise<string>) => {
    const storage = new WalletSessionStorage()
    const sdk = new Openfort({
      baseConfiguration: { publishableKey: access.publishable_key },
      shieldConfiguration: { shieldPublishableKey: access.shield_publishable_key },
      thirdPartyAuth: { provider: ThirdPartyOAuthProvider.CUSTOM, getAccessToken },
      overrides: { storage },
    })
    return {
      waitForInitialization: () => sdk.waitForInitialization(),
      recover: (account: string, encryptionSession: string) =>
        sdk.embeddedWallet.recover({
          account,
          recoveryParams: { recoveryMethod: RecoveryMethod.AUTOMATIC, encryptionSession },
        }),
      exportPrivateKey: () => sdk.embeddedWallet.exportPrivateKey(),
      async sendTransfer(
        wallet: Wallet,
        quote: Quote,
        check: () => void,
        broadcastStarted: () => void,
        confirmation: TransferConfirmation,
      ) {
        tool_verify_transfer_confirmation(wallet, quote, confirmation)
        const network = walletNetwork(access.wallet.chain_id)
        const provider = await sdk.embeddedWallet.getEthereumProvider({
          chains: { [network.id]: network.rpc },
          announceProvider: false,
        })
        return adapter_evm_submit(wallet, quote, provider, check, broadcastStarted, confirmation)
      },
      async logout(completed: boolean) {
        try {
          await cleanup.logout(
            document.getElementById('openfort-iframe'),
            () => sdk.auth.logout(),
            waitForRemoval,
            completed,
          )
        } finally {
          storage.dispose()
        }
      },
    }
  }
}
