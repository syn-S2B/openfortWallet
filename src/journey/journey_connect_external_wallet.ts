import type { Wallet } from '../contracts/species.ts'
import { tool_compare_external_wallet } from '../tool/tool_compare_external_wallet.ts'
import type { PhantomAccount } from '../contracts/external-wallet.ts'
import { externalAccountCapability } from '../capability/tool_capability_external_account.ts'
export type ExternalWalletView = {
  account: PhantomAccount | null
  busy: boolean
  message: string
  missing: boolean
  addressMatches: boolean
  chainMatches: boolean
}
/** Own permission, observations and disposal as one outcome lifecycle. */
export function createExternalWalletJourney(
  target: { phantom?: { ethereum?: unknown } },
  changed: (view: ExternalWalletView) => void,
) {
  let disposed = false,
    revision = 0,
    pending = false
  let cleanup = () => {}
  let expected: Wallet | null = null
  let view: ExternalWalletView = {
    account: null,
    busy: false,
    message: '',
    missing: false,
    addressMatches: false,
    chainMatches: false,
  }
  const publish = (next: Partial<ExternalWalletView>) => {
    view = { ...view, ...next }
    view = { ...view, ...tool_compare_external_wallet(expected, view.account) }
    if (!disposed) changed(view)
  }
  const clear = () => {
    revision++
    cleanup()
    cleanup = () => {}
    publish({ account: null, message: 'Address cleared here. Manage trusted-app permissions in Phantom.' })
  }
  async function connect() {
    if (pending || disposed) return
    const capability = externalAccountCapability(target)
    publish({ missing: !capability, message: '' })
    if (!capability) {
      publish({ message: 'Open this page in a browser with Phantom installed, then connect.' })
      return
    }
    cleanup()
    pending = true
    publish({ busy: true })
    const sequence = ++revision
    const sync = async () => {
      const version = ++revision
      try {
        const account = await capability.read()
        if (version === revision)
          publish({ account, message: account ? '' : 'Phantom disconnected. Connect again when ready.' })
      } catch {
        if (version === revision) publish({ account: null, message: 'Unlock Phantom to refresh the connection.' })
      }
    }
    cleanup = capability.observe(
      () => {
        void sync()
      },
      () => {
        revision++
        publish({ account: null, message: 'Phantom disconnected.' })
      },
    )
    try {
      const account = await capability.read(true)
      if (sequence === revision)
        publish({ account, message: account ? '' : 'Choose an Ethereum account in Phantom and try again.' })
    } catch (error) {
      if (sequence === revision) publish({ account: null, message: capability.message(error) })
    } finally {
      pending = false
      publish({ busy: false })
    }
  }
  return {
    connect,
    compare: (wallet: Wallet | null) => {
      expected = wallet
      publish({})
    },
    clear,
    dispose: () => {
      disposed = true
      revision++
      cleanup()
    },
  }
}
