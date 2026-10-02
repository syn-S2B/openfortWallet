import { useEffect, useRef, useState } from 'react'
import type { Wallet } from './species'
import { phantomNetwork, PHANTOM_DOWNLOAD } from './phantom'
import { createExternalWalletJourney, type ExternalWalletView } from './journey/journey_connect_external_wallet.ts'

export default function PhantomConnect({ wallet }: { wallet: Wallet | null }) {
  const [view, setView] = useState<ExternalWalletView>({ account: null, busy: false, message: '', missing: false, addressMatches: false, chainMatches: false })
  const journey = useRef<ReturnType<typeof createExternalWalletJourney> | null>(null)
  useEffect(() => {
    journey.current = createExternalWalletJourney(window as Window & { phantom?: { ethereum?: unknown } }, setView)
    return () => { journey.current?.dispose(); journey.current = null }
  }, [])
  useEffect(() => { journey.current?.compare(wallet) }, [wallet])
  const { account, busy, message, missing } = view
  const clear = () => journey.current?.clear()
  const connect = () => journey.current?.connect()
  const sameWallet = view.addressMatches
  return <div className="phantom-connection">
    <p className="phantom-detail">{account ? phantomNetwork(account.chainId) : 'Connect to check the address after importing. Connecting alone does not import your wallet.'}</p>
    {account ? <>
      <code className="phantom-address">{account.address.slice(0, 8)}…{account.address.slice(-6)}</code>
      <p className="phantom-detail">{sameWallet ? 'This matches your Species wallet address.' : wallet ? 'This is a different address from your Species wallet.' : 'Your external Phantom account is connected.'}</p>
      {wallet && !view.chainMatches && <p className="phantom-detail">Select {phantomNetwork(wallet.chain_id)} in Phantom.</p>}
      <button className="phantom-secondary" onClick={clear}>Clear connection in this app</button>
    </> : <button className="phantom-secondary" disabled={busy} onClick={() => void connect()}>{busy ? 'Approve in Phantom…' : 'Connect Phantom ↗'}</button>}
    {message && <p className="phantom-message" role="status">{message} {missing && <a href={PHANTOM_DOWNLOAD} target="_blank" rel="noreferrer">Get Phantom ↗</a>}</p>}
  </div>
}
