import { journey_export_wallet_backup } from './journey/journey_export_wallet_backup.ts'
import { OperationIndeterminate } from './contracts/operation.ts'
import { workflow_resolve_treasury_backup } from './workflow/workflow_resolve_treasury_backup.ts'
import { useEffect, useRef, useState } from 'react'
import WalletBackupDialog from './WalletBackupDialog'
import { SpeciesError, type Session } from './species'
import { type TreasuryBackupConfig } from './treasury-wallet-backup'

export default function TreasuryWalletBackup({ session, accountID, name, address, chainID }: { session:Session; accountID:string; name:string; address:string; chainID:number }) {
  const [config,setConfig] = useState<TreasuryBackupConfig|null>(null)
  const [open,setOpen] = useState(false), [busy,setBusy] = useState(false), [notice,setNotice] = useState('')
  const active = useRef<AbortController|null>(null), generation = useRef(0)
  const backupPath = `/treasury/${accountID.replace('species:','')}/wallet/backup`
  useEffect(() => () => { generation.current++; active.current?.abort() },[session.token,accountID])
  async function run(download:boolean) {
    if (active.current) return
    const controller = new AbortController(); active.current=controller
    const current=++generation.current; setBusy(true); setNotice('Checking wallet backup availability…')
    try {
      if (download) {
        setNotice(`Approve the ${name} wallet download in OnliYou.`)
        await journey_export_wallet_backup({ scope: 'treasury', session, account: { id: accountID, address, chainId: chainID }, signal: controller.signal })
        if (current === generation.current) setNotice('Encrypted download started. Opening the file requires a fresh OnliYou approval.')
      } else {
        const { config: value } = await workflow_resolve_treasury_backup(session, { id: accountID, address, chainId: chainID }, controller.signal)
        if (controller.signal.aborted || current !== generation.current) return
        setConfig(value); setNotice(''); setOpen(true)
      }
    } catch (error) {
      if (current === generation.current && !controller.signal.aborted) setNotice(error instanceof OperationIndeterminate ? 'The export response was not confirmed. The previous approval may have been consumed. A new attempt requires fresh OnliYou approval.' : error instanceof SpeciesError ? error.message : 'Wallet backup could not finish. Refresh and approve a fresh request to retry.')
    } finally { if (current === generation.current) { active.current=null; setBusy(false) } }
  }
  return <div className="treasury-backup">
    <div className="backup-actions"><button className="primary" disabled={busy} onClick={() => void run(true)}>{busy ? 'Waiting for OnliYou…' : 'Download encrypted wallet'}</button><button disabled={busy} onClick={() => void run(false)}>Open encrypted file</button></div>
    <p>Wallet credentials stay encrypted. Verify with OnliYou to download or open them.</p>
    {busy && <button className="inline-button" onClick={() => { generation.current++; active.current?.abort(); active.current=null; setBusy(false); setNotice('Cancelled.') }}>Cancel request</button>}
    {notice && <p role="status">{notice}</p>}
    {open && config && <WalletBackupDialog key={`${session.token}:${accountID}`} session={session} wallet={config.wallet} backupPath={backupPath} treasuryName={name} onClose={() => setOpen(false)} />}
  </div>
}
