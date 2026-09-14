export default function Home() {
  return (
    <main style={{maxWidth: 1120, margin: "0 auto", padding: "32px 20px"}}>
      <header style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
        <strong>Arc Launchpad</strong>
        <a href="/create">Create token</a>
      </header>

      <section style={{marginTop: 48}}>
        <h1 style={{fontSize: 32, marginBottom: 8}}>Tokens</h1>
        <p style={{opacity: 0.65}}>USDC-native launches on Arc.</p>
      </section>

      <section style={{marginTop: 32}}>
        <div style={{display: "flex", gap: 16}}>
          <button>Trending</button>
          <button>New</button>
          <button>Graduating</button>
          <button>Graduated</button>
        </div>
      </section>
    </main>
  );
}
