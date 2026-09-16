import styles from "./testnet.module.css";

const contracts = [
  ["Celestial factory", "0x418a062cEcB23d68a3e8dcEa19E89bAD98bBe826"],
  ["Fee escrow", "0xab922E5F1Ff1071a00a339C8b5FcF7d2f6F2a4e0"],
  ["Buyback vault", "0x9FbB1892885888e9a8c01d7A56652C4D76B23fC8"],
  ["Liquidity locker", "0x3e535c6F3daE1594A1C9ebB55E49175abC03bf77"],
  ["Limit order book", "0x93e6ada62d3E6a0153B00F9962c4B52eC7F45f62"],
  ["Legacy V1 factory", "0x8F146d29EAf59fC1E93924F8D1BBd1Eae8C29423"]
] as const;

const explorer = "https://testnet.arc-scan.org";

export default function TestnetArchivePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href="/explore" className={styles.brand}>supershot.fun</a>
        <a href="/explore" className={styles.back}>Back to mainnet</a>
      </header>

      <section className={styles.hero}>
        <span className={styles.badge}>Arc Testnet · Chain 5042002</span>
        <h1>Testnet archive</h1>
        <p>Historical Supershot deployments from Arc Testnet. Production markets, balances, and trading now live on Arc Mainnet.</p>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <h2>Archived contracts</h2>
            <p>Read-only references. Testnet assets have no relationship to mainnet assets.</p>
          </div>
          <a href={explorer} target="_blank" rel="noreferrer">Open testnet explorer</a>
        </div>

        <div className={styles.rows}>
          {contracts.map(([label, address]) => (
            <a key={address} className={styles.row} href={`${explorer}/address/${address}`} target="_blank" rel="noreferrer">
              <span>{label}</span>
              <code>{address}</code>
            </a>
          ))}
        </div>
      </section>

      <section className={styles.note}>
        <strong>Production is Arc Mainnet.</strong>
        <span>The live app does not read testnet contracts or testnet indexed market data.</span>
      </section>
    </main>
  );
}
