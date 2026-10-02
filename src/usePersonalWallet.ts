import { createTransferConfirmation } from './contracts/transfer-confirmation.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type Session, type Wallet } from './species'
import { workflow_resolve_incoming_target } from './workflow/workflow_read_wallet_context.ts'
import { WalletError, type Activity, type Asset, type Balances, type Quote } from './wallet-chain'
import { sendWallet } from './send-wallet'
import { WalletActionError } from './export-core'
import { WalletReloadRequired } from './export-cleanup'
import { WalletOperationUnavailable } from './wallet-operation'
import { assertWalletSessionReady, walletSessionNeedsReload } from './wallet-sdk'

import { parseSubmission, type Submission } from './resource/transfer-operation.ts'
import { journey_send_transfer } from './journey/journey_send_transfer.ts'
import { workflow_review_transfer } from './workflow/workflow_review_transfer.ts'
import { workflow_read_wallet_observations } from './workflow/workflow_read_wallet_observations.ts'
import { workflow_reconcile_transfer } from './workflow/workflow_reconcile_transfer.ts'
import { walletPollingRecipe } from './recipe/wallet-networks.ts'
export function usePersonalWallet(wallet: Wallet | null, session: Session | null) {
  const [balances, setBalances] = useState<Balances | null>(null)
  const [activity, setActivity] = useState<Activity[]>([])
  const [balanceError, setBalanceError] = useState(''), [activityError, setActivityError] = useState('')
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false)
  const [quote, setQuote] = useState<Quote | null>(null), [error, setError] = useState('')
  const [reloadRequired, setReloadRequired] = useState(walletSessionNeedsReload)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [showOutcome, setShowOutcome] = useState(true)
  const [incoming, setIncoming] = useState(''), [incomingError, setIncomingError] = useState(''), [incomingLoading, setIncomingLoading] = useState(false)
  const incomingSequence = useRef(0)
  const generation = useRef(0), lock = useRef(false), readSequence = useRef(0)
  const storageKey = wallet ? `species-wallet-submission:${wallet.chain_id}:${wallet.address.toLowerCase()}` : ''
  async function loadIncoming() {
    if (!wallet || !session) return ''
    const current = generation.current, sequence = ++incomingSequence.current
    setIncoming(''); setIncomingError(''); setIncomingLoading(true)
    try {
      const address = await workflow_resolve_incoming_target(session, wallet)
      if (current !== generation.current || sequence !== incomingSequence.current) return ''
      setIncoming(address); return address
    } catch {
      if (current === generation.current && sequence === incomingSequence.current) setIncomingError('Incoming address unavailable. Retry or choose “Paste an address”.')
      return ''
    } finally { if (current === generation.current && sequence === incomingSequence.current) setIncomingLoading(false) }
  }
  const refresh = useCallback(async () => {
    if (!wallet) return
    const current = generation.current, sequence = ++readSequence.current; setLoading(true)
    const results = await workflow_read_wallet_observations(wallet)
    if (current === generation.current && sequence === readSequence.current) {
      const { balances: balance, activity: history } = results
      if (balance.status === 'fulfilled') { setBalances(balance.value ?? null); setBalanceError('') }
      else { setBalances(null); setBalanceError('Balance could not be loaded. Refresh to try again.') }
      if (history.status === 'fulfilled') { setActivity(history.value ?? []); setActivityError('') }
      else { setActivity([]); setActivityError('Activity is unavailable. You can still check the explorer.') }
      setLoading(false)
    }
  }, [wallet])
  useEffect(() => {
    generation.current++; setBalances(null); setActivity([]); setQuote(null); setError(''); setSubmission(null); setShowOutcome(true); setBusy(false); setLoading(false); setBalanceError(''); setActivityError('')
    incomingSequence.current++; setIncoming(''); setIncomingError(''); setIncomingLoading(false)
    if (storageKey) {
      try {
        setSubmission(parseSubmission(localStorage.getItem(storageKey)))
      } catch { /* no credentials or private material are stored */ }
    }
    const sync = (event: StorageEvent) => {
      if (event.key !== storageKey) return
      try { setSubmission(parseSubmission(event.newValue)); setShowOutcome(true); setQuote(null) } catch { /* malformed storage never authorizes a send */ }
    }
    window.addEventListener('storage', sync)
    void refresh()
    const timer = window.setInterval(() => { if (!document.hidden) void refresh() }, walletPollingRecipe.observationMs)
    return () => { generation.current++; window.clearInterval(timer); window.removeEventListener('storage', sync) }
  }, [refresh, storageKey, session?.token])
  useEffect(() => {
    if (!wallet || !submission?.hash || !['pending', 'unknown'].includes(submission.status)) return
    let stopped = false
    const check = async () => {
      try {
        const next = await workflow_reconcile_transfer({ wallet, operation: submission, key: storageKey, storage: localStorage, isCurrent: () => !stopped })
        if (next && !stopped) { setSubmission(next); void refresh() }
      } catch { /* Keep pending on an unavailable RPC; never report success without a receipt. */ }
    }
    void check(); const timer = window.setInterval(() => void check(), walletPollingRecipe.receiptMs)
    return () => { stopped = true; clearInterval(timer) }
  }, [wallet, submission, storageKey, refresh])
  async function review(asset: Asset, recipient: string, amount: string, destination: 'incoming' | 'custom' = 'custom') {
    if (!wallet || lock.current || reloadRequired || ['pending','unknown'].includes(submission?.status || '')) return
    lock.current = true; setBusy(true); setError(''); setQuote(null); setShowOutcome(false)
    const current = generation.current
    try {
      assertWalletSessionReady()
      const next = await workflow_review_transfer({ wallet, asset, recipient, amount, destination, storage: localStorage, key: storageKey, loadIncoming, isCurrent: () => current === generation.current })
      if (current === generation.current) setQuote(next)
    }
    catch (error) { if (current === generation.current) {
      setReloadRequired(walletSessionNeedsReload())
      setError(error instanceof WalletError || error instanceof WalletReloadRequired ? error.message : 'Could not prepare the transfer. Refresh and try again.')
    } }
    finally { lock.current = false; if (current === generation.current) setBusy(false) }
  }
  async function confirm() {
    if (!wallet || !session || !quote || lock.current || reloadRequired || ['pending','unknown'].includes(submission?.status || '')) return
    lock.current = true; setBusy(true); setError('')
    const current = generation.current, requested = quote, key = storageKey
    try {
      const result = await journey_send_transfer({ confirmation: createTransferConfirmation(requested), session, wallet, quote: requested, key, storage: localStorage, isCurrent: () => current === generation.current, send: sendWallet, changed: next => {
        if (current === generation.current) { setSubmission(next); setShowOutcome(true) }
      } })
      if (current === generation.current) {
        setQuote(null)
        if (result.state === 'indeterminate') setError('Submission could not be confirmed. The original operation must be reconciled before sending again.')
      }
    } catch (error) {
      if (import.meta.env.DEV && error instanceof WalletActionError) console.warn('Wallet operation failed', JSON.stringify(error.diagnostic))
      if (current === generation.current) {
        setQuote(null)
        setError(error instanceof WalletError || error instanceof WalletActionError || error instanceof WalletReloadRequired || error instanceof WalletOperationUnavailable ? error.message : 'Signing did not complete. Reload the app and sign in again.')
      }
    } finally { lock.current = false; if (current === generation.current) { setBusy(false); setReloadRequired(walletSessionNeedsReload()) } }
  }
  return { balances, activity, balanceError, activityError, loading, busy, quote, error, reloadRequired, submission, showOutcome, refresh, review, confirm,
    incoming, incomingError, incomingLoading, loadIncoming,
    newTransfer: () => {
      if (lock.current || reloadRequired || ['pending', 'unknown'].includes(submission?.status || '')) return false
      // Dismiss only the presentation. Retain the receipt and the cross-tab
      // duplicate guard; review/confirm always re-read that guard before sending.
      setShowOutcome(false); setQuote(null); setError(''); return true
    },
    edit: () => { if (!lock.current) { setQuote(null); if (!reloadRequired) setError('') } },
    acknowledgeUnknown: async () => {
      setError('This transfer remains unresolved. Acknowledgment cannot prove that it did not happen. Replacement transfers remain blocked.')
    },
  }
}
export type PersonalWallet = ReturnType<typeof usePersonalWallet>
