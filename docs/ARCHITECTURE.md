# Onli v4.1 implementation and evidence report

Implemented 2 October 2026 on `codex/onli-v4-1-rewrite`. This report records the
client and local Node proxy rewrite against the supplied Onli Engineering Standard
v4.1. [The original classification and build plan](ONLI_V4_1_ANALYSIS_AND_PLAN.md)
contains the seventeen required architecture artifacts and provisional requirements.
[The machine-readable Tool contract inventory](tool-contracts.json) records 27
semantic responsibilities, source symbols, authority, resource parts, effect/result
contracts, evidence, retry duties, consumers and local test pointers.

No separate PRD was supplied. Scope derives from the existing application,
documentation and tests. The leather wallet Surface, member/admin experience,
Ethereum mainnet/Sepolia support, issued-account identity checks, canonical encrypted
backup format and upstream Species envelope remain the product contract. External
Species, Onli, Openfort and Shield services were not rewritten or certified.

## Implemented ownership and outcomes

| Journey / outcome | Workflow composition | Evidence boundary |
| --- | --- | --- |
| `journey_sign_in` / authenticated session | Authentication Capability, cancellation and challenge collection | Species accepted owner-bound session; no extra authority inferred |
| `journey_open_member_wallet` / usable member wallet | Registration observation, readiness resolution, wallet context reads | Owner-scoped wallet and server-selected readiness; backend owns issuance |
| `journey_send_transfer` / reviewed transfer execution | Prepare → review → execute; reconcile original operation | Explicit exact-quote confirmation; matching transaction and receipt inclusion |
| `journey_export_wallet_backup` / encrypted download initiation | Member recovery/export or treasury config/approved release → shared encryption/delivery | Valid encrypted file, verified wallet binding, digest and browser initiation |
| `journey_open_wallet_backup` / bounded temporary reveal | Shared scope validation, approval, protected release, decrypt and verify | File/recipient/digest/key binding and valid reveal expiration |
| `journey_connect_external_wallet` / external account comparison | Permission, account observation, context comparison and subscription teardown | Valid account/network observation; no key import or transaction signing |

Receive QR/copy, balances, activity, treasury projections, card flips and dialog
visibility are Surface calls or reads, not additional Journeys. React components
remain in the language-native flat `src/*.tsx` Surface layout; the extracted domain
units live in `journey/`, `workflow/`, `tool/`, `capability/`, `adapter/`, `resource/`,
`recipe/` and `contracts/`. Root facade modules preserve imports and compose these
owners rather than duplicating their implementation.

## Workflow contexts and shared lifecycles

| Workflow | Context selection | Shared units / private providers |
| --- | --- | --- |
| Prepare/review transfer | Wallet, asset, recipient, amount, network and fresh quote | Pure validation and exact units; chain reads/fee Capability → EVM Adapter |
| Execute transfer | Same quote plus explicit confirmation and operation identity | Confirmation Tool, durable operation fence, recovered session, submission Capability |
| Reconcile transfer | Original intent, hash and original recipe/provider binding | Observation Capability → EVM reads; exact transfer evidence Tool |
| Recover wallet session | Exact wallet identity, access renewal and protected action | Access Capability, identity Tool, isolated SDK storage and origin lock; Openfort Adapter |
| Read wallet observations | Caller selects balance/activity/receipt needs | Only requested reads execute; independent unavailable observations stay distinct |
| Observe registration | Owner, stable request keys, operation ID and Species binding | Persist-before-request, original-operation polling, bounded pending observation |
| Resolve readiness / wallet context | Session and server-directed registration/readiness requirements | Member Capability; server remains authoritative for eligibility and issuance |
| Shared backup lifecycle | Member or treasury scope; opening or export; explicit fresh approval | Authorization wait, release fence, strict binding validation, crypto and delivery |
| Resolve treasury backup | Role and current authoritative configuration | Treasury projection/config read, exact wallet/config binding Tool |

Recovered SDK sessions are shared by send and member export. The Capability holds
the origin lock through teardown, prevents retained factories/handles from being
used after scope exit and cleans abandoned handles before releasing ownership.
Member and treasury backups reuse the approval/release/decrypt lifecycle and one
export Journey. Pure wallet identity, transfer, external-account and treasury
binding operations stay outside orchestration. Provider transport, account RPC,
event subscriptions, provider errors and SDK methods belong to private Adapters.

## Resources, Recipes and service ownership

| Resource | Identity | Content | Context / truth owner |
| --- | --- | --- | --- |
| Wallet | Owner/account/wallet refs, address, chain | Custody/type/instructions | Species authoritative projection; client verifies identity |
| Registration operation | Owner, original request keys, operation ID | Observed outcome | Original Species connection binding; backend owns effect truth |
| Transfer operation | Stable operation ID, sender, recipient, chain | Exact units/payload, hash, result/evidence | Original RPC/token/network and signer bindings; chain inclusion truth |
| Backup release | Owner, proof-scoped operation identity | Effect/scope/state/evidence reference | Species release authority; durable client replay fence |
| Encrypted backup | Canonical file/wallet binding and digest | Encrypted key and wrapping metadata | Scope, recipient and expiration; server authorizes release |
| Approval / ephemeral material | Owner, behavior, proof | Temporary authorized material | One-use backend authority; browser memory only for plaintext keys |
| Observations / external account | Wallet or provider account and chain | Balance/activity/account match | Timestamp/availability; never grants authority |

Continuity records contain operation metadata, not session tokens or plaintext
keys. Browser storage is a recovery fence rather than an independent source of
server or chain authority. Backend one-use consumption remains authoritative,
including concurrent clients.

`wallet-network/v1` chooses supported chain/RPC/token/explorer settings and bounded
poll/quote timing. `wallet-provider/v1` selects the recovered-wallet-session
Capability and Openfort Adapter. Operation records pin these selections.
`species-connection/v1` binds registration to the configured origin/application.
Changing binding cannot silently substitute the provider for an unresolved effect.
Authority, canonical file bytes and completion semantics are contracts rather than
Recipe variation.

| Capability | Adapter / provider | Owning implementation |
| --- | --- | --- |
| Authentication, member, wallet projection and backup release | Species transport/auth/member/backup → local gateway | Browser Capabilities; backend authorizes owner/admin/proof |
| Recovered wallet session | Openfort → Openfort/Shield | Wallet-session Capability; origin lock and teardown |
| Chain reads/fee/submission/transfer observation | EVM RPC; Blockscout activity | Chain and observation Capabilities |
| External account permission/read | Phantom | External-account Capability and connection Journey |
| Encrypted file delivery | Browser download | Delivery Capability; initiation evidence only |
| Server gateway transport | Species HTTP → external gateway | Server Capability; envelope Tool and connection Recipe |

The local gateway retains allowlisted routes, exact-origin admission, sanitized
projections, encrypted envelope bytes/AAD and secret isolation. Its public
`/connection` response adds an opaque `binding_id`. The external backend Manager
mentioned in the integration guide is outside this repository and this rewrite.

## Completion, uncertainty and recovery

Operation contracts distinguish `unmet_requirements`, `pending`, `completed`,
`failed` and `indeterminate`. Compatibility facades translate existing UI statuses;
completion evidence is checked at the owning boundary rather than inferred from a
successful transport return.

Transfers persist exact intent and operation bindings before broadcast. Storage
failure stops execution before signing. Confirmation must match the exact reviewed
quote, wallet and chain. A returned hash means pending. Lost acknowledgment means
indeterminate; the UI cannot erase that duty and automatically submit again.
Replaying the same operation returns its existing result without another broadcast.
Reconciliation verifies transaction hash, sender, target/payload/value/chain and
matching receipt block/hash/status; USDC also requires the exact contract Transfer
event and amount. Terminal writes compare the same operation under the origin lock.

The implemented completion contract is **transfer-inclusion/v1**: matching current
transaction inclusion, not irreversible finality. No confirmation-depth or reorg
monitor is claimed. Stronger finality requires an explicit product/backend contract.
Legacy/hashless unresolved records stay blocked when evidence cannot establish the
original outcome; no recovery hash is invented and no provider switch is attempted.

Registration writes stable server-provided idempotency/correlation keys before
requesting an effect, then records its operation ID. Reload resumes the same request
or observation. Poll timeout is pending; unknown/lost responses preserve uncertainty.
A changed Species connection refuses resumption before another upstream effect.

Protected backup release requires approval and a durable one-use client fence before
the request. Ambiguous release preserves an indeterminate record and requires fresh
approval rather than reusing the proof. Explicit backend refusal is failed. Release
completion requires verified file/recipient/digest/key binding. Browser file delivery
validates the encrypted schema and records download initiation, not a disk-save claim.
Visibility/cancellation guards, expiring reveal and key-buffer cleanup remain active.

## Stack, reusable libraries and conformance gates

Validated runtime: Node **26.5.0**, npm **11.17.0**. `.nvmrc`, engines and package
manager metadata agree; lockfile pins React 18.3.1, TypeScript 5.9.3, Vite 8.3.1,
Openfort 2.6.0 and ethers 5.8. Shared engineering libraries retain canonical backup
crypto, identity checks, isolated storage, cleanup, visibility and browser locking.
React/TypeScript/Vite/ethers/crypto are implementation libraries; Openfort, RPC,
explorer, Species and Phantom are provider integrations behind Capabilities.

| Gate | Implemented check / actual evidence |
| --- | --- |
| Standalone and provider privacy | Import/artwork check; AST architecture check and rejection tests |
| Canonical contracts and ownership | Typed resource/result/confirmation contracts; validated Tool inventory |
| Tools and Adapter normalization | Transfer/binding/backup/envelope tests with explicit doubles |
| Authority before effect | Quote confirmation, owner/proof checks, persistence-before-effect tests |
| Continuity and uncertainty | Lost acknowledgment, same-operation replay, reload, changed binding and storage-failure tests |
| Reusable lifecycle | SDK scoped teardown/locking; shared backup workflow/context tests |
| Composition and Surface | Existing onboarding, chain, crypto, visibility and React UI tests |
| Foundation | Clean install, lint, new-layer format check, type check, production build, audit and license metadata check |

The architecture check resolves static and literal dynamic imports, keeps Adapters
private, blocks browser imports of server code, prevents lower-layer orchestration
and domain-to-Surface imports, and confines raw fetch and Openfort SDK use. It is a
source-level enforcement aid, not a proof of every semantic standard rule. Formatting
checks cover extracted architecture modules; existing Surface formatting is preserved.
Pinned-action Gitea CI runs the same checks; a remote Gitea runner was not exercised.

## Actual verification and remaining limits

A clean `npm ci` followed by `npm run check` passed: **137 tests, zero failures or
skips**, architecture/standalone checks, lint, format, TypeScript and Vite build.
`npm run check:security` passed the moderate-severity threshold with **nine inherited
low-severity advisories** in the pinned ethers/Openfort dependency tree. The suggested
forced remediation changes the SDK incompatibly, so it was not applied.
`npm run check:licenses` verified permitted license metadata for 220 lockfile packages;
this is metadata validation rather than legal certification. See
[verification details](VERIFICATION.md).

The local credential-free demo was checked in the browser with no console errors.
Tests use explicit provider doubles and synthetic encrypted fixtures. Real Species
sign-in/registration, Onli approval, Openfort/Shield recovery, protected key release,
external account permission and on-chain submission remain unverified. No real wallet
was issued, no real key was released and no live transaction was submitted. Backend
recovery for hashless ambiguity, stronger chain finality and deployed-service/remote
CI verification remain external integration work. This report therefore establishes
local client/proxy implementation and contract evidence, not end-to-end production
certification.
