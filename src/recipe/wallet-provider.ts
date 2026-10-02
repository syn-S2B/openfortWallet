export type WalletProviderRecipe = {
  version: 'wallet-provider/v1'
  adapter: 'openfort/v1'
  capability: 'recovered-wallet-session/v1'
}
export const walletProviderRecipe: Readonly<WalletProviderRecipe> = Object.freeze({
  version: 'wallet-provider/v1',
  adapter: 'openfort/v1',
  capability: 'recovered-wallet-session/v1',
})
