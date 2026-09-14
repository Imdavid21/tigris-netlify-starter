import { WalletButton } from "@/components/wallet-button";
import { Launches } from "@/components/launches";

export default function Home() {
  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 20px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <strong>Arc Launchpad</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <WalletButton />
          <a href="/create">
            <button>Create token</button>
          </a>
        </div>
      </header>

      <section style={{ marginTop: 48 }}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>Tokens</h1>
        <p style={{ opacity: 0.65 }}>USDC-native launches on Arc.</p>
      </section>

      <section style={{ marginTop: 32 }}>
        <Launches />
      </section>
    </main>
  );
}
