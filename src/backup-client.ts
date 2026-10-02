import { createWalletBackupClient } from './wallet-backup/client.ts'
import * as crypto from './wallet-backup-crypto'
import { request, type Session } from './species'
export const backupClient = createWalletBackupClient<Session>(request, crypto)
