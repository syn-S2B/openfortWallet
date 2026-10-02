import { createHash } from 'node:crypto'
export function configuration(env = process.env) {
  const gateway = env.SPECIES_GATEWAY_URL || ''
  const symbol = env.SPECIES_APP_SYMBOL || ''
  // Display identity is the deployment's Onli appliance, not its gateway client.
  const applianceSymbol = (env.SPECIES_APPLIANCE_SYMBOL || '').trim()
  const apiKey = env.SPECIES_API_KEY || ''
  const key = Buffer.from(env.SPECIES_ENCRYPTION_KEY || '', 'base64')
  let url
  try { url = new URL(gateway) } catch { /* reported without leaking credentials */ }
  const valid = url && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/' &&
    (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
  const bindingId = valid && symbol ? createHash('sha256').update(`species-connection/v1\0${url.origin}\0${symbol}`).digest('hex') : ''
  return { bindingId, configured: !!(valid && symbol && apiKey && key.length === 32), url: valid ? url.origin : '', symbol, applianceSymbol, apiKey, key }
}
