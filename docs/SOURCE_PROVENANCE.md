# Source provenance

Extracted on 2026-10-01 from the Species wallet demo, with Species HEAD `d481ad8913cd259bd29da7a463f4418ea3b1d0b3`.
Source files were copied from the working tree. This repository contains its own
complete copies; the original checkout is not required at build or runtime.

- UI, local proxy, tests and artwork: `sandbox/usdc-wallet` in Species.
- Included backup helpers: `admin/ui/src/lib/wallet-backup/crypto.ts`, `client.ts`
  and `visibility.ts`, now under `src/wallet-backup/`.
- Extraction changes: local helper imports, explicit credential-free demo mode,
  standalone import/asset check, package metadata and reproduction documentation.
- Openfort SDK: npm dependency `@openfort/openfort-js@2.6.0` and the checked-in lockfile.

Historical incident notes, real account identifiers, local credential files,
provider secrets, generated build output and dependency directories were excluded.
The Phantom artwork is retained from the source demo; third-party names and logos
remain their respective owners' marks. This public snapshot grants no new license to third-party SDKs or branding.
No project open-source license has been selected. Private Git history is excluded
from the public repository; real account identifiers and credentials are not included.
