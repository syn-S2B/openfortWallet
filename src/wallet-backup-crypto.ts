import { computeAddress } from '@ethersproject/transactions'
import { createWalletBackupCrypto } from './wallet-backup/crypto.ts'
export type { BackupConfig, BackupWallet, WalletBackup } from './wallet-backup/crypto.ts'
export const { backupBinding, backupDigest, backupAuthorizationBody, parseWalletBackup, assertBackupOwner, encryptWalletBackup, createUnlockRecipient, decryptWalletBackup } = createWalletBackupCrypto(computeAddress)
