"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  parseUnits,
  type EIP1193Provider
} from "viem";
import { addresses, arcTestnet } from "@/lib/arc";
import { curveAbi, erc20Abi, factoryAbi } from "@/lib/abi";
import { ensureArcChain } from "@/lib/wallet";
import { useWalletSession } from "@/components/wallet-session";
import { RecentTrades } from "@/components/recent-trades";
import { PriceChart } from "@/components/price-chart";
import { Holders } from "@/components/holders";
import { API_URL } from "@/lib/api";
import { AppHeader } from "@/components/app-header";

function injected(): EIP1193Provider | undefined {
  return (window as Window & { ethereum?: EIP1193Provider }).ethereum;
}

type IndexedToken = {
  creator?: string;
  status?: string;
  pool_address?: string | null;
};

export function TokenMarket({ token }: { token: `0x${string}` }) {
  const client = useMemo(
    () =>
      createPublicClient({
        chain: arcTestnet,
        transport: http(
          process.env.NEXT_PUBLIC_ARC_RPC_URL ??
            "https://rpc.testnet.arc.network"
        )
      }),
    []
  );

  const [curve, setCurve] = useState<`0x${string}`>();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [raised, setRaised] = useState(0n);
  const [threshold, setThreshold] = useState(0n);
  const [graduated, setGraduated] = useState(false);
  const [indexed, setIndexed] = useState<IndexedToken>({});
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [mode, setMode] = useState<"market" | "limit" | "orders">("market");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<bigint>();
  const [slippage, setSlippage] = useState("1");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string>();
  const [tokenBalance, setTokenBalance] = useState(0n);
  const { address: walletAddress, connect } = useWalletSession();

  async function refresh() {
    if (!addresses.factory) throw new Error("Factory address is not configured.");

    const curveAddress = (await client.readContract({
      address: addresses.factory,
      abi: factoryAbi,
      functionName: "curveOf",
      args: [token]
    })) as `0x${string}`;

    if (BigInt(curveAddress) === 0n) {
      throw new Error("Token was not launched by this factory.");
    }

    setCurve(curveAddress);

    const [tokenName, tokenSymbol, quoteRaised, quoteThreshold, isGraduated, indexedToken] =
      await Promise.all([
        client.readContract({ address: token, abi: erc20Abi, functionName: "name" }),
        client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
        client.readContract({ address: curveAddress, abi: curveAbi, functionName: "trackedQuote" }),
        client.readContract({ address: curveAddress, abi: curveAbi, functionName: "graduationThreshold" }),
        client.readContract({ address: curveAddress, abi: curveAbi, functionName: "graduated" }),
        fetch(API_URL + "/tokens/" + token)
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({}))
      ]);

    setName(String(tokenName));
    setSymbol(String(tokenSymbol));
    setRaised(quoteRaised as bigint);
    setThreshold(quoteThreshold as bigint);
    setGraduated(Boolean(isGraduated));
    setIndexed(indexedToken as IndexedToken);
  }

  useEffect(() => {
    refresh().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load token.")
    );
  }, [token]);

  useEffect(() => {
    if (!walletAddress) {
      setTokenBalance(0n);
      return;
    }
    client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [walletAddress]
    }).then((balance) => setTokenBalance(balance as bigint)).catch(() => setTokenBalance(0n));
  }, [walletAddress, token, client]);

  useEffect(() => {
    if (!curve || !amount || Number(amount) <= 0 || graduated || mode !== "market") {
      setQuote(undefined);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const input = parseUnits(amount, side === "buy" ? 6 : 18);
        const output = (await client.readContract({
          address: curve,
          abi: curveAbi,
          functionName: side === "buy" ? "quoteBuy" : "quoteSell",
          args: [input]
        })) as bigint;
        setQuote(output);
      } catch {
        setQuote(undefined);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [amount, side, curve, graduated, mode, client]);

  async function trade() {
    setError(undefined);
    if (!curve || quote === undefined || mode !== "market") return;

    const provider = injected();
    if (!provider) {
      setError("No EVM wallet detected.");
      return;
    }

    try {
      setStatus("Preparing");
      await ensureArcChain(provider);

      const account = walletAddress ?? await connect();
      if (!account) throw new Error("No wallet account available.");
      const wallet = createWalletClient({
        account,
        chain: arcTestnet,
        transport: custom(provider)
      });

      const input = parseUnits(amount, side === "buy" ? 6 : 18);
      const asset = side === "buy" ? addresses.usdc : token;

      const allowance = (await client.readContract({
        address: asset,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, curve]
      })) as bigint;

      if (allowance < input) {
        setStatus(side === "buy" ? "Approve USDC" : "Approve token");
        const approveHash = await wallet.writeContract({
          address: asset,
          abi: erc20Abi,
          functionName: "approve",
          args: [curve, input]
        });
        await client.waitForTransactionReceipt({ hash: approveHash });
      }

      const slippageBps = BigInt(Math.max(0, Math.min(5000, Math.round(Number(slippage) * 100))));
      const minOut = (quote * (10000n - slippageBps)) / 10000n;
      setStatus("Confirm trade");

      const hash =
        side === "buy"
          ? await wallet.writeContract({
              address: curve,
              abi: curveAbi,
              functionName: "buy",
              args: [input, minOut]
            })
          : await wallet.writeContract({
              address: curve,
              abi: curveAbi,
              functionName: "sell",
              args: [input, minOut]
            });

      setStatus("Confirming");
      await client.waitForTransactionReceipt({ hash });
      setStatus("Complete");
      setAmount("");
      setQuote(undefined);
      await refresh();
      const nextBalance = await client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [account] }) as bigint;
      setTokenBalance(nextBalance);
    } catch (e) {
      setStatus("");
      setError(e instanceof Error ? e.message : "Trade failed.");
    }
  }

  const progress =
    threshold === 0n
      ? 0
      : Math.min(100, Number((raised * 10000n) / threshold) / 100);

  const inputUnits = amount && Number(amount) > 0
    ? parseUnits(amount, side === "buy" ? 6 : 18)
    : 0n;

  const feeEstimate = side === "buy"
    ? inputUnits / 100n
    : quote !== undefined
      ? quote / 99n
      : 0n;

  const creatorFee = feeEstimate / 4n;
  const protocolFee = feeEstimate - creatorFee;
  const minimum = quote !== undefined
    ? (quote * BigInt(10000 - Math.max(0, Math.min(5000, Math.round(Number(slippage) * 100))))) / 10000n
    : undefined;

  const afterTradeProgress =
    side === "buy" && threshold > 0n && amount && Number(amount) > 0
      ? Math.min(100, Number(((raised + inputUnits) * 10000n) / threshold) / 100)
      : progress;

  return (
    <main className="app-shell">
      <AppHeader />

      <div className="token-breadcrumb">
        <a href="/">Explore</a>
        <span>/</span>
        <span>{symbol || "Token"}</span>
      </div>

      <section className="token-hero">
        <div className="token-identity">
          <div className="token-avatar large">{(symbol || "AR").slice(0, 2)}</div>
          <div>
            <div className="token-title-line">
              <h1>{name || "Token"}</h1>
              {symbol && <span>${symbol}</span>}
              <span className={"phase-badge " + (graduated ? "done" : "")}>
                {graduated ? "Graduated" : "Curve"}
              </span>
            </div>
            <div className="token-links">
              <a href={"https://testnet.arcscan.app/address/" + token} target="_blank" rel="noreferrer">
                {token.slice(0, 8)}...{token.slice(-6)}
              </a>
              {indexed.creator && (
                <span>Creator {indexed.creator.slice(0, 7)}...{indexed.creator.slice(-5)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="hero-metrics">
          <div><span>Raised</span><strong>${Number(formatUnits(raised, 6)).toLocaleString()}</strong></div>
          <div><span>Graduation</span><strong>{progress.toFixed(1)}%</strong></div>
          <div><span>Pair</span><strong>USDC</strong></div>
          <div><span>Market</span><strong>{graduated ? "Arc DEX" : "Bonding curve"}</strong></div>
        </div>
      </section>

      <section className="graduation-strip">
        <div className="graduation-copy">
          <span>{graduated ? "Graduated" : "Graduation progress"}</span>
          <strong>{graduated ? "Curve closed" : "$" + Number(formatUnits(raised, 6)).toLocaleString() + " / $" + Number(formatUnits(threshold, 6)).toLocaleString()}</strong>
        </div>
        <div className="progress-track"><div style={{ width: progress + "%" }} /></div>
        <span>{progress.toFixed(1)}%</span>
      </section>

      <div className="market-layout">
        <section className="market-main">
          <PriceChart token={token} />

          <div className="market-tabs">
            <button className="active">Trades</button>
            <button>Holders</button>
            <button>About</button>
          </div>

          <div className="market-data-grid">
            <RecentTrades token={token} />
            <Holders token={token} />
          </div>

          <section className="about-panel">
            <div className="section-title"><strong>About</strong><span>Onchain launch data</span></div>
            <div className="about-grid">
              <div><span>Contract</span><a href={"https://testnet.arcscan.app/address/" + token} target="_blank" rel="noreferrer">{token.slice(0, 10)}...{token.slice(-8)}</a></div>
              <div><span>Curve</span><a href={curve ? "https://testnet.arcscan.app/address/" + curve : "#"} target="_blank" rel="noreferrer">{curve ? curve.slice(0, 10) + "..." + curve.slice(-8) : "—"}</a></div>
              <div><span>Supply</span><strong>1B fixed</strong></div>
              <div><span>Trade fee</span><strong>1.00%</strong></div>
              <div><span>Creator share</span><strong>25% of fee</strong></div>
              <div><span>Liquidity</span><strong>Reserved + locked</strong></div>
            </div>
            <div className="v2-about">
              <span>Token metadata</span>
              <p>Description, image, socials, creator economics, holder fee sharing, and launch protection appear here when configured.</p>
            </div>
          </section>
        </section>

        <aside className="trade-terminal">
          <div className="trade-modes">
            <button className={mode === "market" ? "active" : ""} onClick={() => setMode("market")}>Market</button>
            <button className={mode === "limit" ? "active" : ""} onClick={() => setMode("limit")}>Limit</button>
            <button className={mode === "orders" ? "active" : ""} onClick={() => setMode("orders")}>Orders</button>
          </div>

          {graduated ? (
            <div className="terminal-empty">
              <strong>Graduated</strong>
              <p>The bonding curve is closed. Post-graduation routing activates with the production Arc DEX adapter.</p>
              <button disabled>Trade on Arc DEX</button>
            </div>
          ) : mode !== "market" ? (
            <div className="terminal-empty">
              <strong>{mode === "limit" ? "Limit orders" : "Open orders"}</strong>
              <p>This order mode is not available on the current market.</p>
              <span className="coming-chip">Unavailable</span>
            </div>
          ) : (
            <>
              <div className="side-toggle">
                <button className={side === "buy" ? "active buy" : ""} onClick={() => { setSide("buy"); setAmount(""); }}>Buy</button>
                <button className={side === "sell" ? "active sell" : ""} onClick={() => { setSide("sell"); setAmount(""); }}>Sell</button>
              </div>

              <div className="amount-box">
                <div className="amount-label"><span>{side === "buy" ? "You pay" : "You sell"}</span><span>{side === "buy" ? "USDC" : symbol}</span></div>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
                {side === "buy" ? (
                  <div className="quick-amounts">
                    {["10","50","100","500"].map((v) => <button type="button" key={v} onClick={() => setAmount(v)}>{"$" + v}</button>)}
                  </div>
                ) : (
                  <div className="quick-amounts">
                    <button type="button" onClick={() => setAmount(formatUnits(tokenBalance / 4n, 18))}>25%</button>
                    <button type="button" onClick={() => setAmount(formatUnits(tokenBalance / 2n, 18))}>50%</button>
                    <button type="button" onClick={() => setAmount(formatUnits((tokenBalance * 3n) / 4n, 18))}>75%</button>
                    <button type="button" onClick={() => setAmount(formatUnits(tokenBalance, 18))} disabled={tokenBalance === 0n}>Sell all</button>
                  </div>
                )}
              </div>

              <div className="trade-settings">
                <span>Slippage</span>
                <div>
                  {["0.5","1","2"].map((v) => (
                    <button key={v} className={slippage === v ? "active" : ""} onClick={() => setSlippage(v)}>{v}%</button>
                  ))}
                </div>
              </div>

              {quote !== undefined && (
                <div className="trade-review">
                  <div><span>Estimated receive</span><strong>{formatUnits(quote, side === "buy" ? 18 : 6)} {side === "buy" ? symbol : "USDC"}</strong></div>
                  <div><span>Minimum received</span><strong>{minimum !== undefined ? formatUnits(minimum, side === "buy" ? 18 : 6) : "—"} {side === "buy" ? symbol : "USDC"}</strong></div>
                  <div><span>Trading fee</span><strong>{formatUnits(feeEstimate, 6)} USDC</strong></div>
                  <div><span>Creator share</span><strong>{formatUnits(creatorFee, 6)} USDC</strong></div>
                  <div><span>Protocol share</span><strong>{formatUnits(protocolFee, 6)} USDC</strong></div>
                  {side === "buy" && <div><span>Graduation after trade</span><strong>{afterTradeProgress.toFixed(1)}%</strong></div>}
                </div>
              )}

              <button className="review-trade-button" onClick={trade} disabled={quote === undefined}>
                {status || (quote === undefined ? "Enter amount" : "Review trade")}
              </button>

              <p className="terminal-footnote">Quotes and execution are read directly from Arc. Indexed data is never in the trade path.</p>
            </>
          )}

          {error && <p className="form-error">{error}</p>}
        </aside>
      </div>
    </main>
  );
}
