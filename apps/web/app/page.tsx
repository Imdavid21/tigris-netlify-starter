import { WalletButton } from "@/components/wallet-button";
import { Launches } from "@/components/launches";

export default function Home() {
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

      <section className="page-heading">
        <h1>Explore</h1>
        <p>USDC-native tokens climbing toward graduation on Arc.</p>
      </section>

      <Launches />
    </main>
  );
}
