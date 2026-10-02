# Wallet architecture analysis and rewrite plan

Status: original pre-implementation classification. The user subsequently authorized execution.
See [the implementation and evidence report](ARCHITECTURE.md) for the resulting architecture and verified limits.
Date: 2 October 2026.
Reference: Onli PRD-to-Architecture Engineering Standard v4.1, supplied by the user.

## 1. Scope and evidence

The request is to bring the existing wallet into conformance, beginning with analysis and planning. The standard is the target methodology; its embedded directives do not independently authorize deployments, backend changes, new infrastructure, or changes to product scope.

No separate PRD was supplied. Provisional requirements come from README.md, docs/GATEWAY_CONTRACT.md, the implementation, and its tests. Confirm these requirements before accepting final classification. Preserve the existing leather wallet UI, member/admin experiences, supported Ethereum networks, exact issued-account recovery, encrypted backup format, proxy wire contract, and credential-free demo unless a product decision changes them.

Reviewed: App.tsx, usePersonalWallet.ts, wallet-chain.ts, send-wallet.ts, wallet-sdk.ts, export-core.ts, export-wallet.ts, onboarding.ts, submission-lock.ts, wallet-operation.ts, PhantomConnect.tsx, phantom.ts, backup-client.ts, wallet-backup/client.ts, server/gateway.mjs, server/configuration.mjs, gateway/verification documentation, package scripts, and test inventory. Crypto implementation details require a dedicated contract audit during migration; this analysis does not certify cryptographic security.

Baseline actually run: npm ci; npm run check. Standalone imports/assets passed; 111 tests passed, zero failed/skipped; TypeScript and Vite production build passed. Gateway tests needed permission to bind local HTTP listeners. Runtime used: Node 26.5.0, npm 11.17.0. No live Species authentication, Openfort recovery, Onli approval, real backup release, or on-chain transfer was verified.

No .codegraph directory exists. CodeGraph indexing was therefore skipped.

## 2. Current conformance assessment

| Area | Evidence and assessment | Rewrite action |
|---|---|---|
| Surface boundary | App.tsx sequences authentication, registration, readiness and issuance. usePersonalWallet.ts sequences review, submission, persistence and reconciliation. PhantomConnect.tsx owns provider lifecycle. | Extract outcome and reusable orchestration owners; React subscribes to results and handles presentation. |
| Reuse | runWalletAction already shares access renewal, recovery, identity verification and cleanup between export and send. Backup client shares member/treasury opening. | Preserve these lifecycles; reclassify rather than replace with thin wrappers. |
| Capability boundary | wallet-sdk.ts translates Openfort but consumers depend on SDK factories and provider methods. wallet-chain.ts mixes canonical validation, RPC, explorer translation and network definitions. | Separate provider-independent contracts from Openfort/EVM/explorer adapters. |
| Canonical results | Registration, authentication, transfers and backups use different status/error representations; pending timeout becomes an exception. | Shared discriminated result model; preserve pending and indeterminate distinctly. |
| Evidence | Recovery verifies account identity; sends check signer/network; receiptStatus checks receipt status; gateway rejects unauthenticated successful envelopes. | Retain evidence checks and declare their exact completion scope. Define stronger transfer verification/finality contract. |
| Continuity | Transfer guard persists amount/status/hash/time, but lacks full operation identity and binding snapshot. acknowledgeUnknown removes it; aged pending can also be cleared. | Reconcile before replacement; acknowledgment must not erase unresolved duty. |
| Registration continuity | Stable server-issued idempotency/correlation headers are reused in-memory. Operation ID is local to setupMember. | Preserve server ownership; recover the same operation across interruptions where required by contract. |
| Recipes | Network/RPC/explorer/token settings and timing thresholds are code constants. Demo isolation and explicit external environment loading already exist. | Version permitted configuration; pin operation bindings; keep security invariants in contracts. |
| Resources | Wallet identity tuple is checked, but response models and state are spread across modules. Onboarding types are duplicated. | Define shared resource schemas and authoritative owners; keep observations distinct from requirements. |
| Authority | Species enforces member/admin access and backup approval. UI selection does not grant admin. SDK handoff is not trading approval. | Preserve external authority; declare effect-specific proofs at capability/tool boundaries. |
| Ownership | Flat filenames mix responsibility and technology. README references a backend Manager; backend source is absent. | Explicit ownership map. Do not claim external Manager elimination in this client rewrite. |
| Foundation | Dependencies and lockfile are pinned; .nvmrc selects 24 while engines permit >=22.18. No .github CI directory found; check currently covers imports/tests/build. | Resolve supported runtime matrix; add CI, lint/format, architecture and security/license checks. |

Recommendation: perform an incremental architectural rewrite with the existing behavior and tests as a reference. A file-renaming exercise will not establish conformance. A simultaneous replacement of all behavior would discard useful proof and make regressions harder to isolate.

## 3. Extracted facts and outcome inventory

Actors: member, treasury operator, approving Onli identity, Species gateway, Openfort/Shield, blockchain RPC, explorer, external wallet, browser.

Outcomes: signed-in session; usable existing/issued member wallet; reviewed transfer and verified transfer outcome; encrypted member backup download initiated; approved temporary opening of an encrypted backup; authorized treasury backup download initiated; external-wallet identity comparison.

Resources: session, authentication challenge, registration operation, readiness requirements, wallet identity, balance/activity observations, transfer intent/quote/operation/evidence, backup file/config, approval proof, temporary key material, treasury projection, recipe binding, external account.

Conditions: authenticated owner, eligible readiness, exact wallet/account/network binding, supported chain, valid destination/amount, fresh quote, available funds/gas, explicit transfer confirmation, safe operation lock, fresh scoped backup approval, valid file/recipient binding and expiration.

Variation: member/treasury backup scope, chain, destination kind, provider bindings, polling schedules, environment/demo mode, observed provider state. Changing authority, key-release semantics, canonical backup bytes, token identity, or completion guarantees requires contract review rather than casual configuration editing.

## 4. Journey inventory

All entries are client-owned outcome orchestration; the backend retains its own authoritative Journeys. An endpoint with a backend Journey label does not make a matching client endpoint a Journey.

| Proposed Journey | Caller / outcome / start | Workflows and branches | Completion evidence and recovery |
|---|---|---|---|
| journey_sign_in | Member/operator obtains a Species session; local connection ready | Authorize identity; accepted/pending/declined/expired paths | Valid owner-bound session returned by Species; resume challenge where permitted, otherwise request a new challenge. No authority inferred beyond session scope. |
| journey_open_member_wallet | Member obtains usable platform wallet; signed in | Resolve readiness, register if selected, ensure/reconcile wallet, read authoritative wallet | Owner-scoped canonical wallet identity and supported access prerequisites; backend owns issuance recovery; client resumes same operation. SDK recovery occurs only when a protected action needs it. |
| journey_send_transfer | Member completes confirmed transfer intent; wallet/session available | Validate context, prepare quote, await explicit confirmation, execute transfer, reconcile | Evidence matching sender/chain/destination/value/asset and agreed finality; unresolved operation remains pending/indeterminate. No replacement broadcast on unknown response. |
| journey_export_wallet_backup | Member/authorized operator obtains encrypted export; wallet selected | Validate context, member recovery/export or treasury approved key release, create encrypted file, deliver file | Valid encrypted artifact plus browser download initiation. Browser cannot prove filesystem save; never label it saved. Outcome-level retry respects one-use approval and release semantics. |
| journey_open_wallet_backup | Owner/operator temporarily opens correct encrypted file; selected file and scope | Validate binding, scoped approval, release wrapping material, decrypt/verify, bounded reveal | Verified key/address binding and valid release expiration; clear reveal on timeout/context change. No claim that manual external import completed. |
| journey_connect_external_wallet | User compares external account with platform wallet | Resolve provider, request account permission, observe account/network, compare identity | Account/network observation and explicit match result; listen for changes, clean subscriptions. Never import or sign as part of connection. |

Not separate Journeys: Receive address/QR display, balance refresh, activity refresh, treasury read, connection configuration read, card flip, wallet modal opening, sign-out button. Reads expose approved Workflows; local UI actions remain presentation. Session revocation, if added, needs an explicit backend contract.

## 5. Surface-call inventory

| Surface | Architectural exposure |
|---|---|
| Sign-in form; /auth/start and /auth/collect | journey_sign_in |
| Setup/reconcile buttons; /members, /operations/{id}, readiness and wallet GET/POST | journey_open_member_wallet |
| Send review/confirm/status | journey_send_transfer; explicit review/confirmation continuation |
| Member export and treasury export buttons | journey_export_wallet_backup with scoped context |
| Backup file picker/open/reveal | journey_open_wallet_backup; file selection and reveal rendering stay Surface |
| Phantom connect / account-change events | journey_connect_external_wallet |
| Balances, activity, Incoming target and treasury refresh | Approved read Workflows |
| /wallet/access and backup config/unlock/download/auth routes | Internal capability transports, not public client Journeys |
| /connection | Sanitized local configuration exposure |

Retain current external HTTP routes during migration. Internal architecture names need not change the wire protocol.

## 6. Journey → Workflow matrix

SI=sign in; OW=open wallet; ST=send transfer; EB=export backup; OB=open backup; EW=external wallet.

| Workflow | SI | OW | ST | EB | OB | EW |
|---|---|---|---|---|---|---|
| workflow_validate_context | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| workflow_authorize_action | ✓ | | | treasury | ✓ | |
| workflow_resolve_member_readiness | | ✓ | Incoming target | | | |
| workflow_register_member | | conditional | | | | |
| workflow_ensure_member_wallet | | ✓ | | | | |
| workflow_recover_wallet_session | | | ✓ | member | | |
| workflow_prepare_transfer | | | ✓ | | | |
| workflow_execute_transfer | | | ✓ | | | |
| workflow_reconcile_transfer | | | ✓ | | | |
| workflow_create_wallet_backup | | | | ✓ | | |
| workflow_open_wallet_backup | | | | | ✓ | |
| workflow_deliver_encrypted_file | | | | ✓ | | |
| workflow_observe_external_account | | | | | | ✓ |

Read Workflows: workflow_read_wallet_observations (balances/activity selected by context), workflow_read_treasury, workflow_read_connection. Add a shared Workflow only when the coherent responsibility is demonstrated; do not create a universal generic pipeline.

## 7. Workflow context matrix

| Reused Workflow | Context | Required children / omitted children |
|---|---|---|
| validate_context | Sign-in | Input/connection/challenge constraints; no wallet/approval checks |
| validate_context | Wallet action | Session generation, owner/wallet identity, supported network, action requirements |
| validate_context | Backup open | File/instance/wallet binding and required approval; no transfer balance checks |
| validate_context | External connection | Provider availability and account/network schema; no Species authority required |
| authorize_action | Sign-in | Identity challenge; validate accepted session; no backup AuthLog |
| authorize_action | Member/treasury backup open | Canonical note bound to file digest, recipient and owner/scope; required AuthLog |
| authorize_action | Treasury export | Export behavior, account/export ID and recipient digest; same wait primitive, distinct proof contract |
| recover_wallet_session | Send | Lock, fresh access, recover exact account, verify signer, execute confirmed intent, cleanup |
| recover_wallet_session | Member export | Same lock/access/recovery/identity/cleanup; export key instead of broadcast |
| create_wallet_backup | Member | Verified recovered key, member wallet/config; no treasury release |
| create_wallet_backup | Treasury | Admin proof and one-use recipient-bound release, verify returned wallet; same encryption/file format |
| read_wallet_observations | Balance/activity/both | Execute only selected reads; preserve independent unavailable results |
| resolve_member_readiness | Onboarding / Incoming send | Select registration/issuance prerequisites or Incoming target respectively; never auto-register for a target read |

Before implementation, specify exact typed contexts for every supported branch. The matrix is behavioral selection, not permission to weaken authority.

## 8. Workflow → sub-workflow → Tool decomposition

| Workflow | Nested responsibility | Tool composition |
|---|---|---|
| authorize_action | workflow_wait_for_authorization | Start scoped approval → poll same challenge → verify proof or preserve unresolved status |
| register_member | workflow_observe_registration | Submit stable request → observe operation → verify readiness; terminal operation alone does not prove wallet readiness |
| recover_wallet_session | workflow_bind_wallet_access | Resolve fresh handoff → verify identity/binding/expiry → open recovered session; lock and teardown bound entire lifecycle |
| prepare_transfer | none initially | Validate intent → resolve target → read balances → estimate fees → bind quote |
| execute_transfer | recover_wallet_session | Lock → read continuity record → revalidate quote/authority/funds → persist intent → submit once → persist provider evidence |
| reconcile_transfer | none initially | Read original operation → inspect original chain reference → verify effect/finality → update canonical state |
| create_wallet_backup | recover session OR approved treasury release | Resolve config → acquire verified key → encrypt/bind file → erase transient buffers |
| open_wallet_backup | authorize_action | Validate file → create recipient → approve → await visible page → release once → decrypt/verify → bounded reveal |
| deliver_encrypted_file | none | Initiate browser download → record supported evidence → revoke object URL |
| observe_external_account | none | Resolve provider → obtain/observe account → validate → compare → dispose subscriptions |

Locking/polling helpers may be engineering libraries or bounded Tools depending on their published responsibility. Do not classify every function as a Tool.

## 9. Master Tool and contract inventory

Provisional inventory. Inputs below include explicit operation context, cancellation and binding where applicable. Canonical operation states are unmet_requirements, pending, completed, failed, indeterminate; read capabilities additionally represent unavailable observations without equating them to effect failure. Existing tests provide behavior coverage, not yet canonical contract conformance.

| Tool | Owner; inputs/resources/parts | Authority / effect | Completion evidence; retry | Used by / existing proof |
|---|---|---|---|---|
| tool_check_action_requirements | Client domain; action, required state, wallet Identity and observed Context | No protected effect | Declared predicates satisfied; pure/repeatable | validate; current identity/network/quote tests |
| tool_validate_transfer_intent | Client domain; destination, amount, asset, chain recipe | No effect | Canonical nonzero intent with exact units/address; pure | prepare; chain/destination tests |
| tool_bind_transfer_quote | Client domain; intent, fee/balance observations, clock, recipe version | No effect | Quote digest/expiry and exact intent binding; pure | prepare/execute; current quote tests, new digest contracts needed |
| tool_verify_backup_binding | Client domain; file Content, wallet Identity, instance and config | No effect | Owner/instance/wallet/digest binding; pure | create/open; crypto/client tests |
| tool_encrypt_wallet_backup | Client crypto; verified key, wallet Identity, config Content | Scoped export authority already resolved; creates encrypted artifact | Canonical bytes and round-trip/address verification; fresh encryption is a new artifact, not a replayed effect | create; backup/export tests |
| tool_decrypt_wallet_backup | Client crypto; file, release evidence, ephemeral recipient | Valid scoped approval/release; transient key disclosure | Key/address and expiry verification; no retained plaintext | open; backup/dialog tests |
| tool_record_operation_state | Client continuity; operation Identity and nonsecret Content, expected revision | Local coordination; persists continuity, never grants authority | Atomic revision/guard update; idempotent same operation | execute/reconcile; lock tests plus new crash tests |
| tool_initiate_file_download | Browser adapter boundary; encrypted file Content/name | User export request; browser download initiation | Artifact digest and initiation event; no filesystem-save claim | deliver; export/UI tests |
| tool_compare_wallet_identity | Client domain; expected/observed Identity | No effect | Explicit match/mismatch; pure | recovery/external; identity/Phantom tests |
| tool_capability_authorize_action | Client; action binding and session/challenge resource | Species/Onli enforces requested approval; creates/observes challenge | Canonical proof or unresolved challenge; never blindly recreate on lost acknowledgment | authorize; session/backup tests; conformance needed |
| tool_capability_register_member | Client; server-selected stable request arguments/session | Species member contract; registration effect external | Same operation ID/status plus readiness evidence; same idempotency key | register; onboarding/proxy tests |
| tool_capability_ensure_wallet | Client; owner/session, readiness, existing operation reference | Species issuance policy; external ensure/reconcile | Authoritative owner-scoped wallet or unresolved operation | ensure; App/proxy tests |
| tool_capability_read_wallet_access | Client; wallet Identity, session, frozen binding | Species owner-scoped short-lived access | Fresh handoff bound to same wallet and provider keys; renewal cannot rebind | recover; export/SDK tests |
| tool_capability_open_wallet_session | Client; handoff, expected wallet, token renewal callback | Authorized recovery; provider session lifecycle | Recovered identity, scoped execution handle, verified cleanup or reload-required fence | recover; SDK/cleanup/operation tests |
| tool_capability_read_wallet_observations | Client; wallet Identity, selected fields, chain binding | Public reads | Chain-verified balances/history with observation provenance/time; retry reads safely | reads/prepare; chain/UI tests |
| tool_capability_estimate_transfer | Client; canonical intent, chain/fee binding | Read-only estimation | Valid fee observation bound to exact transaction; repeatable observation | prepare; chain tests |
| tool_capability_submit_transfer | Client; confirmed intent, operation, verified session | Explicit member intent plus signer/account checks; broadcast | Submission evidence only; completed submission does not mean completed Journey. Lost response = indeterminate; no automatic rebroadcast | execute; send/lock tests |
| tool_capability_observe_transfer | Client; original operation/provider reference, original binding | Read-only | Verified transaction/receipt/effect and selected finality; same operation reads | reconcile; receipt tests; stronger evidence tests needed |
| tool_capability_export_wallet_key | Client; verified scoped session | Explicit member export and provider contract; transient key exposure | Key format/address verified; cleanup enforced | create; export tests |
| tool_capability_release_backup_material | Client; file/export binding, recipient, approval proof | Backend one-use member/admin approval; key release | Matching release ID/digests/wallet/expiry; no unsafe repeat after uncertain consumption | create/open; backup tests; uncertainty contracts needed |
| tool_capability_read_backup_configuration | Client; wallet/scope/session | Backend read policy | Valid wrapping-key metadata and allowed behaviors | create/open; backup tests |
| tool_capability_read_treasury | Client; operator session, selected projection | Backend admin permission | Sanitized timestamped projection; no transfer authority | treasury read; gateway/UI tests |
| tool_capability_observe_external_account | Client; selected external binding, consent requirement | Browser wallet permission; read accounts only | Valid account/chain and lifecycle observations; no signing | external; Phantom tests |

For each implemented Tool, expand this into a versioned contract record with explicit input/output schemas, Resource parts, permitted states, effect boundary, completion condition, evidence schema, idempotency, retry rules and contract-test status. Do not mark this provisional table as implementation proof.

## 10. Capability → Adapter → Provider map

| Capability group | Adapter | Provider / boundary |
|---|---|---|
| Identity authorization, registration, issuance, access/config/release, treasury reads | adapter_species_gateway_<operation> | Existing local HTTP contract; Species owns backend effects and Onli integration |
| Recovered wallet session, member key export and signer submission | adapter_openfort_<operation> | Pinned Openfort SDK and Shield integration; EIP-1193 signer enclosed here |
| Balance/estimate/receipt observations | adapter_evm_rpc_<operation> | Configured chain RPC |
| Activity observations | adapter_blockscout_activity | Explorer API; explicitly qualified observation authority |
| External account observation | adapter_phantom_account | Browser-injected Phantom interface |
| File delivery implementation | adapter_browser_download | Browser Blob/anchor APIs; bounded initiation only |

Only the owning Capability calls its Adapter in production. Workflow may call Capability; it must not import SDKs, issue RPC methods, or inspect provider-specific error/status codes. Capabilities stay Tool roles. No Manager layer is introduced. Local Node proxy has separate server-owned transport admission/envelope responsibilities; it does not gain backend domain ownership.

## 11. Recipe inventory

Proposed versioned definitions: wallet-network/ethereum/v1 and wallet-network/sepolia/v1; wallet-provider/openfort/v1; wallet-observation/<environment>/v1; wallet-polling/v1; wallet-ui-demo/v1; species-connection/<deployment>/v1.

Network definition binds chain, asset identifiers/decimals and allowed endpoints. Endpoint/interval variation can be Recipe data. Supported asset semantics, signer identity, approval behavior, encryption format and finality guarantee are contract-governed. Do not let a Recipe override them arbitrarily. Treasury roles remain backend-owned; local labels project supported roles.

Secrets are separate server-held configuration references, never recipe content sent to the browser. Preserve external environment loading, demo isolation and loopback origin constraints. Persist selected nonsecret recipe/capability/adapter versions for outstanding work; endpoint changes do not silently rebind it.

## 12. Resource Identity / Content / Context and ownership

| Resource | Identity | Content | Context / authoritative owner |
|---|---|---|---|
| Session | Verified owner/session reference | Opaque token, scope/expiry if provided | Current local generation; Species authority, browser holds secret ephemerally |
| Wallet | wallet/user/account refs, address, chain | Custody/account type and issued metadata | Current action requirements; Species owns issuance identity |
| RegistrationOperation | Backend operation/request IDs | Status and evidence | Waiting/resume duty; Species authoritative, client maintains continuity reference |
| TransferIntent / Quote | Intent/quote IDs and binding digest | Recipient/asset/amount/fee/transaction | Freshness, confirmation requirements; client owns intent, observations external |
| TransferOperation | Operation/request ID | Frozen intent/binding, provider reference, evidence, canonical state | Unresolved duty; client owns local continuity, chain owns effect truth |
| Balance / ActivityObservation | Wallet/chain/source/read reference | Observed amounts/events/time | Staleness/read availability; chain and qualified explorer sources |
| BackupFile | Format version/file digest | Encrypted key and immutable binding | Requested opening/export scope; file carries data, not approval authority |
| BackupConfiguration | Instance/key/version refs | Public wrapping key and behavior | Current use constraints; backend owns key metadata/policy |
| ApprovalProof | AuthLog/challenge reference | Behavior and verified bound authorization | Expiration/consumption status; Species/Onli authoritative |
| TemporaryKeyMaterial | Operation-scoped recipient/key reference | Ephemeral nonpersistent key material | Reveal lifetime/visibility; browser controls lifecycle; no audit plaintext |
| TreasuryProjection | Account/chain/source refs | Observed role/address/balance | Checked/observed timestamps and availability; backend/chain own underlying facts |
| RecipeBinding | Stable recipe ID/version | Permitted definition and adapter binding | Snapshot for operation; deployment owner controls definitions |
| ExternalAccountObservation | Provider/address/chain | Observed account and permission state | Comparison with expected wallet; external provider owns observation |

Required state lives in invocation requirements, not copied into observed state. Local timestamps do not become authoritative provider observation timestamps. localStorage records never become authority proof.

## 13. Service ownership and target layout

Client domain owns Journeys, Workflows, intent/quote validation, local continuity and outcome presentation contracts. Browser runtime owns UI/session visibility, scoped secret lifetime, locks and downloads. Local Node proxy owns origin/route/header admission, confidential Species credentials and authenticated transport. Species owns membership, issuance, readiness, approval enforcement, treasury policy and one-use key release. Openfort/Shield owns its provider recovery/signing implementation. Chain owns transaction effects.

Suggested language-native layout:

```text
src/contracts/                 canonical schemas, results, evidence, contexts
src/resource/                  references and safe projections
src/recipe/                    validated versioned definitions/bindings
src/tool/                      bounded domain operations
src/capability/                provider-independent Tool contracts/lifecycles
src/adapter/                   private provider translation
src/workflow/                  reusable orchestration and sub-workflows
src/journey/                   outcome orchestration and continuations
src/surface/                   React components/hooks and view models
server/contracts/              proxy transport schemas
server/tool/                   admission/envelope bounded operations
server/adapter/                confidential upstream transport
server/surface/                middleware and Vite integration
tests/{contracts,adapter,workflow,journey,surface,architecture}/
```

Share cross-runtime contracts only where both implement the same representation. The server proxy is a transport surface, not a new Journey per route. Preserve browser/server separation in package exports/build checks. Existing visual components can migrate after core ownership is established.

## 14. Technology map and reuse report

React/ReactDOM = Surface rendering; Framer Motion = visual library; QR library = display implementation; ethers address/transaction libraries = canonical EVM encoding/validation implementation; WebCrypto = backup/envelope implementation library; Openfort SDK = private provider Adapter dependency; fetch = transport implementation; Vite = local development/build surface; TypeScript = client toolchain; Node test runner = current test foundation; Web Locks = coordination implementation; localStorage or selected replacement = nonsecret continuity implementation.

Reuse candidates: runWalletAction becomes recovery/session lifecycle; assertSameWallet becomes canonical identity verification; prepareTransfer and quote checks become intent/quote Tools plus observation capabilities; pollRegistration and approval loops share cancellation-aware wait mechanics without merging distinct proof semantics; backup crypto and shared backup client preserve member/treasury format reuse; locks/storage/generation guards become shared engineering primitives. Existing forwarding/re-export modules are compatibility shims, not new architectural units. Deduplicate onboarding types currently declared in species.ts and onboarding.ts.

Do not add provider frameworks, databases, queues, code generation or migration tooling unless contracts require them. Decide durable local operation storage from actual continuity requirements. Preserve evidence-oriented tests; move each test to the owner of its responsibility rather than duplicate it at every layer.

## 15. Unresolved classification/product decisions

1. Is this client-only rewrite the complete scope? Recommendation: yes; document external requirements separately. Backend Manager removal requires its own repository and authorization.
2. Is there a separate authoritative wallet PRD? Until supplied, current behavior is provisional scope. Preserve UI appearance by default.
3. What constitutes transfer completion: inclusion or a defined finality threshold? Specify asset/event verification and reorg behavior. Current code checks receipt status, which is narrower than full outcome proof.
4. How can a broadcast with no returned hash be reconciled safely? Need nonce/signed transaction/provider operation reference or an explicit trusted recovery contract. If unavailable, keep it indeterminate; do not unlock replacement merely on acknowledgment.
5. How are registration operation IDs recovered after reload/sign-in? Current server-selected idempotency is helpful; contract must define lookup/resume and idempotency retention.
6. Can uncertain backup authorization/key release be queried or safely replayed? Backend must define consumption/reconciliation; do not invent retries.
7. Which Recipe values are actually administrator-editable, and how are versions distributed/trusted? Start with validated local versions; remote recipe administration is additional scope.
8. What runtime matrix is supported? Recommend pinned Node 24/npm combination after baseline compatibility verification; do not assume the Node 26 baseline proves Node 24.
9. Is external-wallet import an outcome? Current app provides manual instructions/account comparison only; recommend keep that scope.
10. What externally authoritative scope/expiry metadata is available for sessions and confirmations? Client must not fabricate proof the backend does not supply.

## 16. Layered build and migration plan

| Phase | Work / first migration target | Exit evidence |
|---|---|---|
| 0: Foundation | Record baseline; pin supported runtime/package manager; retain compatible dependencies; establish CI, formatter/linter, dependency/license/security checks | Clean checkout passes supported runtime matrix; checks execute; limitations recorded |
| 1: Shared libraries | Result/evidence/operation/context/resource schemas; exact units; redacted diagnostics; shared transport/backup vectors | Shared fixtures and schemas pass; duplicate models removed; no plaintext persisted/logged |
| 2: Enforcement | Establish boundaries, dependency rules, adapter privacy, recipe binding, operation continuity, scoped execution/cancellation | Forbidden workflow→adapter and surface→SDK imports fail architecture checks; original binding survives restart |
| 3: Atomic Tools | Extract identity, requirements, intent/quote, backup-binding/crypto and operation-record responsibilities; keep existing behavior | Independent explicit contracts pass for first target Workflow; no upper-layer workaround copies |
| 4: Capabilities/Adapters | Species reads and access; EVM observations; Openfort recovered session; approvals/releases; submit/observe transfer; external account | Adapter conformance covers unmet/pending/indeterminate and cleanup; provider syntax absent above boundary |
| 5: Sub-workflows | Same-operation observation; authorization waiting; access/session binding | Ordering, cancellation, unresolved propagation and teardown tests pass |
| 6: Workflows | Begin with read observations and wallet recovery; then readiness, transfer and backup lifecycles | Each context selects required children only; evidence and Recipe binding tested |
| 7: Journeys | Sign-in/open wallet first; transfer with resumable confirm/reconcile; member/treasury export/open; external comparison | Outcome/recovery tests pass; incomplete sub-operation cannot claim Journey completion |
| 8: Surface | Replace App/hook business orchestration with typed commands/subscriptions and presentation models; preserve visual behavior | Existing interaction tests plus integration smoke checks pass; Surface does not own protected effects |
| 9: Cutover audit | Remove compatibility paths and duplicate types; update architecture/contracts/setup documentation | All applicable v4.1 gates evidenced; remaining external verification clearly listed |

Within these phases migrate one contract at a time behind temporary compatibility entry points. Suggested vertical acceptance slices: (1) balance/activity reads, (2) exact-wallet recovery reused by export/send, (3) transfer continuity and reconciliation, (4) sign-in/registration/readiness, (5) backup authorization/release and external connection. Each slice follows bottom-up construction even when Journeys are classified first. Keep the working demo available throughout.

Do not change SDK versions, wire formats, visual design and architecture simultaneously. Any needed compatibility upgrade is a separately verified change.

## 17. Layered test plan and conformance gates

Libraries: schema/serialization/result mapping, exact integer units, redaction, version binding and shared backup/envelope vectors.
Tools: declared inputs/Resource parts/authority/effect/evidence/retry contract; test each bounded behavior once.
Capabilities: provider-independent semantics; unresolved lifecycle, stable binding, disposal/fencing and safe retry.
Adapters: provider result/error translation, malformed replies, chain/signer mismatch, timeouts and conformance; test doubles do not prove live provider integration.
Sub-workflows: local ordering, cancellation, child selection and unresolved propagation.
Workflows: context matrix coverage, selected Recipe, resource access, evidence completion and omitted unnecessary children.
Journeys: orchestration, user confirmation, pause/resume/reload, sign-out/account changes, recovery, canonical outcome.
Surface: exposure/status mapping, accessibility/presentation, existing card/receive/send/activity behavior; no repeated cryptography/provider contract suite.
Architecture: dependency direction, private adapters, provider SDK restrictions, no browser import of server credentials, contract/version ownership.
Continuity fault injection: interrupted before broadcast, acknowledgment lost, hash persisted, RPC unavailable, reload, cross-tab race, recipe changed, approval consumed, reorg/finality changes. Unknown effect remains unresolved and blocks unsafe replacement.

Acceptance ledger for each applicable v4.1 gate: classification/nomenclature/reuse; context selection/atomicity; Capability/Adapter privacy; Recipe truth; Resource ownership/access; authority/evidence; continuity; service ownership; test layering; reproducible stack; technology mapping. Every gate links to concrete contracts, source and tests. Passing baseline tests alone is not v4.1 conformance.

Implementation completion report must name implemented units, actual commands/results, supported runtime evidence, external behavior actually verified, and remaining limitations. Live wallet/provider verification remains a separate evidence level requiring a configured environment; no mock result will be reported as live proof.
