"use client";

import { useEffect, useMemo, useState } from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { arcTestnet } from "@/lib/arc";
import { curveAbi } from "@/lib/abi";
import { API_URL } from "@/lib/api";

type IndexedLaunch = {
  address: `0x${string}`;
  curve_address: `0x${string}`;
  name: string;
  symbol: string;
  status: string;
  generation?: string;
  quote_asset?: `0x${string}` | null;
  image?: string | null;
  volume_24h?: string;
  trades_24h?: number;
  last_trade_at?: string | null;
  created_at?: string;
};

type Launch = IndexedLaunch & {
  raised?: bigint;
  threshold?: bigint;
};

type Sort = "activity" | "newest" | "graduation" | "volume";

const QUOTE_DECIMALS: Record<string, number> = {
  "0x3600000000000000000000000000000000000000": 6,
  "0x89b50855aa3be2f677cd6303cec089b5f319d72a": 6,
  "0xf0c4a4ce82a5746abaad9425360ab04fbba432bf": 8
};

function decimals(item: Launch) {
  return item.quote_asset ? QUOTE_DECIMALS[item.quote_asset.toLowerCase()] ?? 6 : 6;
}

function money(value: bigint | string | undefined, d = 6) {
  if (value === undefined) return "—";
  try {
    const n = Number(formatUnits(BigInt(value), d));
    if (!Number.isFinite(n)) return "—";
    if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
    if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
    return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  } catch {
    return "—";
  }
}

function progress(item: Launch) {
  if (item.status === "GRADUATED") return 100;
  if (!item.raised || !item.threshold || item.threshold === 0n) return 0;
  return Math.min(100, Number((item.raised * 10_000n) / item.threshold) / 100);
}

function age(value?: string | null) {
  if (!value) return "";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

function TokenImage({ item }: { item: Launch }) {
  if (item.image) {
    return <img className="market-card-image" src={item.image} alt="" />;
  }
  return (
    <div className="market-card-image market-card-fallback" aria-hidden="true">
      {item.symbol?.slice(0, 2).toUpperCase() || "✦"}
    </div>
  );
}

function MarketCard({ item, graduated = false }: { item: Launch; graduated?: boolean }) {
  const pct = progress(item);
  const d = decimals(item);
  return (
    <a href={"/token/" + item.address} className="market-card">
      <div className="market-card-media">
        <TokenImage item={item} />
        <span className={"market-version " + (graduated ? "graduated" : "")}>
          {graduated ? "Graduated" : item.generation === "CELESTIAL" ? "C" : "V1"}
        </span>
      </div>
      <div className="market-card-body">
        <div className="market-card-title">
          <strong>{item.name}</strong>
          <span>{item.symbol}</span>
        </div>
        <div className="market-card-value">{money(item.volume_24h ?? "0", d)}</div>
        <div className="market-card-meta">
          <span>{Number(item.trades_24h ?? 0).toLocaleString()} trades</span>
          <span>{age(item.last_trade_at ?? item.created_at)}</span>
        </div>
        {!graduated && (
          <div className="market-progress">
            <div style={{ width: pct + "%" }} />
          </div>
        )}
        <div className="market-card-foot">
          <span>{item.address.slice(0, 6)}...{item.address.slice(-4)}</span>
          <span>{graduated ? "DEX" : pct ? pct.toFixed(0) + "%" : "Live"}</span>
        </div>
      </div>
    </a>
  );
}

export function Launches() {
  const [items, setItems] = useState<Launch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("activity");
  const [windowFilter, setWindowFilter] = useState<"all" | "24h" | "7d">("all");

  useEffect(() => {
    const client = createPublicClient({
      chain: arcTestnet,
      transport: http(process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network")
    });

    (async () => {
      try {
        const response = await fetch(API_URL + "/tokens?limit=100");
        if (!response.ok) throw new Error("Market index is temporarily unavailable.");
        const payload = await response.json();
        const indexed = (payload.items ?? []) as IndexedLaunch[];

        const enriched = await Promise.all(
          indexed.map(async (item): Promise<Launch> => {
            if (!item.curve_address || item.status === "GRADUATED") return item;
            try {
              const [raised, threshold] = await Promise.all([
                client.readContract({
                  address: item.curve_address,
                  abi: curveAbi,
                  functionName: "trackedQuote"
                }),
                client.readContract({
                  address: item.curve_address,
                  abi: curveAbi,
                  functionName: "graduationThreshold"
                })
              ]);
              return { ...item, raised: raised as bigint, threshold: threshold as bigint };
            } catch {
              return item;
            }
          })
        );

        setItems(enriched);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load markets.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const cutoff = windowFilter === "24h" ? now - 86_400_000 : windowFilter === "7d" ? now - 604_800_000 : 0;

    const matches = items.filter((x) => {
      const matchQuery =
        !q ||
        x.name.toLowerCase().includes(q) ||
        x.symbol.toLowerCase().includes(q) ||
        x.address.toLowerCase().includes(q);
      const time = new Date(x.last_trade_at ?? x.created_at ?? 0).getTime();
      return matchQuery && (!cutoff || time >= cutoff);
    });

    return [...matches].sort((a, b) => {
      if (sort === "volume") return BigInt(b.volume_24h ?? "0") > BigInt(a.volume_24h ?? "0") ? 1 : -1;
      if (sort === "graduation") return progress(b) - progress(a);
      if (sort === "newest") return String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
      return String(b.last_trade_at ?? b.created_at ?? "").localeCompare(String(a.last_trade_at ?? a.created_at ?? ""));
    });
  }, [items, query, sort, windowFilter]);

  const graduated = filtered.filter((x) => x.status === "GRADUATED").slice(0, 10);
  const live = filtered.filter((x) => x.status !== "GRADUATED");

  if (loading) {
    return <div className="market-loading">Loading Celestial markets...</div>;
  }

  return (
    <div className="explore-surface">
      {error && (
        <div className="system-notice">
          <strong>Market index degraded</strong>
          <span>{error} Onchain trading can remain available from individual market pages.</span>
        </div>
      )}

      <div className="market-toolbar dense">
        <div className="market-search-wrap">
          <span>⌕</span>
          <input
            aria-label="Search tokens"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tokens"
          />
        </div>
        <div className="market-toolbar-actions">
          <div className="segmented">
            {([
              ["activity", "Recent buys"],
              ["newest", "Newest"],
              ["graduation", "Market cap"],
              ["volume", "Volume"]
            ] as const).map(([value, label]) => (
              <button key={value} className={sort === value ? "active" : ""} onClick={() => setSort(value)}>
                {label}
              </button>
            ))}
          </div>
          <div className="segmented compact-segment">
            {(["all", "24h", "7d"] as const).map((value) => (
              <button key={value} className={windowFilter === value ? "active" : ""} onClick={() => setWindowFilter(value)}>
                {value === "all" ? "All" : value}
              </button>
            ))}
          </div>
        </div>
      </div>

      {graduated.length > 0 && (
        <section className="market-section graduated-section">
          <div className="market-section-head">
            <div>
              <h2>Graduated <span>{graduated.length}</span></h2>
              <p>Markets that cleared the graduation threshold.</p>
            </div>
          </div>
          <div className="graduated-grid">
            {graduated.map((item) => <MarketCard item={item} graduated key={item.address} />)}
          </div>
        </section>
      )}

      <section className="market-section explore-grid-section">
        <div className="market-section-head">
          <div>
            <h2>Explore <span>{live.length}</span></h2>
            <p>Live markets on Arc. Trade terms and execution are read from contracts.</p>
          </div>
          <a href="/create" className="secondary-link compact-link">+ Create</a>
        </div>

        {!live.length ? (
          <div className="empty-state">
            <strong>{items.length ? "No matching markets" : "No live markets yet"}</strong>
            <span>{items.length ? "Try another search or time range." : "New launches will appear here automatically."}</span>
          </div>
        ) : (
          <div className="market-card-grid">
            {live.map((item) => <MarketCard item={item} key={item.address} />)}
          </div>
        )}
      </section>
    </div>
  );
}
