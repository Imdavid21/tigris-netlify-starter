export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <a href="/" className="brand footer-logo"><span className="brand-mark">✦</span><span>Celestial</span></a>
        <p>Launch and trade onchain markets on Arc. Your wallet submits every transaction. Celestial does not custody assets.</p>
      </div>
      <div className="footer-column">
        <strong>Product</strong>
        <a href="/explore">Explore</a>
        <a href="/analytics">Analytics</a>
        <a href="/create">Create</a>
        <a href="/profile">Profile</a>
      </div>
      <div className="footer-column">
        <strong>Network</strong>
        <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer">Arc Explorer</a>
        <a href="/analytics">Protocol data</a>
      </div>
      <div className="footer-risk">
        <strong>Risk notice</strong>
        <p>Transactions are irreversible. Tokens and markets can be volatile or lose all value. Celestial does not provide custody, warranties, or financial advice.</p>
      </div>
      <div className="footer-bottom">
        <span>Celestial</span>
        <span>Arc Testnet</span>
      </div>
    </footer>
  );
}
