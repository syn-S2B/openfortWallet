export const PHANTOM_DOWNLOAD = 'https://phantom.com/download'
export const PHANTOM_BUY_USDC = 'https://phantom.com/tokens/ethereum/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
export type { PhantomAccount, PhantomProvider } from './contracts/external-wallet.ts'
export { detectPhantom, readPhantom, phantomError } from './capability/tool_capability_external_account.ts'
export { phantomAccount } from './tool/tool_validate_external_account.ts'
export function phantomNetwork(chainId: number) {
  return ({ 1: 'Ethereum', 11155111: 'Ethereum Sepolia', 8453: 'Base', 84532: 'Base Sepolia', 137: 'Polygon' } as Record<number, string>)[chainId] || `EVM network ${chainId}`
}
