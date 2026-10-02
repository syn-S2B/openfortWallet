import type { Wallet, WalletAccess } from '../contracts/species.ts'
import { WalletActionError, type WalletSDK, type ExportSDK } from '../contracts/wallet-session.ts'
import { assertSameWallet } from '../tool/tool_compare_wallet_identity.ts'
// Injecting the SDK/download boundaries lets tests prove that a mismatched
// account, expired handoff or disconnected session cannot produce a key file.
export async function workflow_recover_wallet_session<T extends WalletSDK, R>({
  wallet,
  getAccess,
  createSDK,
  action,
  isCurrent,
  now = () => Date.now() / 1000,
}: {
  wallet: Wallet
  getAccess: () => Promise<WalletAccess>
  createSDK: (access: WalletAccess, getToken: () => Promise<string>) => T
  action: (sdk: T, check: () => void) => Promise<R>
  isCurrent: () => boolean
  now?: () => number
}) {
  let access: WalletAccess | undefined
  let active = true
  const check = () => {
    if (!active || !isCurrent()) throw new Error('Session changed')
  }
  async function freshAccess() {
    check()
    let next: WalletAccess
    try {
      next = await getAccess()
    } catch {
      throw new WalletActionError('access')
    }
    check()
    assertSameWallet(wallet, next.wallet)
    if (
      next.auth_provider !== 'custom' ||
      !next.auth_token ||
      !next.encryption_session ||
      !next.publishable_key ||
      !next.shield_publishable_key ||
      !Number.isFinite(next.expires_at) ||
      next.expires_at <= now() + 30
    )
      throw new Error('Wallet access expired or invalid')
    if (
      access &&
      (next.publishable_key !== access.publishable_key || next.shield_publishable_key !== access.shield_publishable_key)
    )
      throw new Error('Wallet provider changed')
    return next
  }
  access = await freshAccess()
  const sdk = createSDK(access, async () => {
    check()
    if (!access || access.expires_at <= now() + 30) access = await freshAccess()
    return access.auth_token
  })
  let completed = false
  try {
    try {
      await sdk.waitForInitialization()
    } catch {
      throw new WalletActionError('initialization')
    }
    check()
    if (access.expires_at <= now() + 30) access = await freshAccess()
    let account: Awaited<ReturnType<WalletSDK['recover']>>
    try {
      account = await sdk.recover(wallet.account_ref, access.encryption_session)
    } catch (failure) {
      throw new WalletActionError('recovery', failure)
    }
    check()
    // Openfort EOAs are chain-independent and omit chainId. An explicitly
    // returned chain must still match; send separately checks the live provider
    // network and signer immediately before broadcasting.
    if (
      account.id !== wallet.account_ref ||
      account.address.toLowerCase() !== wallet.address.toLowerCase() ||
      (account.chainId != null && account.chainId !== wallet.chain_id) ||
      account.accountType !== 'Externally Owned Account'
    )
      throw new WalletActionError('identity')
    const result = await action(sdk, check)
    completed = true
    return result
  } finally {
    access = undefined
    active = false
    // Provider errors can contain credentials. Never surface or log them.
    try {
      await sdk.logout(completed)
    } catch {
      /* best-effort SDK cleanup */
    }
  }
}

export async function workflow_export_wallet_key(options: {
  wallet: Wallet
  getAccess: () => Promise<WalletAccess>
  createSDK: (access: WalletAccess, getToken: () => Promise<string>) => ExportSDK
  save: (privateKey: string, address: string) => void | Promise<void>
  isCurrent: () => boolean
  now?: () => number
}) {
  return workflow_recover_wallet_session({
    ...options,
    async action(sdk, check) {
      let key = ''
      try {
        key = await sdk.exportPrivateKey()
        check()
        if (!/^(0x)?[a-fA-F0-9]{64}$/.test(key)) throw new Error('Invalid key export')
        await options.save(key, options.wallet.address)
      } finally {
        key = ''
      }
    },
  })
}
