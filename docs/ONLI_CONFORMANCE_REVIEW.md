# Wallet conformance review — 2 October 2026

Scope: wallet client/local Species proxy; supplied Onli v4.1 standard plus the
requested authentication and transport/at-rest requirements. This is a source and
local-contract audit. External backend implementations are absent. No claim of
complete production acceptance is made.

## Finding resolved

The wallet-session Capability exposed a raw provider() handle and derived its public
factory type from adapter_openfort_factory. This allowed consumers to bypass
canonical operations. Removed the handle from both layers and added
RecoveredWalletSession/WalletSessionFactory to contracts/wallet-session.ts.
Openfort implements the canonical contract; the Capability wraps only those methods.
The session test checks absence of raw provider exposure, teardown locking,
retained factory/handle refusal and abandoned-handle cleanup.

## Applicable gate ledger

| Gate | Assessment and evidence |
| --- | --- |
| Classification | Journeys own outcomes; Workflows own reusable lifecycles; Tools verify bounded operations. Source-reviewed send/recovery/reconciliation, registration and backup boundaries. |
| Nomenclature | Extracted units use canonical folder/name patterns; documented root compatibility aliases retain legacy import names. No new Manager layer. |
| Reuse | Send/member export share recovery; member/treasury backup share authorization/release/crypto workflows. Context/composition tests cover selection. |
| Workflow context | Read observations select required reads; backup scope and action vary through shared context. |
| Tool atomicity | Identity, confirmation, operation creation and evidence checks stay separate from orchestration. |
| Capability boundary | Canonical scoped session contract now hides raw SDK/provider methods. Chain/session/Species operations go through Capabilities. |
| Adapter privacy | AST check confines Adapter imports to Capability/Adapter owners and SDK/fetch to integration boundaries. Tests reject inverted imports. Not a proof against arbitrary reflective code. |
| Recipe boundary | Provider/network/poll settings are versioned definitions; Openfort provider selection is a Recipe binding. Current selection supports one provider, not a dynamic registry. |
| Resource truth | Species owns wallet/access/readiness; chain owns inclusion. Client records observations and duties without inventing authoritative completion. |
| Resource access | Context selects observations and scoped backup data. Access handoff remains Openfort/Shield-specific; broader provider neutrality needs a new agreed access schema. |
| Authority | Partial: exact quote confirmation, identity/network checks and backend-scoped backup approval exist. General backend AuthorizeBehavior enforcement for sends is absent. Skill instructions cannot substitute for enforcement. |
| Evidence | Matching transaction/receipt/token event establishes current inclusion. Finality/reorg monitoring and Onli-side/Oracle completion are outside implemented contract. |
| Continuity | Pre-effect record, stable registration keys/connection binding, one-use backup fence, preserved hash/intent/recipe, lock-protected updates and replay prevention. Hashless ambiguity cannot be resolved without backend/provider lookup. |
| Service ownership | Layer folders and tool inventory identify owners; external Species backend remains separately owned. |
| Test layering | Shared boundary tests plus Workflow/context/Journey/UI composition tests; no live mutations used. |
| Stack reproducibility | Pinned Node/npm/dependencies; clean install previously verified. Full checks pass; remote Gitea runner not exercised. |
| Technology mapping | React/crypto/ethers are libraries. Recipe selects Openfort; Adapter translates its SDK. RPC/explorer integrations stay private. |
| Encryption extension | Partial: authenticated Species envelope and canonical encrypted backup format verified. Local loopback HTTP is development-only; production HTTPS/provider at-rest storage unverified. Continuity metadata remains unencrypted at application level. |

## Verification actually run after the fix

npm run check: 137 tests passed, zero failed/skipped/cancelled; standalone checks,
105-module architecture check, lint, new-layer format check, TypeScript and Vite
production build passed. No real Species/Onli/Openfort/Shield flow or transaction
was executed. Security/license checks retain the previous evidence: nine low
advisories; 220 lockfile package license metadata checks. Lockfile unchanged.

## Remaining production work

1. Agree and enforce a backend Onli behavior contract bound to exact transfer intent,
   Owner/Appliance and operation identity; preserve AuthLog proof before effect.
2. Define protected storage/key ownership for sensitive continuity metadata and
   verify production transport and provider at-rest encryption. Do not persist
   private keys/session tokens to browser storage.
3. Verify live provider/authentication/approval/cleanup/recovery behavior, remote CI
   and any requested stronger finality contract.
4. Supply authoritative recovery for hashless/legacy ambiguity and separate Onli
   effect/Oracle contracts if the product requires a bridge.

The walkthrough at public/Docs/openfort-walkthrough.html explains the code that
exists, and explicitly states these limits rather than presenting them as complete.
