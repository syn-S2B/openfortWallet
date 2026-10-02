# Gateway contract used by this client

The browser calls `/api/species` on the local Vite origin. The Node middleware in
`server/gateway.mjs` is an explicit allowlist, not an unrestricted proxy. It is
included in both development and Vite preview. Backend authorization remains the
Species gateway's responsibility.

## Route map

Local paths below are relative to `/api/species`; upstream paths are relative to
`/species/v1`. `{self}` is the member's verified `usr-...` ID.

| Method and local path | Upstream | Purpose |
| --- | --- | --- |
| GET `/connection` | none | Sanitized local configuration; no credentials. |
| POST `/auth/start` | POST `/auth/onli/authentications` | Start with email or Onli ID. |
| POST `/auth/collect` | GET `/auth/onli/authentications/{challenge}` | Claim secret becomes `X-Onli-Auth-Claim`. |
| POST `/members` | same | Empty body; stable `Idempotency-Key` and `X-Correlation-Id`. |
| GET `/operations/{id}` | same | Owner-scoped registration outcome. |
| GET `/members/{self}/readiness` | same | Server-selected onboarding steps and funding target. |
| GET/POST `/members/{self}/wallet` | same | Read / issue or reconcile the member wallet. |
| POST `/members/{self}/wallet/access` | same | Short-lived Openfort and Shield handoff. |
| GET `/treasury` | GET `/money/configuration` | Sanitized authorized treasury projection. |
| POST `/auth/backup-authorization` | POST `/auth/onli/behavior-authorizations` | Owner approval for encrypted wallet files. |
| GET `/auth/backup-authorization/{id}` | GET `/auth/onli/behavior-authorizations/{id}` | Poll approval. |
| GET `/members/{self}/wallet/backup/config` | same | Public wrapping-key metadata. |
| POST `/members/{self}/wallet/backup/unlock` | same | Rewrap file key to ephemeral browser recipient. |
| GET `/treasury/{role}/wallet/backup/config` | GET `/money/treasury/{role}/wallet/backup/config` | Treasury wrapping-key metadata. |
| POST `/treasury/{role}/wallet/backup/download` | POST `/money/treasury/{role}/wallet/backup/download` | Administrator-authorized encrypted export. |
| POST `/treasury/{role}/wallet/backup/unlock` | POST `/money/treasury/{role}/wallet/backup/unlock` | Administrator-authorized file opening. |

The current admin UI/proxy supports `incoming`, `master` and `outgoing` roles.
It does not add a treasury-transfer endpoint. Backup mutations forward
`X-Onli-Auth-Log-Id`; unrelated request headers are not forwarded.

## Species envelope

The proxy sends `X-Onli-App-Symbol` and `X-Species-Appliance-Key`, plus
`X-Onli-Session` for authenticated operations. JSON mutation bodies use AES-256-GCM,
a fresh 12-byte nonce in `X-Species-Enc-Nonce`, and ciphertext followed by the
16-byte authentication tag as an `application/octet-stream` body.

Authenticated additional data joins `species-gateway-v1`, direction (`request`
or `response`), HTTP method, exact escaped upstream path, and application symbol
with NUL separators. Direction and path must match. GET requests carry no body.
Successful upstream responses must use the authenticated envelope and decode to
`{ ok: true, data: ... }`. Admission failures can be unencrypted error responses;
a missing response envelope never becomes a successful wallet result. Redirects
are refused. See the wire-contract tests in `tests/gateway.test.mjs`.

The browser receives direct data or `{ error: { code, message } }`, with no-store
headers. Errors are sanitized. Local POSTs require the exact loopback Origin;
cross-site requests and unlisted routes are refused.

## Wallet and access response

The wallet contains `adapter`, `account_ref`, `user_ref`, `wallet_ref`, `address`,
`network`, `chain_id`, `account_type`, `custody`, `instructions` and optional
`wallet_download_url`. A usable platform wallet has `custody: "User"` and
`account_type: "Externally Owned Account"`. The identity tuple cannot change
between wallet reads and access renewal.

The access response contains `wallet`, `publishable_key`,
`shield_publishable_key`, `auth_provider: "custom"`, `auth_token`,
`encryption_session`, and `expires_at` in Unix seconds. Never return a service
secret, plaintext project encryption share or EVM private key.

Openfort's callback is separate from this local proxy:
`POST /species/v1/auth/member-wallet/verify` on the actual gateway verifies the
wallet token supplied in `payload` and returns `{ "userId": "verified-member-id" }`.
It is wallet-token authenticated; an Appliance envelope must not prevent Openfort
from reaching it, and a successful callback must not create gateway authority.

## Registration compatibility

An accepted login can include `journey: { state, next_tool, actions }`. The client
preserves the two stable registration arguments from the
`journey_member_registration` action and sends an empty registration body. The
server returns `operation.operation_id`. After terminal success, readiness selects
the next step. The client understands `journey_member_wallet_ensure` for wallet
issuance; other steps remain requirements of the owning application.

Wallet access is not itself a trading approval or a compliance-approved payout
destination. Reading treasury requires an administrator session; choosing the admin
UI is not an authorization mechanism.

## Backup compatibility

The public key response includes `key_id` (SHA-256 of DER SPKI), `public_key_spki`,
`instance_id` and `authorization_behavior: "open-wallet-backup"`. Treasury config
also has its exact wallet and `export_behavior: "export-treasury-wallet-backup"`.
The canonical file binding, digest, authorization note and OAEP labels must match
`src/wallet-backup/crypto.ts` and `client.ts` byte for byte. These modules and their
round-trip tests are included so another implementation can reproduce the format.

## Local binding and operation continuity

The sanitized local `/connection` response adds `binding_id`: SHA-256 over the
versioned Species connection origin and application symbol. It contains no secret
and is not an authentication credential. Registration records it with the original
server-issued idempotency/correlation keys and returned operation ID. Reload resumes
that operation; a changed binding refuses continuation before another request.
Bounded polling timeout remains pending, and ambiguous responses remain unresolved.
The upstream route and encrypted envelope formats are unchanged.

Backup unlock/export records a proof-scoped operation fence before requesting key
release. The backend must still enforce owner/behavior scope and atomic one-use
consumption. Lost response must not authorize replay of that proof. Fresh approval
is required after ambiguous release; completion is established only after exact
file/recipient/digest/key binding checks. Browser persistence supplies continuity,
not backend authority. See [the implementation report](ARCHITECTURE.md).
