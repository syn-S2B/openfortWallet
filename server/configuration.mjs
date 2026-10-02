import { loadEnvFile } from 'node:process'
import { configuration } from './gateway.mjs'

// Demo is an explicit visual preview, even if this shell has real credentials.
export function loadWalletConfiguration(mode, env = process.env, load = loadEnvFile) {
  if (mode === 'demo') return configuration({})
  if (env.SPECIES_WALLET_ENV_FILE) load(env.SPECIES_WALLET_ENV_FILE)
  return configuration(env)
}
