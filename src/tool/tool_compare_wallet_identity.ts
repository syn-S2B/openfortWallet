import type { Wallet } from '../contracts/species.ts'
export function assertSameWallet(expected: Wallet, actual: Wallet) {
  if (
    !actual ||
    !/^0x[0-9a-fA-F]{40}$/.test(actual.address) ||
    actual.account_ref !== expected.account_ref ||
    actual.user_ref !== expected.user_ref ||
    actual.wallet_ref !== expected.wallet_ref ||
    actual.address.toLowerCase() !== expected.address.toLowerCase() ||
    actual.chain_id !== expected.chain_id ||
    !Number.isSafeInteger(actual.chain_id) ||
    actual.chain_id <= 0 ||
    actual.custody !== 'User' ||
    actual.account_type !== 'Externally Owned Account'
  ) {
    throw new Error('Wallet identity mismatch')
  }
}
