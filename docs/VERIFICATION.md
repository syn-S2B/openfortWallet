# Verification

Verified on **2026-10-02** in the standalone checkout using Node **26.5.0** and
npm **11.17.0**. `.nvmrc`, package engines and package-manager metadata select this
validated runtime. No Species source checkout is required.

| Check actually run | Result |
| --- | --- |
| Clean `npm ci` from the lockfile | Passed; nine low-severity dependency advisories reported. |
| `npm run check:standalone` | Standalone relative imports and included artwork passed. |
| `npm run check:architecture` | AST import/transport boundary checks passed. |
| `npm run lint` | Passed. |
| `npm run format:check` | Extracted architecture modules passed. |
| `npm test` | 137 tests passed; zero failures, cancellations or skips. |
| `npm run build` | TypeScript no-emit and Vite production bundle passed. |
| `npm run check:security` | Passed moderate-severity threshold; nine low advisories remain. |
| `npm run check:licenses` | 220 lockfile packages passed permitted license metadata check. |
| Local browser demo | Wallet cards rendered; browser console reported no errors. |

The final clean-install run executed `npm run check`, which includes standalone,
architecture, lint, formatting, tests and build. The suite includes existing proxy,
crypto, onboarding, recovery, concurrency, visibility and React UI coverage, plus
new exact-confirmation, exact transfer evidence, lost acknowledgment, persistence
failure, same-operation replay, registration reload/binding, backup proof fencing,
shared workflow context, encrypted delivery, scoped SDK handle and architecture
rejection cases. Layered tests reuse shared boundaries rather than issuing real
provider effects for each Journey.

Mainnet and Sepolia fixtures exercise receive, fee review, explicit confirmation,
pending/indeterminate guard retention, transfer links and activity. An unrelated
receipt cannot establish completion. Backup fixtures cover encrypted round trips,
owner and recipient binding, hidden-page/cancelled release, expiration and download
initiation. The browser cannot prove a downloaded file was saved to disk.

Reproduce with:

~~~sh
npm ci
npm run check
npm run check:security
npm run check:licenses
npm run demo
~~~

Gateway tests bind temporary loopback HTTP listeners. In a restricted sandbox,
listener permission is needed to run those tests. The demo is available at
[http://127.0.0.1:5175/](http://127.0.0.1:5175/).

The pinned Gitea workflow is present but has not run on a remote runner. License
checking evaluates lockfile metadata, not legal compliance. The nine inherited
low-severity advisories are in the ethers/Openfort tree; forced remediation would
change the working SDK incompatibly and was not applied.

Evidence reaches local client/proxy contracts, composition, SDK initialization and
Surface behavior. No live Species registration/sign-in, Onli approval, Openfort or
Shield recovery, protected key release, Phantom permission or on-chain transaction
was verified. Transfer completion is matching current inclusion, not irreversible
finality. Hashless or legacy unresolved effects stay blocked without authoritative
recovery evidence. See [the architecture report](ARCHITECTURE.md) for exact ownership
and remaining integration limits.
