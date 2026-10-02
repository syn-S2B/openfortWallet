export type Session = { token: string; onli_id: string }
import type { OnboardingJourney } from '../onboarding.ts'
export type { OnboardingAction, OnboardingJourney } from '../onboarding.ts'
export type Wallet = {
  account_ref: string
  user_ref: string
  wallet_ref: string
  address: string
  adapter: string
  network: string
  chain_id: number
  account_type: string
  custody: string
  instructions: string[]
  wallet_download_url?: string
}
export type WalletAccess = {
  wallet: Wallet
  publishable_key: string
  shield_publishable_key: string
  auth_provider: string
  auth_token: string
  encryption_session: string
  expires_at: number
}
export type Treasury = {
  adapter: string
  network: string
  chain_id?: number
  checked_at: string
  accounts: {
    id: string
    name: string
    balance_minor: number | null
    scale: number
    currency: string
    address?: string
    provider_id?: string
  }[]
}
export class SpeciesError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message)
  }
}
export type MemberReadiness = OnboardingJourney & {
  onli_id?: string
  owner?: string
  ready_to_transact?: boolean
  trading_ability?: boolean
  money_transfer_ability?: boolean
  member_wallet?: Wallet | null
  funding_target?: {
    adapter: string
    settlement_account: string
    settlement_address?: string
    denomination: string
    available: boolean
  }
}
export type RegistrationStart = {
  operation?: { operation_id?: string; state?: string; [key: string]: unknown }
  result?: unknown
  receipt?: unknown
}
