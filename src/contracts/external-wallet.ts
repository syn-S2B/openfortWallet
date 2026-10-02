export type PhantomAccount = { address: string; chainId: number }
export type PhantomProvider = {
  isPhantom: boolean
  request(input: { method: string; params?: unknown[] }): Promise<unknown>
  on?(event: string, listener: (...args: unknown[]) => void): void
  removeListener?(event: string, listener: (...args: unknown[]) => void): void
}
