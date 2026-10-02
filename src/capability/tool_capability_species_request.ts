import type { Session } from '../contracts/species.ts'
import { adapter_species_transport } from '../adapter/adapter_species_transport.ts'
export function tool_capability_species_request<T>(
  path: string,
  session?: Session | null,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  return adapter_species_transport<T>(path, session, body, extraHeaders)
}
export const request = tool_capability_species_request
