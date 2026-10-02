# Public demo deployment

Target: https://onli-openfort-wallet.fly.dev

This deployment serves the credential-free wallet UI and Docs. It is not a
configured Species wallet service. The build explicitly uses Vite demo mode,
which ignores inherited Species configuration. The runtime image contains only
`dist` and `server/demo-site.mjs`; it does not contain the upstream gateway,
SDK server configuration, dependencies, environment files or private Git history.

The demo server provides static GET/HEAD requests, a health endpoint and a
sanitized `/api/species/connection` response with `configured: false`. Other API
reads are refused; mutations return 405. Real sign-in, wallet provisioning, key
release and transactions remain unavailable. CSP confines scripts/connections to
the site and blocks frames; Fly forces HTTPS. No secrets are configured for this app.

The Docker build context uses an allowlist. Node 26.5.0 and npm 11.17.0 are pinned.
Fly uses one shared CPU and 256 MB memory in lax, starts on requests and stops when
idle. The deployment requests one Machine rather than the default HA pair. No
persistent volume or database is needed for this static demo.

## Reproduce

```sh
npm ci
npm run check
npm run build:demo
flyctl config validate
flyctl deploy --remote-only --ha=false --yes
```

The Fly account must have deployment permission. Do not reuse this public demo
configuration to expose the developer proxy: a real-wallet deployment needs its own
HTTPS/session/authority and protected-storage architecture.

Local verification: 138 tests passed, zero failures, including static delivery,
credential-free connection, blocked API effects, traversal refusal, HEAD handling,
health response, cache and security headers. Full architecture/lint/type/build checks
passed. Live endpoint and browser verification are recorded after deployment.

## Live verification — 2 October 2026

Deployment succeeded with one Machine. Wallet root, both Docs pages, health and
connection endpoint returned HTTPS 200. Connection reported configured=false; a
POST to authentication start returned 405. Browser rendered the wallet with no
console errors. The Docker base image is pinned to the digest observed in the
successful remote build. No real credentials, accounts or provider effects were used.
