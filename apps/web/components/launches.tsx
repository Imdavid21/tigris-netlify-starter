"use client";

import { useEffect, useMemo, useState } from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { addresses, arcTestnet } from "@/lib/arc";
import { curveAbi, erc20Abi, factoryAbi } from "@/lib/abi";
import { API_URL } from "@/lib/api";

type Launch = {
  token: `0x${string}`;
  curve: `0x${string}`;
  name: string;
  symbol: string;
  raised: bigint;
  threshold: bigint;
  graduated: boolean;
  volume24h: bigint;
  lastTradeAt?: string;
};

type Sort = "activity" | "newest" | "graduation" | "volume";

export function Launches() {
  const [items, setItems] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("activity");

  useEffect(() => {
    if (!addresses.factory) {
      setError("Factory is not deployed/configured yet.");
      setLoading(false);
      return;
    }

    const client = createPublicClient({
      chain: arcTestnet,
      transport: http(
        process.env.NEXT_PUBLIC_ARC_RPC_URL ??
          "https://rpc.testnet.arc.network"
      )
    });

    (async () => {
      try {
        const indexed = await fetch(API_URL + "/tokens?limit=100")
          .then((r) => (r.ok ? r.json() : { items: [] }))
          .catch(() => ({ items: [] }));

        const indexedMap = new Map<string, any>(
          (indexed.items ?? []).map((x: any) => [String(x.address).toLowerCase(), x])
        );

        const count = (await client.readContract({
          address: addresses.factory!,
          abi: factoryAbi,
          functionName: "tokenCount"
        })) as bigint;

        const start = count > 100n ? count - 100n : 0n;
        const indices = Array.from(
          { length: Number(count - start) },
          (_, i) => start + BigInt(i)
        ).reverse();

        const launches = await Promise.all(
          indices.map(async (i) => {
            const token = (await client.readContract({
              address: addresses.factory!,
              abi: factoryAbi,
              functionName: "allTokens",
              args: [i]
            })) as `0x${string}`;

            const curve = (await client.readContract({
              address: addresses.factory!,
              abi: factoryAbi,
              functionName: "curveOf",
              args: [token]
            })) as `0x${string}`;

            const [name, symbol, raised, threshold, graduated] =
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
                  address: curve,
                  abi: curveAbi,
                  functionName: "trackedQuote"
                }),
                client.readContract({
                  address: curve,
                  abi: curveAbi,
                  functionName: "graduationThreshold"
                }),
                client.readContract({
                  address: curve,
                  abi: curveAbi,
                  functionName: "graduated"
                })
              ]);

            const ix = indexedMap.get(token.toLowerCase());

            return {
              token,
              curve,
              name: String(name),
              symbol: String(symbol),
              raised: raised as bigint,
              threshold: threshold as bigint,
              graduated: Boolean(graduated),
              volume24h: BigInt(ix?.volume_24h ?? "0"),
              lastTradeAt: ix?.last_trade_at ?? undefined
            };
          })
        );

        setItems(launches);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to load launches."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = !q
      ? items
      : items.filter(
          (x) =>
            x.name.toLowerCase().includes(q) ||
            x.symbol.toLowerCase().includes(q) ||
            x.token.toLowerCase().includes(q)
        );

    return [...filtered].sort((a, b) => {
      if (sort === "volume") {
        return a.volume24h === b.volume24h
          ? 0
          : a.volume24h > b.volume24h
            ? -1
            : 1;
      }

      if (sort === "graduation") {
        const ap = a.threshold ? (a.raised * 10000n) / a.threshold : 0n;
        const bp = b.threshold ? (b.raised * 10000n) / b.threshold : 0n;
        return ap === bp ? 0 : ap > bp ? -1 : 1;
      }

      if (sort === "activity") {
        return String(b.lastTradeAt ?? "").localeCompare(
          String(a.lastTradeAt ?? "")
        );
      }

      return 0;
    });
  }, [items, query, sort]);

  if (loading) return <p className="muted">Loading launches...</p>;
  if (error) return <p className="muted">{error}</p>;

  return (
    <div>
      <div className="market-toolbar">
        <input
          aria-label="Search tokens"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, ticker, or address"
        />

        <div className="segmented">
          {(
            [
              ["activity", "Recent"],
              ["newest", "Newest"],
              ["graduation", "Graduation"],
              ["volume", "24h volume"]
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={sort === value ? "active" : ""}
              onClick={() => setSort(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!visible.length ? (
        <div className="empty-state">
          <strong>{items.length ? "No matching tokens" : "No launches yet"}</strong>
          <span>
            {items.length
              ? "Try another name, ticker, or contract address."
              : "The first Arc launch will appear here automatically."}
          </span>
        </div>
      ) : (
        <div className="launch-list">
          <div className="launch-list-head">
            <span>Token</span>
            <span>Phase</span>
            <span>Raised</span>
            <span>24h volume</span>
          </div>

          {visible.map((item) => {
            const progress =
              item.threshold === 0n
                ? 0
                : Math.min(
                    100,
                    Number((item.raised * 10000n) / item.threshold) / 100
                  );

            return (
              <a
                key={item.token}
                href={"/token/" + item.token}
                className="launch-row"
              >
                <div>
                  <strong>
                    {item.name}{" "}
                    <span className="muted">${item.symbol}</span>
                  </strong>
                  <span className="address-line">
                    {item.token.slice(0, 8)}...{item.token.slice(-6)}
                  </span>
                </div>

                <div>
                  <span className="phase-pill">
                    {item.graduated
                      ? "Graduated"
                      : progress.toFixed(1) + "%"}
                  </span>
                </div>

                <div>
                  ${Number(formatUnits(item.raised, 6)).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 }
                  )}
                </div>

                <div>
                  ${Number(formatUnits(item.volume24h, 6)).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 }
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
