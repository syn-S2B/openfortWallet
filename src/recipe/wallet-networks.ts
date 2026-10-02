export const SEPOLIA = Object.freeze({
  id: 11155111,
  name: 'Sepolia testnet',
  rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
  explorer: 'https://eth-sepolia.blockscout.com',
  usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  testnet: true,
  gasAsset: 'Sepolia ETH',
})
// Circle's native USDC: https://developers.circle.com/stablecoins/usdc-contract-addresses
export const ETHEREUM = Object.freeze({
  id: 1,
  name: 'Ethereum mainnet',
  rpc: 'https://ethereum.publicnode.com',
  explorer: 'https://eth.blockscout.com',
  usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  testnet: false,
  gasAsset: 'ETH',
})
export const walletNetworkRecipeVersion = 'wallet-network/v1' as const
export const walletPollingRecipe = Object.freeze({
  version: 'wallet-polling/v1',
  observationMs: 30_000,
  receiptMs: 8_000,
  quoteLifetimeMs: 60_000,
  registrationAttempts: 60,
  registrationMs: 2000,
  authenticationMs: 2000,
  backupApprovalMs: 1500,
  backupApprovalLifetimeMs: 300_000,
})
