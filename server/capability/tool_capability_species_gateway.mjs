import { refuse } from '../contracts.mjs'
import { seal, open } from '../tool/tool_gateway_envelope.mjs'
import { adapter_species_http } from '../adapter/adapter_species_http.mjs'
const messages = {
  wallet_backup_unavailable: 'Encrypted wallet files are not configured on this Species instance.',
  wallet_backup_behavior_unavailable: 'OnliYou wallet-file approval is not enabled for this owner yet.',
  wallet_backup_authorization_used: 'This approval has already been used. Request a fresh OnliYou approval.',
  wallet_backup_authorization_mismatch: 'Approve a fresh OnliYou request for this file and browser.',
  wallet_backup_owner_mismatch: 'This file belongs to another owner, wallet or Species instance.',
  wallet_backup_invalid: 'The encrypted file or browser key is invalid.',
  authorization_unanswered: 'OnliYou approval expired. Try again when you are ready.',
  member_wallet_required: 'Your member account does not have an issued wallet yet.',
  member_wallet_pending: 'The same wallet needs provider reconciliation before it can be opened.',
  member_wallet_unsupported: 'This Species instance has not enabled embedded member wallets.',
  member_wallet_access_unavailable: 'Wallet recovery is unavailable. Reconcile the issued wallet before exporting.',
  member_not_found: 'Set up your Species member account and wallet to continue.',
  owner_mismatch: 'Only the wallet belonging to this signed-in member is available.',
  session_expired: 'Your Species session expired. Disconnect and sign in again.',
  invalid_onli_session: 'Your Species session is no longer active. Disconnect and sign in again.',
  appliance_not_authorized: 'Species did not accept the configured application credentials.',
  authentication_unanswered: 'No Onli approval was received. Try signing in again.',
  authentication_retry_limit_reached: 'Onli sign-in reached its retry limit. Wait before trying again.',
}
export function createGateway(config, fetcher = fetch) {
  return async function call(method, path, session, data, extraHeaders = {}) {
    if (!config.configured) refuse(503, 'connection_required', 'Configure the Species gateway connection before signing in.')
    const headers = { Accept: 'application/json', 'X-Onli-App-Symbol': config.symbol, 'X-Species-Appliance-Key': config.apiKey, ...extraHeaders }
    if (session) headers['X-Onli-Session'] = session
    let body
    if (data !== undefined) {
      const encrypted = seal(Buffer.from(JSON.stringify(data)), config.key, method, path, config.symbol)
      body = encrypted.body; headers['X-Species-Enc-Nonce'] = encrypted.nonce; headers['Content-Type'] = 'application/octet-stream'
    }
    let response, result
    try {
      response = await adapter_species_http(fetcher, config.url + path, { method, headers, body })
      if (Number(response.headers.get('content-length')) > 2_000_000) throw new Error('oversized response')
      const reader = response.body.getReader(); const chunks = []; let length = 0
      while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > 2_000_000) { await reader.cancel(); throw new Error('oversized response') } chunks.push(Buffer.from(value)) }
      const bytes = Buffer.concat(chunks)
      const nonce = response.headers.get('X-Species-Enc-Nonce')
      // Unencrypted failures are the admission gate's contract. Successful
      // responses must prove possession of the configured encryption key.
      if (!nonce && response.ok) throw new Error('missing encrypted response')
      result = JSON.parse((nonce ? open(bytes, nonce, config.key, method, path, config.symbol) : bytes).toString('utf8'))
    } catch { refuse(502, 'gateway_unavailable', 'The Species gateway could not return an authenticated response.') }
    if (!response.ok || result.ok !== true) {
      const code = /^[a-z][a-z0-9_]{0,80}$/.test(result?.error?.code) ? result.error.code : 'gateway_refused'
      const explanation = path === '/species/v1/money/configuration' && response.status === 403
        ? 'Treasury accounts require an authorized operator session. Sign in with an administrator’s Onli identity.'
        : messages[code] || `Species refused this request (${code}).`
      refuse(response.status >= 400 ? response.status : 502, code, explanation)
    }
    return result.data
  }
}
