type Props = { params: Promise<{ address: string }> };

export default async function TokenPage({ params }: Props) {
  const { address } = await params;

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 20px" }}>
      <a href="/">Back</a>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(280px, 1fr)", gap: 28, marginTop: 32 }}>
        <section>
          <p style={{ opacity: 0.55, wordBreak: "break-all" }}>{address}</p>
          <h1>Token</h1>
          <div style={{ minHeight: 420, border: "1px solid #29302c", borderRadius: 12, padding: 20 }}>
            Chart
          </div>
        </section>
        <aside style={{ border: "1px solid #29302c", borderRadius: 12, padding: 20, height: "fit-content" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button>Buy</button>
            <button>Sell</button>
          </div>
          <input style={{ marginTop: 16 }} inputMode="decimal" placeholder="0.00 USDC" />
          <button style={{ width: "100%", marginTop: 16 }}>Review trade</button>
        </aside>
      </div>
    </main>
  );
}
