import { useState } from 'react'
import './wallet-demo.css'

/** Self-contained teaching simulation. No authentication, provider calls or signing. */
export default function WalletDemo() {
  const [view, setView] = useState<'home' | 'receive' | 'send' | 'review' | 'activity'>('home')
  const [amount, setAmount] = useState('')
  const [balance, setBalance] = useState(250)
  const [error, setError] = useState('')
  const [transfers, setTransfers] = useState<number[]>([])
  const [notice, setNotice] = useState('')
  function review() {
    const value = Number(amount)
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || value <= 0 || value > balance) {
      setError('Enter an amount greater than zero and within the sample balance, with up to two decimal places.')
      return
    }
    setError(''); setView('review')
  }
  function confirm() {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0 || value > balance) return
    setBalance(previous => Math.round((previous - value) * 100) / 100)
    setTransfers(previous => [value, ...previous]); setAmount(''); setView('activity')
    setNotice('Simulation complete. No funds moved and no transaction was signed.')
  }
  return <main className="wallet-demo-page">
    <header className="wallet-demo-header"><a href="/">← Onli Agentic Wallets</a><a href="/Docs/openfort-walkthrough.html">How this wallet is built →</a></header>
    <section className="wallet-demo-intro"><p className="eyebrow">INTERACTIVE WALLET DEMO</p><h1>Try the wallet. No login needed.</h1><p>Explore a sample wallet and practice reviewing a send. Everything here is simulated; balances, recipients and activity are fictional.</p></section>
    <section className="wallet-demo-card" aria-label="Sample wallet">
      <div className="wallet-demo-card-top"><strong>Appliance wallet</strong><span>SIMULATION</span></div>
      <nav aria-label="Wallet views">{(['home', 'receive', 'send', 'activity'] as const).map(item => <button key={item} aria-current={view === item || (item === 'send' && view === 'review') ? 'page' : undefined} onClick={() => {setView(item); setError(''); setNotice('')}}>{item === 'home' ? 'Overview' : item[0].toUpperCase() + item.slice(1)}</button>)}</nav>
      {view === 'home' && <div className="wallet-demo-panel"><p>Sample balance</p><h2>{balance.toFixed(2)} <small>USDC</small></h2><p>0.025 ETH · Sample fee balance</p><button className="wallet-demo-primary" onClick={() => setView('send')}>Try a send →</button></div>}
      {view === 'receive' && <div className="wallet-demo-panel"><h2>Receive</h2><p>A connected wallet shows its network, address and QR code here.</p><div className="wallet-demo-recipient">Sample wallet · No deposit address</div><p>This demo does not accept deposits. In your Appliance, verify the supported network before showing a real receive address.</p></div>}
      {view === 'send' && <form className="wallet-demo-panel" onSubmit={event => {event.preventDefault(); review()}}><h2>Send</h2><label>Recipient<select><option>Sample Appliance Incoming account</option></select></label><label>Amount in USDC<input aria-label="Amount to send" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="10.00" /></label><p>Available: {balance.toFixed(2)} USDC</p>{error && <p role="alert">{error}</p>}<button className="wallet-demo-primary">Review transfer</button><p>Review prepares the request. It does not submit it.</p></form>}
      {view === 'review' && <div className="wallet-demo-panel"><h2>Review transfer</h2><dl><dt>Amount</dt><dd>{Number(amount).toFixed(2)} USDC</dd><dt>Recipient</dt><dd>Sample Appliance Incoming account</dd><dt>Network</dt><dd>Simulation only</dd><dt>Network fee</dt><dd>No fee charged</dd></dl><p>In a connected Appliance, this step follows identity and behavior authorization and confirms the exact transfer.</p><button className="wallet-demo-primary" onClick={confirm}>Confirm simulated send</button><button className="wallet-demo-secondary" onClick={() => setView('send')}>Edit transfer</button></div>}
      {view === 'activity' && <div className="wallet-demo-panel"><h2>Activity</h2>{notice && <p role="status">{notice}</p>}{transfers.length ? <ul>{transfers.map((value,index) => <li key={index}>Simulated send to Appliance Incoming <strong>{value.toFixed(2)} USDC</strong></li>)}</ul> : <p>No simulated transfers yet. Try a send to see the outcome here.</p>}<p>A real wallet observes transaction evidence before reporting completion. This simulation has no chain receipt.</p></div>}
    </section>
    <button className="wallet-demo-reset" onClick={() => {setBalance(250);setTransfers([]);setAmount('');setError('');setNotice('');setView('home')}}>Reset demo</button>
  </main>
}
