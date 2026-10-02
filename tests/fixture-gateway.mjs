// Standalone UI test fixture. No provider calls, signing, or real credentials.
import { createServer } from 'node:http'
import { seal, open } from '../server/gateway.mjs'
const key = Buffer.alloc(32, 42), symbol = 'WALLET_FIXTURE'
const address = digit => `0x${digit.repeat(40)}`
const sessions = new Map()
createServer(async (req, res) => {
  const chunks = []; for await (const part of req) chunks.push(part)
  let body = {}
  try { if (chunks.length) body = JSON.parse(open(Buffer.concat(chunks), req.headers['x-species-enc-nonce'], key, req.method, req.url, symbol, 'request')) } catch { res.writeHead(400).end(); return }
  const send = (status, data, error) => {
    const encrypted = seal(Buffer.from(JSON.stringify({ ok: !error, data, error })), key, req.method, req.url, symbol, 'response')
    res.writeHead(status, { 'X-Species-Enc-Nonce': encrypted.nonce }); res.end(encrypted.body)
  }
  if (req.url === '/species/v1/auth/onli/authentications' && req.method === 'POST') {
    const id = body.onli_id || (body.email?.startsWith('member') ? 'usr-member' : body.email?.startsWith('missing') ? 'usr-missing' : 'usr-operator')
    sessions.set('auth-fixture', id); return send(202, { challenge_id: 'auth-fixture', claim_secret: 'claim-fixture', status: 'ASKED' })
  }
  if (req.url === '/species/v1/auth/onli/authentications/auth-fixture') return send(200, { status: 'ACCEPTED', session: { token: `sess-${sessions.get('auth-fixture')}`, onli_id: sessions.get('auth-fixture') } })
  const owner = (req.headers['x-onli-session'] || '').replace('sess-', '')
  if (req.url === `/species/v1/members/${owner}/readiness`) return send(200, {
    onli_id: owner, ready_to_transact: false,
    funding_target: { adapter: 'openfort-usdc-evm', settlement_account: 'species:incoming', settlement_address: address('1'), denomination: 'USD', available: true },
    member_wallet: { account_ref: 'acc_fixture', user_ref: 'usr_fixture', wallet_ref: 'pla_fixture', address: address('8'), adapter: 'openfort-usdc-evm', network: 'Ethereum Sepolia · test fixture', chain_id: 11155111, custody: 'User', account_type: 'Externally Owned Account', instructions: [] },
  })
  if (req.url === '/species/v1/money/configuration') {
    if (owner !== 'usr-operator') return send(403, null, { code: 'permission_denied', message: 'Operator required' })
    return send(200, { denomination: { code: 'USD', minor_unit_scale: 2 }, rail_provider: { adapter: 'openfort-usdc-evm', network: 'Ethereum Sepolia · test fixture', chain_id: 11155111 }, bank_rail: { treasury_accounts: ['incoming','master','outgoing'].map((name, i) => ({ account_id: `species:${name}`, balance_minor: [152050, 84000000, 42800][i], address: address(String(i+1)), status: 'verified', observed_at: new Date().toISOString(), currency: 'USDC' })) } })
  }
  if (req.url === `/species/v1/members/${owner}/wallet`) {
    if (owner === 'usr-missing') return send(404, null, { code: 'member_wallet_required', message: 'Missing' })
    return send(200, { account_ref: 'acc_fixture', user_ref: 'usr_fixture', wallet_ref: 'pla_fixture', address: address('8'), adapter: 'openfort-usdc-evm', network: 'Ethereum Sepolia · test fixture', chain_id: 11155111, custody: 'User', account_type: 'Externally Owned Account', instructions: [] })
  }
  send(503, null, { code: 'fixture_no_export', message: 'Fixtures never return wallet access or private keys.' })
}).listen(5190, '127.0.0.1', () => {
  console.log('Isolated wallet UI fixture on 127.0.0.1:5190. No real accounts.')
  console.log(`SPECIES_GATEWAY_URL=http://127.0.0.1:5190 SPECIES_APP_SYMBOL=${symbol} SPECIES_API_KEY=appk_fixture SPECIES_ENCRYPTION_KEY=${key.toString('base64')} npm run dev`)
})
