import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { Wallet } from './species'
import { findWalletNetwork, formatUnits, type Asset } from './wallet-chain'
import type { PersonalWallet } from './usePersonalWallet'
import './WalletTools.css'

export default function WalletTools({ wallet, personal, hidden, busy }: {
  wallet: Wallet | null; personal: PersonalWallet; hidden: boolean; busy: boolean
}) {
  const [view, setView] = useState<'home' | 'receive' | 'send' | 'activity'>('home')
  const [asset, setAsset] = useState<Asset>('USDC'), [recipient, setRecipient] = useState(''), [amount, setAmount] = useState('')
  const [destination, setDestination] = useState<'incoming' | 'custom'>('incoming')
  const [copied, setCopied] = useState(false)
  const locked = busy || personal.busy
  const blocked = ['pending','unknown'].includes(personal.submission?.status || '')
  const showResult = !!personal.submission && (blocked || personal.showOutcome) && !personal.quote
  const balance = personal.balances
  const network = wallet ? findWalletNetwork(wallet.chain_id) : undefined
  const networkName = network?.name || 'Unsupported network'
  const explorer = network && wallet ? `${network.explorer}/address/${wallet.address}` : undefined
  const copy = async () => { if (!wallet) return; try { await navigator.clipboard.writeText(wallet.address); setCopied(true) } catch { setCopied(false) } }
  const changeView = (next: typeof view) => {
    if (locked) return
    personal.edit(); setView(next)
    if (next === 'send') {
      if (personal.newTransfer()) setAmount('')
      if (destination === 'incoming') void personal.loadIncoming()
    }
  }
  const sendAddress = destination === 'incoming' ? personal.incoming : recipient
  const newTransfer = () => {
    if (locked || !personal.newTransfer()) return
    setAmount(''); setRecipient(''); setAsset('USDC'); setDestination('incoming')
    void personal.loadIncoming()
  }
  return <div className="wallet-tools" data-view={view}>
    <div className="wallet-tools-heading">
      {view === 'home' ? <span><i />{wallet ? networkName : 'Wallet preview'}</span> : <button onClick={() => changeView('home')} disabled={locked}>← {view === 'receive' ? 'Receive' : view === 'send' ? 'Send' : 'Activity'}</button>}
      <button aria-label="Refresh wallet balances and activity" disabled={!wallet || personal.loading || locked} onClick={() => void personal.refresh()} className={personal.loading ? 'refreshing' : ''}>↻</button>
    </div>
    {view === 'send' && personal.error && <p className="wallet-inline-error wallet-send-error" role="alert">{personal.error}</p>}
    <div className="wallet-tools-content">
      {view === 'home' && <>
        <div className="wallet-overview">
        <div className="wallet-total"><strong>{hidden ? '••••••' : balance ? formatUnits(balance.usdc, 'USDC', 6) : personal.loading ? '…' : '—'}</strong><span>USDC</span></div>
        <p className="wallet-gas">{hidden ? '••••' : balance ? formatUnits(balance.eth, 'ETH', 8) : '—'} ETH <span>for network fees</span></p>
        {personal.balanceError && <p className="wallet-inline-error" role="status">{personal.balanceError}</p>}
        </div>
        <div className="wallet-main-actions">
          <button disabled={!wallet || !network || locked} onClick={() => changeView('receive')}><span>↓</span>Receive</button>
          <button disabled={!wallet || !network || locked} onClick={() => changeView('send')}><span>↗</span>Send</button>
          <button disabled={!wallet || !network || locked} onClick={() => changeView('activity')}><span>≡</span>Activity</button>
        </div>
        <div className="wallet-tools-footer">
          <div className="wallet-footer-actions"><button disabled={!wallet} onClick={() => void copy()}>{copied ? 'Copied ✓' : wallet ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)} ⧉` : 'Not connected'}</button></div>
          <p className="wallet-network-note">{network ? network.testnet ? 'Test tokens only · Ethereum Sepolia' : 'Real USDC · Ethereum mainnet' : wallet ? 'No supported network connected' : 'Sign in to use Receive, Send, and Activity.'}</p>
        </div>
      </>}
      {view === 'receive' && wallet && network && <div className="wallet-receive">
        <QRCodeSVG value={`ethereum:${wallet.address}@${wallet.chain_id}`} size={112} marginSize={2} level="M" title={`Receive address on ${networkName}`} />
        <div className="wallet-receive-details"><p>Receive USDC or ETH on <strong>{networkName} only</strong>.</p>
          <button className="wallet-primary" onClick={() => void copy()}>{copied ? 'Address copied ✓' : 'Copy address'}</button>
          <a href={explorer} target="_blank" rel="noreferrer">View address on explorer ↗</a>
        </div>
        <code aria-label="Wallet address">{wallet.address}</code>
      </div>}
      {view === 'send' && !personal.reloadRequired && !personal.quote && !showResult && <form className="wallet-send" onSubmit={event => { event.preventDefault(); if (sendAddress) void personal.review(asset, sendAddress, amount, destination) }}>
        {blocked ? <p className="wallet-inline-error">{personal.submission?.status === 'unknown' ? 'The previous submission is unresolved. Replacement transfers remain blocked.' : 'A transfer is pending. Wait for its receipt before sending again.'}</p> : <>
          <div className="wallet-send-route"><label>Send to<select aria-label="Send destination" value={destination} disabled={locked} onChange={event => {
            const next = event.target.value as typeof destination
            setDestination(next); personal.edit()
            if (next === 'incoming') { setAsset('USDC'); void personal.loadIncoming() }
          }}><option value="incoming">Appliance Incoming account</option><option value="custom">Paste an address</option></select></label>
            <label>Asset<select value={asset} disabled={locked || destination === 'incoming'} onChange={event => { setAsset(event.target.value as Asset); personal.edit() }}><option>USDC</option><option>ETH</option></select></label>
          </div>
          <label>{destination === 'incoming' ? 'Incoming address' : 'Recipient address'}<input autoComplete="off" spellCheck={false} value={sendAddress} readOnly={destination === 'incoming'} disabled={locked} onChange={event => { if (destination === 'custom') { setRecipient(event.target.value); personal.edit() } }} placeholder={destination === 'incoming' ? personal.incomingLoading ? 'Loading Incoming address…' : 'Incoming address unavailable' : 'Paste wallet address · 0x…'} required aria-label="Recipient address" /></label>
          {destination === 'incoming' && personal.incomingError && <p className="wallet-inline-error" role="status">{personal.incomingError} <button type="button" disabled={locked || personal.incomingLoading} onClick={() => void personal.loadIncoming()}>Retry</button></p>}
          <div className="wallet-send-entry">
            <label><span className="wallet-amount-label">Amount <span className="wallet-available">Available: {balance ? formatUnits(asset === 'USDC' ? balance.usdc : balance.eth, asset, 8) : '—'} {asset}</span></span><input inputMode="decimal" autoComplete="off" value={amount} disabled={locked} onChange={event => { setAmount(event.target.value); personal.edit() }} placeholder="0.00" required aria-label="Amount to send" /></label>
            <button className="wallet-primary" disabled={locked || !wallet || !network || !sendAddress || (destination === 'incoming' && personal.incomingLoading)}>{personal.busy ? 'Checking transfer…' : 'Review transfer'}</button>
          </div>
          <p className="wallet-network-note">{networkName} · Network fees are paid in ETH.</p>
        </>}
      </form>}
      {view === 'send' && !personal.reloadRequired && personal.quote && <div className="wallet-review">
        <div className="wallet-review-summary"><h3>Review transfer</h3><strong>{formatUnits(personal.quote.units, personal.quote.asset)} {personal.quote.asset}</strong></div>
        <dl><dt>To</dt><dd>{destination === 'incoming' && <span className="wallet-destination-name">Appliance Incoming account</span>}{personal.quote.recipient}</dd><dt>Network</dt><dd>{networkName}</dd><dt>Maximum network fee</dt><dd>{formatUnits(personal.quote.fee, 'ETH')} ETH</dd></dl>
        <p>Check the full address. A confirmed transfer cannot be undone. A transaction link appears after submission.</p>
        <div className="wallet-review-actions"><button className="wallet-primary" disabled={locked} onClick={() => void personal.confirm()}>{personal.busy ? 'Signing and submitting…' : 'Confirm and send'}</button><button disabled={locked} onClick={personal.edit}>Edit transfer</button></div>
      </div>}
      {view === 'send' && personal.reloadRequired && <div className="wallet-session-reset">
        <p>The wallet session needs to restart. Sign in again, then review your transfer.</p>
        <button className="wallet-primary" disabled={locked} onClick={() => window.location.reload()}>Reload and sign in</button>
      </div>}
      {network && ((view === 'send' && showResult) || view === 'activity') && personal.submission && <div className="wallet-submission" role="status">
        <strong>{personal.submission.status === 'confirmed' ? 'Transfer confirmed' : personal.submission.status === 'failed' ? 'Transfer failed on chain' : personal.submission.status === 'unknown' ? 'Submission status unknown' : 'Transfer pending'}</strong>
        <span>{personal.submission.amount} {personal.submission.asset}</span>
        {personal.submission.hash ? <a className="wallet-transaction-link" href={`${network.explorer}/tx/${personal.submission.hash}`} target="_blank" rel="noreferrer" aria-label={`View transaction ${personal.submission.hash} on ${networkName}`}>View transaction ↗</a> : <>
          <p>A transaction ID was not returned. Check wallet activity to reconcile the original transfer.</p>
          <a href={explorer} target="_blank" rel="noreferrer">Check wallet activity ↗</a>
        </>}
        {view === 'send' && !blocked && <div className="wallet-result-actions"><button className="wallet-primary" disabled={locked} onClick={() => changeView('home')}>Done</button><button disabled={locked} onClick={newTransfer}>New transfer</button></div>}
        {(personal.submission.status === 'unknown' || (personal.submission.status === 'pending' && Date.now() - (personal.submission.createdAt || 0) >= 300_000)) && <><p>A pending transfer may still confirm. Check its status before creating another payment.</p><p>Another transfer stays blocked until the original outcome is verified.</p></>}
      </div>}
      {view === 'activity' && network && <div className="wallet-activity">
        <p className="wallet-network-note">Recent USDC & ETH · Explorer indexing may lag.</p>
        {personal.activityError ? <p className="wallet-inline-error">{personal.activityError}</p> : !personal.activity.length ? <p className="wallet-empty">{personal.loading ? 'Loading activity…' : 'No recent transfers found.'}</p> : personal.activity.map((item, index) => <a key={`${item.hash}:${index}`} href={`${network.explorer}/tx/${item.hash}`} target="_blank" rel="noreferrer" aria-label={`View ${item.direction} ${item.asset} transaction ${item.hash} on ${networkName}`}><span>{item.direction === 'sent' ? '↗ Sent' : '↓ Received'}<small>{item.status} · {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'Pending'}</small><small className="wallet-activity-link">View transaction ↗</small></span><strong>{hidden ? '••••' : item.amount} {item.asset}</strong></a>)}
        <a className="wallet-explorer-link" href={explorer} target="_blank" rel="noreferrer">Full history on explorer ↗</a>
      </div>}
    </div>
  </div>
}
