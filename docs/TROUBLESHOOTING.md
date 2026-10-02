# Troubleshooting the reproduced integration

| Symptom | Check / action |
| --- | --- |
| `EADDRINUSE` on 5175 | Stop the other local wallet server. Keep the browser, proxy origin checks and configured provider origin on 5175. |
| Preview shows no balance | Expected for `npm run demo`: it opens a visual preview without an account. Use configured `npm run dev` to sign in. |
| Sign-in disabled | Supply the explicit external environment file. A valid gateway origin, app symbol, API key and base64 32-byte envelope key are required. Demo mode deliberately ignores them. |
| Instance connected but requests fail | That label reports local configuration, not provider health. Verify the configured gateway and its issued Appliance credentials. |
| Appliance not configured | Set `SPECIES_APPLIANCE_SYMBOL` for the display label; it is different from the gateway app symbol. |
| `appliance_not_authorized` | Use credentials issued by the target Species gateway, not an Openfort secret key. Confirm the application is active there. |
| `gateway_unavailable` | Check reachability and the encrypted response contract. The proxy refuses redirects, unencrypted successful responses and invalid GCM envelopes. |
| Sign-in remains pending | Approve the specific Onli request. Do not invent an ACCEPTED response or bypass owner approval. |
| `member_not_found` | Use Set up my wallet with the server-supplied registration identifiers. Do not manually choose a new member ID. |
| `member_wallet_pending` | Reconcile the existing member account in the backend. Do not pregenerate another wallet to clear the error. |
| Wallet recovery fails | Check project/mode, custom-auth callback, exact `acc_...`, verified `usr_...`/`pla_...` mapping and Shield recovery. A fresh encryption session must belong to the same project. |
| Session needs to restart | Reload and sign in again after failed recovery or incomplete iframe teardown. Keep the cleanup guard; changing the account or repeatedly constructing SDKs can worsen stale state. |
| Recovered identity mismatch | Refuse the operation. Compare the member's persisted tuple to the returned Openfort account and address. Never select the first provider account as a fallback. |
| Review asks for ETH | This client uses a personal EOA with direct transactions and no sponsorship policy. Fund gas on the same network. Treasury sponsorship does not apply automatically. |
| `invalid BytesLike` / transaction serialization | Preserve type `0x2` and the explicit EIP-1559 fee fields in the pinned SDK integration. Do not replace the reviewed payload with SDK defaults. |
| Review expired | Obtain a new quote; review expires after 60 seconds. |
| Send has an unknown result | Check Activity / the receipt before another send. Do not remove the pending-submission guard or automatically retry after broadcast began. |
| Phantom not detected | Use a browser with Phantom's Ethereum provider, or its supported in-app browser. The Codex embedded browser does not install the extension. The button otherwise opens the provider download page. |
| Imported address differs | Select/import the correct Ethereum private key and verify the address. Connecting Phantom alone does not import the Species wallet. |
| Backup is unavailable | Configure the backend wrapping-key ring and owner-bound OnliYou behavior. This does not require embedding a private wrapping key in the client. |
| Backup cannot open after app switching | Keep `waitForVisiblePage`: the one-use key release is requested after the browser is visible again. |
| Gateway tests report `listen EPERM` | Run the tests in a developer environment that allows loopback sockets. This is an environment setup issue, not a reason to skip the suite. |

Read the allowlisted error classification in `WalletActionError` when diagnosing
initialization versus recovery. Do not log provider error payloads, raw handoffs,
auth tokens, encryption sessions, recovery shares or private keys.

The source preserves the working SDK version and cleanup sequence. Upgrade the
SDK deliberately with the existing recovery, teardown, token-refresh, transaction
and export tests; do not use `npm audit fix --force` as a substitute for an SDK migration.
