import './landing.css'

const github = 'https://github.com/syn-S2B/openfortWallet'

export default function LandingPage() {
  return (
    <div className="landing">
      <a className="landing-skip" href="#landing-content">Skip to content</a>
      <header className="site-header">
        <a className="site-brand" href="/" aria-label="Onli Agentic Wallets home">onli<span> / Agentic Wallets</span></a>
        <nav aria-label="Main navigation"><a href="/Docs/">Docs</a><a href="/Docs/openfort-walkthrough.html">Code walkthrough</a><a href={github}>GitHub ↗</a><a className="site-demo-link" href="/demo/">Open demo</a></nav>
      </header>
      <main id="landing-content">
        <section className="landing-hero" aria-labelledby="landing-title">
          <p className="landing-eyebrow">ONLI AGENTIC WALLETS</p>
          <h1 id="landing-title">Different from<br />the ground up.</h1>
          <p className="landing-lead">Learn to build a wallet for your Onli Appliance.<br className="landing-desktop-break" /> Follow the Openfort wallet, from intent to outcome.</p>
          <div className="landing-actions"><a className="landing-primary" href="/demo/">Explore the wallet <span aria-hidden="true">↗</span></a><a className="landing-secondary" href="/Docs/">Start learning <span aria-hidden="true">→</span></a></div>
          <p className="landing-note">Synth demo · Onli ID required · Sepolia testnet</p>
          <div className="landing-visual" aria-label="A wallet integration connects a digital thing to a proven outcome">
            <div className="landing-object"><span className="landing-object-symbol" aria-hidden="true">o.</span><span>Digital thing</span><small>Identity. Content. Context.</small></div>
            <div className="landing-bridge"><span className="landing-bridge-line" /><span>Wallet adapter</span><small>Selected by Recipe</small></div>
            <div className="landing-outcome"><span className="landing-check" aria-hidden="true">✓</span><span>One clear outcome</span><small>Intent → proven execution</small></div>
          </div>
        </section>
        <section className="landing-principles" aria-labelledby="landing-principles-title">
          <div className="landing-section-heading"><p className="landing-eyebrow">THE FOUNDATION</p><h2 id="landing-principles-title">Understand it. Then build it.</h2><p>Use the wallet we built to understand the parts your Appliance needs.</p></div>
          <div className="landing-columns">
            <article><span className="landing-number">01</span><h3>A thing, with a history.</h3><p>Onli is a digital thing, not a ledger entry. Its Oracle records the events that happen to it.</p><a href="/Docs/index.html#thing">Understand Onli →</a></article>
            <article><span className="landing-number">02</span><h3>Intent meets execution.</h3><p>Tools do one bounded job. Workflows compose the work. A Journey owns the outcome. The Recipe defines the arrangement.</p><a href="/Docs/index.html#concepts">Learn the architecture →</a></article>
            <article><span className="landing-number">03</span><h3>A bridge you can inspect.</h3><p>Follow the Openfort wallet we built. Learn what to reuse and what to supply for your own Onli Appliance.</p><a href="/Docs/openfort-walkthrough.html">Walk through the code →</a></article>
          </div>
        </section>
        <section className="landing-build" aria-labelledby="landing-build-title"><div><p className="landing-eyebrow">BUILT IN THE OPEN</p><h2 id="landing-build-title">Start with the working example.</h2><p>Explore the interface. Read the contracts. Build your adapter.</p></div><a className="landing-primary" href={github}>View the source <span aria-hidden="true">↗</span></a></section>
      </main>
      <footer className="landing-footer"><a className="landing-brand" href="/">onli</a><p>Onli Agentic Wallets · Learn how to build</p><a href="/Docs/">Developer documentation →</a></footer>
    </div>
  )
}
