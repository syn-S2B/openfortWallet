import { SpeciesError, type Session } from '../contracts/species.ts'
export async function adapter_species_transport<T>(
  path: string,
  session?: Session | null,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const response = await fetch(`/api/species${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { 'X-Onli-Session': session.token } : {}),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok || result.error) {
    throw new SpeciesError(
      result.error?.code ?? 'request_failed',
      result.error?.message ?? 'Species could not complete this request.',
      response.status,
    )
  }
  return result as T
}
