import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import type { Wallet } from './species'
import WalletTools from './WalletTools'
import PhantomConnect from './PhantomConnect'
import WalletCardArtwork from './WalletCardArtwork'
import { PHANTOM_BUY_USDC, PHANTOM_DOWNLOAD } from './phantom'
import type { PersonalWallet } from './usePersonalWallet'
import { findWalletNetwork, formatUnits } from './wallet-chain'
import './ByondUsdcWallet.css'
import './WalletCardArtwork.css'
import './PhantomConnect.css'

type CardId = 'vendor' | 'create'
type CardSide = 'front' | 'back'

export default function ByondUsdcWallet({ wallet, personal, owner, busy, onDownload, onOpenBackup }: {
  wallet: Wallet | null; personal: PersonalWallet; owner?: string; busy: boolean; onDownload: () => void; onOpenBackup: () => void
}) {
  const { ref, scale } = useWalletScale()
  const vendorMotion = useSlotCardMotion('vendor'), createMotion = useSlotCardMotion('create')
  const vendorRotateY = useMotionValue(0), createRotateY = useMotionValue(0)
  const [active, setActive] = useState<CardId | null>(null)
  const [sides, setSides] = useState<Record<CardId, CardSide>>({ vendor: 'front', create: 'front' })
  const [hidden, setHidden] = useState(false)
  const [toast, setToast] = useState('')
  const reduced = useReducedMotion()
  const motionFor = (id: CardId) => id === 'vendor' ? vendorMotion : createMotion
  const rotateFor = (id: CardId) => id === 'vendor' ? vendorRotateY : createRotateY
  const flip = async (id: CardId) => {
    const next = sides[id] === 'front' ? 'back' : 'front'
    setSides(current => ({ ...current, [id]: next }))
    await animate(rotateFor(id), next === 'back' ? 180 : 0, reduced ? { duration: 0 } : FLIP_SPRING)
    if ((rotateFor(id).get() > 90) === (next === 'back')) {
      ref.current?.querySelector<HTMLButtonElement>(`[data-card="${id}"].is-open .face-${next} button:not(:disabled)`)?.focus()
    }
  }
  const close = (id: CardId) => {
    setActive(null); setSides(current => ({ ...current, [id]: 'front' }))
    void animate(rotateFor(id), 0, reduced ? { duration: 0 } : FLIP_SPRING)
    void motionFor(id).travel('close')
  }
  const open = (id: CardId) => {
    if (active === id) return
    if (active) close(active)
    setActive(id)
    void motionFor(id).travel('open')
  }
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])
  const detailsMotion = (id: CardId) => ({ opacity: active === id ? 1 : 0, y: active === id ? 0 : 7 })
  // Framer Motion 11 filters the inert attribute. Apply it to the rendered
  // details whenever a card moves or flips, keeping hidden controls out of Tab.
  useEffect(() => {
    for (const id of ['create', 'vendor'] as const) {
      ref.current?.querySelectorAll(`[data-card="${id}"] .card-details`).forEach(element => {
        element.toggleAttribute('inert', active !== id || !!element.closest('[aria-hidden="true"]'))
      })
    }
  }, [active, sides, ref])
  const cardWindow = (id: CardId, children: ReactNode) => {
    const movement = motionFor(id), isOpen = active === id
    return <div className={`card-window card-window-${id} ${isOpen ? 'is-open' : ''} ${movement.abovePocket ? 'is-above-pocket' : ''}`} data-card={id}>
      <motion.div className="card-position" style={{ y: movement.y, rotateZ: movement.rotateZ, scale: movement.scale }} onPointerEnter={() => { if (!active) movement.hoverIn() }} onPointerLeave={() => { if (!active) movement.hoverOut() }}>
        {children}
        <motion.button className="card-close" type="button" aria-label={`Return ${id === 'vendor' ? 'wallet' : 'Phantom'} card to wallet`} tabIndex={isOpen ? 0 : -1} aria-hidden={!isOpen} onClick={() => close(id)} animate={{ opacity: isOpen ? 1 : 0, scale: isOpen ? 1 : 0.94 }} style={{ pointerEvents: isOpen ? 'auto' : 'none' }}><Icon name="close" /></motion.button>
      </motion.div>
    </div>
  }
  const displayedBalance = hidden ? '••••••' : personal.balances ? formatUnits(personal.balances.usdc, 'USDC', 6) : personal.loading ? '…' : '—'
  const shortAddress = wallet ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : 'Not connected'
  return <div className="byond-wallet-component" ref={ref}>
    <div className="byond-wallet-stage" style={{ height: DESIGN_HEIGHT * scale }}><div className="wallet-scene" style={{ transform: `scale(${scale})` }}>
      <div className="wallet-shadow" aria-hidden="true" /><div className="wallet-shell" aria-hidden="true" />
      <svg className="tf-base-stitch" viewBox="0 0 500 342" preserveAspectRatio="none" aria-hidden="true"><path d="M15 15 H485 M15 15 V327 M485 15 V327 M15 327 H485" className="tf-thread" /></svg>
      <svg className="tf-stitch-defs" width="0" height="0" aria-hidden="true"><defs><filter id="tfThread" x="-20%" y="-40%" width="140%" height="180%"><feTurbulence type="fractalNoise" baseFrequency="0.095" numOctaves="2" seed="9" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="0.7" xChannelSelector="R" yChannelSelector="G" result="wobble" /><feDropShadow in="wobble" dx="0" dy="0.65" stdDeviation="0.32" floodColor="#e8c7a2" floodOpacity="0.46" /></filter></defs></svg>
      <div className="tf-mid-panel tf-leather" aria-hidden="true"><div className="tf-edge-top" /><svg className="tf-mid-stitch" viewBox="0 0 500 283" preserveAspectRatio="none"><path d="M14 14 H486 M14 14 V95 M486 14 V95" className="tf-thread" /></svg></div>
      {cardWindow('create', <motion.div className="card" style={{ rotateY: createRotateY }} data-side={sides.create}>
        <section className="card-face face-front create-face ad-face" aria-hidden={sides.create === 'back'} ref={element => element?.toggleAttribute('inert', sides.create === 'back')}>
          <button className="card-header" onClick={() => active === 'create' ? flip('create') : open('create')} aria-expanded={active === 'create'}><span className="card-brand"><span className="get-icon"><Icon name="up-right" /></span>Phantom</span><span className="card-header-value">Your wallet. Anywhere. <Icon name="up-right" /></span></button>
          <motion.div className="card-details ad" animate={detailsMotion('create')}>
            <div className="ad-photo" aria-hidden="true" />
            <div className="ad-copy phantom-copy">
              <span className="phantom-eyebrow">PHANTOM</span>
              <h2 className="ad-headline">Your wallet. Your world.</h2>
              <p className="ad-sub">The freedom to take it with you.</p>
              <button className="ad-cta phantom-cta" onClick={() => void flip('create')}>Take your wallet with you <Icon name="flip" /></button>
              <a className="phantom-buy" href={PHANTOM_BUY_USDC} target="_blank" rel="noopener noreferrer">DON’T HAVE USDC? BUY SOME <Icon name="up-right" /></a>
            </div>
          </motion.div>
        </section>
        <section className="card-face face-back create-face create-back" aria-hidden={sides.create === 'front'} ref={element => element?.toggleAttribute('inert', sides.create === 'front')}>
          <div className="card-header"><span className="card-brand"><span className="get-icon"><Icon name="user" /></span>PLATFORM WALLET</span><span className="pill">EXPORT</span></div>
          <motion.div className="card-details create-details portability-details" animate={detailsMotion('create')}>
            <h2>Take your wallet with you.</h2>
            <p className="card-intro">Your wallet belongs to you. Use it in Phantom or another compatible wallet.</p>
            <button className="primary-button" disabled={!wallet || busy} onClick={onDownload}>{busy ? 'Preparing download…' : 'Download encrypted wallet'}<Icon name="arrow" /></button>
            <button className="backup-open-button" disabled={!wallet || busy} onClick={onOpenBackup}>Open encrypted file ↗</button>
            <p className="export-key-note">Encrypted when saved. A fresh OnliYou approval each time you open it here.</p>
            <div className="phantom-setup"><span>Don’t have Phantom?</span><a href={PHANTOM_DOWNLOAD} target="_blank" rel="noopener noreferrer">Get Phantom <Icon name="up-right" /></a></div>
            <details className="phantom-check"><summary>Already imported? Check your wallet</summary><PhantomConnect wallet={wallet} /></details>
            <div className="card-bottom"><span className="micro-note">Same wallet. Same address.</span><button className="text-button" onClick={() => flip('create')}><Icon name="flip" />Back to ad</button></div>
          </motion.div>
        </section>
      </motion.div>)}
      {cardWindow('vendor', <motion.div className="card" style={{ rotateY: vendorRotateY }} data-side={sides.vendor}>
        <section className="card-face face-front vendor-face onli-card-front" aria-hidden={sides.vendor === 'back'} ref={element => element?.toggleAttribute('inert', sides.vendor === 'back')}>
          <WalletCardArtwork />
          <button className="card-header" onClick={() => open('vendor')} aria-expanded={active === 'vendor'}><span className="card-brand">PLATFORM WALLET</span><Icon name="up-right" /></button>
          <motion.div className="card-details onli-card-details" animate={detailsMotion('vendor')}>
            <div className="onli-card-identity"><span className="onli-card-status">{wallet ? 'Connected with Onli' : 'Sign in with Onli'}</span><span className="onli-card-address">{shortAddress}</span></div>
            <div className="onli-card-footer"><span className="onli-card-wordmark">ØnliCash</span><button className="onli-card-open" onClick={() => flip('vendor')}>Open wallet <Icon name="arrow" /></button></div>
          </motion.div>
        </section>
        <section className="card-face face-back vendor-face" aria-hidden={sides.vendor === 'front'} ref={element => element?.toggleAttribute('inert', sides.vendor === 'front')}>
          <div className="card-header"><span className="card-brand"><UsdcIcon />PLATFORM WALLET</span><span className="pill">WALLET</span></div>
          <motion.div className="card-details vendor-back-details" animate={detailsMotion('vendor')}>
            <WalletTools wallet={wallet} personal={personal} hidden={hidden} busy={busy} />
          </motion.div>
        </section>
      </motion.div>)}
      <section className="wallet-pocket" aria-label="PLATFORM WALLET balance">
        <div className="tf-front-left tf-leather" aria-hidden="true"><div className="tf-edge-top" /><div className="tf-edge-right" /></div><div className="tf-front-right tf-leather" aria-hidden="true"><div className="tf-edge-top" /><div className="tf-edge-left" /></div><div className="tf-front-bottom tf-leather" aria-hidden="true"><div className="tf-edge-top" /></div>
        <svg className="tf-front-stitch" viewBox="0 0 500 197" preserveAspectRatio="none" aria-hidden="true"><path d="M14 14 H148 M352 14 H486 M148 14 V83 M352 14 V83 M148 83 H352 M14 14 V183 M486 14 V183 M14 183 H486" className="tf-thread" /></svg>
        <div className="balance"><div className="balance-label"><span className="balance-owner">{owner || 'YOUR WALLET'}</span><button className="eye-button" aria-label={hidden ? 'Show balance' : 'Hide balance'} onClick={() => setHidden(value => !value)}><Icon name={hidden ? 'eye' : 'eye-off'} /></button></div><div className="balance-amount"><UsdcIcon /><span className="balance-number">{displayedBalance}</span></div><p className="balance-unit">{wallet ? personal.balances ? `USDC · ${findWalletNetwork(wallet.chain_id)?.name || 'Unsupported network'}` : personal.loading ? 'Loading balance…' : 'Balance unavailable' : 'Not connected'}</p></div>
      </section>
    </div></div>
    <div className={`toast ${toast ? 'visible' : ''}`} role="status">{toast}</div>
  </div>
}

// Original BYOND popup geometry, leather, card faces and spring choreography.
// Species supplies wallet identity/access; the client reads and signs for that personal EOA.
const DESIGN_WIDTH = 520;
const DESIGN_HEIGHT = 658;

const CARD_GEOMETRY: Record<
  CardId,
  { top: number; height: number; lift: number; occluderTop: number; tilt: number }
> = {
  create: { top: 298, height: 360, lift: -264, occluderTop: 347, tilt: -0.16 },
  vendor: { top: 370, height: 275, lift: -252, occluderTop: 433, tilt: 0.1 },
};

const HOVER_SPRING = { type: "spring" as const, stiffness: 520, damping: 38, mass: 0.55 };
// Critically damped flip (response ≈ 0.45 s): reversible at any angle.
const FLIP_SPRING = { type: "spring" as const, stiffness: 240, damping: 31, mass: 1 };

// Every slot-card motion is a spring from wherever the card is right now, so a
// tap mid-flight re-targets instead of jumping, and which layer the card sits on
// follows its actual position rather than a timer.

function useSlotCardMotion(id: CardId) {
  const geometry = CARD_GEOMETRY[id];
  const reduced = useReducedMotion();
  const y = useMotionValue(0);
  const rotateZ = useMotionValue(0);
  const scale = useMotionValue(1);
  const [abovePocket, setAbovePocket] = useState(false);
  const controls = useRef<ReturnType<typeof animate>[]>([]);

  const stop = useCallback(() => {
    controls.current.forEach((control) => control.stop());
    controls.current = [];
  }, []);

  useEffect(() => stop, [stop]);

  // The slot mouth: above it the card is in front of the pocket, below it behind.
  const breakout = useMemo(() => {
    const physical = geometry.occluderTop - (geometry.top + geometry.height) - 2;
    return Math.max(physical, geometry.lift + 26);
  }, [geometry]);

  // Re-render only when the card crosses the slot mouth, not on every frame.
  const aboveRef = useRef(false);
  useEffect(
    () =>
      y.on("change", (value) => {
        const above = value < breakout;
        if (above !== aboveRef.current) {
          aboveRef.current = above;
          setAbovePocket(above);
        }
      }),
    [breakout, y]
  );

  // One critically damped spring per axis, from wherever the card is: the
  // card leaves the slot and rises in a single continuous motion (response
  // ≈ 0.5 s opening, a touch quicker closing), and a tap mid-flight simply
  // re-targets it with its velocity intact.
  const travel = useCallback(
    async (direction: "open" | "close") => {
      stop();
      const opening = direction === "open";
      const spring = reduced ? { duration: 0 } : opening
        ? { type: "spring" as const, stiffness: 150, damping: 24.5, mass: 1 }
        : { type: "spring" as const, stiffness: 190, damping: 27.6, mass: 1 };
      controls.current = [
        animate(y, opening ? geometry.lift : 0, spring),
        animate(rotateZ, opening ? geometry.tilt : 0, spring),
        animate(scale, opening ? 1.002 : 1, spring),
      ];
      await controls.current[0];
    },
    [geometry, reduced, rotateZ, scale, stop, y]
  );

  const hoverIn = useCallback(() => {
    if (reduced) return;
    stop();
    controls.current = [
      animate(y, -7, HOVER_SPRING),
      animate(rotateZ, id === "create" ? -0.12 : 0.08, HOVER_SPRING),
      animate(scale, 1.001, HOVER_SPRING),
    ];
  }, [id, reduced, rotateZ, scale, stop, y]);

  const hoverOut = useCallback(() => {
    stop();
    controls.current = [
      animate(y, 0, HOVER_SPRING),
      animate(rotateZ, 0, HOVER_SPRING),
      animate(scale, 1, HOVER_SPRING),
    ];
  }, [rotateZ, scale, stop, y]);

  return { y, rotateZ, scale, abovePocket, travel, hoverIn, hoverOut, stop };
}

function useWalletScale() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setScale(Math.min(1, element.clientWidth / DESIGN_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, scale };
}

function Icon({ name, className = "icon" }: { name: "arrow" | "up-right" | "close" | "flip" | "eye" | "eye-off" | "lock" | "user" | "plus" | "dollar"; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      {name === "arrow" && <path d="M5 12h14m-6-6 6 6-6 6" {...common} />}
      {name === "up-right" && <path d="m7 17 10-10M7 7h10v10" {...common} strokeWidth={1.9} />}
      {name === "close" && <path d="m6 6 12 12M6 18 18 6" {...common} />}
      {name === "flip" && <path d="M4 8a8.5 8.5 0 0 1 15-2l2 3m0-5v5h-5M20 16A8.5 8.5 0 0 1 5 18l-2-3m0 5v-5h5" {...common} strokeWidth={1.5} />}
      {name === "eye" && <><path d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z" {...common} strokeWidth={1.5} /><circle cx="12" cy="12" r="2.7" {...common} strokeWidth={1.5} /></>}
      {name === "eye-off" && <path d="m3 3 18 18M9 5.9A11 11 0 0 1 12 5.5c6.1 0 9.5 6.5 9.5 6.5a18 18 0 0 1-2.8 3.6M6 7A19 19 0 0 0 2.5 12s3.4 6.5 9.5 6.5c1.7 0 3.2-.5 4.5-1.2M10 10a2.8 2.8 0 0 0 4 4" {...common} strokeWidth={1.5} />}
      {name === "lock" && <><rect x="5" y="10" width="14" height="11" rx="2" {...common} strokeWidth={1.6} /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" {...common} strokeWidth={1.6} /></>}
      {name === "user" && <><circle cx="12" cy="8" r="3.5" {...common} strokeWidth={1.5} /><path d="M5 21v-2a7 7 0 0 1 14 0v2" {...common} strokeWidth={1.5} /></>}
      {name === "plus" && <path d="M12 5v14M5 12h14" {...common} strokeWidth={2} />}
      {name === "dollar" && <><path d="M12 4v16" {...common} strokeWidth={1.8} /><path d="M16 8.5c-.6-1.4-2-2.2-4-2.2-2.3 0-3.8 1.1-3.8 2.7 0 3.6 7.8 1.6 7.8 5.5 0 1.7-1.6 2.9-4 2.9-2.2 0-3.6-.9-4.2-2.4" {...common} strokeWidth={1.8} /></>}
    </svg>
  );
}

function UsdcIcon({ className = "usdc" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10.8 11.8c.7-1.6 2.5-2.6 5.1-2.6 2.9 0 4.8 1.3 4.8 3.4 0 5-8.6 2.3-8.6 6.6 0 1.9 1.7 3.2 4.7 3.2 2.5 0 4.3-.9 5.1-2.7M16 7.3v2.2M16 22.5v2.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.2 11a10.5 10.5 0 0 0 0 10M23.8 11a10.5 10.5 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity=".82" />
    </svg>
  );
}
