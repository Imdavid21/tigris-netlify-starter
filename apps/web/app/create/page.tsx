import { CreateTokenForm } from "@/components/create-token-form";
import { WalletButton } from "@/components/wallet-button";

export default function CreatePage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="/" className="brand">Arc Launchpad</a>
        <nav className="nav">
          <a href="/">Explore</a>
          <a href="/analytics">Analytics</a>
          <a href="/create">Create</a>
        </nav>
        <WalletButton />
      </header>

      <section className="create-layout">
        <div>
          <div className="page-heading">
            <h1>Launch token</h1>
            <p>Fixed supply. USDC bonding curve. Permanently reserved graduation liquidity.</p>
          </div>

          <CreateTokenForm />
        </div>

        <aside className="create-side">
          <span className="muted">Current launch model</span>
          <h2>Simple by design.</h2>
          <p>
            The current Testnet factory only accepts a name and ticker. Metadata,
            creator-tax controls, and atomic opening buys belong in the next
            factory revision rather than being simulated offchain.
          </p>
          <div className="side-rule" />
          <p className="muted">
            After confirmation, you are redirected directly to the token market.
            Trading starts on the bonding curve.
          </p>
        </aside>
      </section>
    </main>
  );
}
