import { getAddress } from '@ethersproject/address'
import type { Wallet } from '../contracts/species.ts'
import type { Asset, Quote } from '../contracts/wallet.ts'
import { ETHEREUM, SEPOLIA, walletPollingRecipe } from '../recipe/wallet-networks.ts'
export class WalletError extends Error {}
export const fail = (message: string): never => {
  throw new WalletError(message)
}
export const hex = (value: bigint) => `0x${value.toString(16)}`
export const decimals = (asset: Asset) => (asset === 'USDC' ? 6 : 18)

export function findWalletNetwork(chainID: number) {
  if (chainID === ETHEREUM.id) return ETHEREUM
  if (chainID === SEPOLIA.id) return SEPOLIA
}
export function walletNetwork(chainID: number) {
  return findWalletNetwork(chainID) ?? fail('This wallet network is not supported. Sending is disabled.')
}
export function assertNetwork(wallet: Wallet) {
  const network = walletNetwork(wallet.chain_id)
  if (wallet.custody !== 'User' || wallet.account_type !== 'Externally Owned Account')
    fail('This is not a supported platform wallet.')
  address(wallet.address)
  return network
}
export function address(value: string) {
  try {
    const result = getAddress(value.trim())
    if (BigInt(result) === 0n) throw new Error()
    return result
  } catch {
    return fail('Enter a valid EVM address. Check the full address and capitalization.')
  }
}
export function parseAmount(value: string, asset: Asset): bigint {
  const places = decimals(asset),
    input = value.trim()
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(input) || input.length > 90)
    return fail('Enter a positive amount without commas or exponents.')
  const [whole, fraction = ''] = input.split('.')
  if (fraction.length > places) return fail(`${asset} supports up to ${places} decimal places.`)
  const result = BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, '0'))
  if (result <= 0n || result >= 2n ** 256n) return fail('Enter a positive amount within the token limit.')
  return result
}
export function formatUnits(value: bigint, asset: Asset, displayPlaces = decimals(asset)) {
  const places = decimals(asset),
    digits = value.toString().padStart(places + 1, '0')
  const whole = digits.slice(0, -places),
    fraction = digits.slice(-places).slice(0, displayPlaces).replace(/0+$/, '')
  if (value > 0n && whole === '0' && !fraction && displayPlaces < places) return `<0.${'0'.repeat(displayPlaces - 1)}1`
  return fraction ? `${whole}.${fraction}` : whole
}
export function quantity(value: unknown): bigint {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{1,64}$/.test(value))
    return fail('The network returned an invalid balance or fee.')
  return BigInt(value)
}
export function assertQuote(wallet: Wallet, quote: Quote, now = Date.now()) {
  assertNetwork(wallet)
  if (quote.chainId !== wallet.chain_id || quote.walletAddress.toLowerCase() !== wallet.address.toLowerCase())
    fail('The wallet changed. Review the transfer again.')
  const network = walletNetwork(wallet.chain_id)
  const recipient = address(quote.recipient)
  if (
    !['ETH', 'USDC'].includes(quote.asset) ||
    quote.units <= 0n ||
    quote.units >= 2n ** 256n ||
    quote.fee <= 0n ||
    !Number.isFinite(quote.createdAt)
  )
    fail('Invalid transfer review.')
  const tx = quote.transaction
  const expectedData =
    quote.asset === 'USDC'
      ? `0xa9059cbb${recipient.slice(2).toLowerCase().padStart(64, '0')}${quote.units.toString(16).padStart(64, '0')}`
      : '0x'
  if (
    recipient.toLowerCase() === wallet.address.toLowerCase() ||
    recipient.toLowerCase() === network.usdc.toLowerCase() ||
    tx.from?.toLowerCase() !== wallet.address.toLowerCase() ||
    tx.to?.toLowerCase() !== (quote.asset === 'USDC' ? network.usdc : recipient).toLowerCase() ||
    tx.data !== expectedData ||
    tx.chainId !== hex(BigInt(wallet.chain_id)) ||
    tx.value !== (quote.asset === 'ETH' ? hex(quote.units) : '0x0') ||
    tx.type !== '0x2' ||
    quantity(tx.gas) * quantity(tx.maxFeePerGas) !== quote.fee ||
    quantity(tx.maxPriorityFeePerGas) > quantity(tx.maxFeePerGas)
  )
    fail('The reviewed transaction changed. Review the transfer again.')
  if (now - quote.createdAt > walletPollingRecipe.quoteLifetimeMs || now < quote.createdAt)
    fail('The fee estimate expired. Review the transfer again.')
}
