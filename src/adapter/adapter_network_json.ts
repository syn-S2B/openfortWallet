import { fail } from '../tool/tool_validate_transfer.ts'
export async function adapter_network_json(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) return fail('The network is unavailable. Please refresh and try again.')
  return response.json()
}
