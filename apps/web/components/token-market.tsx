"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  getAddress,
  http,
  parseUnits,
  type EIP1193Provider
} from "viem";
import { addresses, arcTestnet } from "@/lib/arc";
import { curveAbi, erc20Abi, factoryAbi } from "@/lib/abi";
import { ensureArcChain } from "@/lib/wallet";

function injected(): EIP1193Provider | undefined {
  return (window as Window & { ethereum?: EIP1193Provider }).ethereum;
}

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
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<bigint>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string>();

  async function refresh() {
    if (!addresses.factory) {
      throw new Error("Factory address is not configured.");
    }

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

    const [tokenName, tokenSymbol, quoteRaised, quoteThreshold, isGraduated] =
      await Promise.all([
        client.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "name"
        }),
        client.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "symbol"
        }),
        client.readContract({
          address: curveAddress,
          abi: curveAbi,
          functionName: "trackedQuote"
        }),
        client.readContract({
          address: curveAddress,
          abi: curveAbi,
          functionName: "graduationThreshold"
        }),
        client.readContract({
          address: curveAddress,
          abi: curveAbi,
          functionName: "graduated"
        })
      ]);

    setName(String(tokenName));
    setSymbol(String(tokenSymbol));
    setRaised(quoteRaised as bigint);
    setThreshold(quoteThreshold as bigint);
    setGraduated(Boolean(isGraduated));
  }

  useEffect(() => {
    refresh().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load token.")
    );
  }, [token]);

  useEffect(() => {
    if (!curve || !amount || Number(amount) <= 0 || graduated) {
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
  }, [amount, side, curve, graduated, client]);

  async function trade() {
    setError(undefined);
    if (!curve || quote === undefined) return;

    const provider = injected();
    if (!provider) {
      setError("No EVM wallet detected.");
      return;
    }

    try {
      setStatus("Preparing");
      await ensureArcChain(provider);

      const accounts = (await provider.request({
        method: "eth_requestAccounts"
      })) as string[];
      if (!accounts[0]) throw new Error("No wallet account available.");

      const account = getAddress(accounts[0]);
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
        setStatus("Approve asset");
        const approveHash = await wallet.writeContract({
          address: asset,
          abi: erc20Abi,
          functionName: "approve",
          args: [curve, input]
        });
        await client.waitForTransactionReceipt({ hash: approveHash });
      }

      const minOut = (quote * 99n) / 100n;
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
    } catch (e) {
      setStatus("");
      setError(e instanceof Error ? e.message : "Trade failed.");
    }
  }

  const progress =
    threshold === 0n
      ? 0
      : Math.min(100, Number((raised * 10000n) / threshold) / 100);

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 20px" }}>
      <a href="/">Back</a>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,3fr) minmax(300px,1fr)",
          gap: 28,
          marginTop: 28
        }}
      >
        <section>
          <h1 style={{ marginBottom: 4 }}>
            {name || "Token"}{" "}
            {symbol && <span style={{ opacity: 0.5 }}>${symbol}</span>}
          </h1>
          <p style={{ opacity: 0.5, wordBreak: "break-all" }}>{token}</p>

          <div style={{ display: "flex", gap: 28, marginTop: 28 }}>
            <div>
              <div style={{ opacity: 0.55 }}>Raised</div>
              <strong>${Number(formatUnits(raised, 6)).toLocaleString()}</strong>
            </div>
            <div>
              <div style={{ opacity: 0.55 }}>Graduation</div>
              <strong>
                {graduated ? "Graduated" : progress.toFixed(1) + "%"}
              </strong>
            </div>
          </div>

          <div
            style={{
              marginTop: 28,
              border: "1px solid #29302c",
              borderRadius: 12,
              padding: 20,
              minHeight: 240
            }}
          >
            Trading history and chart require the indexer service. Core onchain
            trading works without it.
          </div>
        </section>

        <aside
          style={{
            border: "1px solid #29302c",
            borderRadius: 12,
            padding: 20,
            height: "fit-content"
          }}
        >
          {graduated ? (
            <p>
              Bonding curve trading is closed. DEX routing activates after the
              production graduation adapter is configured.
            </p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setSide("buy")}
                  style={{ opacity: side === "buy" ? 1 : 0.5 }}
                >
                  Buy
                </button>
                <button
                  onClick={() => setSide("sell")}
                  style={{ opacity: side === "sell" ? 1 : 0.5 }}
                >
                  Sell
                </button>
              </div>

              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ marginTop: 16 }}
                inputMode="decimal"
                placeholder={
                  side === "buy"
                    ? "0.00 USDC"
                    : "0.00 " + (symbol || "TOKEN")
                }
              />

              {quote !== undefined && (
                <p style={{ opacity: 0.65 }}>
                  Estimated:{" "}
                  {formatUnits(quote, side === "buy" ? 18 : 6)}{" "}
                  {side === "buy" ? symbol : "USDC"}
                </p>
              )}

              <button
                onClick={trade}
                disabled={quote === undefined}
                style={{ width: "100%", marginTop: 8 }}
              >
                {status || "Review trade"}
              </button>
            </>
          )}

          {error && (
            <p style={{ color: "#ff9d9d", wordBreak: "break-word" }}>{error}</p>
          )}
        </aside>
      </div>
    </main>
  );
}
