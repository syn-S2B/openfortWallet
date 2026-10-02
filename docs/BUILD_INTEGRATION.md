# Build the integration step by step

This guide describes the implementation in this repository, including the
boundaries supplied by the Species backend. Begin with the included, pinned
implementation. There is no dependency on a local Species folder, and replacing
it with the latest Openfort scaffold would change the recovery flow being reproduced.

## 1. Build the client first

Run `npm ci`, then `npm run check`, then `npm run demo` from the repository root.
The preview must display the two wallet cards at `http://127.0.0.1:5175` without
credentials. This verifies installation and UI independently of provider setup.

The implementation uses React 18.3.1, Vite 8.3.1, TypeScript 5.9.3 and
`@openfort/openfort-js` 2.6.0, with the exact transitive versions in `package-lock.json`.
The low-level Openfort SDK is intentional: Species owns Onli authentication,
member identity and wallet issuance, and the client recovers that issued account.

## 2. Configure the services

The owner of the Species instance performs these steps. The client developer needs
the resulting gateway endpoint and issued Appliance credentials, not service secrets.

1. Select the intended Openfort project and mode. Match the backend API key,
   browser publishable key, Shield project credentials, project encryption share
   and account records. Test and live projects are separate; a test account is
   not made into an existing live account by changing the frontend chain label.
2. Configure Openfort custom authentication to call the gateway endpoint
   `POST /species/v1/auth/member-wallet/verify`. It accepts the wallet-purpose
   token in `payload` and returns the verified stable member identifier as `userId`.
   It must reject a Species login session used as a wallet-purpose token.
3. Register the exact browser origin `http://127.0.0.1:5175` in the matching
   Openfort/Shield allowed-origin configuration. If you use `localhost`, configure
   that origin too; it is a different browser origin and SDK storage scope.
4. Configure the backend Openfort adapter, enable member wallets and provide its
   protected references: publishable key, Shield publishable key/secret, project
   encryption share and wallet-auth signing secret. Provider endpoints, chain,
   token and treasury references remain backend configuration.
5. Register this application at the Species gateway and obtain the application
   symbol, Appliance API key and AES envelope key. Configure the Onli identity
   provider and an active member or the gateway's member-registration journey.
6. For encrypted files, configure the backend's persistent RSA wrapping-key ring,
   instance ID, and the owner-bound `open-wallet-backup` behavior in OnliYou.
   Treasury backup also uses `export-treasury-wallet-backup`. Retain old wrapping
   keys for existing backup files when rotating the active key.

All service secrets stay behind Species. The only long-lived secrets in the local
Node process are its own issued Species Appliance credentials. Copy `.env.example`
outside the checkout, fill it, and start with `SPECIES_WALLET_ENV_FILE=... npm run dev`.

## 3. Preserve the identities that made recovery work

These references are different and must not be substituted for one another:

| Identifier | Meaning | Used for |
| --- | --- | --- |
| Species `usr-...` | Verified member identity | Onli session and Openfort custom-auth external user ID. |
| Openfort `usr_...` | Openfort user | The public wallet's `user_ref`. |
| Openfort `pla_...` | Openfort wallet/player | `wallet_ref` and Shield's Openfort identity binding. |
| Openfort `acc_...` | The exact EVM account | `account_ref`; passed to `embeddedWallet.recover`. |
| Openfort `sig_...` | Account signer | Shield recovery reference. |
| EVM `0x...` | Public account address | Balance, recipient, export and signer validation. |

The working backend pregenerates the account using
`POST /v2/users/pregenerate` with the verified member as `thirdPartyUserId`,
`thirdPartyProvider: "custom"`, and an EVM `Externally Owned Account` request.
It persists the returned account identity and an encrypted recovery checkpoint
before completing setup. A lost response becomes reconciliation work under the
same member; it must not cause another account to be created.

Shield preregistration uses the returned recovery share and `sig_...` reference,
project entropy/encryption share, and **the `pla_...` wallet/player as `x-user-id`**
with `x-auth-provider: openfort`. Passing the public `usr_...` here was not the
working identity binding. Never put a plaintext recovery share in a database record,
log or browser response.

Pregeneration can temporarily report Developer custody. Do not publish the pending
record as a usable platform wallet. Completion reads back the exact custom-auth
user, wallet/player and one EVM account, verifies User custody, and checks that
Shield has project recovery for that wallet and signer. Manager owns this workflow;
the adapter provides its prepare, complete and verify tools. This repository consumes
the resulting verified wallet through the gateway; it does not duplicate that workflow.

## 4. Implement sign-in and member setup

`App.tsx` starts Onli authentication through the local proxy. The gateway returns a
challenge and a claim secret; polling sends that secret in a header upstream.
Only an ACCEPTED response with a session token and owner ID becomes a client session.
The browser keeps the session in memory.

For a new member, follow the gateway's returned journey. Preserve its
`Idempotency-Key` and `X-Correlation-Id`, POST an empty object to member registration,
poll the returned owner-scoped operation, then read readiness. Issue a wallet only
when readiness selects the wallet step; do not skip other onboarding requirements.
A retry uses the same registration operation identifiers.

The current wire vocabulary consumed by this client is
`journey_member_registration` and `journey_member_wallet_ensure`. These are gateway
compatibility identifiers, not permission for the adapter to own the journey.

An existing member uses `GET /members/{self}/wallet`. Read and retain the full
account/user/wallet/address/chain tuple. The client never guesses a wallet from
an email, imports a treasury account as a member wallet, or defaults a missing chain.

## 5. Return a fresh recovery handoff

`POST /members/{self}/wallet/access` accepts an empty body and the member session.
The backend returns the exact wallet plus these fields:

~~~ts
{
  wallet,                    // the same verified identity tuple as the wallet read
  publishable_key,           // the matching Openfort project
  shield_publishable_key,    // the matching Shield project
  auth_provider: 'custom',
  auth_token,                // wallet-purpose, expiring bearer
  encryption_session,        // fresh Shield session, not the project encryption share
  expires_at                 // Unix seconds
}
~~~

In the Species implementation, the backend creates the Shield session via
`POST /project/encryption-session` using the protected project encryption share.
It issues a five-minute, HMAC-authenticated wallet token bound to the member and
publishable-key audience. The callback verifies signature, audience and expiry,
then resolves the authenticated member. This token is separate from the Species
session and never grants Species API authority.

Return handoffs with `Cache-Control: no-store`. Do not persist them in logs,
analytics, audit payloads, browser localStorage or generic response replay caches.
`runWalletAction` validates the tuple, expiry, custom provider and project keys.
If less than 30 seconds remain, it renews access and requires the same project
keys and wallet identity before proceeding.

## 6. Construct and recover the SDK in this order

The actual implementation is in `wallet-sdk.ts` and `export-core.ts`:

~~~ts
const sdk = new Openfort({
  baseConfiguration: { publishableKey: access.publishable_key },
  shieldConfiguration: { shieldPublishableKey: access.shield_publishable_key },
  thirdPartyAuth: {
    provider: ThirdPartyOAuthProvider.CUSTOM,
    getAccessToken, // renews the wallet-purpose handoff when needed
  },
  overrides: { storage }, // an operation-local WalletSessionStorage
})

await sdk.waitForInitialization()
const recovered = await sdk.embeddedWallet.recover({
  account: wallet.account_ref,
  recoveryParams: {
    recoveryMethod: RecoveryMethod.AUTOMATIC,
    encryptionSession: access.encryption_session,
  },
})
~~~

Do not replace `recover` with an account-creating convenience call. Require the
recovered account ID, address and EOA type to match the issued wallet. An EVM EOA
recovery response may omit `chainId`; if it supplies one, it must match. A send
separately checks the live signing provider's chain and account before broadcast.

Acquire the origin-wide `species:openfort-sdk` Web Lock before creating an SDK
instance. Keep that lock through logout and iframe cleanup, including on failure.
Use operation-local memory storage and dispose it afterward; late SDK callbacks
must not restore stale values. Send and export share this lock.

Logout can trigger asynchronous iframe teardown. Wait for the known Openfort
iframe to disappear. If recovery failed, the iframe was missing, or teardown
cannot be proven complete, require a page reload before another SDK operation.
Reload/sign-in resets this local session; it is not a request to create a new wallet.

## 7. Review and send from the platform wallet

`wallet-chain.ts` has explicit Ethereum mainnet and Sepolia entries: chain ID,
RPC, native USDC contract, explorer and gas asset. Every balance, quote, SDK
provider and receipt check uses the chain returned by Species. Adding a chain
requires a deliberate entry and tests, not a default fallback.

Review validates the recipient and exact integer units, reads balances, and
estimates gas. It creates an immutable quote expiring after 60 seconds. USDC uses
6 decimal places; ETH uses 18. The reviewed transaction uses EIP-1559 type `0x2`
with explicit gas, max fee and priority fee. This also avoids the SDK 2.6 legacy
serialization path's unsupported optional fields.

On a separate confirmation, recover the account, obtain the provider with an
explicit chain-to-RPC map and `announceProvider: false`, recheck balances and
require `eth_chainId` and the sole `eth_accounts` result to match. Then submit
`eth_sendTransaction` once. The personal EOA path does not pass a sponsorship
policy and requires ETH for gas. Do not infer sponsorship from a backend treasury policy.

A cross-tab wallet lock and a pending-submission record prevent parallel or
uncertain sends from being silently resubmitted. After broadcast begins, a lost
answer is an unknown outcome. Reconcile the receipt/activity; never automatically
retry. Display the transaction hash linked to `/tx/{hash}` on the correct explorer.

## 8. Implement portability without sending the key to Species

`export-wallet.ts` recovers and exports the key locally, verifies its derived
address, encrypts it with a fresh AES-256-GCM key and wraps that key to the
backend's RSA-OAEP-SHA256 public key. Canonical metadata binds owner, account,
chain and instance to the ciphertext. Only the encrypted JSON file is downloaded.
The format and cryptography are included under `src/wallet-backup/`.

To reopen, the browser makes a nonextractable ephemeral RSA key and requests a
fresh OnliYou authorization binding the exact file digest and recipient public-key
digest. It waits for the page to be visible before consuming the one-use approval.
The server returns the AES key rewrapped to that browser. The private EVM key is
decrypted locally, shown only briefly, and cleared when hidden or closed.

Phantom connection is a separate address-comparison convenience. Importing the
key is a manual action in Phantom; connecting the extension alone does not import,
issue or move a wallet. The promotional link is just an advertisement/download link.

## 9. Reproduce and extend with evidence

Run `npm run check` in a fresh checkout. The tests cover the actual React components,
proxy envelope, owner scoping, exact-account recovery, token renewal, cross-tab
locks, failed teardown, expired fee quotes, uncertain sends and backup cryptography.
The standalone check rejects imports outside this checkout and missing artwork.

For API wiring exercises, `npm run fixture` supplies synthetic sign-in and wallet
metadata. It deliberately has no recovery or signing capability. For a configured
instance, first observe the correct member/account/network, then let its owner
exercise the explicit operation. A live transaction is not needed to build or
verify this repository, and local test results do not claim one occurred.

Official background: [Openfort custom authentication](https://www.openfort.io/docs/configuration/custom-auth/auth-token),
[embedded wallet JavaScript](https://www.openfort.io/docs/products/embedded-wallet/javascript/quickstart),
[API keys](https://www.openfort.io/docs/configuration/api-keys).
The executable pinned implementation here is the reference for this client.
