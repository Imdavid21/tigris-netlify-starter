"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  parseUnits,
  zeroAddress,
  type Address,
  type EIP1193Provider
} from "viem";
import { addresses, arcTestnet } from "@/lib/arc";
import { curveAbi, erc20Abi, factoryAbi } from "@/lib/abi";
import {
  celestialAddresses,
  celestialCurveAbi,
  celestialFactoryAbi,
  celestialTokenAbi,
  dexAdapterAbi,
  orderBookAbi,
  quoteAssets
} from "@/lib/celestial";
import { ensureArcChain } from "@/lib/wallet";
import { useWalletSession } from "@/components/wallet-session";
import { RecentTrades } from "@/components/recent-trades";
import { PriceChart } from "@/components/price-chart";
import { Holders } from "@/components/holders";
import { API_URL } from "@/lib/api";
import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";
import { createArcPublicClient, friendlyChainError } from "@/lib/rpc";

function injected(): EIP1193Provider | undefined {
  return (window as Window & { ethereum?: EIP1193Provider }).ethereum;
}

type IndexedToken = {
  address?: string;
  curve_address?: Address;
  creator?: string;
  status?: string;
  generation?: "V1" | "CELESTIAL";
  quote_asset?: Address | null;
  pool_address?: Address | null;
  creator_fee_recipient?: string | null;
  creator_tax_bps?: number;
  holder_fee_bps?: number;
  description?: string | null;
  image?: string | null;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
};

type IndexedOrder = {
  order_id: string;
  curve: string;
  side: "BUY" | "SELL";
  amount_in: string;
  min_amount_out: string;
  status: string;
  created_at?: string;
};

export function TokenMarket({ token }: { token: Address }) {
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

  const { address: walletAddress, connect } = useWalletSession();

  const [curve, setCurve] = useState<Address>();
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
  const [limitReceive, setLimitReceive] = useState("");
  const [slippage, setSlippage] = useState("1");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string>();
  const [tokenBalance, setTokenBalance] = useState(0n);
  const [holderRewards, setHolderRewards] = useState(0n);
  const [orders, setOrders] = useState<IndexedOrder[]>([]);
  const [feeBps, setFeeBps] = useState(100n);
  const [creatorTaxBps, setCreatorTaxBps] = useState(0n);
  const [holderFeeBps, setHolderFeeBps] = useState(0n);
  const [snipeBps, setSnipeBps] = useState(0n);

  const isCelestial = indexed.generation === "CELESTIAL";
  const quoteAsset = useMemo(() => {
    const found = quoteAssets.find(
      (q) => q.address.toLowerCase() === indexed.quote_asset?.toLowerCase()
    );
    return found ?? quoteAssets[0];
  }, [indexed.quote_asset]);

  async function refresh() {
    const indexedToken = await fetch(API_URL + "/tokens/" + token)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})) as IndexedToken;

    let celestial = indexedToken.generation === "CELESTIAL";
    let curveAddress = indexedToken.curve_address;

    // Indexed data improves discovery/history, but market resolution must work
    // directly from Arc so an indexer delay cannot make a live market unusable.
    if (!curveAddress && celestialAddresses.factory) {
      const celestialCurve = await client.readContract({
        address: celestialAddresses.factory,
        abi: celestialFactoryAbi,
        functionName: "curveOf",
        args: [token]
      }).catch(() => zeroAddress) as Address;

      if (celestialCurve !== zeroAddress) {
        celestial = true;
        curveAddress = celestialCurve;
        indexedToken.generation = "CELESTIAL";

        const [quoteAsset, graduation] = await Promise.all([
          client.readContract({
            address: celestialAddresses.factory,
            abi: celestialFactoryAbi,
            functionName: "quoteAssetOf",
            args: [token]
          }).catch(() => zeroAddress),
          client.readContract({
            address: celestialAddresses.factory,
            abi: celestialFactoryAbi,
            functionName: "graduations",
            args: [token]
          }).catch(() => undefined)
        ]);

        if (quoteAsset !== zeroAddress) {
          indexedToken.quote_asset = quoteAsset as Address;
        }

        if (graduation) {
          const pool = graduation[3] as Address;
          if (pool !== zeroAddress) indexedToken.pool_address = pool;
        }
      }
    }

    if (!curveAddress && addresses.factory) {
      const legacyCurve = await client.readContract({
        address: addresses.factory,
        abi: factoryAbi,
        functionName: "curveOf",
        args: [token]
      }).catch(() => zeroAddress) as Address;

      if (legacyCurve !== zeroAddress) {
        celestial = false;
        curveAddress = legacyCurve;
        indexedToken.generation = "V1";
      }
    }

    if (!curveAddress || curveAddress === zeroAddress) {
      throw new Error("Token market could not be resolved.");
    }

    const marketAbi = celestial ? celestialCurveAbi : curveAbi;

    const common = await Promise.all([
      client.readContract({ address: token, abi: erc20Abi, functionName: "name" }),
      client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
      client.readContract({ address: curveAddress, abi: marketAbi, functionName: "trackedQuote" }),
      client.readContract({ address: curveAddress, abi: marketAbi, functionName: "graduationThreshold" }),
      client.readContract({ address: curveAddress, abi: marketAbi, functionName: "graduated" })
    ]);

    setCurve(curveAddress);
    setName(String(common[0]));
    setSymbol(String(common[1]));
    setRaised(common[2] as bigint);
    setThreshold(common[3] as bigint);
    setGraduated(Boolean(common[4]));
    setIndexed(indexedToken);

    if (celestial) {
      const buyer = walletAddress ?? zeroAddress;
      const [base, creatorTax, holderFee, snipe] = await Promise.all([
        client.readContract({ address: curveAddress, abi: celestialCurveAbi, functionName: "feeBps" }),
        client.readContract({ address: curveAddress, abi: celestialCurveAbi, functionName: "creatorTaxBps" }),
        client.readContract({ address: curveAddress, abi: celestialCurveAbi, functionName: "holderFeeBps" }),
        client.readContract({ address: curveAddress, abi: celestialCurveAbi, functionName: "currentSnipeBps", args: [buyer] })
      ]);
      setFeeBps(base as bigint);
      setCreatorTaxBps(creatorTax as bigint);
      setHolderFeeBps(holderFee as bigint);
      setSnipeBps(snipe as bigint);
    } else {
      setFeeBps(100n);
      setCreatorTaxBps(0n);
      setHolderFeeBps(0n);
      setSnipeBps(0n);
    }
  }

  async function refreshWalletState(account: Address) {
    const balance = await client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account]
    }) as bigint;
    setTokenBalance(balance);

    if (isCelestial) {
      const rewards = await client.readContract({
        address: token,
        abi: celestialTokenAbi,
        functionName: "withdrawableRewardOf",
        args: [account]
      }).catch(() => 0n) as bigint;
      setHolderRewards(rewards);
    } else {
      setHolderRewards(0n);
    }
  }

  async function refreshOrders(account: Address) {
    const data = await fetch(API_URL + "/wallet/" + account + "/orders")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .catch(() => ({ items: [] }));

    setOrders(
      (data.items ?? []).filter(
        (order: IndexedOrder) =>
          !curve || order.curve.toLowerCase() === curve.toLowerCase()
      )
    );
  }

  useEffect(() => {
    refresh().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load token.")
    );
  }, [token, walletAddress]);

  useEffect(() => {
    if (!walletAddress) {
      setTokenBalance(0n);
      setHolderRewards(0n);
      setOrders([]);
      return;
    }
    void refreshWalletState(walletAddress);
    void refreshOrders(walletAddress);
  }, [walletAddress, token, isCelestial, curve]);

  useEffect(() => {
    if (!curve || !amount || Number(amount) <= 0 || mode === "orders") {
      setQuote(undefined);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const input = parseUnits(
          amount,
          side === "buy" ? quoteAsset.decimals : 18
        );

        let output: bigint;

        if (graduated) {
          if (!isCelestial || !indexed.pool_address || !celestialAddresses.dexAdapter) {
            setQuote(undefined);
            return;
          }
          const simulation = await client.simulateContract({
            address: celestialAddresses.dexAdapter,
            abi: dexAdapterAbi,
            functionName: "quoteExactInput",
            args: [
              indexed.pool_address,
              side === "buy" ? quoteAsset.address : token,
              input
            ],
            account: walletAddress ?? zeroAddress
          });
          output = simulation.result as bigint;
        } else if (isCelestial) {
          output = side === "buy"
            ? await client.readContract({
                address: curve,
                abi: celestialCurveAbi,
                functionName: "quoteBuyFor",
                args: [walletAddress ?? zeroAddress, input]
              }) as bigint
            : await client.readContract({
                address: curve,
                abi: celestialCurveAbi,
                functionName: "quoteSell",
                args: [input]
              }) as bigint;
        } else {
          output = await client.readContract({
            address: curve,
            abi: curveAbi,
            functionName: side === "buy" ? "quoteBuy" : "quoteSell",
            args: [input]
          }) as bigint;
        }

        setQuote(output);
      } catch {
        setQuote(undefined);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [
    amount,
    side,
    curve,
    graduated,
    mode,
    client,
    walletAddress,
    isCelestial,
    indexed.pool_address,
    quoteAsset.address,
    quoteAsset.decimals,
    token
  ]);

  async function accountAndWallet() {
    const provider = injected();
    if (!provider) throw new Error("No EVM wallet detected.");
    await ensureArcChain(provider);
    const account = walletAddress ?? await connect();
    if (!account) throw new Error("No wallet account available.");
    return {
      account,
      wallet: createWalletClient({
        account,
        chain: arcTestnet,
        transport: custom(provider)
      })
    };
  }

  async function ensureAllowance(
    asset: Address,
    spender: Address,
    input: bigint,
    label: string
  ) {
    const { account, wallet } = await accountAndWallet();
    const allowance = await client.readContract({
      address: asset,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account, spender]
    }) as bigint;

    if (allowance < input) {
      setStatus(label);
      const hash = await wallet.writeContract({
        address: asset,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, input]
      });
      await client.waitForTransactionReceipt({ hash });
    }

    return { account, wallet };
  }

  async function marketTrade() {
    setError(undefined);
    if (!curve || quote === undefined) return;

    try {
      setStatus("Preparing");
      const input = parseUnits(
        amount,
        side === "buy" ? quoteAsset.decimals : 18
      );
      const minOut =
        quote *
        BigInt(
          10000 -
            Math.max(0, Math.min(5000, Math.round(Number(slippage) * 100)))
        ) /
        10000n;

      const asset = side === "buy" ? quoteAsset.address : token;

      if (graduated) {
        if (
          !isCelestial ||
          !indexed.pool_address ||
          !celestialAddresses.dexAdapter
        ) {
          throw new Error(
            "Post-graduation trading is waiting for the configured Arc DEX connector."
          );
        }

        const { account, wallet } = await ensureAllowance(
          asset,
          celestialAddresses.dexAdapter,
          input,
          "Approve asset"
        );

        setStatus("Confirm trade");
        const hash = await wallet.writeContract({
          address: celestialAddresses.dexAdapter,
          abi: dexAdapterAbi,
          functionName: "swapExactInput",
          args: [
            indexed.pool_address,
            asset,
            input,
            minOut,
            account
          ]
        });
        await client.waitForTransactionReceipt({ hash });
      } else {
        const { account, wallet } = await ensureAllowance(
          asset,
          curve,
          input,
          side === "buy" ? "Approve " + quoteAsset.symbol : "Approve token"
        );

        setStatus("Confirm trade");
        const hash = isCelestial
          ? side === "buy"
            ? await wallet.writeContract({
                address: curve,
                abi: celestialCurveAbi,
                functionName: "buy",
                args: [input, minOut]
              })
            : await wallet.writeContract({
                address: curve,
                abi: celestialCurveAbi,
                functionName: "sell",
                args: [input, minOut]
              })
          : side === "buy"
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
        await refreshWalletState(account);
      }

      setStatus("Complete");
      setAmount("");
      setQuote(undefined);
      await refresh();
    } catch (e) {
      setStatus("");
      setError(friendlyChainError(e, "Trade failed."));
    }
  }

  async function placeLimitOrder() {
    setError(undefined);
    if (
      !isCelestial ||
      !curve ||
      !celestialAddresses.orderBook ||
      !amount ||
      !limitReceive
    ) return;

    try {
      const input = parseUnits(
        amount,
        side === "buy" ? quoteAsset.decimals : 18
      );
      const minOutput = parseUnits(
        limitReceive,
        side === "buy" ? 18 : quoteAsset.decimals
      );
      const asset = side === "buy" ? quoteAsset.address : token;

      const { account, wallet } = await ensureAllowance(
        asset,
        celestialAddresses.orderBook,
        input,
        side === "buy" ? "Approve " + quoteAsset.symbol : "Approve token"
      );

      setStatus("Place order");
      const hash = side === "buy"
        ? await wallet.writeContract({
            address: celestialAddresses.orderBook,
            abi: orderBookAbi,
            functionName: "placeBuyOrder",
            args: [curve, input, minOutput]
          })
        : await wallet.writeContract({
            address: celestialAddresses.orderBook,
            abi: orderBookAbi,
            functionName: "placeSellOrder",
            args: [curve, input, minOutput]
          });

      await client.waitForTransactionReceipt({ hash });
      setStatus("Order placed");
      setAmount("");
      setLimitReceive("");
      await refreshOrders(account);
      setMode("orders");
    } catch (e) {
      setStatus("");
      setError(friendlyChainError(e, "Order placement failed."));
    }
  }

  async function cancelOrder(orderId: string) {
    if (!celestialAddresses.orderBook) return;
    try {
      const { account, wallet } = await accountAndWallet();
      setStatus("Cancel order");
      const hash = await wallet.writeContract({
        address: celestialAddresses.orderBook,
        abi: orderBookAbi,
        functionName: "cancel",
        args: [BigInt(orderId)]
      });
      await client.waitForTransactionReceipt({ hash });
      setStatus("Cancelled");
      await refreshOrders(account);
    } catch (e) {
      setStatus("");
      setError(friendlyChainError(e, "Cancellation failed."));
    }
  }

  async function claimHolderRewards() {
    if (!walletAddress || !isCelestial || holderRewards === 0n) return;
    try {
      const { account, wallet } = await accountAndWallet();
      setStatus("Claim rewards");
      const hash = await wallet.writeContract({
        address: token,
        abi: celestialTokenAbi,
        functionName: "claimHolderRewards"
      });
      await client.waitForTransactionReceipt({ hash });
      setStatus("Rewards claimed");
      await refreshWalletState(account);
    } catch (e) {
      setStatus("");
      setError(friendlyChainError(e, "Reward claim failed."));
    }
  }

  const progress =
    threshold === 0n
      ? 0
      : Math.min(100, Number((raised * 10000n) / threshold) / 100);

  const inputUnits =
    amount && Number(amount) > 0
      ? parseUnits(amount, side === "buy" ? quoteAsset.decimals : 18)
      : 0n;

  const totalTradeBps =
    feeBps +
    creatorTaxBps +
    holderFeeBps +
    (side === "buy" ? snipeBps : 0n);

  const feeEstimate =
    side === "buy"
      ? inputUnits * totalTradeBps / 10000n
      : quote !== undefined
        ? quote * totalTradeBps / (10000n - totalTradeBps)
        : 0n;

  const minimum =
    quote !== undefined
      ? quote *
        BigInt(
          10000 -
            Math.max(0, Math.min(5000, Math.round(Number(slippage) * 100)))
        ) /
        10000n
      : undefined;

  const outputDecimals = side === "buy" ? 18 : quoteAsset.decimals;
  const outputSymbol = side === "buy" ? symbol : quoteAsset.symbol;

  return (
    <main className="app-shell">
      <AppHeader />

      <div className="token-breadcrumb">
        <a href="/explore">Explore</a><span>/</span><span>{symbol || "Token"}</span>
      </div>

      <section className="token-hero">
        <div className="token-identity">
          <div className="token-avatar large">
            {indexed.image ? <img src={indexed.image} alt="" /> : (symbol || "AR").slice(0, 2)}
          </div>
          <div>
            <div className="token-title-line">
              <h1>{name || "Token"}</h1>
              {symbol && <span>{"$" + symbol}</span>}
              <span className={"phase-badge " + (graduated ? "done" : "")}>
                {graduated ? "Graduated" : "Curve"}
              </span>
            </div>
            <div className="token-links">
              <a href={"https://testnet.arcscan.app/address/" + token} target="_blank" rel="noreferrer">
                {token.slice(0, 8)}...{token.slice(-6)}
              </a>
              {indexed.creator && <span>Creator {indexed.creator.slice(0, 7)}...{indexed.creator.slice(-5)}</span>}
              {indexed.website && <a href={indexed.website} target="_blank" rel="noreferrer">Website</a>}
              {indexed.twitter && <a href={indexed.twitter.startsWith("http") ? indexed.twitter : "https://x.com/" + indexed.twitter.replace("@", "")} target="_blank" rel="noreferrer">X</a>}
              {indexed.telegram && <a href={indexed.telegram.startsWith("http") ? indexed.telegram : "https://" + indexed.telegram} target="_blank" rel="noreferrer">Telegram</a>}
            </div>
          </div>
        </div>

        <div className="hero-metrics">
          <div><span>Raised</span><strong>{Number(formatUnits(raised, quoteAsset.decimals)).toLocaleString()} {quoteAsset.symbol}</strong></div>
          <div><span>Graduation</span><strong>{progress.toFixed(1)}%</strong></div>
          <div><span>Pair</span><strong>{quoteAsset.symbol}</strong></div>
          <div><span>Market</span><strong>{graduated ? "Uniswap v4" : "Bonding curve"}</strong></div>
        </div>
      </section>

      <section className="graduation-strip">
        <div className="graduation-copy">
          <span>{graduated ? "Graduated" : "Graduation progress"}</span>
          <strong>
            {graduated
              ? "Curve closed"
              : Number(formatUnits(raised, quoteAsset.decimals)).toLocaleString() +
                " / " +
                Number(formatUnits(threshold, quoteAsset.decimals)).toLocaleString() +
                " " +
                quoteAsset.symbol}
          </strong>
        </div>
        <div className="progress-track"><div style={{ width: progress + "%" }} /></div>
        <span>{progress.toFixed(1)}%</span>
      </section>

      <div className="market-layout">
        <section className="market-main">
          <PriceChart token={token} />

          <div className="market-data-grid">
            <RecentTrades token={token} />
            <Holders token={token} />
          </div>

          <section className="about-panel">
            <div className="section-title"><strong>About</strong><span>Onchain launch data</span></div>
            {indexed.description && <p className="review-copy">{indexed.description}</p>}
            <div className="about-grid">
              <div><span>Contract</span><a href={"https://testnet.arcscan.app/address/" + token} target="_blank" rel="noreferrer">{token.slice(0, 10)}...{token.slice(-8)}</a></div>
              <div><span>Curve</span><a href={curve ? "https://testnet.arcscan.app/address/" + curve : "#"} target="_blank" rel="noreferrer">{curve ? curve.slice(0, 10) + "..." + curve.slice(-8) : "—"}</a></div>
              <div><span>Supply</span><strong>1B fixed</strong></div>
              <div><span>Base fee</span><strong>{Number(feeBps) / 100}%</strong></div>
              <div><span>Creator tax</span><strong>{Number(creatorTaxBps) / 100}%</strong></div>
              <div><span>Holder sharing</span><strong>{Number(holderFeeBps) / 100}%</strong></div>
            </div>

            {isCelestial && walletAddress && (
              <div className="v2-about">
                <span>Holder rewards</span>
                <p>{formatUnits(holderRewards, quoteAsset.decimals)} {quoteAsset.symbol} claimable from trading fees.</p>
                <button onClick={() => void claimHolderRewards()} disabled={holderRewards === 0n}>Claim rewards</button>
              </div>
            )}
          </section>
        </section>

        <aside className="trade-terminal">
          <div className="trade-modes">
            <button className={mode === "market" ? "active" : ""} onClick={() => setMode("market")}>Market</button>
            <button className={mode === "limit" ? "active" : ""} onClick={() => setMode("limit")} disabled={!isCelestial || graduated}>Limit</button>
            <button className={mode === "orders" ? "active" : ""} onClick={() => setMode("orders")} disabled={!isCelestial}>Orders</button>
          </div>

          {mode === "orders" ? (
            <div className="terminal-empty">
              <strong>Open orders</strong>
              {!walletAddress ? (
                <button onClick={() => void connect()}>Connect wallet</button>
              ) : !orders.length ? (
                <p>No orders for this market.</p>
              ) : (
                orders.map((order) => (
                  <div className="trade-review" key={order.order_id}>
                    <div><span>{order.side}</span><strong>{order.status}</strong></div>
                    <div><span>Input</span><strong>{order.amount_in}</strong></div>
                    <div><span>Minimum output</span><strong>{order.min_amount_out}</strong></div>
                    {order.status === "OPEN" && <button onClick={() => void cancelOrder(order.order_id)}>Cancel</button>}
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              <div className="side-toggle">
                <button className={side === "buy" ? "active buy" : ""} onClick={() => { setSide("buy"); setAmount(""); }}>Buy</button>
                <button className={side === "sell" ? "active sell" : ""} onClick={() => { setSide("sell"); setAmount(""); }}>Sell</button>
              </div>

              <div className="amount-box">
                <div className="amount-label"><span>{side === "buy" ? "You pay" : "You sell"}</span><span>{side === "buy" ? quoteAsset.symbol : symbol}</span></div>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
                {side === "buy" ? (
                  <div className="quick-amounts">
                    {["10", "50", "100", "500"].map((v) => <button type="button" key={v} onClick={() => setAmount(v)}>{v}</button>)}
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

              {mode === "limit" && (
                <div className="amount-box">
                  <div className="amount-label"><span>Minimum receive</span><span>{outputSymbol}</span></div>
                  <input value={limitReceive} onChange={(e) => setLimitReceive(e.target.value)} inputMode="decimal" placeholder="0.00" />
                  <p className="terminal-footnote">The order executes permissionlessly when the bonding curve can return at least this amount.</p>
                </div>
              )}

              {mode === "market" && (
                <div className="trade-settings">
                  <span>Slippage</span>
                  <div>
                    {["0.5", "1", "2"].map((v) => (
                      <button key={v} className={slippage === v ? "active" : ""} onClick={() => setSlippage(v)}>{v}%</button>
                    ))}
                  </div>
                </div>
              )}

              {quote !== undefined && (
                <div className="trade-review">
                  <div><span>Estimated receive</span><strong>{formatUnits(quote, outputDecimals)} {outputSymbol}</strong></div>
                  {mode === "market" && <div><span>Minimum received</span><strong>{minimum !== undefined ? formatUnits(minimum, outputDecimals) : "—"} {outputSymbol}</strong></div>}
                  {!graduated && <div><span>Estimated fees</span><strong>{formatUnits(feeEstimate, quoteAsset.decimals)} {quoteAsset.symbol}</strong></div>}
                  {side === "buy" && snipeBps > 0n && <div><span>Launch protection</span><strong>{Number(snipeBps) / 100}%</strong></div>}
                </div>
              )}

              <button
                className="review-trade-button"
                onClick={() => void (mode === "limit" ? placeLimitOrder() : marketTrade())}
                disabled={
                  mode === "limit"
                    ? !amount || !limitReceive || !celestialAddresses.orderBook
                    : quote === undefined
                }
              >
                {status ||
                  (mode === "limit"
                    ? "Place limit order"
                    : quote === undefined
                      ? "Enter amount"
                      : graduated
                        ? "Trade on Arc DEX"
                        : "Review trade")}
              </button>

              {graduated && (!celestialAddresses.dexAdapter || !indexed.pool_address) && (
                <p className="terminal-footnote">The market is graduated, but the production Arc DEX connector is not configured yet.</p>
              )}
              <p className="terminal-footnote">Quotes and execution are read directly from Arc. Indexed data is never in the trade path.</p>
            </>
          )}

          {error && <p className="form-error">{error}</p>}
        </aside>
      </div>
    </main>
  );
}
