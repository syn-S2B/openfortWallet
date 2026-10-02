import { refuse, GatewayError } from './contracts.mjs'
import { configuration } from './recipe/species-connection.mjs'
import { createGateway } from './capability/tool_capability_species_gateway.mjs'
export { GatewayError, configuration, createGateway }
export { seal, open } from './tool/tool_gateway_envelope.mjs'
export function projectTreasury(data) {
  const rail = data.rail_provider || {}, denomination = data.denomination || {}
  const reads = Array.isArray(data.bank_rail?.treasury_accounts) ? data.bank_rail.treasury_accounts : []
  return {
    adapter: typeof rail.adapter === 'string' ? rail.adapter : 'Species rail',
    network: typeof rail.network === 'string' ? rail.network : '', chain_id: rail.chain_id,
    checked_at: new Date().toISOString(),
    accounts: ['Incoming', 'Master', 'Outgoing'].map(name => {
      const id = `species:${name.toLowerCase()}`, account = reads.find(value => value.account_id === id)
      const scale = denomination.minor_unit_scale
      return { id, name, balance_minor: account?.status === 'verified' && account.observed_at && Number.isSafeInteger(account.balance_minor) && Number.isInteger(scale) ? account.balance_minor : null,
        scale: Number.isInteger(scale) ? scale : 2, currency: account?.currency || denomination.code || '',
        address: typeof account?.address === 'string' ? account.address : undefined }
    }),
  }
}
function publicJourneyAction(action) {
  if (!action || typeof action !== 'object' || typeof action.tool !== 'string' || !action.tool) return null
  const result = { tool: action.tool }
  if (typeof action.reason === 'string' && action.reason) result.reason = action.reason
  // The registration journey's two stable values are the only arguments the
  // browser needs. Provider handoff arguments and account references stay in
  // the authenticated Species response.
  if (action.tool === 'journey_member_registration' && action.arguments && typeof action.arguments === 'object') {
    const args = {}
    for (const key of ['idempotency_key', 'correlation_id']) {
      if (typeof action.arguments[key] === 'string' && action.arguments[key]) args[key] = action.arguments[key]
    }
    if (Object.keys(args).length) result.arguments = args
  }
  return result
}
export function projectJourney(journey) {
  if (!journey || typeof journey !== 'object') return undefined
  const result = {}
  if (typeof journey.state === 'string' && journey.state) result.state = journey.state
  if (typeof journey.next_tool === 'string' && journey.next_tool) result.next_tool = journey.next_tool
  if (Array.isArray(journey.actions)) {
    const actions = journey.actions.map(publicJourneyAction).filter(Boolean)
    if (actions.length) result.actions = actions
  }
  return Object.keys(result).length ? result : undefined
}
async function readJSON(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) refuse(415, 'json_required', 'JSON is required.')
  const chunks = []; let size = 0
  for await (const chunk of req) { size += chunk.length; if (size > 8192) refuse(413, 'body_too_large', 'Request is too large.'); chunks.push(chunk) }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return value }
  catch { refuse(400, 'invalid_json', 'Request must be a JSON object.') }
}
export function createMiddleware(config, port = 5175, fetcher = fetch) {
  const call = createGateway(config, fetcher)
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/species')) return next()
    const write = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)) }
    try {
      const host = req.headers.host
      if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(host) ||
          (req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site' ||
          (req.method === 'POST' && req.headers.origin !== `http://${host}`)) refuse(403, 'origin_refused', 'Use the local wallet application.')
      const path = req.url.slice('/api/species'.length)
      if (path === '/connection' && req.method === 'GET') return write(200, { configured: config.configured, gateway_url: config.url, binding_id: config.bindingId, appliance_symbol: config.applianceSymbol,
        message: config.configured ? 'Connected application configuration.' : 'Set the gateway URL and application credentials in your external environment file, then restart the wallet app. See this app’s README.' })
      if (path === '/auth/start' && req.method === 'POST') {
        const body = await readJSON(req)
        const selector = typeof body.email === 'string' ? { email: body.email.trim() } : { onli_id: String(body.onli_id || '').trim() }
        if (!Object.values(selector)[0] || Object.values(selector)[0].length > 254) refuse(400, 'identity_required', 'Enter your Onli email or ID.')
        const auth = await call('POST', '/species/v1/auth/onli/authentications', '', selector)
        return write(200, { challenge_id: auth.challenge_id, claim_secret: auth.claim_secret, status: auth.status })
      }
      if (path === '/auth/collect' && req.method === 'POST') {
        const body = await readJSON(req)
        if (!/^[a-zA-Z0-9_-]{1,200}$/.test(body.challenge_id) || typeof body.claim_secret !== 'string' || !body.claim_secret || body.claim_secret.length > 500) refuse(400, 'claim_required', 'Start a sign-in first.')
        const auth = await call('GET', `/species/v1/auth/onli/authentications/${body.challenge_id}`, '', undefined, { 'X-Onli-Auth-Claim': body.claim_secret })
        const accepted = auth.status === 'ACCEPTED' && auth.session?.token && auth.session?.onli_id
        const journey = accepted ? projectJourney(auth.journey) : undefined
        return write(200, { status: auth.status, ...(accepted ? { session: { token: auth.session.token, onli_id: auth.session.onli_id } } : {}), ...(journey ? { journey } : {}) })
      }
      const session = req.headers['x-onli-session']
      if (typeof session !== 'string' || !session.trim()) refuse(401, 'session_required', 'Sign in with Onli first.')
      if (path === '/auth/backup-authorization' && req.method === 'POST') {
        const body = await readJSON(req)
        if (Object.keys(body).length !== 1 || !['open-wallet-backup', 'export-treasury-wallet-backup'].includes(body.note?.behavior) || typeof body.note?.body !== 'string' || body.note.body.length > 1024 || Object.keys(body.note).length !== 2) refuse(400, 'invalid_backup_authorization', 'A wallet-file approval note is required.')
        return write(200, await call('POST', '/species/v1/auth/onli/behavior-authorizations', session, body))
      }
      const authorization = /^\/auth\/backup-authorization\/([a-zA-Z0-9_-]{1,200})$/.exec(path)
      if (authorization && req.method === 'GET') return write(200, await call('GET', `/species/v1/auth/onli/behavior-authorizations/${authorization[1]}`, session))
      const backup = /^\/members\/(usr-[a-zA-Z0-9_-]+)\/wallet\/backup\/(config|unlock)$/.exec(path)
      if (backup && backup[2] === 'config' && req.method === 'GET') return write(200, await call('GET', `/species/v1${path}`, session))
      if (backup && backup[2] === 'unlock' && req.method === 'POST') {
        const body = await readJSON(req), authLog = req.headers['x-onli-auth-log-id']
        if (typeof authLog !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(authLog)) refuse(400, 'authorization_required', 'Approve opening this file in OnliYou first.')
        return write(200, await call('POST', `/species/v1${path}`, session, body, { 'X-Onli-Auth-Log-Id': authLog }))
      }
      if (path === '/treasury' && req.method === 'GET') return write(200, projectTreasury(await call('GET', '/species/v1/money/configuration', session)))
      const treasuryBackup = /^\/treasury\/(incoming|master|outgoing)\/wallet\/backup\/(config|download|unlock)$/.exec(path)
      if (treasuryBackup) {
        const upstream = `/species/v1/money${path}`
        if (treasuryBackup[2] === 'config' && req.method === 'GET') return write(200, await call('GET', upstream, session))
        if (['download', 'unlock'].includes(treasuryBackup[2]) && req.method === 'POST') {
          const body = await readJSON(req), authLog = req.headers['x-onli-auth-log-id']
          if (typeof authLog !== 'string' || !/^[a-zA-Z0-9_-]{1,200}$/.test(authLog)) refuse(400, 'authorization_required', 'Approve this wallet request in OnliYou first.')
          return write(200, await call('POST', upstream, session, body, { 'X-Onli-Auth-Log-Id': authLog }))
        }
      }
      if (path === '/members' && req.method === 'POST') {
        const body = await readJSON(req)
        if (Object.keys(body).length) refuse(400, 'registration_body_not_allowed', 'Registration identity comes from the authenticated session; send an empty object.')
        const idempotencyKey = req.headers['idempotency-key']
        const correlationID = req.headers['x-correlation-id']
        if (typeof idempotencyKey !== 'string' || !idempotencyKey || idempotencyKey.length > 200) refuse(400, 'missing_idempotency_key', 'Registration needs a stable Idempotency-Key.')
        if (typeof correlationID !== 'string' || !correlationID || correlationID.length > 200) refuse(400, 'missing_correlation_id', 'Registration needs a stable X-Correlation-Id.')
        return write(200, await call('POST', '/species/v1/members', session, {}, { 'Idempotency-Key': idempotencyKey, 'X-Correlation-Id': correlationID }))
      }
      const operation = /^\/operations\/([a-zA-Z0-9_-]{1,200})$/.exec(path)
      if (operation && req.method === 'GET') return write(200, await call('GET', `/species/v1/operations/${operation[1]}`, session))
      const readiness = /^\/members\/(usr-[a-zA-Z0-9_-]+)\/readiness$/.exec(path)
      if (readiness && req.method === 'GET') return write(200, await call('GET', `/species/v1/members/${readiness[1]}/readiness`, session))
      const wallet = /^\/members\/(usr-[a-zA-Z0-9_-]+)\/wallet(\/access)?$/.exec(path)
      if (wallet && (req.method === 'POST' || (req.method === 'GET' && !wallet[2]))) {
        if (req.method === 'POST') { const body = await readJSON(req); if (Object.keys(body).length) refuse(400, 'body_not_empty', 'This operation has no input fields.') }
        return write(200, await call(req.method, `/species/v1${path}`, session, req.method === 'POST' ? {} : undefined))
      }
      refuse(404, 'not_found', 'No wallet operation matches this request.')
    } catch (error) {
      write(error instanceof GatewayError ? error.status : 502, { error: { code: error instanceof GatewayError ? error.code : 'connection_failed', message: error instanceof GatewayError ? error.message : 'The Species connection failed.' } })
    }
  }
}
