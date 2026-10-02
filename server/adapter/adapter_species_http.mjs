export function adapter_species_http(fetcher, url, request) {
  return fetcher(url, { ...request, redirect: 'error', signal: AbortSignal.timeout(180_000) })
}
