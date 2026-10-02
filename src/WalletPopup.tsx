import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import ByondUsdcWallet from './ByondUsdcWallet'
import { DURATION, EASE_OUT } from './animations'
import type { Wallet } from './species'
import type { PersonalWallet } from './usePersonalWallet'

export default function WalletPopup({ wallet, personal, owner, busy, notice, onClose, onDownload, onOpenBackup }: {
  wallet: Wallet | null; personal: PersonalWallet; owner?: string; busy: boolean; notice: string
  onClose: () => void; onDownload: () => void; onOpenBackup: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    const dialog = ref.current!
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    return () => {
      dialog.close()
      // React removes the dialog before native focus restoration can run.
      // Automatic sign-in may also have removed the original submit button.
      const target = trigger?.isConnected && trigger !== document.body
        ? trigger : document.querySelector<HTMLElement>('[data-wallet-opener]')
      target?.focus()
    }
  }, [])
  return <dialog ref={ref} className="wallet-popup" aria-label="PLATFORM WALLET" onCancel={onClose}>
    <div className="popup-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <motion.div className="popup-frame"
        initial={{ opacity: 0, y: reduced ? 0 : 24, scale: reduced ? 1 : 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduced ? 0 : DURATION.modal, ease: EASE_OUT }}>
        <ByondUsdcWallet wallet={wallet} personal={personal} owner={owner} busy={busy} onDownload={onDownload} onOpenBackup={onOpenBackup} />
        <a className="popup-docs-link" href="/Docs/index.html">Docs · Onli concepts &amp; wallet adapters</a>
        <a className="popup-docs-link" href="https://github.com/syn-S2B/openfortWallet">View source on GitHub</a>
        {notice && <p className="popup-notice" role="status">{notice}</p>}
        <button onClick={onClose} aria-label="Close wallet" className="popup-close">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </motion.div>
    </div>
  </dialog>
}
