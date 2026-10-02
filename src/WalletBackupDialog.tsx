import { OperationIndeterminate } from './contracts/operation.ts'
import { useEffect, useRef, useState } from 'react'
import Dialog from './Dialog'
import { openWalletBackup } from './open-wallet-backup'
import { parseWalletBackup, type WalletBackup, type BackupWallet } from './wallet-backup-crypto'
import { SpeciesError, type Session } from './species'
import './WalletBackupDialog.css'

type Props = { session: Session; wallet: BackupWallet; onClose: () => void; backupPath?: string; treasuryName?: string }

export default function WalletBackupDialog(props: Props) {
  const { session, wallet, backupPath } = props
  // Remount before rendering a different wallet/session. An effect alone can
  // briefly expose the old key and preserve its file input or pending state.
  const binding = JSON.stringify([session.token, session.onli_id, wallet.account_ref, wallet.address.toLowerCase(), wallet.chain_id, backupPath || ''])
  return <BoundWalletBackupDialog key={binding} {...props} />
}

function BoundWalletBackupDialog({ session, wallet, onClose, backupPath, treasuryName }: Props) {
  const [file, setFile] = useState<WalletBackup | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [revealed, setRevealed] = useState<{ privateKey: string; expiresAt: number } | null>(null)
  const controller = useRef<AbortController | null>(null)
  const generation = useRef(0)
  useEffect(() => {
    const lock = () => {
      if (document.visibilityState === 'hidden') {
        setRevealed(null)
      }
    }
    document.addEventListener('visibilitychange', lock)
    return () => { generation.current++; controller.current?.abort(); document.removeEventListener('visibilitychange', lock) }
  }, [session.token, wallet.account_ref])
  useEffect(() => {
    if (!revealed) return
    const timer = setTimeout(() => { generation.current++; setRevealed(null); setNotice('Locked. Approve in OnliYou to open again.') }, Math.max(0, revealed.expiresAt - Date.now()))
    return () => clearTimeout(timer)
  }, [revealed])
  async function choose(selected?: File) {
    generation.current++; controller.current?.abort(); setRevealed(null); setFile(null); setBusy(false); setNotice('')
    if (!selected) return
    const current = generation.current
    try {
      if (selected.size > 16_384) throw new Error('This file is too large. Choose an encrypted Species wallet file.')
      const parsed = parseWalletBackup(await selected.text())
      if (current === generation.current) setFile(parsed)
    } catch { if (current === generation.current) setNotice('Choose a valid encrypted Species wallet file.') }
  }
  async function unlock() {
    if (!file || busy || revealed) return
    const active = new AbortController(); controller.current = active
    const current = ++generation.current
    setBusy(true); setNotice('Approve “open-wallet-backup” in OnliYou to reveal this wallet’s key.')
    try {
      const result = await openWalletBackup(file, session, wallet, active.signal, backupPath)
      if (!active.signal.aborted && current === generation.current) {
        if (document.visibilityState === 'hidden') setNotice('Locked while this page was hidden. Request a fresh approval to open again.')
        else { setRevealed(result); setNotice('Open for up to 60 seconds. Keep this key private.') }
      }
    } catch (error) {
      if (!active.signal.aborted && current === generation.current) setNotice(error instanceof OperationIndeterminate ? 'The key-release response was not confirmed. That approval may have been consumed. A new attempt requires fresh OnliYou approval.' : error instanceof SpeciesError ? error.message : 'The file could not be opened. Check your file and approve a fresh request in OnliYou.')
    } finally { if (current === generation.current) setBusy(false) }
  }
  async function copy() {
    if (!revealed || revealed.expiresAt <= Date.now()) { setRevealed(null); return }
    const current = generation.current
    try {
      await navigator.clipboard.writeText(revealed.privateKey)
      if (current === generation.current) setNotice('Key copied. In Phantom, choose Import Private Key → Ethereum. Clear your clipboard after importing.')
    } catch { if (current === generation.current) setNotice('Clipboard unavailable. Select the key to copy it.') }
  }
  return <Dialog title="Open encrypted wallet" className="backup-dialog" onClose={onClose}>
    <p className="eyebrow">{treasuryName ? `${treasuryName} · Admin wallet backup` : 'Take your wallet with you'}</p>
    <h2>Open with OnliYou.</h2>
    <p>Your saved file stays encrypted. Approve a fresh request to reveal the key here for import into Phantom.</p>
    <label className="backup-file">Encrypted wallet file<input type="file" accept=".json,application/json" disabled={busy} onChange={event => void choose(event.target.files?.[0])} /></label>
    {file && <p className="backup-address">{file.address}</p>}
    {revealed ? <>
      <label className="backup-file">Private key<textarea className="backup-key" aria-label="Private key" value={revealed.privateKey} readOnly spellCheck={false} autoComplete="off" /></label>
      <div className="backup-actions"><button className="primary" onClick={() => void copy()}>Copy for Phantom</button><button onClick={() => { generation.current++; setRevealed(null); setNotice('Locked.') }}>Lock now</button></div>
      <p>After import, Phantom controls access to your wallet. Anyone with this key can use it.</p>
    </> : <button className="primary" disabled={!file || busy} onClick={() => void unlock()}>{busy ? 'Waiting for OnliYou…' : 'Verify with OnliYou & open'}</button>}
    {busy && <button className="inline-button" onClick={() => { generation.current++; controller.current?.abort(); setBusy(false); setNotice('Cancelled. A fresh approval is required to try again.') }}>Cancel request</button>}
    {notice && <p className="backup-notice" role="status">{notice}</p>}
  </Dialog>
}
