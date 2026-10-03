import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import Dialog from './Dialog'
import WalletPopup from './WalletPopup'
import WalletBackupDialog from './WalletBackupDialog'
import TreasuryWalletBackup from './TreasuryWalletBackup'
import { exportWallet } from './export-wallet'
import { WalletOperationUnavailable } from './wallet-operation'
import { usePersonalWallet } from './usePersonalWallet'
import { RegistrationOperationError, registrationArguments, type OnboardingJourney, type RegistrationArguments } from './onboarding'
import { formatBalance, SpeciesError, type Session, type Treasury, type Wallet } from './species'

const demo = typeof __WALLET_DEMO__ !== 'undefined' && __WALLET_DEMO__
type Experience = 'user' | 'admin'
import type { Connection } from './capability/tool_capability_wallet_projection.ts'
import { workflow_read_connection, workflow_read_treasury, workflow_read_member_wallet } from './workflow/workflow_read_wallet_context.ts'
import type { AuthenticationChallenge as Challenge } from './contracts/authentication.ts'
import { journey_sign_in } from './journey/journey_sign_in.ts'
import { journey_open_member_wallet } from './journey/journey_open_member_wallet.ts'
const accounts = [
  { id: 'species:incoming', name: 'Incoming', description: 'Receives member deposits' },
  { id: 'species:master', name: 'Master', description: 'Holds settled backing' },
  { id: 'species:outgoing', name: 'Outgoing', description: 'Stages market-maker payouts' },
]
const message = (error: unknown) => error instanceof SpeciesError ? error.message : 'Connection unavailable. Try again.'

export default function App() {
  const [experience, setExperience] = useState<Experience>('user')
  const [connection, setConnection] = useState<Connection | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [onliID, setOnliID] = useState('')
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [treasury, setTreasury] = useState<Treasury | null>(null)
  const [treasuryError, setTreasuryError] = useState('')
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const personal = usePersonalWallet(wallet, session)
  const [walletError, setWalletError] = useState('')
  const [walletCode, setWalletCode] = useState('')
  const [onboarding, setOnboarding] = useState<OnboardingJourney | null>(null)
  const [setupStatus, setSetupStatus] = useState<'idle' | 'working' | 'error'>('idle')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [details, setDetails] = useState('species:master')
  const [walletOpen, setWalletOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [connectionOpen, setConnectionOpen] = useState(false)
  const generation = useRef(0), exportLock = useRef(false), openAfterSignIn = useRef(false)
  const registrationArgs = useRef<RegistrationArguments | null>(null)
  const authenticationAbort = useRef<AbortController | null>(null)
  useEffect(() => () => { authenticationAbort.current?.abort(); registrationAbort.current?.abort(); generation.current++ }, [])
  const registrationAbort = useRef<AbortController | null>(null)

  useEffect(() => { workflow_read_connection().then(setConnection).catch(() => setAuthError('The local Species connection is unavailable.')) }, [])
  const disconnect = () => {
    authenticationAbort.current?.abort(); authenticationAbort.current = null
    registrationAbort.current?.abort(); registrationAbort.current = null; registrationArgs.current = null
    generation.current++; openAfterSignIn.current = false
    setSession(null); setChallenge(null); setTreasury(null); setWallet(null)
    setTreasuryError(''); setWalletError(''); setWalletCode(''); setOnboarding(null); setSetupStatus('idle'); setNotice(''); setWalletOpen(false); setBackupOpen(false); setLoading(false)
    setBusy(false); setAuthBusy(false); setAuthError(''); setOnliID('')
  }
  const changeExperience = (next: Experience) => {
    if (next === experience) return
    disconnect(); setExperience(next)
  }
  // User sessions never probe treasury. Only its authorized server response
  // admits the admin dashboard; selecting the view does not grant a role.
  const refresh = useCallback(async () => {
    if (!session) return
    const current = generation.current
    setLoading(true)
    if (experience === 'admin') {
      try {
        const value = await workflow_read_treasury(session)
        if (generation.current === current) { setTreasury(value); setTreasuryError('') }
      } catch (error) { if (generation.current === current) { setTreasury(null); setTreasuryError(message(error)) } }
    } else {
      try {
        const value = await workflow_read_member_wallet(session)
        if (generation.current === current) {
          setWallet(value); setWalletError(''); setWalletCode('')
          if (openAfterSignIn.current) { openAfterSignIn.current = false; setWalletOpen(true) }
        }
      } catch (error) {
        if (generation.current === current) { setWallet(null); setWalletError(message(error)); setWalletCode(error instanceof SpeciesError ? error.code : '') }
      }
    }
    if (generation.current === current) setLoading(false)
  }, [session, experience])
  useEffect(() => { void refresh() }, [refresh])
  async function signIn(event: FormEvent) {
    event.preventDefault()
    const current = generation.current
    authenticationAbort.current?.abort()
    const controller = new AbortController(); authenticationAbort.current = controller
    setAuthBusy(true); setAuthError('')
    try {
      const result = await journey_sign_in(onliID, controller.signal, value => { if (generation.current === current && authenticationAbort.current === controller && !controller.signal.aborted) setChallenge(value) })
      if (generation.current !== current || controller.signal.aborted) return
      if (result.state === 'completed') {
        registrationArgs.current = registrationArguments(result.onboarding)
        setOnboarding(result.onboarding || null); setSetupStatus('idle')
        generation.current++; openAfterSignIn.current = experience === 'user'
        setSession(result.session); setChallenge(null); setAuthError(''); setAuthBusy(false)
        if (experience === 'user') {
          const signedGeneration = generation.current
          setLoading(true)
          try {
            const opened = await journey_open_member_wallet({ session: result.session, registration: registrationArgs.current || undefined, signal: controller.signal, isCurrent: () => generation.current === signedGeneration })
            if (generation.current === signedGeneration) applyWalletOutcome(opened)
          } catch (error) {
            if (generation.current === signedGeneration && !controller.signal.aborted) setWalletError(message(error))
          } finally { if (generation.current === signedGeneration) setLoading(false) }
        }
      } else if (result.state === 'failed') { setChallenge(null); setAuthError(result.message) }
    } catch (error) { if (generation.current === current && !controller.signal.aborted) { setChallenge(null); setAuthError(message(error)) } }
    finally { if (generation.current === current && authenticationAbort.current === controller) setAuthBusy(false) }
  }
  function applyWalletOutcome(result: Awaited<ReturnType<typeof journey_open_member_wallet>>) {
    if (!result) return
    if ('operationId' in result) {
      setWalletCode('registration_pending'); setWalletError(result.state === 'indeterminate' ? 'Registration outcome is unknown. Retry setup to reconcile the same Species operation.' : 'Species is still setting up this member. Retry setup to check the same operation.')
      return
    }
    setOnboarding(result.readiness)
    if (result.wallet) { setWallet(result.wallet); setWalletError(''); setWalletCode(''); setWalletOpen(true) }
    else { setWallet(null); setWalletCode('onboarding_prerequisite'); setWalletError(result.reason) }
  }
  async function setupMember() {
    if (!session || busy || setupStatus === 'working') return
    const owner = session; const current = generation.current
    const args = registrationArgs.current || registrationArguments(onboarding)
    if (!args) {
      setSetupStatus('error'); setWalletCode('registration_journey_missing')
      setWalletError('Species did not return the registration journey. Sign in again to receive a fresh setup request.')
      return
    }
    const controller = new AbortController()
    registrationAbort.current = controller
    setBusy(true); setSetupStatus('working'); setWalletError(''); setWalletCode('')
    try {
      const result = await journey_open_member_wallet({ session: owner, registration: args, signal: controller.signal, isCurrent: () => generation.current === current })
      if (generation.current === current) applyWalletOutcome(result)
      if (generation.current === current) setSetupStatus('idle')
    } catch (error) {
      if (generation.current !== current) return
      if (error instanceof DOMException && error.name === 'AbortError') {
        setSetupStatus('idle'); setWalletError('Setup paused. Retry to check the same Species operation.')
      } else {
        setSetupStatus('error')
        setWalletCode(error instanceof SpeciesError ? error.code : error instanceof RegistrationOperationError ? error.code : 'registration_failed')
        setWalletError(error instanceof SpeciesError || error instanceof RegistrationOperationError ? error.message : 'Species could not finish member setup. Retry to continue the same operation.')
      }
    } finally {
      if (registrationAbort.current === controller) registrationAbort.current = null
      if (generation.current === current) setBusy(false)
    }
  }
  function cancelSetup() {
    registrationAbort.current?.abort()
  }
  async function ensureWallet() {
    if (!session || busy) return
    const owner = session; const current = generation.current; setBusy(true); setWalletError('')
    try {
      const result = await journey_open_member_wallet({ session: owner, isCurrent: () => generation.current === current })
      if (generation.current === current) applyWalletOutcome(result)
    } catch (error) {
      if (generation.current === current) { setWalletCode(error instanceof SpeciesError ? error.code : 'readiness_failed'); setWalletError(message(error)) }
    } finally { if (generation.current === current) setBusy(false) }
  }
  async function download() {
    if (!session || !wallet || exportLock.current || personal.busy) return
    exportLock.current = true; setBusy(true); setNotice('Encrypting your wallet file…')
    const current = generation.current
    try {
      await exportWallet(session, wallet, () => generation.current === current)
      if (generation.current === current) setNotice('Encrypted download started. Open it here with OnliYou approval when you are ready to import into Phantom.')
    } catch (error) { if (generation.current === current) setNotice(error instanceof WalletOperationUnavailable ? error.message : 'Wallet export was not completed. Check the wallet’s recovery setup, then reload this app before trying again.') }
    finally { exportLock.current = false; if (generation.current === current) setBusy(false) }
  }
  const selected = treasury?.accounts.find(account => account.id === details)
  const selectedLabel = accounts.find(account => account.id === details)?.name ?? 'Account'
  const registrationVisible = walletCode === 'member_not_found' || onboarding?.next_tool === 'journey_member_registration' || setupStatus === 'error'
  const login = <section className="login-panel" aria-labelledby="login-title">
    <p className="eyebrow">{experience === 'admin' ? 'Operator access' : 'PLATFORM WALLET'}</p>
    <h2 id="login-title">{experience === 'admin' ? 'Admin login' : 'Sign in with Onli'}</h2>
    <p>{experience === 'admin' ? 'Use your administrator’s Onli identity to view Incoming, Master and Outgoing.' : 'Accept your Synth invitation, then approve sign-in in OnliYou. Your wallet is set up and opens here.'}</p>{demo && <p><a href="/Docs/onliyou.html">First time? Download OnliYou and join Synth →</a></p>}
    <form onSubmit={signIn}><label>Onli email or ID<input value={onliID} onChange={event => setOnliID(event.target.value)} placeholder="you@example.com or usr-…" required autoComplete="off" disabled={!connection?.configured || authBusy || !!challenge} /></label><button className="primary" disabled={!connection?.configured || authBusy || !!challenge || !onliID.trim()}>{authBusy ? 'Requesting approval…' : challenge ? 'Waiting for Onli…' : 'Sign in with Onli'}</button></form>
    {challenge && <p role="status">Approve the sign-in in Onli. <button className="inline-button" onClick={() => { authenticationAbort.current?.abort(); setChallenge(null); setAuthBusy(false) }}>Cancel</button></p>}
    {authError && <p className="error-message" role="alert">{authError}</p>}
    {!connection?.configured && <p className="connection-note">{connection ? 'Connect a Species instance to enable sign-in.' : 'Checking the Species connection…'} <button className="inline-button" onClick={() => setConnectionOpen(true)}>Connection settings</button></p>}
    {experience === 'user' && <button className="preview-button" data-wallet-opener onClick={() => setWalletOpen(true)}>Preview wallet UI ↗</button>}
  </section>
  return <main className={`test-platform experience-${experience}`}>
    <header className="platform-toolbar"><div><span className="platform-brand">{demo ? 'SYNTH' : 'SPECIES'}</span><span className="platform-caption">{demo ? 'Synth · Sepolia testnet' : 'Experience test platform'}</span></div><a className="site-docs-link" href="/Docs/index.html">Docs</a><a className="site-docs-link" href="https://github.com/syn-S2B/openfortWallet">GitHub</a><nav className="experience-switch" aria-label="Experience"><button aria-pressed={experience === 'user'} onClick={() => changeExperience('user')}>User experience</button><button aria-pressed={experience === 'admin'} onClick={() => changeExperience('admin')}>Admin experience</button></nav><button className="connection-button" onClick={() => setConnectionOpen(true)}>{connection?.configured ? 'Instance connected' : 'Connect instance'} <span aria-hidden="true">↗</span></button></header>
    <div className="experience-stage">
      {experience === 'user' ? <section className="user-shell">
        <header className="user-header"><span className="platform-brand">{demo ? 'SYNTH' : 'SPECIES'}</span>{session && <button className="chip" onClick={disconnect}>Sign out</button>}</header>
        <div className="user-content"><div className="user-intro"><p className="eyebrow">The user experience</p><h1>Your wallet.<br />Your world.</h1><p>One Onli sign-in. A platform wallet that stays with you.</p><span className="user-intro-note">{connection?.configured && connection.appliance_symbol ? `Appliance · ${connection.appliance_symbol}` : 'Appliance not configured'}</span></div>
          {!session ? login : <section className="login-panel"><p className="eyebrow">Signed in with Onli</p><h2>PLATFORM WALLET</h2><p className="identity-line">{session.onli_id}</p>{loading ? <p role="status">Opening your wallet…</p> : wallet ? <><p>{wallet.network}</p><button className="primary" data-wallet-opener onClick={() => setWalletOpen(true)}>Open wallet ↗</button><button className="preview-button" onClick={() => void refresh()}>Refresh wallet</button></> : <><p role="status">{walletError || 'Your wallet is not available yet.'}</p>{registrationVisible ? <><button className="primary" disabled={busy} onClick={() => void setupMember()}>{setupStatus === 'working' ? 'Setting up…' : setupStatus === 'error' ? 'Retry setup' : 'Set up my wallet'}</button>{setupStatus === 'working' && <button className="inline-button" onClick={cancelSetup}>Cancel setup</button>}</> : ['member_wallet_required', 'member_wallet_pending'].includes(walletCode) && <button className="primary" disabled={busy} onClick={() => void ensureWallet()}>{busy ? 'Checking Species…' : walletCode === 'member_wallet_pending' ? 'Reconcile wallet' : 'Set up my wallet'}</button>}</>}</section>}
        </div>
      </section> : <section className="admin-shell">
        <header className="admin-header"><h1>Species <span>Admin · Treasury</span></h1>{session && <div className="admin-controls"><button onClick={() => void refresh()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button><button onClick={disconnect}>Sign out</button></div>}</header>
        {!session ? <div className="admin-entry"><aside><p className="eyebrow">The admin experience</p><h2>One view of<br />the treasury.</h2><p>Read Incoming, Master and Outgoing with an authorized administrator session.</p></aside>{login}</div> : !treasury ? <div className="admin-gate" role="status"><h2>{loading ? 'Verifying admin access…' : 'Admin access required'}</h2><p>{loading ? 'Checking the signed-in identity with Species.' : treasuryError || 'This session cannot read treasury accounts.'}</p><button className="primary" onClick={disconnect}>Use another Onli identity</button></div> : <div className="admin-panels">
          <section className="admin-read"><div className="panel-heading"><div><p className="eyebrow">Treasury accounts</p><h2>Incoming → Master → Outgoing</h2></div><span className="status-pill">Authorized</span></div><div className="treasury-list">{accounts.map(account => {
            const live = treasury.accounts.find(value => value.id === account.id)
            return <button key={account.id} className={`treasury-row ${details === account.id ? 'selected' : ''}`} aria-pressed={details === account.id} onClick={() => setDetails(account.id)}><span><strong>{account.name}</strong><small>{account.description}</small></span><span className="treasury-value">{live ? formatBalance(live.balance_minor, live.scale) : 'Unavailable'}<small>{live?.currency || '—'}</small></span></button>
          })}</div><p className="read-note">{treasury.network} · Read {new Date(treasury.checked_at).toLocaleTimeString()}</p></section>
          <section className="admin-detail"><p className="eyebrow">Account details</p><h2>{selectedLabel}</h2><dl><div><dt>Balance</dt><dd>{selected ? `${formatBalance(selected.balance_minor, selected.scale)} ${selected.currency}` : 'Unavailable'}</dd></div><div><dt>Account</dt><dd>{details}</dd></div><div><dt>Address</dt><dd>{selected?.address || 'Not supplied by this instance'}</dd></div><div><dt>Adapter</dt><dd>{treasury.adapter}</dd></div></dl>{selected?.address && treasury.chain_id && treasury.adapter === 'openfort-usdc-evm' && <TreasuryWalletBackup key={`${session.token}:${details}`} session={session} accountID={details} name={selectedLabel} address={selected.address} chainID={treasury.chain_id} />}</section>
        </div>}
      </section>}
    </div>
    <footer className="platform-footer"><span>{experience === 'user' ? 'User experience · Popup wallet' : 'Admin experience · Flat treasury dashboard'}</span><span>{connection?.gateway_url || 'No instance connected'}</span></footer>
    {experience === 'user' && walletOpen && <WalletPopup wallet={wallet} personal={personal} owner={session?.onli_id} busy={busy || personal.busy} notice={notice} onClose={() => { setWalletOpen(false); setBackupOpen(false) }} onDownload={() => void download()} onOpenBackup={() => setBackupOpen(true)} />}
    {backupOpen && session && wallet && <WalletBackupDialog key={session.token} session={session} wallet={wallet} onClose={() => setBackupOpen(false)} />}
    {connectionOpen && <Dialog title="Instance connection" onClose={() => setConnectionOpen(false)}><h2>Instance connection</h2><p>{connection?.configured ? `Connected to ${connection.gateway_url}` : connection?.message || 'The local connection is unavailable.'}</p><p>Both experiences use the connected Species instance. Switching experience signs out of the current session.</p></Dialog>}
  </main>
}
