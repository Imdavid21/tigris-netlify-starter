import { CreateTokenForm } from "@/components/create-token-form";
import { WalletButton } from "@/components/wallet-button";

export default function CreatePage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <a href="/">Back</a>
        <WalletButton />
      </header>

      <h1 style={{ marginTop: 32 }}>Create token</h1>
      <p style={{ opacity: 0.65 }}>
        Fixed 1B supply. USDC bonding curve. No creator allocation.
      </p>

      <CreateTokenForm />
    </main>
  );
}
