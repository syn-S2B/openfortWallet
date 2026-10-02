export type Asset = 'USDC' | 'ETH'
export type Balances = { usdc: bigint; eth: bigint; checkedAt: number }
export type Activity = {
  hash: string
  asset: Asset
  amount: string
  direction: 'sent' | 'received'
  status: 'confirmed' | 'failed' | 'pending'
  timestamp: string
  peer: string
}
export type RPC = (method: string, params: unknown[]) => Promise<unknown>
export type Quote = {
  walletAddress: string
  chainId: number
  recipient: string
  asset: Asset
  units: bigint
  fee: bigint
  createdAt: number
  transaction: Record<string, string>
}
