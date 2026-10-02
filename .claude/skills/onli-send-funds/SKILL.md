---
name: onli-send-funds
description: Route an Onli send-funds outcome through an approved Recipe and proven wallet Journey, with Owner authentication, behavior authorization, explicit confirmation and evidence-based recovery. Use for Onli wallet send requests; do not invent provider calls or a bridge.
---

# Onli send funds

Interpret intent and select installed, contract-tested code. This skill supplies
instructions, not executable proof or transaction permission. Follow the host's
execution policy, including handing off financial execution where required.

## Required inputs

- Intent: Owner Onli ID or email, issued wallet identity, asset, exact amount,
  recipient and desired outcome.
- **Recipe input**: approved ID/version, deployment environment, app_symbol,
  Journey binding, Capability/Adapter versions, network/chain/asset, authentication
  method, configured authorization behavior, quote/poll timing, completion/evidence
  contract, durable operation store and protected audit store references.
- Trusted backend configuration: separate Onli ID/Cloud hosts, app_key secret-store
  reference and mTLS certificate/key references. Never include secrets in a Recipe,
  model prompt or log.
- Installed Journey entry point and verified authority/confirmation integration.

See [recipe.example.json](recipe.example.json) for an illustrative input template.
It is not an Onli wire schema or an already registered runtime Recipe. Resolve all
references through trusted application configuration. Missing or incompatible
inputs are unmet requirements; never guess recipient, amount, chain or behavior.
A Recipe configures permitted work; it does not execute or weaken contracts.

## Preconditions

Check the approved Recipe and installed bindings. Preserve any existing unresolved
operation and its original Recipe/provider binding before considering a new effect.

Require a registered Appliance with app_symbol/app_key; backend gRPC with mTLS and
app_key metadata on every request; correct service hosts/environment; active Owner;
OnliYou installed with initialized vault and correct non-production environment.
The requested behavior must exist in Appliance Tray under the Owner's user_class,
and the Owner must belong to that class in this Appliance context. Default `move`
does not by itself authorize an arbitrary EVM transaction.

## Onli authentication and behavior authorization

Use trusted backend Capabilities. Never put app_key or mTLS private keys in browser
code. Source: the user-supplied onli-authentication skill and its exported
onli-id/securityMessages.proto. Read [authentication.md](authentication.md) for
request shapes/status semantics. Verify deployment proto versions before coding.

1. Resolve email with ListOwner: condition `identity.email`, meta.keyword=email;
   require one match and read identity.onli_you_id. With a `usr-` ID, use
   GetOwner(onli_you_id, app_symbol). FetchOwner projects; it does not search.
2. Start AuthenticateOwner with owner, app_symbol and a clear body. Use the Recipe's
   supported basic, reverse-mfa or reverse-hash method. The approved Master supplies
   rev_string or app_salt/client_gene_sample; do not invent those values.
3. The Owner receives an OnliYou prompt; the bidirectional stream lasts 60 seconds.
   ASKED waits; only ACCEPTED authenticates. DENIED/EXPIRED stop. Lost stream evidence
   is not acceptance and must not trigger a protected effect.
4. Persist auth_log_id, final authentication_status, auth_type and any returned
   timestamp/asset_balance in protected audit storage. Verify Owner/Appliance binding.
   Onli asset_balance is not an EVM wallet balance.
5. Prepare/review the exact transfer. Call AuthorizeBehavior with owner, app_symbol,
   note.behavior from approved configuration and note.body describing the real
   amount/asset/recipient/network. Enforce the agreed binding between approval and
   operation; a prose notification alone is not cryptographic payload binding.
6. Only ACCEPTED authorizes continuation. Persist the authorization auth_log_id and
   final status before the protected effect. Both exported records use
   `authentication_status`; do not test enum truthiness. Login is not action approval.
7. Retrieve AuthLog(app_symbol, auth_log_id) for both decisions. Inspect method,
   appliance, timestamp, request/response and error state. AuthLog proves the security
   event, not fund delivery. Keep identity and authorization proof references separate.

Do not loop prompts after denial/expiry. New approval requests follow an explicit
user request or permitted application policy. Unknown responses require authoritative
observation, not a speculative effect. Route Onli ID and Onli Cloud RPCs to their
own service hosts.

## Execute the outcome through proven units

Conceptual Journey: journey_send_funds. This client implements
`src/journey/journey_send_transfer.ts` with:

- workflow_review_transfer / workflow_prepare_transfer: validate destination,
  exact units, current balances/fees and fresh immutable quote.
- workflow_recover_wallet_session: renew access, recover/verify the issued account,
  perform the scoped action and tear down the provider session.
- workflow_execute_transfer: verify confirmation, live signer/chain and submit.
- workflow_reconcile_transfer: observe the original transaction and verify evidence.

The Surface obtains explicit confirmation of the exact quote. Behavior approval and
transfer confirmation are separate gates; the model cannot create either as proof.
The backend must enforce accepted scoped behavior authorization at the effect boundary.
**This client's send API does not currently expose a general AuthorizeBehavior gate.
Stop until the deployment supplies and verifies that integration. Skill text does
not add a backend enforcement mechanism.**

Use only the application's trusted Journey entry point. Never bypass it with raw
SDK/RPC, direct mutation, key export or runtime-generated execution. Persist stable
operation identity, exact intent and original binding before broadcast. Persistence
failure stops before signing. Same-operation replay cannot authorize another send.

## Outcome and recovery

- unmet_requirements: report the missing prerequisite; do not execute.
- pending: retain original operation ID and duty; observe it.
- completed: require matching evidence for the declared completion contract.
- failed: retain the evidence-established failure and its identity.
- indeterminate: preserve the unresolved duty; never automatically rebroadcast.

A returned hash is pending. Current transfer-inclusion/v1 verifies matching current
transaction/receipt and token event, not irreversible finality. Never claim an Onli
thing changed or Oracle updated from a chain receipt: those need separate installed
contracts/evidence. This client supplies no Oracle writer or general bridge.

Require authenticated encryption in transit and encryption of sensitive data at rest,
with separated keys and controlled access. Never persist plaintext keys/session
secrets. Browser continuity metadata is currently unencrypted at application level;
production protected storage and provider-side at-rest encryption require verification.

Report state, operation ID, Recipe/binding version, safe evidence references and
remaining recovery duty. Keep auth records in the authorized audit channel. Distinguish
local-double evidence from live provider verification; acceptance is not completion.
