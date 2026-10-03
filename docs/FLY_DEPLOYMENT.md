# Hosted Synth testnet wallet

The site serves the landing page and Docs, with the actual user/admin wallet at `/demo/`.
The existing SYNTH test gateway is configured using private Fly runtime secrets; no credentials are included in the image or repository.
The exact public HTTPS origin is required by the server gateway. Other origins are refused. Wallet and treasury projections must report Sepolia chain ID 11155111.

Invited Owners sign in with Onli ID and approve the request in OnliYou. Accepted user login runs the existing registration/readiness/wallet Journey. Administrators use their authorized Onli identity for Incoming, Master and Outgoing; selecting the admin view grants no authority.

The CSP permits only the configured same-origin gateway, Sepolia observation endpoints, and the Openfort API, Shield and embedded signer hosts. Real private keys remain outside the site backend.

Build: `npm run build:demo`. Deploy: `flyctl deploy --remote-only --ha=false --yes`.
The public connection must be tested with an Owner-approved sign-in before claiming wallet provisioning and a testnet transfer were exercised. Anonymous connection and admission checks do not establish those outcomes.
