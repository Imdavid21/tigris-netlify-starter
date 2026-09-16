import { formatUnits, getAddress, isAddress } from "viem";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";
import { FlowDiv, FlowSection } from "@/components/viewport-flow";
import { API_URL } from "@/lib/api";
import { quoteAssets } from "@/lib/celestial";
import styles from "./ScannerPage.module.css";

type Props = { params: Promise<{ address: string }> };

type IndexedTrade = {
  tx_hash: string;
  block_time: string;
  trader: string;
  side: "BUY" | "SELL";
  token_amount: string;
  quote_amount: string;
};

type IndexedToken = {
  address?: string;
  curve_address?: string | null;
  creator?: string | null;
  name?: string;
  symbol?: string;
  status?: string;
  generation?: string;
  quote_asset?: string | null;
  pool_address?: string | null;
  image?: string | null;
  trades?: IndexedTrade[];
};

type Holder = {
  holder: string;
  balance: string;
};

async function load(address: string) {
  try {
    const [tokenRes, holdersRes] = await Promise.all([
      fetch(`${API_URL}/tokens/${address}`, { cache: "no-store" }),
      fetch(`${API_URL}/tokens/${address}/holders`, { cache: "no-store" })
    ]);

    return {
      token: tokenRes.ok ? await tokenRes.json() as IndexedToken : null,
      holders: holdersRes.ok ? ((await holdersRes.json()).items ?? []) as Holder[] : [],
      degraded: !tokenRes.ok || !holdersRes.ok
    };
  } catch {
    return { token: null, holders: [] as Holder[], degraded: true };
  }
}

function short(value?: string | null) {
  if (!value) return "—";
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export default async function ScannerPage({ params }: Props) {
  const { address } = await params;
  if (!isAddress(address)) notFound();

  const tokenAddress = getAddress(address);
  const { token, holders, degraded } = await load(tokenAddress);
  const trades = token?.trades ?? [];
  const quote = quoteAssets.find((asset) => asset.address.toLowerCase() === token?.quote_asset?.toLowerCase());
  const quoteDecimals = quote?.decimals ?? 6;
  const quoteSymbol = quote?.symbol ?? "Quote";
  const totalHolderBalance = holders.reduce((sum, holder) => {
    try {
      return sum + BigInt(holder.balance);
    } catch {
      return sum;
    }
  }, 0n);

  return (
    <main className={styles.page}>
      <AppHeader />

      <div className={styles.canvas}>
        {degraded && (
          <FlowDiv className={styles.notice}>
            Indexed scanner data may be incomplete. Use Arc Explorer for contract-native verification.
          </FlowDiv>
        )}

        <FlowDiv className={styles.head}>
          <div className={styles.identity}>
            <div className={styles.avatar}>
              {token?.image ? <img src={token.image} alt="" /> : (token?.symbol || "AR").slice(0, 2)}
            </div>
            <div>
              <h1>{token?.name || "Contract"}</h1>
              <div className={styles.meta}>
                {token?.symbol && <span>${token.symbol}</span>}
                <span>{short(tokenAddress)}</span>
                <span>{token?.status || "Not indexed"}</span>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <a href={`https://testnet.arcscan.app/address/${tokenAddress}`} target="_blank" rel="noreferrer">Arc Explorer</a>
            {token && <a href={`/token/${tokenAddress}`} className={styles.primary}>Open market</a>}
          </div>
        </FlowDiv>

        <FlowSection className={styles.metrics} delay={0.03}>
          <div className={styles.metric}><span>Holders</span><strong>{holders.length.toLocaleString()}</strong></div>
          <div className={styles.metric}><span>Indexed trades</span><strong>{trades.length.toLocaleString()}</strong></div>
          <div className={styles.metric}><span>Status</span><strong>{token?.status || "—"}</strong></div>
          <div className={styles.metric}><span>Generation</span><strong>{token?.generation || "—"}</strong></div>
          <div className={styles.metric}><span>Quote asset</span><strong>{quoteSymbol}</strong></div>
          <div className={styles.metric}><span>Creator</span><strong>{short(token?.creator)}</strong></div>
          <div className={styles.metric}><span>Indexed supply held</span><strong>{Number(formatUnits(totalHolderBalance, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></div>
        </FlowSection>

        <div className={styles.grid}>
          <FlowSection className={styles.panel} delay={0.05}>
            <div className={styles.panelHead}>
              <h2>Contract details</h2>
              <span>Indexed + explorer links</span>
            </div>
            <div className={styles.contractGrid}>
              <div className={styles.contractCell}>
                <span className={styles.cellLabel}>Token</span>
                <a href={`https://testnet.arcscan.app/address/${tokenAddress}`} target="_blank" rel="noreferrer">{tokenAddress}</a>
              </div>
              <div className={styles.contractCell}>
                <span className={styles.cellLabel}>Curve</span>
                {token?.curve_address ? <a href={`https://testnet.arcscan.app/address/${token.curve_address}`} target="_blank" rel="noreferrer">{token.curve_address}</a> : <strong>—</strong>}
              </div>
              <div className={styles.contractCell}>
                <span className={styles.cellLabel}>Creator</span>
                {token?.creator ? <a href={`https://testnet.arcscan.app/address/${token.creator}`} target="_blank" rel="noreferrer">{token.creator}</a> : <strong>—</strong>}
              </div>
              <div className={styles.contractCell}>
                <span className={styles.cellLabel}>DEX pool</span>
                {token?.pool_address ? <a href={`https://testnet.arcscan.app/address/${token.pool_address}`} target="_blank" rel="noreferrer">{token.pool_address}</a> : <strong>—</strong>}
              </div>
            </div>
          </FlowSection>

          <FlowSection className={styles.panel} delay={0.07}>
            <div className={styles.panelHead}>
              <h2>Top holders</h2>
              <span>{holders.length} indexed</span>
            </div>
            {!holders.length ? (
              <div className={styles.empty}>No indexed holders yet.</div>
            ) : holders.slice(0, 20).map((holder, index) => (
              <a
                key={holder.holder}
                href={`https://testnet.arcscan.app/address/${holder.holder}`}
                target="_blank"
                rel="noreferrer"
                className={styles.row}
              >
                <span className={styles.rank}>{index + 1}</span>
                <span className={styles.address}>{holder.holder}</span>
                <span className={styles.value}>{Number(formatUnits(BigInt(holder.balance), 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </a>
            ))}
          </FlowSection>

          <FlowSection className={`${styles.panel} ${styles.full}`} delay={0.09}>
            <div className={styles.panelHead}>
              <h2>Recent activity</h2>
              <span>{trades.length} indexed trades</span>
            </div>
            {!trades.length ? (
              <div className={styles.empty}>No indexed activity yet.</div>
            ) : trades.slice(0, 24).map((trade) => (
              <a
                key={`${trade.tx_hash}-${trade.block_time}`}
                href={`https://testnet.arcscan.app/tx/${trade.tx_hash}`}
                target="_blank"
                rel="noreferrer"
                className={`${styles.row} ${styles.activityRow}`}
              >
                <span className={`${styles.side} ${trade.side === "BUY" ? styles.buy : styles.sell}`}>{trade.side === "BUY" ? "Buy" : "Sell"}</span>
                <span className={styles.address}>{trade.trader}</span>
                <span className={styles.value}>{Number(formatUnits(BigInt(trade.quote_amount), quoteDecimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })} {quoteSymbol}</span>
              </a>
            ))}
          </FlowSection>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
