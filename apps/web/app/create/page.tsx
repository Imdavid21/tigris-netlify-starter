export default function CreatePage() {
  return (
    <main style={{maxWidth: 720, margin: "0 auto", padding: "32px 20px"}}>
      <a href="/">Back</a>
      <h1 style={{marginTop: 32}}>Create token</h1>
      <form style={{display: "grid", gap: 16, marginTop: 24}}>
        <input name="name" placeholder="Name" />
        <input name="symbol" placeholder="Ticker" />
        <input name="image" type="file" accept="image/*" />
        <textarea name="description" placeholder="Description" />
        <input name="website" placeholder="Website" />
        <input name="twitter" placeholder="X" />
        <input name="telegram" placeholder="Telegram" />
        <button type="submit">Launch</button>
      </form>
    </main>
  );
}
