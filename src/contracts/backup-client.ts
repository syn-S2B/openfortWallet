import type { BackupConfig, BackupWallet } from '../wallet-backup/crypto.ts'
export type BackupOwner = { onli_id: string }
export type BackupRequest<S> = <T>(
  path: string,
  session: S,
  body?: unknown,
  headers?: Record<string, string>,
) => Promise<T>
export type TreasuryBackupWallet = BackupWallet & { account_id: string; adapter: string; network: string }
export type TreasuryBackupConfig = BackupConfig & { export_behavior: string; wallet: TreasuryBackupWallet }
