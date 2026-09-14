"use client";

import { useEffect, useState } from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { addresses, arcTestnet } from "@/lib/arc";
import { curveAbi, erc20Abi, factoryAbi } from "@/lib/abi";

type Launch = {
  token: `0x${string}`;
  curve: `0x${string}`;
  name: string;
  symbol: string;
  raised: bigint;
  threshold: bigint;
  graduated: boolean;
};

export function Launches() {
  const [items, setItems] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!addresses.factory) {
      setError("Factory is not deployed/configured yet.");
      setLoading(false);
      return;
    }

    const client = createPublicClient({
      chain: arcTestnet,
      transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network")
    });

    (async () => {
      try {
        const count = await client.readContract({
          address: addresses.factory!,
          abi: factoryAbi,
          functionName: "tokenCount"
        }) as bigint;

        const start = count > 50n ? count - 50n : 0n;
        const indices = Array.from({ length: Number(count - start) }, (_, i) => start + BigInt(i)).reverse();

        const launches = await Promise.all(indices.map(async (i) => {
          const token = await client.readContract({
            address: addresses.factory!,
            abi: factoryAbi,
            functionName: "allTokens",
            args: [i]
          }) as `0x${string}`;

          const curve = await client.readContract({
            address: addresses.factory!,
            abi: factoryAbi,
            functionName: "curveOf",
            args: [token]
          }) as `0x${string}`;

          const [name, symbol, raised, threshold, graduated] = await Promise.all([
            client.readContract({ address: token, abi: erc20Abi, functionName: "name" }),
            client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
            client.readContract({ address: curve, abi: curveAbi, functionName: "trackedQuote" }),
            client.readContract({ address: curve, abi: curveAbi, functionName: "graduationThreshold" }),
            client.readContract({ address: curve, abi: curveAbi, functionName: "graduated" })
          ]);

          return {
            token,
            curve,
            name: String(name),
            symbol: String(symbol),
            raised: raised as bigint,
            threshold: threshold as bigint,
            graduated: Boolean(graduated)
          };
        }));

        setItems(launches);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load launches.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p style={{ opacity: .65 }}>Loading launches...</p>;
  if (error) return <p style={{ opacity: .65 }}>{error}</p>;
  if (!items.length) return <p style={{ opacity: .65 }}>No launches yet.</p>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((item) => {
        const progress = item.threshold === 0n ? 0 : Math.min(100, Number(item.raised * 10000n / item.threshold) / 100);
        const raisedText = Number(formatUnits(item.raised, 6)).toLocaleString();
        return (
          <a key={item.token} href={"/token/" + item.token} style={{ border: "1px solid #29302c", borderRadius: 12, padding: 16, display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
            <div>
              <strong>{item.name} <span style={{ opacity: .55 }}>${item.symbol}</span></strong>
              <div style={{ opacity: .6, fontSize: 13, marginTop: 6 }}>{item.token.slice(0, 8)}...{item.token.slice(-6)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div>{item.graduated ? "Graduated" : progress.toFixed(1) + "%"}</div>
              <div style={{ opacity: .55, fontSize: 13 }}>${raisedText} raised</div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
