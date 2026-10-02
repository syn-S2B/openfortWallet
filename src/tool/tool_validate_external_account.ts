import { getAddress } from '@ethersproject/address'
import type { PhantomAccount } from '../contracts/external-wallet.ts'
export function phantomAccount(accounts: unknown, chain: unknown): PhantomAccount | null {
  if (!Array.isArray(accounts)) throw new Error('Invalid wallet response')
  if (!accounts.length) return null
  if (typeof accounts[0] !== 'string' || typeof chain !== 'string' || !/^0x[0-9a-fA-F]+$/.test(chain))
    throw new Error('Invalid wallet response')
  const address = getAddress(accounts[0]),
    chainId = Number(BigInt(chain))
  if (BigInt(address) === 0n || !Number.isSafeInteger(chainId) || chainId <= 0)
    throw new Error('Invalid wallet response')
  return { address, chainId }
}
