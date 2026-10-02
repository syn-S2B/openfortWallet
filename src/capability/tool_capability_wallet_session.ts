import type { WalletSessionFactory } from '../contracts/wallet-session.ts'
import { walletProviderRecipe, type WalletProviderRecipe } from '../recipe/wallet-provider.ts'
import { adapter_openfort_factory } from '../adapter/adapter_openfort.ts'
import { WalletCleanupGuard } from '../export-cleanup.ts'
import { WalletOperationUnavailable, withWalletOperation } from '../wallet-operation.ts'

/** One origin-wide operation includes the provider teardown. */
export function createWalletSessionCapability(recipe: WalletProviderRecipe = walletProviderRecipe) {
  const adapters = { 'openfort/v1': adapter_openfort_factory }
  const selected = adapters[recipe.adapter]
  if (!selected || recipe.version !== 'wallet-provider/v1' || recipe.capability !== 'recovered-wallet-session/v1')
    throw new WalletOperationUnavailable('The selected wallet provider binding is unavailable.')
  const cleanup = new WalletCleanupGuard()
  let locked = false
  async function withWalletSDK<T>(action: (factory: WalletSessionFactory) => Promise<T>) {
    if (locked) throw new WalletOperationUnavailable()
    locked = true
    try {
      return await withWalletOperation(async () => {
        cleanup.assertReady()
        const adapterFactory = await selected(cleanup)
        let active = true
        const sessions = new Set<{ logout(completed: boolean): Promise<void> }>()
        const check = () => {
          if (!active) throw new WalletOperationUnavailable('This wallet operation has ended.')
        }
        const factory: WalletSessionFactory = (access, getToken) => {
          check()
          if (sessions.size) throw new WalletOperationUnavailable()
          const adapter = adapterFactory(access, getToken)
          const session = {
            waitForInitialization: () => {
              check()
              return adapter.waitForInitialization()
            },
            recover: (...args: Parameters<typeof adapter.recover>) => {
              check()
              return adapter.recover(...args)
            },
            exportPrivateKey: () => {
              check()
              return adapter.exportPrivateKey()
            },
            sendTransfer: (...args: Parameters<typeof adapter.sendTransfer>) => {
              check()
              return adapter.sendTransfer(...args)
            },
            async logout(completed: boolean) {
              if (!sessions.has(session)) return
              try {
                await adapter.logout(completed)
              } finally {
                sessions.delete(session)
              }
            },
          }
          sessions.add(session)
          return session
        }
        try {
          return await action(factory)
        } finally {
          try {
            for (const session of sessions) await session.logout(false)
          } finally {
            active = false
          }
        }
      })
    } finally {
      locked = false
    }
  }
  return {
    withWalletSDK,
    walletSessionNeedsReload: () => cleanup.requiresReload,
    assertWalletSessionReady: () => cleanup.assertReady(),
  }
}
