import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { configuration, createGateway, createMiddleware, open, projectJourney, projectTreasury, seal } from '../server/gateway.mjs'
const config = configuration({ SPECIES_GATEWAY_URL: 'https://gateway.example.test', SPECIES_APP_SYMBOL: 'FIXTURE', SPECIES_API_KEY: 'appk_fixture', SPECIES_ENCRYPTION_KEY: Buffer.alloc(32, 42).toString('base64') })
function response(data, method, path, status = 200) {
  const s = seal(Buffer.from(JSON.stringify(data)), config.key, method, path, config.symbol, 'response')
  return new Response(s.body, { status, headers: { 'X-Species-Enc-Nonce': s.nonce } })
}
test('real wire contract binds encryption to direction, method, escaped path and appliance', async () => {
  const call = createGateway(config, async (url, options) => {
    assert.equal(url, 'https://gateway.example.test/species/v1/members/usr-fixture/wallet/access')
    assert.equal(options.redirect, 'error'); assert.equal(options.headers['X-Onli-Session'], 'sess_fixture')
    assert.equal(options.headers['X-Species-Appliance-Key'], 'appk_fixture')
    assert.equal(open(options.body, options.headers['X-Species-Enc-Nonce'], config.key, 'POST', new URL(url).pathname, 'FIXTURE', 'request').toString(), '{}')
    assert.throws(() => open(options.body, options.headers['X-Species-Enc-Nonce'], config.key, 'GET', new URL(url).pathname, 'FIXTURE', 'request'))
    return response({ ok: true, data: { wallet: 'bound' } }, 'POST', new URL(url).pathname)
  })
  assert.deepEqual(await call('POST', '/species/v1/members/usr-fixture/wallet/access', 'sess_fixture', {}), { wallet: 'bound' })
})
test('GET requests carry both authorities and no body', async () => {
  await createGateway(config, async (_, options) => {
    assert.equal(options.body, undefined); assert.equal(options.headers['X-Onli-Session'], 'sess_member')
    return response({ ok: true, data: {} }, 'GET', '/species/v1/money/configuration')
  })('GET', '/species/v1/money/configuration', 'sess_member')
})
test('unsigned success, damaged ciphertext and redirected responses never become data', async () => {
  for (const result of [new Response('{"ok":true,"data":{}}'), new Response('corrupt', { headers: { 'X-Species-Enc-Nonce': Buffer.alloc(12).toString('base64') } })]) {
    await assert.rejects(createGateway(config, async () => result)('GET', '/species/v1/money/configuration', 's'), { code: 'gateway_unavailable' })
  }
})
test('gate refusal is readable but raw upstream errors cannot expose credentials', async () => {
  await assert.rejects(createGateway(config, async () => new Response(JSON.stringify({ error: { code: 'appliance_not_authorized', message: 'appk_secret' } }), { status: 403 }))('GET', '/species/v1/money/configuration', 's'), error => !error.message.includes('appk_secret') && error.status === 403)
})
test('treasury projection strips credential refs and never invents zero balances', () => {
  const result = projectTreasury({ denomination: { code: 'USD', minor_unit_scale: 2 }, rail_provider: { adapter: 'openfort-usdc-evm', credential_refs: { secret: 'do-not-return' } }, bank_rail: { snapshot: { accounts: { 'species:incoming': { balance_minor: 0 } } }, treasury_accounts: [{ account_id: 'species:master', balance_minor: 123, currency: 'USD', status: 'verified', observed_at: new Date().toISOString() }] } })
  assert.equal(result.accounts[0].balance_minor, null); assert.equal(result.accounts[1].balance_minor, 123)
  assert.equal(JSON.stringify(result).includes('do-not-return'), false)
})
test('older gateways with cached zeros cannot masquerade as fresh treasury reads', () => {
  const result = projectTreasury({ denomination: { minor_unit_scale: 2 }, bank_rail: { snapshot: { accounts: { 'species:incoming': { balance_minor: 0 }, 'species:master': { balance_minor: 999 } } } } })
  assert.ok(result.accounts.every(account => account.balance_minor === null))
})
test('refuses remote plaintext gateways and malformed credentials', () => {
  assert.equal(configuration({ SPECIES_GATEWAY_URL: 'http://remote.example.test', SPECIES_APP_SYMBOL: 'X', SPECIES_API_KEY: 'key', SPECIES_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64') }).configured, false)
  assert.equal(configuration({ SPECIES_GATEWAY_URL: 'https://user:secret@remote.example.test' }).url, '')
})
test('appliance display identity is independent from gateway authentication', () => {
  const separate = configuration({ SPECIES_GATEWAY_URL:'https://gateway.example.test', SPECIES_APP_SYMBOL:'TEST23', SPECIES_APPLIANCE_SYMBOL:'SYNTH', SPECIES_API_KEY:'fixture', SPECIES_ENCRYPTION_KEY:Buffer.alloc(32).toString('base64') })
  assert.equal(separate.symbol,'TEST23'); assert.equal(separate.applianceSymbol,'SYNTH')
  assert.equal(configuration({SPECIES_APP_SYMBOL:'TEST23'}).applianceSymbol,'')
})
async function withServer(fetcher, work) {
  let middleware
  const server = createServer((req, res) => middleware(req, res, () => { res.statusCode = 404; res.end() }))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port, base = `http://127.0.0.1:${port}`
  middleware = createMiddleware(config, port, fetcher)
  try { await work(base) } finally { await new Promise(resolve => server.close(resolve)) }
}
test('treasury exports forward administrator session and approval only to configured role routes', async () => {
  let calls=0
  await withServer(async (url,options) => {
    calls++; assert.equal(new URL(url).pathname,'/species/v1/money/treasury/master/wallet/backup/download')
    assert.equal(options.headers['X-Onli-Session'],'admin-fixture'); assert.equal(options.headers['X-Onli-Auth-Log-Id'],'auth-treasury')
    const body=JSON.parse(open(options.body,options.headers['X-Species-Enc-Nonce'],config.key,'POST',new URL(url).pathname,config.symbol,'request').toString())
    assert.deepEqual(body,{export_id:'export-fixture',recipient_public_key_spki:'public-fixture'})
    return response({ok:true,data:{encrypted_private_key:'ciphertext-only'}},'POST',new URL(url).pathname)
  },async base => {
    const headers={Origin:base,'Content-Type':'application/json','X-Onli-Session':'admin-fixture'}
    const path=`${base}/api/species/treasury/master/wallet/backup/download`
    assert.equal((await fetch(path,{method:'POST',headers,body:'{}'})).status,400)
    const got=await fetch(path,{method:'POST',headers:{...headers,'X-Onli-Auth-Log-Id':'auth-treasury'},body:JSON.stringify({export_id:'export-fixture',recipient_public_key_spki:'public-fixture'})})
    assert.equal(got.status,200);assert.equal(got.headers.get('cache-control'),'no-store')
    assert.deepEqual(await got.json(),{encrypted_private_key:'ciphertext-only'})
    assert.equal((await fetch(`${base}/api/species/treasury/custom/wallet/backup/config`,{headers})).status,404)
  });assert.equal(calls,1)
})
test('proxy refuses cross-origin requests, missing sessions and unlisted mutations', async () => {
  let called = 0
  await withServer(async () => { called++; throw new Error('unexpected') }, async base => {
    assert.equal((await fetch(`${base}/api/species/connection`, { headers: { Origin: 'https://evil.example' } })).status, 403)
    assert.equal((await fetch(`${base}/api/species/connection`, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403)
    assert.equal((await fetch(`${base}/api/species/treasury`)).status, 401)
    assert.equal((await fetch(`${base}/api/species/transfers`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', 'X-Onli-Session': 's' }, body: '{}' })).status, 404)
    assert.equal((await fetch(`${base}/api/species/auth/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403)
  }); assert.equal(called, 0)
})
test('self wallet forwards only the requesting member session; upstream refuses foreign owner', async () => {
  await withServer(async (url, options) => {
    assert.equal(options.headers['X-Onli-Session'], 'member-session')
    assert.equal(options.headers['X-Species-Peer-Key'], undefined)
    return response({ ok: false, error: { code: 'owner_mismatch', message: 'private provider detail' } }, 'POST', new URL(url).pathname, 403)
  }, async base => {
    const result = await fetch(`${base}/api/species/members/usr-other/wallet/access`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', 'X-Onli-Session': 'member-session' }, body: '{}' })
    assert.equal(result.status, 403); assert.equal((await result.json()).error.code, 'owner_mismatch')
    assert.equal(result.headers.get('cache-control'), 'no-store')
  })
})
test('claim travels in a header and only ACCEPTED may disclose a session', async () => {
  await withServer(async (url, options) => {
    assert.equal(new URL(url).search, ''); assert.equal(options.headers['X-Onli-Auth-Claim'], 'claim-fixture')
    return response({ ok: true, data: { status: 'ASKED', session: { token: 'must-not-leak', onli_id: 'usr-fixture' } } }, 'GET', new URL(url).pathname)
  }, async base => {
    const result = await fetch(`${base}/api/species/auth/collect`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ challenge_id: 'auth-fixture', claim_secret: 'claim-fixture' }) })
    assert.deepEqual(await result.json(), { status: 'ASKED' })
  })
})
test('accepted auth forwards only the onboarding fields needed by the client', async () => {
  await withServer(async (url, options) => {
    return response({ ok: true, data: {
      status: 'ACCEPTED',
      session: { token: 'session-member', onli_id: 'usr-fixture' },
      journey: {
        state: 'REGISTRATION_REQUIRED', next_tool: 'journey_member_registration',
        owner: 'must-not-leak', funding_target: { address: 'must-not-leak' },
        actions: [{ tool: 'journey_member_registration', reason: 'create member', arguments: { idempotency_key: 'registration-key', correlation_id: 'correlation-key', secret: 'must-not-leak' } }],
      },
    } }, 'GET', new URL(url).pathname)
  }, async base => {
    const result = await fetch(`${base}/api/species/auth/collect`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ challenge_id: 'auth-fixture', claim_secret: 'claim-fixture' }) })
    assert.deepEqual(await result.json(), {
      status: 'ACCEPTED', session: { token: 'session-member', onli_id: 'usr-fixture' },
      journey: { state: 'REGISTRATION_REQUIRED', next_tool: 'journey_member_registration', actions: [{ tool: 'journey_member_registration', reason: 'create member', arguments: { idempotency_key: 'registration-key', correlation_id: 'correlation-key' } }] },
    })
  })
  assert.deepEqual(projectJourney({ status: 'ASKED', actions: [{ tool: 'journey_member_registration', arguments: { idempotency_key: 'nope' } }] }), { actions: [{ tool: 'journey_member_registration', arguments: { idempotency_key: 'nope' } }] })
})
test('registration sends an empty encrypted body with stable server-selected headers', async () => {
  let calls = 0
  await withServer(async (url, options) => {
    calls += 1
    assert.equal(new URL(url).pathname, '/species/v1/members')
    assert.equal(options.headers['X-Onli-Session'], 'session-member')
    assert.equal(options.headers['Idempotency-Key'], 'registration-key')
    assert.equal(options.headers['X-Correlation-Id'], 'correlation-key')
    assert.equal(open(options.body, options.headers['X-Species-Enc-Nonce'], config.key, 'POST', new URL(url).pathname, config.symbol, 'request').toString(), '{}')
    return response({ ok: true, data: { operation: { operation_id: 'member-registration-fixture', state: 'PENDING' } } }, 'POST', new URL(url).pathname, 202)
  }, async base => {
    const headers = { Origin: base, 'Content-Type': 'application/json', 'X-Onli-Session': 'session-member', 'Idempotency-Key': 'registration-key', 'X-Correlation-Id': 'correlation-key' }
    const result = await fetch(`${base}/api/species/members`, { method: 'POST', headers, body: '{}' })
    assert.equal(result.status, 200); assert.deepEqual(await result.json(), { operation: { operation_id: 'member-registration-fixture', state: 'PENDING' } })
    const rejected = await fetch(`${base}/api/species/members`, { method: 'POST', headers, body: JSON.stringify({ onli_id: 'usr-other' }) })
    assert.equal(rejected.status, 400); assert.equal((await rejected.json()).error.code, 'registration_body_not_allowed')
  })
  assert.equal(calls, 1)
})
test('operations and readiness require a session and preserve upstream self-scoping', async () => {
  let calls = 0
  await withServer(async (url, options) => {
    calls += 1
    assert.equal(options.headers['X-Onli-Session'], 'session-member')
    assert.equal(new URL(url).pathname, '/species/v1/members/usr-other/readiness')
    return response({ ok: false, error: { code: 'owner_mismatch', message: 'private identity detail' } }, 'GET', new URL(url).pathname, 403)
  }, async base => {
    assert.equal((await fetch(`${base}/api/species/operations/member-registration-fixture`)).status, 401)
    const result = await fetch(`${base}/api/species/members/usr-other/readiness`, { headers: { Origin: base, 'X-Onli-Session': 'session-member' } })
    assert.equal(result.status, 403); assert.equal((await result.json()).error.code, 'owner_mismatch')
  })
  assert.equal(calls, 1)
})
test('backup unlock forwards only the explicit AuthLog header through authenticated encryption', async () => {
  await withServer(async (url, options) => {
    const path=new URL(url).pathname
    assert.equal(path,'/species/v1/members/usr-fixture/wallet/backup/unlock')
    assert.equal(options.headers['X-Onli-Auth-Log-Id'],'auth-backup')
    assert.equal(options.headers['X-Injected-Secret'],undefined)
    const body=JSON.parse(open(options.body,options.headers['X-Species-Enc-Nonce'],config.key,'POST',path,config.symbol,'request'))
    assert.deepEqual(body,{backup:{format:'species-wallet-backup'},recipient_public_key_spki:'encrypted-response-recipient'})
    return response({ok:true,data:{wrapped_key:'ciphertext-only'}},'POST',path)
  },async base=>{
    const result=await fetch(`${base}/api/species/members/usr-fixture/wallet/backup/unlock`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-Onli-Session':'session','X-Onli-Auth-Log-Id':'auth-backup','X-Injected-Secret':'must-not-forward'},body:JSON.stringify({backup:{format:'species-wallet-backup'},recipient_public_key_spki:'encrypted-response-recipient'})})
    assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store')
    assert.deepEqual(await result.json(),{wrapped_key:'ciphertext-only'})
  })
})
test('wallet approval proxy refuses unrelated behavior names and client-supplied approval status', async()=>{
 await withServer(async()=>{throw new Error('should not call provider')},async base=>{
  for (const body of [{note:{behavior:'move',body:'not allowed'}},{note:{behavior:'open-wallet-backup',body:'bound'},status:'ACCEPTED'}]) {
   const r=await fetch(`${base}/api/species/auth/backup-authorization`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-Onli-Session':'session'},body:JSON.stringify(body)})
   assert.equal(r.status,400)
  }
 })
})

test('hosted gateway accepts only its exact HTTPS host and origin', async () => {
  const origin = 'https://wallet.example.test'
  const middleware = createMiddleware(config, 8080, async () => { throw new Error('Unexpected upstream call') }, origin)
  async function request(headers) {
    let status, body
    await middleware({ url: '/api/species/connection', method: 'GET', headers }, { writeHead(code) {status=code}, end(value) {body=JSON.parse(value)} }, () => assert.fail('Unexpected next'))
    return {status,body}
  }
  assert.equal((await request({host:'wallet.example.test',origin})).status,200)
  assert.equal((await request({host:'other.example.test',origin})).status,403)
  assert.equal((await request({host:'wallet.example.test',origin:'https://other.example.test'})).status,403)
  assert.equal((await request({host:'wallet.example.test','sec-fetch-site':'cross-site'})).status,403)
  assert.throws(() => createMiddleware(config,8080,fetch,'http://wallet.example.test'))
})

test('public testnet gateway refuses mainnet wallet projection', async () => {
  const path='/species/v1/members/usr-fixture/wallet'
  const middleware=createMiddleware({...config,testnetOnly:true},8080,async () => response({ok:true,data:{account_ref:'fixture',chain_id:1}},'GET',path),'https://wallet.example.test')
  let status,body
  await middleware({url:'/api/species/members/usr-fixture/wallet',method:'GET',headers:{host:'wallet.example.test','x-onli-session':'fixture'}},{writeHead(code){status=code},end(value){body=JSON.parse(value)}},()=>assert.fail('Unexpected next'))
  assert.equal(status,409); assert.equal(body.error.code,'testnet_required')
})
